// PreToolUse hook：AI 每次要執行 Bash 指令「之前」都會先跑這支程式。
//
// 運作方式：
//   1. Claude Code 把這次要做的事用 JSON 從 stdin 傳進來，例如：
//      { "tool_name": "Bash", "tool_input": { "command": "git push --force" } }
//   2. 我們檢查 command 是否危險。
//   3. 用 exit code 回答 Claude Code：
//      - exit 0：放行
//      - exit 2：擋下，並把 stderr 的內容告訴 AI（AI 就知道為什麼被擋）
//      - 其他：當作「hook 自己出錯」，不會擋，只顯示警告。所以擋下一定要用 2！

import { pathToFileURL } from 'node:url';

// 每條規則：名稱 + 判斷函式 + 被擋時給 AI 看的原因
const RULES = [
	{
		name: 'force-push',
		// 擋 --force 和 -f，但放行比較安全的 --force-with-lease
		test: (cmd) => /\bgit\s+push\b/.test(cmd) && /\s(--force(?!-with-lease)|-f)(\s|$)/.test(cmd),
		reason: 'git push --force 會覆蓋遠端歷史，可能弄丟別人的提交。若真的需要，可改用 --force-with-lease，或請使用者自己執行。',
	},
	{
		name: 'reset-hard',
		test: (cmd) => /\bgit\s+reset\b.*\s--hard\b/.test(cmd),
		reason: 'git reset --hard 會永久丟棄未提交的變更。請先用 git stash 保存，或請使用者自己執行。',
	},
	{
		name: 'rm-recursive-force',
		test: (cmd) => hasRmRecursiveForce(cmd),
		reason: 'rm 同時帶有遞迴與強制參數（例如 -rf），刪錯就救不回來。請改成刪除明確的單一檔案，或請使用者自己執行。',
	},
];

// 判斷 rm 指令是否同時有「遞迴」和「強制」參數。
// 不只看 -rf，也能抓到 -r -f、-fr、-Rf、--recursive --force 這些寫法。
function hasRmRecursiveForce(cmd) {
	// 用 ; && || | 把複合指令切開，逐段檢查
	for (const part of cmd.split(/;|&&|\|\||\|/)) {
		const tokens = part.trim().split(/\s+/);
		const rmIndex = tokens.findIndex((t) => t === 'rm' || t.endsWith('/rm'));
		if (rmIndex === -1) continue;

		let recursive = false;
		let force = false;
		for (const t of tokens.slice(rmIndex + 1)) {
			if (t === '--recursive') recursive = true;
			else if (t === '--force') force = true;
			else if (/^-[a-zA-Z]+$/.test(t)) {
				if (/[rR]/.test(t)) recursive = true;
				if (/f/.test(t)) force = true;
			}
		}
		if (recursive && force) return true;
	}
	return false;
}

// 純函式：方便測試。回傳命中的規則，沒命中回傳 null。
export function check(command) {
	return RULES.find((rule) => rule.test(command)) ?? null;
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
}

async function main() {
	let command = '';
	try {
		const input = JSON.parse(await readStdin());
		command = input?.tool_input?.command ?? '';
	} catch {
		// 讀不懂輸入就放行（fail-open），避免 hook 壞掉時卡住使用者
		process.exit(0);
	}

	const hit = check(command);
	if (!hit) process.exit(0);

	// 被擋：原因寫到 stderr，再用 exit 2，AI 才看得到這段訊息
	process.stderr.write(`[dev-buddy] 已擋下指令（規則：${hit.name}）\n指令：${command}\n原因：${hit.reason}\n`);
	process.exit(2);
}

// 只有「直接執行這支檔案」時才跑 main；被測試 import 時不會跑
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
