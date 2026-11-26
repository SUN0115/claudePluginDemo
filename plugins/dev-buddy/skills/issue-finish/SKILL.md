---
name: issue-finish
description: 收尾一張 GitHub issue：核對驗收條件、審查程式、commit、push 並開 PR。使用者測試完後輸入 /dev-buddy:issue-finish <編號> 時使用。
argument-hint: <issue 編號>
disable-model-invocation: true
---

# 收尾 issue #$ARGUMENTS

目標：確認驗收條件都已達成、程式經過審查，再 commit、push 並開 PR，讓 PR 合併時自動關閉 issue。

若 `$ARGUMENTS` 是空的，請使用者提供 issue 編號，然後停止。

## 步驟

1. 確認目前不在預設分支（`main` 或 `master`）。若在預設分支，回報並停止。
2. 執行 `gh issue view $ARGUMENTS --comments`，取得驗收條件。
3. 執行 `git status` 與 `git diff <預設分支>...HEAD`，加上未 commit 的改動，整理這次所有變更。
4. 逐條核對驗收條件，每條標記 ✅ 或 ❌，並附上對應的 `檔案:行號` 作為證據。
	- 若有任何 ❌：列出缺漏，停止，請使用者決定要補做還是調整驗收條件。
5. 檢查這次新增的程式碼是否含 `mock`、`TODO`、`FIXME`、寫死的假資料。若有，列出位置，請使用者確認是否可接受。
6. 審查程式：
	- 改動在 10 個檔案以內，且只動前端或只動後端：使用 `workflow-core:code-review` skill。
	- 改動超過 10 個檔案，或同時動到前端與後端：呼叫 `workflow-core:code-reviewer` agent。
	- 若有 🔴 等級的問題：列出，請使用者決定要先修還是先 commit。
7. 準備 commit：
	- 列出要 stage 的檔案，只包含這張 issue 相關的改動，不使用 `git add -A`。
	- commit message 依 `workflow-core:git-workflow` 格式：`<emoji> <type>(<scope>): <摘要>`，最後一行寫 `#$ARGUMENTS`。
8. 準備 PR：
	- 標題：與 commit 摘要相同。
	- 內容：改動摘要、驗收條件核對清單、測試方式，最後一行寫 `Closes #$ARGUMENTS`。
9. 把「要 stage 的檔案、commit message、PR 標題與內容」一次給使用者看，等使用者確認。確認前不得 commit 或 push。
10. 使用者確認後：
	1. `git add <檔案>`，再 `git commit`。若 `pre-commit-review` hook 攔下，依它的清單完成自我審查後再 commit。
	2. `git push -u origin <目前分支>`。
	3. `gh pr create`，填入步驟 8 的標題與內容。
11. 回報 PR 網址。
