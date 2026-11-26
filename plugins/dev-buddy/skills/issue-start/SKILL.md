---
name: issue-start
description: 開始處理一張 GitHub issue：讀取內容、確認驗收條件、提出實作計畫，計畫確認後才開分支與實作。使用者輸入 /dev-buddy:issue-start <編號> 時使用。
argument-hint: <issue 編號>
disable-model-invocation: true
---

# 開始處理 issue #$ARGUMENTS

目標：在動手寫程式前，確定「要做什麼」與「怎樣算做完」，並取得使用者對計畫的確認。

若 `$ARGUMENTS` 是空的，請使用者提供 issue 編號，然後停止。

## 步驟

1. 執行 `gh issue view $ARGUMENTS --comments`，讀取標題、內容與留言。
	- 若指令失敗，回報錯誤訊息並停止。常見原因：未登入 `gh`、不在 git 專案內、編號不存在。
2. 檢查 issue 是否有驗收條件（可逐條驗證的完成標準）。
	- 若有：逐條列出。
	- 若沒有或內容模糊：讀相關程式碼，草擬 3～7 條驗收條件，請使用者確認。使用者確認前，不得進入步驟 3。
3. 讀相關程式碼，找出要修改的位置與可重用的既有函式。
4. 提出實作計畫，內容包含：
	- 分支名稱：依 `workflow-core:git-workflow` 規則，格式 `feature/$ARGUMENTS-<英文簡述>`；修 bug 用 `bugfix/$ARGUMENTS-<英文簡述>`。
	- 要修改或新增的檔案。
	- 每條驗收條件對應到哪個改動。
	- 會用到假資料、mock 或寫死值的地方。若有，說明原因與之後如何換成真實作。
	- 若步驟 2 有新草擬的驗收條件，計畫要包含「用 `gh issue edit` 把驗收條件更新到 issue」。
5. 停下來，等使用者確認計畫。確認前不得修改任何檔案、不得開分支。

## 計畫確認後

1. 確認工作區沒有未 commit 的改動。若有，列出檔案並詢問使用者如何處理，不得自行 stash 或丟棄。
2. 切到預設分支並 `git pull`，再用 `git switch -c <分支名稱>` 開分支。
3. 依計畫實作。
4. 完成後提醒使用者：先自己測試，測完再執行 `/dev-buddy:issue-finish $ARGUMENTS`。
