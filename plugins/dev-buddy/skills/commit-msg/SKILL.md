---
name: commit-msg
description: 根據目前 staged 的變更，產生繁體中文、帶 emoji 類型前綴的 git commit message。使用者要寫 commit message、整理提交說明時使用。只產生文字，不會自動 stage、commit 或 push。
---

# Commit Message 產生器

## 步驟

1. 執行 `git diff --cached --stat` 與 `git diff --cached`，取得 staged 的變更。
2. 若沒有任何 staged 變更，告訴使用者先 `git add`，然後停止。
3. 判斷這次變更的類型與影響範圍（scope），依下方格式產生訊息。
4. 只輸出 commit message 本身，讓使用者自己決定要不要使用。不要執行 `git commit`。

## 格式

```
<emoji> <type>(<scope>): <摘要>

- <細節 1>
- <細節 2>
```

| emoji | type | 用途 |
|---|---|---|
| ✨ | feat | 新功能 |
| 🐞 | fix | 修 bug |
| 📃 | docs | 只改文件 |
| 🦄 | refactor | 重構，不改變行為 |
| 🧪 | test | 新增或修改測試 |
| 🐳 | chore | 建置、設定、雜項 |

## 規則

- 摘要用繁體中文，30 字以內，不加句號。
- scope 用受影響的模組或資料夾名稱，例如 `auth`、`user-api`。
- 細節最多 5 點，說明「改了什麼、為什麼改」。
- 變更很小時（例如改一個錯字），可以省略細節。

## 範例

```
✨ feat(user-api): 新增使用者停用功能

- 新增 PATCH /users/:id/disable
- 停用後清除該使用者所有 session
```
