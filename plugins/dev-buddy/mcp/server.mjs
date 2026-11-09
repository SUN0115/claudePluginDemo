// 最小的 MCP server，不用任何套件，示範 MCP 的本質：JSON 一來一往。
//
// 傳輸方式：stdio
//   - Claude Code 把這支程式當子行程啟動
//   - Claude Code 寫入我們的 stdin，我們寫到 stdout 回應
//   - 每則訊息是一行 JSON（JSON-RPC 2.0 格式）
//   - stdout 只能放協定訊息！要印除錯資訊請用 stderr
//
// 一次連線的流程：
//   Claude → initialize               我們 → 回報版本與能力（我們有 tools）
//   Claude → notifications/initialized（通知，不用回）
//   Claude → tools/list               我們 → 回傳工具清單
//   Claude → tools/call               我們 → 執行工具並回傳結果

import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

// > 工具定義：AI 會看 name、description 決定要不要用，inputSchema 說明參數格式
const TOOLS = [
	{
		name: 'uuid',
		description: '產生一個或多個隨機 UUID v4。',
		inputSchema: {
			type: 'object',
			properties: {
				count: { type: 'integer', minimum: 1, maximum: 20, description: '要產生幾個，預設 1' },
			},
		},
		run: ({ count = 1 } = {}) => {
			const n = Math.min(Math.max(Number(count) || 1, 1), 20);
			return Array.from({ length: n }, () => randomUUID()).join('\n');
		},
	},
	{
		name: 'taipei_time',
		description: '取得台北（Asia/Taipei）現在的日期與時間。',
		inputSchema: { type: 'object', properties: {} },
		run: () =>
			new Date().toLocaleString('zh-TW', {
				timeZone: 'Asia/Taipei',
				dateStyle: 'full',
				timeStyle: 'medium',
				hour12: false,
			}),
	},
];

function send(message) {
	process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
}

// > 依 method 分派。回傳 result 物件；丟出錯誤則回傳 JSON-RPC error
function handle(method, params = {}) {
	switch (method) {
		case 'initialize':
			return {
				// 直接沿用 client 要求的協定版本
				protocolVersion: params.protocolVersion ?? '2025-06-18',
				capabilities: { tools: {} },
				serverInfo: { name: 'dev-tools', version: '0.1.0' },
			};

		case 'ping':
			return {};

		case 'tools/list':
			// 只回傳協定需要的欄位，不把 run 函式送出去
			return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };

		case 'tools/call': {
			const tool = TOOLS.find((t) => t.name === params.name);
			if (!tool) {
				// 工具不存在屬於協定層錯誤
				throw Object.assign(new Error(`找不到工具：${params.name}`), { code: -32602 });
			}
			try {
				return { content: [{ type: 'text', text: tool.run(params.arguments) }] };
			} catch (err) {
				// 工具執行失敗不算協定錯誤，用 isError 告訴 AI
				return { content: [{ type: 'text', text: `執行失敗：${err.message}` }], isError: true };
			}
		}

		default:
			throw Object.assign(new Error(`不支援的 method：${method}`), { code: -32601 });
	}
}

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
	if (!line.trim()) return;

	let msg;
	try {
		msg = JSON.parse(line);
	} catch {
		send({ id: null, error: { code: -32700, message: 'JSON 格式錯誤' } });
		return;
	}

	// 沒有 id 的是「通知」（例如 notifications/initialized），規定不能回應
	const isNotification = msg.id === undefined;

	try {
		const result = handle(msg.method, msg.params);
		if (!isNotification) send({ id: msg.id, result });
	} catch (err) {
		if (isNotification) return;
		send({ id: msg.id, error: { code: err.code ?? -32603, message: err.message } });
	}
});
