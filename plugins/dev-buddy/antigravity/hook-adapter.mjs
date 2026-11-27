// @ Antigravity hook 轉接器：讓原本為 Claude Code 寫的 hook 腳本，不改一行就能在 Antigravity 執行。
//
// 用法（寫在 plugin 根目錄的 hooks.json）：
//   node ./antigravity/hook-adapter.mjs <事件> <腳本1> [腳本2 ...]
//   事件：pre = PreToolUse、post = PostToolUse、session = SessionStart、flush = PostInvocation（不帶腳本）
//
// 兩邊協定差異（轉接器負責翻譯）：
//   輸入  Claude：{ tool_name: "Bash", tool_input: { command } }
//         Antigravity：{ toolCall: { name: "run_command", args: { CommandLine } }, workspacePaths: [...] }
//   擋下  Claude：exit 2 + stderr
//         Antigravity：一定要 exit 0，stdout 印 {"decision":"deny","reason":"..."}；非 0 會被忽略＝放行
//   注入  Claude：SessionStart 的 stdout 直接進上下文
//         Antigravity：stdout 印 {"injectSteps":[{"systemMessage":{"systemMessage":"..."}}]}
//   回饋  Claude：PostToolUse 用 exit 2 + stderr 把警告交給 AI
//         Antigravity：PostToolUse 只能回 {}，所以先把警告存進佇列檔，
//                      再由 PostInvocation（flush）在該輪結束時注入並要求模型繼續處理
//
// !! 本檔在 my-claude-kit 與 fullstack-dev-kit 各有一份，修改時兩邊要同步。

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_NAME = PLUGIN_ROOT.split(/[\\/]/).pop();
// !! 單支腳本上限 × 同一行串接的腳本數，必須小於 hooks.json 的 timeout（秒），否則整個 hook 逾時＝放行
const SCRIPT_TIMEOUT_MS = 18_000;

// - Antigravity 工具名 → Claude Code 工具名與輸入欄位
// ?? 同一個 Antigravity，IDE 與 CLI（agy）的檔案工具名不同：IDE 用 view_file／write_to_file，CLI 用 read_file／write_file（2026-11 實測 agy 1.3.6）
const TOOL_MAP = {
	run_command: (a) => ({ tool_name: 'Bash', tool_input: { command: a.CommandLine ?? '' } }),
	// > CLI
	read_file: (a) => ({ tool_name: 'Read', tool_input: { file_path: a.Path ?? '' } }),
	write_file: (a) => ({ tool_name: 'Write', tool_input: { file_path: a.Path ?? '' } }),
	edit_file: (a) => ({ tool_name: 'Edit', tool_input: { file_path: a.Path ?? '' } }),
	// > IDE
	view_file: (a) => ({ tool_name: 'Read', tool_input: { file_path: a.AbsolutePath ?? '' } }),
	find_by_name: (a) => ({ tool_name: 'Glob', tool_input: { pattern: a.Pattern ?? '', path: a.SearchDirectory ?? '' } }),
	write_to_file: (a) => ({ tool_name: 'Write', tool_input: { file_path: a.TargetFile ?? '' } }),
	replace_file_content: (a) => ({ tool_name: 'Edit', tool_input: { file_path: a.TargetFile ?? '' } }),
	multi_replace_file_content: (a) => ({ tool_name: 'Edit', tool_input: { file_path: a.TargetFile ?? '' } }),
};

// 純函式：把 Antigravity 的 hook 輸入翻成 Claude Code 格式；不認得的工具回傳 null。
export function toClaudeInput(input) {
	const name = input?.toolCall?.name;
	const map = TOOL_MAP[name];
	if (!map) return null;
	return { hook_event_name: 'PreToolUse', ...map(input.toolCall.args ?? {}) };
}

// 純函式：依事件與各腳本結果，組出 Antigravity 要的 stdout JSON。
//   results：[{ code, stdout, stderr }]
export function toAntigravityOutput(event, results) {
	if (event === 'pre') {
		const blocked = results.find((r) => r.code === 2);
		// !! 放行一定要明確回 allow：回 {} 時 Antigravity 會把 subagent 的工具呼叫當成被 hook 拒絕（2026-11 實測 agy 1.3.6）
		//    allow 只代表 hook 不反對，之後仍走一般權限確認；不要用 auto_approve
		return blocked ? { decision: 'deny', reason: blocked.stderr.trim() || '已被 hook 擋下' } : { decision: 'allow' };
	}
	// > post：Claude 用 exit 2 + stderr 回饋給 AI；session：Claude 用 stdout 注入上下文
	const texts = results
		.map((r) => (event === 'post' ? (r.code === 2 ? r.stderr : '') : r.stdout).trim())
		.filter(Boolean);
	if (texts.length === 0) return {};
	return { injectSteps: [{ systemMessage: { systemMessage: texts.join('\n\n') } }] };
}

// - PostToolUse 警告佇列：每個對話、每個 plugin 一個檔，避免多個 plugin 互相清掉對方的訊息
function queueFile(conversationId) {
	const safeId = String(conversationId ?? 'unknown').replace(/[^\w-]/g, '_');
	return join(tmpdir(), `agy-hook-queue-${PLUGIN_NAME}-${safeId}.txt`);
}

function enqueue(conversationId, text) {
	appendFileSync(queueFile(conversationId), text.trim() + '\n\n\u0000');
}

// 先改名再讀，避免與同時寫入的 PostToolUse 搶同一個檔
function drain(conversationId) {
	const file = queueFile(conversationId);
	if (!existsSync(file)) return [];
	const taken = `${file}.${process.pid}`;
	try {
		renameSync(file, taken);
		const items = readFileSync(taken, 'utf8').split('\u0000').map((s) => s.trim()).filter(Boolean);
		unlinkSync(taken);
		return items;
	} catch {
		return [];
	}
}

// ?? Windows 上 PATH 裡的 bash 可能是 WSL 的 System32\bash.exe，所以優先找 Git Bash。
function findBash() {
	if (process.platform !== 'win32') return 'bash';
	const candidates = [
		process.env.GIT_BASH,
		'C:\\Program Files\\Git\\bin\\bash.exe',
		'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
		process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
	].filter(Boolean);
	return candidates.find((p) => existsSync(p)) ?? 'bash';
}

function runScript(script, stdinText, cwd) {
	const path = resolve(PLUGIN_ROOT, script);
	const isNode = ['.mjs', '.js', '.cjs'].includes(extname(path));
	const [cmd, args] = isNode ? [process.execPath, [path]] : [findBash(), [path.replace(/\\/g, '/')]];
	const r = spawnSync(cmd, args, {
		input: stdinText,
		cwd,
		encoding: 'utf8',
		timeout: SCRIPT_TIMEOUT_MS,
		// > 讓沿用 ${CLAUDE_PLUGIN_ROOT} 的腳本也找得到自己的檔案
		env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
	});
	return { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? r.error?.message ?? '' };
}

function debugLog(entry) {
	const file = process.env.AGY_HOOK_DEBUG;
	if (!file) return;
	try {
		appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n');
	} catch {
		// 除錯紀錄寫不進去不影響 hook 本身
	}
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
}

async function main() {
	const [event, ...scripts] = process.argv.slice(2);
	let output = {};
	try {
		const raw = await readStdin();
		const input = raw.trim() ? JSON.parse(raw) : {};
		const workspace = input.workspacePaths?.[0] ?? process.cwd();

		if (event === 'flush') {
			const items = drain(input.conversationId);
			// > 有警告才要求模型繼續；沒有就什麼都不做，避免無限迴圈
			output = items.length
				? { injectSteps: [{ systemMessage: { systemMessage: items.join('\n\n') } }], terminationBehavior: 'force_continue' }
				: {};
			debugLog({ event, input, output });
			process.stdout.write(JSON.stringify(output));
			process.exit(0);
		}

		let claudeInput = { hook_event_name: 'SessionStart', cwd: workspace };
		let cwd = workspace;

		if (event === 'pre' || event === 'post') {
			claudeInput = toClaudeInput(input);
			// > 不認得的工具直接放行，避免誤擋
			if (claudeInput) {
				claudeInput.cwd = workspace;
				if (event === 'post') claudeInput.hook_event_name = 'PostToolUse';
				cwd = input.toolCall?.args?.Cwd || workspace;
			}
		}

		const results = [];
		if (claudeInput) {
			for (const script of scripts) {
				const r = runScript(script, JSON.stringify(claudeInput), existsSync(cwd) ? cwd : PLUGIN_ROOT);
				results.push(r);
				// > 與 Claude Code 相同：PreToolUse 只要有一支擋下就不再往下跑
				if (event === 'pre' && r.code === 2) break;
			}
		}
		output = toAntigravityOutput(event, results);
		if (event === 'post') {
			const text = output.injectSteps?.[0]?.systemMessage?.systemMessage;
			if (text) enqueue(input.conversationId, text);
			output = {};
		}
		debugLog({ event, scripts, input, claudeInput, results, output });
	} catch (err) {
		// !! 轉接器自己出錯時只能放行（Antigravity 本來就 fail open），但留下紀錄方便查
		debugLog({ event, scripts, error: String(err?.stack ?? err) });
	}
	process.stdout.write(JSON.stringify(output));
	process.exit(0);
}

// 只有直接執行時才跑 main；被測試 import 時不會跑
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
