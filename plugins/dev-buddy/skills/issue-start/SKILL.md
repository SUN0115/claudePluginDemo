---
name: issue-start
description: 開始處理一張 GitHub issue：讀取內容、確認驗收條件與驗證方式、提出實作計畫，計畫確認後才開分支、實作並寫測試。使用者輸入 /dev-buddy:issue-start <編號> 時使用。
argument-hint: <issue 編號>
disable-model-invocation: true
effort: high
---

# 開始處理 issue #$ARGUMENTS

目標：在動手寫程式前，確定「要做什麼」、「怎樣算做完」與「怎麼驗證」，並取得使用者對計畫的確認。

若 `$ARGUMENTS` 是空的，請使用者提供 issue 編號，然後停止。

## 開始前：確認 repo

1. 執行 `git rev-parse --show-toplevel`。
	- 成功：以下所有步驟都在這個 repo 根目錄執行。
	- 失敗（目前目錄不是 git repo，例如多個 repo 並列的工作區）：列出下一層含 `.git` 的子資料夾。若使用者的說明無法判斷 issue 屬於哪個 repo，請使用者指定，然後停止。
2. 選定 repo 後，所有 `git`、`gh` 指令都在該 repo 根目錄執行。
3. 若 issue 需要改動多個 repo：在計畫中列出處理順序，一次只處理一個 repo。每個 repo 各開分支、各開 PR。

## 步驟

1. 執行 `gh issue view $ARGUMENTS --comments`，讀取標題、內容與留言。
	- 若指令失敗，回報錯誤訊息並停止。常見原因：未登入 `gh`、不在 git 專案內、編號不存在、issue 在另一個 repo。
2. 檢查 issue 是否有驗收條件（可逐條驗證的完成標準）。內容與留言都要看；留言中若有之前附加的驗收條件，以最新一則為準。
	- 若有：逐條列出。
	- 若沒有或內容模糊：讀相關程式碼，草擬 3～7 條驗收條件。不要在這裡停下來詢問，把草擬的條件放進步驟 5 的計畫，讓使用者一次確認條件與計畫。
3. 讀相關程式碼，找出要修改的位置與可重用的既有函式。
4. 確認專案現有的測試工具：讀 `package.json` 的 `scripts` 與 devDependencies，找 `playwright.config.*`、`vitest.config.*`、`jest.config.*`、`pytest.ini`、`pyproject.toml`，以及既有測試的資料夾與命名方式。
5. 提出實作計畫，內容包含：
	- 若步驟 2 有新草擬的驗收條件：放在計畫最前面，標明「草擬，待確認」。
	- 分支名稱：依 `workflow-core:git-workflow`（Antigravity 為 `git-workflow`）規則，格式 `<類型>/$ARGUMENTS-<英文簡述>`。類型依改動性質選一種：新功能 `feature`、修 bug `bugfix`、效能 `perf`、重構 `refactor`。
	- 要修改或新增的檔案。
	- 每條驗收條件對應到哪個改動。
	- 每條驗收條件的**驗證方式**，從下列選一種：
		- `E2E`：寫 Playwright 測試。適用會影響畫面或使用者操作流程的條件。測試在驗收點截圖，作為 issue-finish 的畫面證據。
		- `單元／整合`：寫單元或整合測試。適用後端邏輯、API、資料處理。
		- `人工`：只能人工確認，例如視覺感受、第三方服務。必須寫出人工確認的步驟。
	- 要新增的測試檔路徑，沿用專案既有的資料夾與命名方式。
	- 會用到假資料、mock 或寫死值的地方。若有，說明原因與之後如何換成真實作。
	- 若專案沒有對應的測試工具：該條改列為 `人工`，並在計畫中詢問使用者是否要導入。不得自行安裝測試框架。
6. 停下來，等使用者一次確認驗收條件與計畫。這是 issue-start 唯一的確認點。確認前不得修改任何檔案、不得開分支。

## 計畫確認後

以下的「受影響的測試」指：這次新增或修改的測試檔，加上直接測試被修改模組的既有測試檔。

1. 確認工作區沒有未 commit 的改動。若有，列出檔案並詢問使用者如何處理，不得自行 stash 或丟棄。
2. 切到預設分支並 `git pull`，再用 `git switch -c <分支名稱>` 開分支。
3. 若驗收條件是這次草擬的：把確認後的條件以留言附加到 issue，讓之後的 issue-finish（包含在新對話執行時）讀得到。
	- 用寫檔工具把留言內容寫到 `$(git rev-parse --git-dir)/dev-buddy/issue-<編號>-ac.md`（資料夾不存在就先依步驟 8.2 建立），再執行 `gh issue comment $ARGUMENTS --body-file <該檔案>`，完成後刪除該檔案。
	- 禁止用 `gh issue edit --body`，它會覆蓋 issue 原本的內容。
4. 依計畫實作，並寫好計畫中列出的測試。
	- 驗證方式為 `E2E` 的條件：在該條件的驗收點截圖，檔名用 `ac<條件序號>-<英文簡述>.png`。若專案既有測試已有截圖寫法，沿用既有寫法。Playwright 範例：
		```ts
		await page.screenshot({ path: testInfo.outputPath('ac1-license-expired-page.png') });
		```
5. 開發過程中只跑受影響的單元／整合測試，修到全部通過。
	- 開發中不跑 E2E。E2E 只在步驟 7 跑一次。
	- 禁止為了「順便確認」而跑與改動無關的大型測試。
	- 禁止為了讓測試通過而放寬斷言、刪除測試、加上 `skip` 或 `only`，或把真實作換成 mock。
	- 若測試因環境問題無法執行（例如缺資料庫、缺測試帳號），回報原因，不得假裝通過。
6. 做一次輕量自我審查，這就是團隊標準要求的完成前自我審查。不派 subagent，也不執行審查類 skill；完整審查在 issue-finish 進行。
	- 逐條對照驗收條件，確認每條都有對應的改動與測試。
	- 檢查新增的程式碼有沒有殘留 `console.log`、`debugger`、`TODO`、寫死的假資料、被吞掉的錯誤、hardcode 的機密。
	- 若檢查後修改了程式，重跑受影響的測試。
7. 在最後一次修改程式之後，跑一次收尾檢查：
	1. E2E：跑這次新增或修改的 spec，加上直接斷言被修改行為的既有 spec（例如改了路由守衛就跑測路由權限的 spec）。截圖因此對應最後的程式碼。
	2. typecheck：若專案有，執行一次。
	3. 完整檢查（lint、全部單元測試、build）：先確認 pre-push hook 是否真的啟用。
		1. 取得 hook 目錄：`git config core.hooksPath` 有值就用它（相對路徑以 repo 根目錄為準），否則用 `git rev-parse --git-path hooks`。
		2. hook 目錄裡有 `pre-push` 檔案才算啟用。只有 `.husky/pre-push` 而 hook 目錄沒有 `pre-push`，視為未啟用。
		3. 已啟用時，讀實際的設定確認它跑哪些項目：husky 看 `.husky/pre-push`，lefthook 看 `lefthook.yml`，pre-commit 看 `.pre-commit-config.yaml`，其他直接讀 hook 檔。
		- 已啟用的 pre-push hook 會跑的項目：這裡不跑，交給 issue-finish 的 push。
		- 其他項目，或 pre-push hook 未啟用：這裡跑一次。
	- 若某項失敗而修改程式：修完後只重跑失敗的那項與受影響的測試，不再整套重跑。若改動影響 E2E 涵蓋的畫面，重跑那支 spec。
8. 記錄驗證狀態，讓 issue-finish 判斷要不要重跑測試：
	1. 在 repo 根目錄執行下列指令，取得工作區指紋。指紋涵蓋已 commit、未 commit 與未追蹤的檔案，指令不會修改 git index。
		```bash
		tmp="$(mktemp)" && cp "$(git rev-parse --git-path index)" "$tmp" && GIT_INDEX_FILE="$tmp" git add -A && GIT_INDEX_FILE="$tmp" git write-tree; rm -f "$tmp"
		```
		若終端機是 PowerShell（例如 Windows 上的 Antigravity），改用下列等效指令，結果相同：
		```powershell
		$tmp = New-TemporaryFile; Copy-Item (git rev-parse --git-path index) $tmp -Force; $env:GIT_INDEX_FILE = $tmp.FullName; git add -A; git write-tree; Remove-Item Env:GIT_INDEX_FILE; Remove-Item $tmp
		```
	2. 建立紀錄資料夾：bash 執行 `mkdir -p "$(git rev-parse --git-dir)/dev-buddy"`；PowerShell 執行 `New-Item -ItemType Directory -Force (Join-Path (git rev-parse --git-dir) dev-buddy)`。
	3. 寫入驗證紀錄檔 `$(git rev-parse --git-dir)/dev-buddy/issue-<編號>.md`。`<編號>` 只取數字。這個檔案在 `.git` 資料夾內，不會被 commit。內容格式：
		```
		fingerprint: <工作區指紋>
		checks: <步驟 7 實際跑過且通過的指令，例如 npm run typecheck；交給 pre-push 的項目寫「pre-push：npm run lint、npm test、npm run build」>
		results: <各項結果，例如 npm test 135 個檔案、688 個測試通過>
		e2e: <跑過的 spec 路徑>
		screenshots: <截圖檔路徑，一行一個>
		```
9. 完成後回報：改了哪些檔案、新增哪些測試、測試結果與截圖路徑。
10. 提醒使用者：先自己測試，測完再執行 `/dev-buddy:issue-finish $ARGUMENTS`（Antigravity 為 `/issue-finish $ARGUMENTS`）。若自己測試時改了程式，issue-finish 會偵測到並重跑受影響的測試。
