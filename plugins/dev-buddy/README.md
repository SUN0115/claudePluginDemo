# dev-buddy

練習用的 Claude Code plugin，用最小的例子示範一個 plugin 能包含的 5 種零件：

- **Skill** `issue-start`、`issue-finish`：處理一張 GitHub issue 的開工與收尾流程（只能由你輸入指令觸發）。commit message 改用 `workflow-core:git-commit`
- **Slash command** `/dev-buddy:explain <檔案>`：用白話解說指定檔案
- **Subagent** `reviewer`：只能讀檔的程式碼審查員
- **Hooks**：開場注入規則；執行 `git push --force`、`git reset --hard`、`rm -rf` 前擋下
- **MCP server** `dev-tools`：提供 `uuid` 與 `taipei_time` 兩個工具

需要 Node.js 18 以上，不需要安裝任何套件。安裝方式與試用清單請看 repo 根目錄的 README。
