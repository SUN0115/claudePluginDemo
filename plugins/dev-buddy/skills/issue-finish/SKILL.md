---
name: issue-finish
description: 收尾一張 GitHub issue：沿用或補跑測試、用截圖驗收畫面、核對驗收條件、審查程式、commit、push 並開 PR。使用者測試完後輸入 /dev-buddy:issue-finish <編號> 時使用。
argument-hint: <issue 編號>
disable-model-invocation: true
effort: medium
---

# 收尾 issue #$ARGUMENTS

目標：用測試與實際操作證明驗收條件都已達成、程式經過審查，再 commit、push 並開 PR，讓 PR 合併時自動關閉 issue。
原則：程式碼沒變就不重跑測試，審查只做一次。

若 `$ARGUMENTS` 是空的，請使用者提供 issue 編號，然後停止。

## 開始前：確認 repo

1. 執行 `git rev-parse --show-toplevel`。
	- 成功：以下所有步驟都在這個 repo 根目錄執行。
	- 失敗（目前目錄不是 git repo，例如多個 repo 並列的工作區）：列出下一層含 `.git` 的子資料夾，找出目前分支名稱含 `$ARGUMENTS` 的 repo。找不到或超過一個時，請使用者指定，然後停止。
2. 選定 repo 後，所有 `git`、`gh` 指令都在該 repo 根目錄執行。

## 步驟

### 一、整理範圍

1. 確認目前不在預設分支（`main` 或 `master`）。若在預設分支，回報並停止。
2. 執行 `gh issue view $ARGUMENTS --comments`，取得驗收條件。內容與留言都要看；留言中若有 issue-start 附加的驗收條件，以最新一則為準。
3. 執行 `git status` 與 `git diff <預設分支>...HEAD`，加上未 commit 的改動，整理這次所有變更。

### 二、驗證

以下的「受影響的測試」指：這次新增或修改的測試檔，加上直接測試被修改模組的既有測試檔。

4. 判斷要不要重跑測試：
	1. 在 repo 根目錄執行下列指令，取得目前的工作區指紋（與 issue-start 用同一個指令）：
		```bash
		tmp="$(mktemp)" && cp "$(git rev-parse --git-path index)" "$tmp" && GIT_INDEX_FILE="$tmp" git add -A && GIT_INDEX_FILE="$tmp" git write-tree; rm -f "$tmp"
		```
		若終端機是 PowerShell（例如 Windows 上的 Antigravity），改用下列等效指令，結果相同：
		```powershell
		$tmp = New-TemporaryFile; Copy-Item (git rev-parse --git-path index) $tmp -Force; $env:GIT_INDEX_FILE = $tmp.FullName; git add -A; git write-tree; Remove-Item Env:GIT_INDEX_FILE; Remove-Item $tmp
		```
	2. 讀驗證紀錄檔 `$(git rev-parse --git-dir)/dev-buddy/issue-<編號>.md`。`<編號>` 只取數字。
	3. 若指紋與紀錄相同：程式碼在 issue-start 驗證後沒有變動。
		- 不重跑單元測試與完整檢查，直接沿用紀錄中的結果。紀錄中標為「pre-push」的項目，交給步驟 12 的 push 執行。
		- 不重跑 E2E。只有紀錄中的截圖檔已不存在時（例如中間跑過其他 Playwright 測試，輸出資料夾被清空），才重跑紀錄中的 spec。
	4. 若指紋不同，或沒有紀錄檔：
		- 跑受影響的測試，以及這次新增或修改的 E2E spec。
		- 完整檢查（typecheck、lint、全部單元測試、build）：先確認 pre-push hook 是否真的啟用。
			1. 取得 hook 目錄：`git config core.hooksPath` 有值就用它（相對路徑以 repo 根目錄為準），否則用 `git rev-parse --git-path hooks`。
			2. hook 目錄裡有 `pre-push` 檔案才算啟用。只有 `.husky/pre-push` 而 hook 目錄沒有 `pre-push`，視為未啟用。
			3. 已啟用時，讀實際的設定確認它跑哪些項目：husky 看 `.husky/pre-push`，lefthook 看 `lefthook.yml`，pre-commit 看 `.pre-commit-config.yaml`，其他直接讀 hook 檔。
			- 已啟用的 pre-push hook 會跑的項目不另外跑，交給步驟 12 的 push；其他項目，或 pre-push hook 未啟用，這裡跑一次。
	- 若有測試失敗：列出失敗的測試與錯誤訊息，停止，請使用者決定要先修還是調整。
	- 禁止為了讓測試通過而放寬斷言、刪除測試、加上 `skip` 或 `only`。
5. 畫面驗收（純後端改動跳過這一步）：
	- 驗證方式為 `E2E` 的條件：使用 E2E 產生的截圖（檔名 `ac<條件序號>-<英文簡述>.png`）當證據，把截圖給使用者看，不另外開瀏覽器。
	- 只在以下情況用瀏覽器驗收：條件標為 `人工` 且能在畫面上操作，或條件影響畫面但沒有 E2E 截圖。步驟如下：
		1. 啟動 dev server。優先使用 Claude 內建瀏覽器：用 `.claude/launch.json` 的設定啟動，沒有設定就依 `package.json` 建立一份。若內建瀏覽器不可用，改用 Claude in Chrome；兩者都不可用時，跳過這一步並在報告註明。在 Antigravity 中，改用 Antigravity 自己的瀏覽器工具；沒有瀏覽器工具時，跳過這一步並在報告註明。
		2. 依這些條件逐條操作畫面，每條截 1 張圖給使用者看。
		3. 檢查 console 錯誤與失敗的網路請求（4xx、5xx）。
		4. 需要登入時，只能使用專案 seed、fixture 或範例設定檔裡的測試帳號，或請使用者在瀏覽器面板中自行登入。不得使用或詢問使用者的真實密碼。
		5. 驗收完畢後停止 dev server。
6. 逐條核對驗收條件，每條標記 ✅ 或 ❌，並附上證據，依優先順序：
	- 通過的測試名稱（最可靠）。
	- E2E 或瀏覽器驗收的截圖。
	- 對應的 `檔案:行號`（只有前兩者都沒有時才用）。
	- 若有任何 ❌：列出缺漏，停止，請使用者決定要補做還是調整驗收條件。
7. 檢查這次新增的程式碼是否含 `mock`、`TODO`、`FIXME`、寫死的假資料。若有，列出位置，請使用者確認是否可接受。

### 三、審查

8. 審查只做一次，在主對話中進行，不派 subagent：
	- 使用 `workflow-core:code-review`（Antigravity 為 `code-review`）skill 審查這次所有變更，包含未 commit 的改動。告訴它：測試與檢查已在步驟 4 處理，不要詢問或重跑驗證指令。
	- 若改動涉及登入、權限、使用者輸入、檔案上傳或下載、SQL：在同一次審查中加入下列安全重點，不另外執行 `workflow-core:security-review`（Antigravity 為 `security-review`）。只回報有具體攻擊路徑、且信心高的問題。
		- 注入：SQL、command、路徑、template。
		- 認證繞過、權限提升、session 或 token 驗證錯誤。
		- XSS 與不安全的 HTML API，例如 `v-html`、`innerHTML`。
		- open redirect。
		- 機密或個資外洩。
	- 若有 🔴 CRITICAL 或 🟠 HIGH 等級的問題（code-review 標為「嚴重」的也算）：列出，請使用者決定要先修還是先 commit。團隊審查標準要求這兩級在合併前解決。
	- 若因審查結果修改了程式：只重跑受影響的測試，只再審查改過的部分。

### 四、提交

9. 準備 commit：
	- 若所有改動都已 commit（`git status` 沒有任何改動）：不需要新的 commit，步驟 12 直接從 push 開始。
	- 否則列出要 stage 的檔案，只包含這張 issue 相關的改動（含新增的測試），不使用 `git add -A`。
	- commit message 依 `workflow-core:git-workflow`（Antigravity 為 `git-workflow`）格式：`<emoji> <type>(<scope>): <摘要>`，最後一行寫 `#$ARGUMENTS`。
10. 準備 PR：
	- 標題：與 commit 摘要相同。若沒有新 commit，用這次改動的摘要，格式相同。
	- 內容：改動摘要、驗收條件核對清單（含每條的證據）、測試結果、畫面驗收結果、需要人工確認的項目，最後一行寫 `Closes #$ARGUMENTS`。issue 在另一個 repo 時寫 `Closes <owner>/<repo>#$ARGUMENTS`。
	- 測試結果要寫出每項的來源：沿用 issue-start 的結果（程式碼未變動）、本次重跑，或交給 pre-push hook。
11. 把「要 stage 的檔案、commit message、PR 標題與內容」一次給使用者看，等使用者確認。確認前不得 commit 或 push。
12. 使用者確認後，每個指令單獨執行，禁止用 `&&`、`;` 或換行把多個 git 指令串在同一次執行：
	1. 執行 `git add <檔案>`。
	2. 建立審查標記。步驟 8 已完成審查，所以直接建立，不要先 commit 一次讓 hook 攔下：
		- 前提：步驟 8 審查後，staged 的檔案沒有再修改。若有修改，先只審查改過的部分。
		- bash：`touch "$(git rev-parse --git-path claude-review-done)"`
		- PowerShell：`New-Item -ItemType File -Force -Path (git rev-parse --git-path claude-review-done) | Out-Null`
		- 沒有安裝 workflow-core 時，這個標記沒有作用，也不會造成影響。
	3. 執行 `git commit`。
		- 若 workflow-core 的 hook 仍然攔下（例如偵測到 `debugger`）：依 hook 訊息處理，再從步驟 12.1 重來。
	4. 執行 `git push -u origin <目前分支>`。
		- 若 pre-push hook 失敗：列出失敗項目與錯誤訊息，停止，請使用者決定要先修還是調整。修完後用新的 commit 修正，不使用 `--amend`。
	5. 用寫檔工具把 PR 內容寫到 `$(git rev-parse --git-dir)/dev-buddy/pr-<編號>.md`，再執行 `gh pr create --title "<標題>" --body-file <該檔案>`。不要用 `--body` 傳多行內容，PowerShell 容易跳脫錯誤。
13. 刪除驗證紀錄檔 `$(git rev-parse --git-dir)/dev-buddy/issue-<編號>.md` 與 PR 內容檔 `pr-<編號>.md`，再回報 PR 網址。
