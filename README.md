# Shihuto

飲食店向けのシフト提出・勤怠打刻・給与管理を一元化する Next.js アプリケーションです。Supabase Auth / Database をバックエンドに利用し、スタッフ向け画面と管理者向け画面を分けて運用できます。

## 主な機能

- **認証**: Supabase Auth によるログイン、管理者によるスタッフ登録
- **シフト管理**: 出勤不可日の提出、確定シフトの閲覧・管理
- **勤怠管理**: 店舗別打刻、勤怠履歴、管理者による勤怠修正
- **給与管理**: 店舗別時給、深夜手当、交通費を考慮した月次給与計算と PDF 出力
- **PWA**: インストール促進、Service Worker、Web Push 通知の購読 API
- **会計連携 API**: 別リポジトリの会計アプリ向けに人件費・勤怠・店舗・スタッフ情報を提供

## 技術スタック

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS
- Supabase Auth / Database
- `@ducanh2912/next-pwa`
- jsPDF / jspdf-autotable

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. 環境変数を作成

```bash
cp .env.example .env.local
```

`.env.local` に Supabase と連携 API 用の値を設定してください。実際の秘密情報は GitHub に公開しないでください。

### 3. データベースを準備

Supabase の SQL Editor などで、`supabase/migration.sql` と必要な追加マイグレーションを適用します。

```text
supabase/migration.sql
supabase/add_shift_submissions.sql
supabase/add_3breaks.sql
supabase/fix_rls_policies.sql
supabase/add_store_hourly_wages.sql
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。

## 利用可能なスクリプト

```bash
npm run dev    # 開発サーバーを起動
npm run build  # 本番ビルド
npm run start  # 本番サーバーを起動
npm run lint   # ESLint を実行
```

## 会計アプリ連携 API

このアプリは、別の会計アプリに人件費データを提供できます。

- `GET /api/accounting/labor-costs?yearMonth=YYYY-MM`
- `GET /api/accounting/attendance-daily?date=YYYY-MM-DD`
- `GET /api/accounting/attendance-daily?from=YYYY-MM-DD&to=YYYY-MM-DD&storeId=<optional>`
- `GET /api/accounting/stores`
- `GET /api/accounting/staff?includeInactive=true|false`

認証には `Authorization: Bearer <ACCOUNTING_API_KEY>` が必要です。詳細は `docs/accounting-app-bootstrap.md` を参照してください。

## 公開前の確認

GitHub で公開する前に、以下を必ず確認してください。

- `.env.local` などの実値入り環境変数ファイルをコミットしていないこと
- Supabase の `SUPABASE_SERVICE_ROLE_KEY`、VAPID 秘密鍵、会計連携 API キーを公開していないこと
- 本番 DB に実在スタッフの氏名・メールアドレス・給与・勤怠などの個人情報を含めたまま公開していないこと
- リポジトリ内の店舗名や業務フローを公開して問題ないことを関係者に確認していること
- 公開後に運用する場合は Supabase RLS と管理者権限を再確認していること

具体的な確認コマンドと判断基準は `docs/public-release-checklist.md` を参照してください。

## ES 記載例

```text
飲食店向けに、シフト提出・勤怠打刻・給与計算を一元管理する Web アプリを開発しました。Next.js / TypeScript / Supabase を用い、スタッフは出勤不可日の提出、確定シフトの確認、店舗別打刻、給与確認を行えます。管理者はスタッフ登録、シフト確定、勤怠修正、店舗別時給・交通費を反映した給与計算、PDF 明細出力を行えます。RLS や API キー認証を用いて権限管理にも配慮しました。
GitHub: <リポジトリURL>
```

## ライセンス

現時点ではライセンス未設定です。第三者による利用条件を明確にしたい場合は、公開前に `LICENSE` を追加してください。
