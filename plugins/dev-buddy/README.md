# dev-buddy

GitHub issue 的開工與收尾工作流 plugin，搭配 fullstack-dev-kit 的 `workflow-core` 使用。

- **Skill** `issue-start`、`issue-finish`：只能由你輸入指令觸發。
	- `issue-start`：讀 issue、草擬驗收條件，與實作計畫一起確認一次；實作、寫測試，E2E 只在最後跑一次並在驗收點截圖；在 `.git/dev-buddy/` 記錄工作區指紋。
	- `issue-finish`：指紋沒變就沿用 issue-start 的測試結果與截圖；審查只在主對話用 `workflow-core:code-review` 做一次；commit message 依 `workflow-core:git-workflow` 格式；push 後開 PR。
	- 已啟用的 pre-push hook 會跑的檢查，不在 skill 內重跑。
	- 目前目錄不是 git repo 時（多個 repo 並列的工作區），先選定 issue 所屬的子 repo。
	- `effort` 只作用在輸入指令的那一回合，Antigravity 會忽略這個欄位。
- **Hook**：開場注入兩條規則（繁體中文回答、改完說明）。危險指令與機密的防護由 `workflow-core` 負責。

另附幾個零件範例：

- **Slash command** `/dev-buddy:explain <檔案>`：用白話解說指定檔案。
- **Subagent** `reviewer`：只能讀檔的審查員。需點名「dev-buddy reviewer」才使用，一般審查用 `workflow-core:code-reviewer`。
- **MCP server** `dev-tools`：提供 `uuid` 與 `taipei_time` 兩個工具。

需要 Node.js 18 以上，不需要安裝任何套件。安裝方式請看 repo 根目錄的 README。
