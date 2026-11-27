# dev-buddy

練習用的 Claude Code plugin，用最小的例子示範一個 plugin 能包含的 5 種零件：

- **Skill** `issue-start`、`issue-finish`：處理一張 GitHub issue 的開工與收尾流程（只能由你輸入指令觸發）。
	- `issue-start` 以 `effort: high` 執行：寫測試、E2E 在驗收點截圖、完整檢查只跑一次，並在 `.git/dev-buddy/` 記錄工作區指紋。
	- `issue-finish` 以 `effort: medium` 執行：指紋沒變就沿用 issue-start 的測試結果與截圖；審查只在主對話用 `workflow-core:code-review` 做一次。
	- `effort` 只作用在輸入指令的那一回合。之後的回合（例如確認計畫後的實作）使用 session 的 effort。
	- commit message 改用 `workflow-core:git-commit`。
- **Slash command** `/dev-buddy:explain <檔案>`：用白話解說指定檔案
- **Subagent** `reviewer`：只能讀檔的程式碼審查員（需點名「dev-buddy reviewer」才使用，一般審查用 `workflow-core:code-reviewer`）
- **Hooks**：開場注入規則；執行 `git push --force`、`git reset --hard`、`rm -rf` 前擋下
- **MCP server** `dev-tools`：提供 `uuid` 與 `taipei_time` 兩個工具

需要 Node.js 18 以上，不需要安裝任何套件。安裝方式與試用清單請看 repo 根目錄的 README。
