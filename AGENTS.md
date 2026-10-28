<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HOKUMA の開発ルール

北大生専用のフリマ「HOKUMA」。Next.js(App Router) + Supabase + Tailwind v4。`main` に入ると Vercel で本番に自動デプロイされる。
クラウド版・VS Code 版など複数の Claude Code がこのリポジトリを触るので、会話の記憶ではなくこのファイルとコードを共通の前提にする。

## 作業の進め方
- 作業を始める前に必ず `git pull`(origin/main を取り込む)。別の場所で同時に同じ箇所を編集しない。
- 終わったら型チェック・ビルド・lint を通し、PR を作って `main` にマージするところまでやる(オーナーの方針)。
- コミットメッセージ・PR・コメント・画面の文言は日本語。コード中のコメントも、周りに合わせて日本語でやさしく書く。
- 利用者の画面に出す文言は、北大生向けにわかりやすく、です・ます調で。

## 確認コマンド
- 型チェック: `npx tsc --noEmit`
- lint: `npx eslint app components lib`(`react-hooks/set-state-in-effect` などの既存エラーがある。新しく増やさないこと)
- ビルド: `npm run build`(Supabase に繋がない環境では `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` にダミー値を入れればビルドは通る)

## データベース(Supabase)
- SQL は `supabase/migrations/0001_enable_rls.sql` の末尾に `-- PART XX:` として追記する(AA, AB, … の順。最後の PART を確認して次の記号を使う)。新しいファイルは作らない。
- SQL はオーナーが Supabase ダッシュボードの SQL Editor に貼って手動で実行する。SQL が必要な変更は、PR とあわせて「どの PART を実行すればよいか」を必ず伝える。何度実行しても壊れないように書く(`create or replace`、`drop policy if exists`、`if not exists` など)。
- すべてのテーブルで RLS を有効にする。ブラウザから直接 Supabase を呼ぶ作りなので、権限チェックは必ず DB 側(RLS・`SECURITY DEFINER` の RPC)で行う。
- `item` と `demand` は列単位で権限を絞っている(`user_id`・購入者などを隠すため)。`select("*")` は使わず、`lib/itemColumns.ts` の `ITEM_COLUMNS` など決まった列を指定する。
- 管理者の判定は DB では `public.is_admin()`、画面では `lib/adminEmails.ts` の `isAdminEmail()`。管理者を増やすときは両方と、集計から運営を除く `public.staff_ids()`（migration PART AR）も直す。
- 「僕も！」した人など、利用者を特定できる情報は管理者用の RPC 以外から見えないようにする。

## 画面まわりの決まりごと
- お知らせは `alert()` ではなく `lib/toast.ts` の `toast()` を使う(ルートレイアウトの `<Toaster />` に表示される)。はい/いいえの確認だけ `confirm()` のままでよい。
- ログインが必要なページへの誘導は `lib/nav.ts` の `loginPath()` を使う(ログイン後に元のページへ戻れる)。「戻る」は `goBack()`。
- ヘッダーは `components/Header.tsx`、管理者ページは `app/admin/*`。欲しい！機能は `app/demands/*`・`lib/demand.ts`・`components/Demand*.tsx`。
- 色はオレンジ(`orange-700` など)と `stone` 系が基調。スマホでの見え方を優先して確認する。
