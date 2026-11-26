// SessionStart hook：每次開新對話時執行一次。
//
// 規則：SessionStart hook 印到 stdout 的文字，Claude Code 會直接放進 AI 的上下文。
// 所以這裡印什麼，AI 一開場就「知道」什麼，效果類似自動多一份 CLAUDE.md。

const message = `
[dev-buddy] 已載入練習用 plugin。請遵守以下規則：
1. 回答一律使用繁體中文。
2. 每次修改程式碼後，用一句話說明「改了什麼、為什麼改」。
`;

process.stdout.write(message.trim() + '\n');

// exit 0 = 正常結束。SessionStart 沒有東西可以擋，所以永遠是 0。
process.exit(0);


