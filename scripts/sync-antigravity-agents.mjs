// @ 由 Claude Code agent（唯一來源）產生 Antigravity agent，避免兩份內容各改各的。
//
// 為什麼要兩份：
//   - Antigravity 只讀 plugin 的 agents/，且 tools 必須是它自己的工具名，寫錯名稱 subagent 會啟動失敗。
//   - Claude Code 的 .claude-plugin/plugin.json 設了 "agents" 就不再掃 agents/，所以 Claude 版放在 claude-agents/。
//
// 用法：
//   node scripts/sync-antigravity-agents.mjs           # 重新產生 plugins/*/agents/*.md
//   node scripts/sync-antigravity-agents.mjs --check   # 只檢查是否同步，不同步時 exit 1（適合 CI）
//
// !! 本檔在 my-claude-kit 與 fullstack-dev-kit 各有一份，修改時兩邊要同步。

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const MARKER = '<!-- 自動產生：請改 claude-agents/ 的原始檔，再執行 node scripts/sync-antigravity-agents.mjs -->';

// - Claude Code 工具名 → Antigravity 工具名
// ?? 用 IDE 文件的名稱；agy CLI 會把它們對應到自己的工具（例如 view_file → read_file）。
//    同一份清單不可同時寫 view_file 與 read_file，否則 Antigravity 會報「tool name conflict」（2026-11 實測 agy 1.3.6）
const TOOL_MAP = {
	Read: ['view_file'],
	Glob: ['find_by_name', 'list_dir'],
	Grep: ['grep_search'],
	Bash: ['run_command'],
	Write: ['write_to_file'],
	Edit: ['replace_file_content', 'multi_replace_file_content'],
};

// 純函式：把一份 Claude agent 轉成 Antigravity agent 的完整內容。
function toAntigravityAgent(source, sourceLabel) {
	const text = source.replace(/\r\n/g, '\n');
	const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) throw new Error(`${sourceLabel}：找不到 frontmatter`);
	const [, frontmatter, body] = match;

	const toolsLine = frontmatter.match(/^tools:[ \t]*(.*)$/m);
	let frontmatterOut = frontmatter;
	let mapping = '';
	if (toolsLine) {
		const claudeTools = toolsLine[1].replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
		const unknown = claudeTools.filter((t) => !TOOL_MAP[t]);
		if (unknown.length) throw new Error(`${sourceLabel}：沒有對應的 Antigravity 工具：${unknown.join(', ')}（請補 TOOL_MAP）`);
		const agyTools = [...new Set(claudeTools.flatMap((t) => TOOL_MAP[t]))];
		frontmatterOut = frontmatter.replace(toolsLine[0], `tools: [${agyTools.join(', ')}]`);
		mapping = claudeTools.map((t) => `${t} → ${TOOL_MAP[t].join('／')}`).join('、');
	}
	// > 內文仍用 Claude 的工具名描述做法，補一行對照讓 Antigravity 的模型看得懂
	const note = mapping ? `\n${MARKER}\n> 下文提到的工具名稱對照：${mapping}。\n` : `\n${MARKER}\n`;
	return `---\n${frontmatterOut}\n---\n${note}\n${body.replace(/^\n+/, '')}`;
}

function pluginDirs() {
	const base = join(ROOT, 'plugins');
	return readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(base, e.name));
}

let drift = 0;
for (const dir of pluginDirs()) {
	const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
	if (!existsSync(manifestPath)) continue;
	const sources = JSON.parse(readFileSync(manifestPath, 'utf8')).agents;
	if (!sources) continue;
	const outDir = join(dir, 'agents');
	const expected = new Map();
	for (const src of [].concat(sources)) {
		const srcPath = resolve(dir, src);
		const label = relative(ROOT, srcPath);
		expected.set(join(outDir, basename(srcPath)), toAntigravityAgent(readFileSync(srcPath, 'utf8'), label));
	}
	// - 移除已沒有原始檔、但帶有自動產生標記的舊檔
	const stale = existsSync(outDir)
		? readdirSync(outDir).filter((f) => f.endsWith('.md')).map((f) => join(outDir, f))
			.filter((f) => !expected.has(f) && readFileSync(f, 'utf8').includes(MARKER))
		: [];

	for (const [path, content] of expected) {
		const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
		if (current === content) continue;
		drift++;
		if (CHECK) console.error(`未同步：${relative(ROOT, path)}`);
		else {
			mkdirSync(outDir, { recursive: true });
			writeFileSync(path, content);
			console.log(`已產生：${relative(ROOT, path)}`);
		}
	}
	for (const path of stale) {
		drift++;
		if (CHECK) console.error(`多餘：${relative(ROOT, path)}`);
		else {
			unlinkSync(path);
			console.log(`已移除：${relative(ROOT, path)}`);
		}
	}
}

if (CHECK && drift) {
	console.error('Antigravity agents 與 claude-agents 不同步，請執行 node scripts/sync-antigravity-agents.mjs');
	process.exitCode = 1;
} else if (!drift) {
	console.log('Antigravity agents 已是最新。');
}
