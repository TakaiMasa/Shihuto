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
- `GET /api/accounting/attendance-daily?from=YYYY-MM-DD&to=YYYY-MM-DD&storeId=<optional>`
- `GET /api/accounting/stores`
- `GET /api/accounting/staff?includeInactive=true|false`
- すべて `Authorization: Bearer <ACCOUNTING_API_KEY>` が必要

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

## 6. 推奨の同期順序

1. `labor-costs` で月次の人件費を取り込む
2. `stores` と `staff` でマスタ同期する
3. `attendance-daily` で日次明細を取り込む

この順序で進めると、会計アプリ側で段階的に画面実装しやすくなります。
