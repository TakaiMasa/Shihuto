# 会計アプリを新規Repoで立ち上げる手順

このドキュメントは、既存の勤怠アプリとは分離して会計アプリを作るための最小手順です。

## 1. GitHubで新規Repoを作る

例: `shihuto-accounting`

```bash
git clone git@github.com:<your-org>/shihuto-accounting.git
cd shihuto-accounting
npx create-next-app@latest . --ts --eslint --app --src-dir=false
```

## 2. Vercelプロジェクトを分離

- 勤怠アプリ: 既存Vercelプロジェクト
- 会計アプリ: 新規Vercelプロジェクト
- 環境変数も別管理にする

## 3. 勤怠アプリ側で公開するAPI

このリポジトリに以下を追加済みです。

- `GET /api/accounting/labor-costs?yearMonth=YYYY-MM`
- `Authorization: Bearer <ACCOUNTING_API_KEY>` が必要

返却例:

```json
{
  "yearMonth": "2026-01",
  "totalLaborCost": 123456,
  "count": 5,
  "items": [
    {
      "id": "...",
      "user_id": "...",
      "year_month": "2026-01",
      "total_salary": 30000,
      "profiles": { "name": "山田" }
    }
  ]
}
```

## 4. 勤怠アプリ側の環境変数

```bash
ACCOUNTING_API_KEY=xxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
```

## 5. 会計アプリ側の同期方針（推奨）

1. 月次データ取得: `labor-costs?yearMonth=YYYY-MM`
2. 取り込み先テーブルに `source_app`, `source_key` を持たせる
3. `source_key` でUPSERTして冪等にする
4. 同期ログ（成功件数/失敗件数）を保存する

## 6. 次に追加するとよいAPI

- `GET /api/accounting/attendance-daily?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/accounting/stores`
- `GET /api/accounting/staff`

段階的に追加して、会計アプリ側の計算責務を明確に保つのがおすすめです。
