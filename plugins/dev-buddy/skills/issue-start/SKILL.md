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

## 步驟

1. 執行 `gh issue view $ARGUMENTS --comments`，讀取標題、內容與留言。
	- 若指令失敗，回報錯誤訊息並停止。常見原因：未登入 `gh`、不在 git 專案內、編號不存在。
2. 檢查 issue 是否有驗收條件（可逐條驗證的完成標準）。
	- 若有：逐條列出。
	- 若沒有或內容模糊：讀相關程式碼，草擬 3～7 條驗收條件。不要在這裡停下來詢問，把草擬的條件放進步驟 5 的計畫，讓使用者一次確認條件與計畫。
3. 讀相關程式碼，找出要修改的位置與可重用的既有函式。
4. 確認專案現有的測試工具：讀 `package.json` 的 `scripts` 與 devDependencies，找 `playwright.config.*`、`vitest.config.*`、`jest.config.*`、`pytest.ini`、`pyproject.toml`，以及既有測試的資料夾與命名方式。
5. 提出實作計畫，內容包含：
	- 分支名稱：依 `workflow-core:git-workflow`（Antigravity 為 `git-workflow`）規則，格式 `feature/$ARGUMENTS-<英文簡述>`；修 bug 用 `bugfix/$ARGUMENTS-<英文簡述>`。
	- 要修改或新增的檔案。
	- 每條驗收條件對應到哪個改動。
	- 每條驗收條件的**驗證方式**，從下列選一種：
		- `E2E`：寫 Playwright 測試。適用會影響畫面或使用者操作流程的條件。測試在驗收點截圖，作為 issue-finish 的畫面證據。
		- `單元／整合`：寫單元或整合測試。適用後端邏輯、API、資料處理。
		- `人工`：只能人工確認，例如視覺感受、第三方服務。必須寫出人工確認的步驟。
	- 要新增的測試檔路徑，沿用專案既有的資料夾與命名方式。
	- 會用到假資料、mock 或寫死值的地方。若有，說明原因與之後如何換成真實作。
	- 若步驟 2 有新草擬的驗收條件：在計畫最前面列出，標明「草擬，待確認」，並包含「用 `gh issue edit` 把驗收條件更新到 issue」。
	- 若專案沒有對應的測試工具：該條改列為 `人工`，並在計畫中詢問使用者是否要導入。不得自行安裝測試框架。
6. 停下來，等使用者一次確認驗收條件與計畫。這是 issue-start 唯一的確認點。確認前不得修改任何檔案、不得開分支。

## 計畫確認後

以下的「受影響的測試」指：這次新增或修改的測試檔，加上直接測試被修改模組的既有測試檔。

1. 確認工作區沒有未 commit 的改動。若有，列出檔案並詢問使用者如何處理，不得自行 stash 或丟棄。
2. 切到預設分支並 `git pull`，再用 `git switch -c <分支名稱>` 開分支。
3. 依計畫實作，並寫好計畫中列出的測試。
	- 驗證方式為 `E2E` 的條件：在該條件的驗收點截圖，檔名用 `ac<條件序號>-<英文簡述>.png`。若專案既有測試已有截圖寫法，沿用既有寫法。Playwright 範例：
		```ts
		await page.screenshot({ path: testInfo.outputPath('ac1-license-expired-page.png') });
		```
4. 開發過程中只跑受影響的單元／整合測試，修到全部通過。
	- 開發中不跑 E2E。E2E 只在步驟 6 跑一次。
	- 禁止為了「順便確認」而跑與改動無關的大型測試。
	- 禁止為了讓測試通過而放寬斷言、刪除測試、加上 `skip` 或 `only`，或把真實作換成 mock。
	- 若測試因環境問題無法執行（例如缺資料庫、缺測試帳號），回報原因，不得假裝通過。
5. 做一次輕量自我檢查。不派 subagent，也不執行審查類 skill；完整審查在 issue-finish 進行。
	- 逐條對照驗收條件，確認每條都有對應的改動與測試。
	- 檢查新增的程式碼有沒有殘留 `console.log`、`debugger`、`TODO`、寫死的假資料、被吞掉的錯誤、hardcode 的機密。
	- 若檢查後修改了程式，重跑受影響的測試。
6. 在最後一次修改程式之後，跑一次收尾檢查：
	1. E2E：跑這次新增或修改的 spec，加上直接斷言被修改行為的既有 spec（例如改了路由守衛就跑測路由權限的 spec）。截圖因此對應最後的程式碼。
	2. typecheck：若專案有，執行一次。
	3. 完整檢查（lint、全部單元測試、build）：先讀 `.husky/pre-push`、`.git/hooks/pre-push`、`lefthook.yml` 或 `.pre-commit-config.yaml`。
		- pre-push hook 會跑的項目，這裡不跑，交給 issue-finish 的 push。
		- hook 沒有涵蓋的項目，或專案沒有 pre-push hook：這裡跑一次。
	- 若某項失敗而修改程式：修完後只重跑失敗的那項與受影響的測試，不再整套重跑。若改動影響 E2E 涵蓋的畫面，重跑那支 spec。
7. 記錄驗證狀態，讓 issue-finish 判斷要不要重跑測試：
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
		checks: <步驟 6 實際跑過且通過的指令，例如 npm run typecheck；交給 pre-push 的項目寫「pre-push：npm run lint、npm test、npm run build」>
		results: <各項結果，例如 npm test 135 個檔案、688 個測試通過>
		e2e: <跑過的 spec 路徑>
		screenshots: <截圖檔路徑，一行一個>
		```
8. 完成後回報：改了哪些檔案、新增哪些測試、測試結果與截圖路徑。
9. 提醒使用者：先自己測試，測完再執行 `/dev-buddy:issue-finish $ARGUMENTS`（Antigravity 為 `/issue-finish $ARGUMENTS`）。若自己測試時改了程式，issue-finish 會偵測到並重跑受影響的測試。
