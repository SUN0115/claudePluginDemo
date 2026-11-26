---
name: issue-finish
description: 收尾一張 GitHub issue：跑測試、用瀏覽器驗收畫面、核對驗收條件、審查程式、commit、push 並開 PR。使用者測試完後輸入 /dev-buddy:issue-finish <編號> 時使用。
argument-hint: <issue 編號>
disable-model-invocation: true
---

# 收尾 issue #$ARGUMENTS

目標：用測試與實際操作證明驗收條件都已達成、程式經過審查，再 commit、push 並開 PR，讓 PR 合併時自動關閉 issue。

若 `$ARGUMENTS` 是空的，請使用者提供 issue 編號，然後停止。

## 步驟

### 一、整理範圍

1. 確認目前不在預設分支（`main` 或 `master`）。若在預設分支，回報並停止。
2. 執行 `gh issue view $ARGUMENTS --comments`，取得驗收條件。
3. 執行 `git status` 與 `git diff <預設分支>...HEAD`，加上未 commit 的改動，整理這次所有變更。

### 二、驗證

4. 跑測試：
	- 從 `package.json` 的 `scripts` 或專案設定檔找出測試指令，例如 `npm test`、`npm run test:e2e`、`npx playwright test`、`pytest`。
	- 先跑這次新增與受影響的測試，再跑完整的單元測試。E2E 測試只跑和這次改動相關的檔案。
	- 若有測試失敗：列出失敗的測試與錯誤訊息，停止，請使用者決定要先修還是調整。
	- 禁止為了讓測試通過而放寬斷言、刪除測試、加上 `skip` 或 `only`。
5. 瀏覽器驗收（只在 issue 會影響畫面時執行，純後端改動跳過這一步）：
	1. 啟動 dev server。優先使用 Claude 內建瀏覽器：用 `.claude/launch.json` 的設定啟動，沒有設定就依 `package.json` 建立一份。若內建瀏覽器不可用，改用 Claude in Chrome；兩者都不可用時，跳過這一步並在報告註明。
	2. 依驗收條件逐條操作畫面，每條截 1 張圖給使用者看。
	3. 檢查 console 錯誤與失敗的網路請求（4xx、5xx）。
	4. 需要登入時，只能使用專案 seed、fixture 或範例設定檔裡的測試帳號，或請使用者在瀏覽器面板中自行登入。不得使用或詢問使用者的真實密碼。
	5. 驗收完畢後停止 dev server。
6. 逐條核對驗收條件，每條標記 ✅ 或 ❌，並附上證據，依優先順序：
	- 通過的測試名稱（最可靠）。
	- 瀏覽器驗收的截圖與操作結果。
	- 對應的 `檔案:行號`（只有前兩者都沒有時才用）。
	- 若有任何 ❌：列出缺漏，停止，請使用者決定要補做還是調整驗收條件。
7. 檢查這次新增的程式碼是否含 `mock`、`TODO`、`FIXME`、寫死的假資料。若有，列出位置，請使用者確認是否可接受。

### 三、審查

8. 審查程式：
	- 改動在 10 個檔案以內，且只動前端或只動後端：使用 `workflow-core:code-review` skill。
	- 改動超過 10 個檔案，或同時動到前端與後端：呼叫 `workflow-core:code-reviewer` agent。
	- 若改動涉及登入、權限、使用者輸入、檔案上傳或下載、SQL：另外使用 `workflow-core:security-review` skill。
	- 若有 🔴 等級的問題：列出，請使用者決定要先修還是先 commit。

### 四、提交

9. 準備 commit：
	- 列出要 stage 的檔案，只包含這張 issue 相關的改動（含新增的測試），不使用 `git add -A`。
	- commit message 依 `workflow-core:git-workflow` 格式：`<emoji> <type>(<scope>): <摘要>`，最後一行寫 `#$ARGUMENTS`。
10. 準備 PR：
	- 標題：與 commit 摘要相同。
	- 內容：改動摘要、驗收條件核對清單（含每條的證據）、測試結果（跑了哪些、幾項通過）、瀏覽器驗收結果、需要人工確認的項目，最後一行寫 `Closes #$ARGUMENTS`。
11. 把「要 stage 的檔案、commit message、PR 標題與內容」一次給使用者看，等使用者確認。確認前不得 commit 或 push。
12. 使用者確認後：
	1. `git add <檔案>`，再 `git commit`。若 `pre-commit-review` hook 攔下，依它的清單完成自我審查後再 commit。
	2. `git push -u origin <目前分支>`。
	3. `gh pr create`，填入步驟 10 的標題與內容。
13. 回報 PR 網址。
