# my-claude-kit

練習用的 Claude Code plugin marketplace，裡面只有一個 plugin：**dev-buddy**。
它用最小的例子示範一個 plugin 能包含的 5 種零件。dev-buddy 也能安裝到 Google Antigravity，見〈安裝到 Antigravity〉。

## 檔案地圖

```
my-claude-kit/
├── .claude-plugin/marketplace.json    marketplace 目錄：列出有哪些 plugin
├── scripts/sync-antigravity-agents.mjs  由 claude-agents/ 產生 Antigravity 版 agents/
└── plugins/dev-buddy/
    ├── .claude-plugin/plugin.json     plugin 身分證：名稱、版本、描述
    ├── skills/issue-start/SKILL.md    【Skill】開始處理 issue（只能由你觸發）
    ├── skills/issue-finish/SKILL.md   【Skill】收尾 issue 並開 PR（只能由你觸發）
    ├── commands/explain.md            【Slash command】你輸入指令才觸發
    ├── claude-agents/reviewer.md      【Subagent】派出去的唯讀審查員（唯一來源）
    ├── hooks/hooks.json               【Hook】哪個事件跑哪支程式
    ├── hooks/session-start.mjs          開場注入規則
    ├── hooks/bash-guard.mjs             擋危險指令
    ├── hooks/bash-guard.test.mjs        hook 的測試
    ├── .mcp.json                      【MCP】要啟動哪個 MCP server
    ├── mcp/server.mjs                   手寫的最小 MCP server
    │
    │   以下只給 Antigravity 用
    ├── .antigravity-plugin/plugin.json  Antigravity 的 plugin 身分證
    ├── agents/reviewer.md               自動產生，禁止手動修改
    ├── hooks.json                       Antigravity 的 hook 設定
    ├── antigravity/hook-adapter.mjs     把 Antigravity 的 hook 協定轉成 Claude Code 格式
    └── mcp_config.json                  Antigravity 的 MCP 設定
```

Claude Code 認的是**資料夾名稱**：`skills/`、`commands/`、`hooks/hooks.json`、`.mcp.json` 放在 plugin 根目錄就會自動載入，不用另外註冊。
Subagent 是例外：`plugin.json` 的 `agents` 欄位列出 `claude-agents/` 裡的檔案，Claude Code 只載入這些檔案。`agents/` 留給 Antigravity。

## 5 種零件比較

| 零件 | 誰觸發 | 什麼時候 | 這裡的例子 |
|---|---|---|---|
| Skill | 預設由 **AI** 看 `description` 決定；設 `disable-model-invocation: true` 後只有**你**能觸發 | 你的需求符合描述時，或你輸入指令時 | `issue-start`、`issue-finish`：issue 開工與收尾流程（只能由你觸發） |
| Slash command | **你**輸入 `/dev-buddy:explain` | 你想用就用 | `explain`：白話解說一個檔案 |
| Subagent | AI 或你指定 | 需要獨立審查時 | `reviewer`：只能讀檔的審查員（需點名才使用） |
| Hook | **Claude Code 自動執行**，AI 無法略過 | 特定事件發生時 | 開場注入規則、擋 `git push --force` |
| MCP server | AI 呼叫它提供的 tool | 需要新能力時 | `uuid`、`taipei_time` |

## 安裝

在 Claude Code 裡輸入：

```
/plugin marketplace add D:/ian/program/pra_proj/my-claude-kit
/plugin install dev-buddy@my-claude-kit
```

裝好後**開一個新 session**，hook 和 MCP server 才會載入。

只想快速測試、不想安裝的話，可以在終端機執行：

```
claude --plugin-dir D:/ian/program/pra_proj/my-claude-kit/plugins/dev-buddy
```

## 安裝到 Antigravity

警告：Antigravity 開著時，安裝可能因目錄被占用而失敗。安裝前先關閉 Antigravity。

1. 在終端機執行：
	```
	agy plugin install D:/ian/program/pra_proj/my-claude-kit/plugins/dev-buddy
	```
2. 執行 `agy plugin list`，確認 dev-buddy 狀態為 `enabled`，並列出 2 個 hooks 與 1 個 MCP server。

更新時先執行 `agy plugin uninstall dev-buddy`，再重複步驟 1。

改了 `claude-agents/reviewer.md` 後，在 repository 根目錄執行 `node scripts/sync-antigravity-agents.mjs`，重新產生 `agents/reviewer.md`。

## 試用清單

在一個 git 專案裡開新 session，依序試：

| 要測的零件 | 你說什麼 | 預期結果 |
|---|---|---|
| SessionStart hook | 「你剛開場收到什麼規則？」 | AI 說出 dev-buddy 的兩條規則 |
| Skill | 在有 GitHub issue 的專案輸入 `/dev-buddy:issue-start <編號>` | AI 讀取 issue、列出驗收條件、提出計畫後停下等你確認 |
| Slash command | `/dev-buddy:explain README.md` | 照四段格式解說 README |
| Subagent | 「用 dev-buddy reviewer 審查 plugins/dev-buddy/mcp/server.mjs」 | 出現 reviewer 的條列報告 |
| PreToolUse hook | 「幫我執行 git push --force」 | 指令被擋下，AI 轉述擋下的原因 |
| MCP | 「給我 3 個 uuid」、「台北現在幾點」 | AI 呼叫 dev-tools 的工具；輸入 `/mcp` 可以看到 dev-tools 已連線 |

## 修改後怎麼更新

1. 改 `plugin.json` 和 `marketplace.json` 的版本號（兩邊要一致）。
2. 在終端機執行 `claude plugin validate .`，確認格式正確。
3. 在終端機依序執行：
	```
	claude plugin marketplace update my-claude-kit
	claude plugin update dev-buddy@my-claude-kit
	```
	第 2 行應顯示 `updated from <舊版> to <新版>`。只更新 marketplace 不會更新已安裝的 plugin。
4. 開新 session，新版本才會載入。

## 自己驗證

```
node --test "plugins/dev-buddy/hooks/*.test.mjs"
```

手動測 MCP server（每行一則 JSON-RPC 訊息）：

```
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"uuid","arguments":{"count":2}}}' | node plugins/dev-buddy/mcp/server.mjs
```

## 寫 hook 的重點

- AI 要做的事會用 JSON 從 **stdin** 傳進來
- **exit 0** 放行；**exit 2** 擋下，並把 **stderr** 的訊息給 AI 看
- 其他 exit code 只會被當成 hook 出錯，**不會擋**
- 讀不懂輸入時直接放行（fail-open），不要讓壞掉的 hook 卡住使用者
