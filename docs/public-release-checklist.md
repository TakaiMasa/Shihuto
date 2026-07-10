# GitHub 公開前チェックリスト

ES などで GitHub URL を共有する前に、以下を確認してください。

## 公開してよい可能性が高いもの

- アプリのソースコード
- DB スキーマ、RLS ポリシー、マイグレーション SQL
- 実値を伏せた環境変数サンプル
- 架空データまたは匿名化済みの画面スクリーンショット
- 技術選定、設計意図、実装上の工夫を説明する README / docs

## 公開前に確認・削除すべきもの

- `.env.local`、`.env`、Vercel / Supabase から取得した実キー
- `SUPABASE_SERVICE_ROLE_KEY`、VAPID 秘密鍵、会計連携 API キー
- 実在スタッフの氏名、メールアドレス、給与、勤怠、交通費、シフト希望
- 店舗や関係者が非公開にしたい業務ルール、売上・人件費などの機密情報
- スクリーンショット内の個人情報、URL、QR コード、管理画面情報

## 推奨手順

1. `git status --short` で公開予定の変更を確認する。
2. `rg -n "(SUPABASE|SERVICE_ROLE|API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE|VAPID)" -g '!node_modules' -g '!package-lock.json'` で秘密情報らしき文字列を確認する。
3. `.env.example` にはダミー値だけを置く。
4. 本番 DB ではなく、デモ用 Supabase プロジェクトまたは匿名化済みデータを使う。
5. 公開リポジトリにする前に、店舗名や業務内容を公開してよいか関係者へ確認する。
6. 公開後にキー流出が疑われる場合は、対象キーを即時ローテーションする。

## ES に書くときの注意

GitHub URL は成果物の裏付けとして有効ですが、閲覧者がすぐ理解できるように README を整備し、何を作ったか・どの技術を使ったか・どこを工夫したかを本文にも簡潔に書くのがおすすめです。

## 確認方法（コマンドと見方）

### 1. `.env.local` や実キーが Git 管理されていないか

```bash
git ls-files | rg '(^|/)\.env|\.pem$|\.vercel|supabase.*\.env'
find . -maxdepth 3 -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' \) -not -path './node_modules/*' -not -path './.git/*' -print
```

- 1つ目のコマンドは「すでに Git に管理されている危険なファイル」を探します。何も表示されなければ基本的に問題ありません。
- 2つ目のコマンドは「ローカルに存在する env / pem ファイル」を探します。`.env.example` 以外が表示された場合、そのファイルは公開対象にしないでください。

### 2. Supabase / Vercel / API キーの実値が混ざっていないか

```bash
rg -n "(SUPABASE_SERVICE_ROLE_KEY\s*=|ACCOUNTING_API_KEY\s*=|VAPID_PRIVATE|NEXT_PUBLIC_SUPABASE_URL\s*=|NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=|password\s*=|sk-[A-Za-z0-9])" \
  -g '!node_modules' \
  -g '!package-lock.json' \
  -g '!public/workbox-*.js' \
  -g '!public/sw.js' \
  -g '!public/swe-worker-*.js'
```

- `.env.example` の `your-...` や `xxxx` のようなダミー値だけなら問題ありません。
- `https://実プロジェクトID.supabase.co`、長いランダム文字列、秘密鍵、Vercel トークンなどが出た場合は削除し、必要ならキーを再発行してください。
- `NEXT_PUBLIC_` から始まる値はブラウザへ公開されます。Supabase anon key や VAPID public key は公開前提ですが、サービスロールキーや秘密鍵は絶対に `NEXT_PUBLIC_` に入れないでください。

### 3. 実スタッフ情報・給与・勤怠などが含まれていないか

```bash
rg -n "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|山田|佐藤|鈴木|田中|高橋|給与|交通費|勤怠|シフト希望" \
  -g '!node_modules' \
  -g '!package-lock.json'
```

- メールアドレスや実名が表示された場合は、サンプル値なのか実在人物なのかを確認してください。
- DB スキーマ名、画面文言、要件説明としての「給与」「勤怠」「交通費」は問題になりにくいですが、実際の金額・勤務日・個人名がセットで出る場合は削除または匿名化してください。
- スクリーンショットを載せる場合は、氏名・メール・給与額・勤怠時刻・QRコード・管理画面URLが見えていないか目視で確認してください。

### 4. 店舗名・業務フローを公開してよいか

コード検索だけでは「公開してよいか」は判断できません。以下の観点で確認してください。

- 店舗名、ロゴ、実運用の URL、打刻ページのパスを公開して問題ないか。
- 給与計算ルール、交通費ルール、締め日・支払日などの業務ルールを公開して問題ないか。
- 実店舗向けに作ったものなら、店長・関係者に「GitHub で公開してよい範囲」を確認したか。

迷う場合は、店舗名を架空名に置換し、README では「飲食店向け」「複数店舗向け」のように一般化するのが安全です。
