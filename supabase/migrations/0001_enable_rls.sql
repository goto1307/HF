-- 北フリ: Row Level Security (RLS) を有効化するマイグレーション
--
-- 背景:
--   このアプリはブラウザから直接Supabaseにアクセスしており、
--   これまでRLS(行単位のアクセス制御)が設定されていなかった。
--   そのため理論上、ログインしていない人やDBの知識がある人が
--   ブラウザの開発者ツール等から直接Supabaseに命令を送ることで、
--   他人のデータを読んだり書き換えたりできる状態だった。
--
-- 適用方法:
--   このファイルの中身を全部コピーし、Supabaseダッシュボードの
--   「SQL Editor」に貼り付けて実行する。詳しい手順はチャットの説明を参照。
--
-- 構成:
--   PART A: item(の一部)以外のテーブル。今すぐ適用してOK。
--   PART B: item テーブルの UPDATE と、購入/受取RPC関数の設定。
--           先に「事前確認」のSELECT文を実行してから適用すること。
--           (順番を間違えると、購入・受取機能が一時的に動かなくなる)

-- ============================================================
-- PART A: favorite / message / review / report / meetup / notification
-- ============================================================

-- ---------- favorite (いいね) ----------
alter table public.favorite enable row level security;

drop policy if exists "favorite_select_all" on public.favorite;
create policy "favorite_select_all"
on public.favorite for select
using (true); -- 一覧ページのいいね数表示は未ログインでも見えるため、閲覧は誰でも許可

drop policy if exists "favorite_insert_own" on public.favorite;
create policy "favorite_insert_own"
on public.favorite for insert
to authenticated
with check (auth.uid() = user_id); -- 自分の名義でしかいいねできない

drop policy if exists "favorite_delete_own" on public.favorite;
create policy "favorite_delete_own"
on public.favorite for delete
to authenticated
using (auth.uid() = user_id); -- 自分がつけたいいねしか消せない


-- ---------- message (商品ごとの公開Q&A + 個別取引チャット) ----------
alter table public.message enable row level security;

drop policy if exists "message_select_participant_or_public" on public.message;
create policy "message_select_participant_or_public"
on public.message for select
using (
  buyer_id is null                 -- 公開Q&Aは誰でも閲覧可
  or auth.uid() = buyer_id         -- 個別チャットは買い手本人
  or auth.uid() = seller_id        -- または出品者本人のみ閲覧可
);

drop policy if exists "message_insert_valid" on public.message;
create policy "message_insert_valid"
on public.message for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    -- 公開Q&A: buyer_idを付けずに投稿
    buyer_id is null
    or
    -- 個別チャット: 本当にその商品の買い手 or 出品者本人だけが送れる
    (
      buyer_id is not null
      and (auth.uid() = buyer_id or auth.uid() = seller_id)
      and exists (
        select 1 from public.item i
        where i.id = message.item_id
          and i.user_id = message.seller_id
      )
    )
  )
);
-- update/deleteのポリシーは作らない → アプリ側で使っていないため、そのまま「禁止」になる


-- ---------- review (出品者への評価) ----------
alter table public.review enable row level security;

drop policy if exists "review_select_participant" on public.review;
drop policy if exists "review_select_all" on public.review;
create policy "review_select_all"
on public.review for select
using (true); -- 出品者ページ・商品ページで平均評価を誰でも見られるようにするため公開

drop policy if exists "review_insert_valid_purchase" on public.review;
create policy "review_insert_valid_purchase"
on public.review for insert
to authenticated
with check (
  auth.uid() = reviewer_id
  and exists (
    select 1 from public.item i
    where i.id = review.item_id
      and i.user_id = review.seller_id
      and i.buyer_id = auth.uid()
      and i.received = true        -- 受け取り確認済みの購入者しか評価できない
  )
);


-- ---------- report (通報) ----------
-- 注意: app/admin/reports/page.tsx という管理画面が追加されており、
--   そこでは「管理者かどうか」をフロントエンドのメールアドレス一覧
--   (ADMIN_EMAILS)だけで判定している。RLSがない今の状態だと、
--   ログイン済みなら誰でも devtools から直接 report/item を
--   読み書きできてしまう(見た目のガードだけで実際には無防備)。
--   下のポリシーで「管理者メールアドレスの場合のみ」閲覧・削除できる
--   ようDB側でも強制する。ADMIN_EMAILSを変更したら、このSQLの
--   admin_emails 配列も合わせて更新すること。
alter table public.report enable row level security;

drop policy if exists "report_insert_authenticated" on public.report;
create policy "report_insert_authenticated"
on public.report for insert
to authenticated
with check (true); -- ログインユーザーのみ通報可能(未ログインでは不可に)

drop policy if exists "report_select_admin_only" on public.report;
create policy "report_select_admin_only"
on public.report for select
to authenticated
using (
  (auth.jwt() ->> 'email') in (
    'debuchi.sora.b0@elms.hokudai.ac.jp',
    'goto.kanata.w1@elms.hokudai.ac.jp'
  )
);

drop policy if exists "report_delete_admin_only" on public.report;
create policy "report_delete_admin_only"
on public.report for delete
to authenticated
using (
  (auth.jwt() ->> 'email') in (
    'debuchi.sora.b0@elms.hokudai.ac.jp',
    'goto.kanata.w1@elms.hokudai.ac.jp'
  )
);


-- ---------- meetup (待ち合わせ調整) ----------
-- 注意: 当初は出品者しか提案できない設計だったが、購入者側からも
--   提案できるよう双方向に変更した(2026-09頃)。実データベースには
--   もともと buyer_agreed 列が存在しておらず、代わりに
--   proposed_by(直近の提案者) と agreed(相手側の同意) の2列を
--   追加している。以下はその追加をSupabase側で直接実行した記録:
--
-- alter table public.meetup add column if not exists proposed_by uuid references auth.users(id);
-- alter table public.meetup add column if not exists agreed boolean not null default false;
-- update public.meetup m set proposed_by = i.user_id
--   from public.item i where m.item_id = i.id and m.proposed_by is null;

alter table public.meetup enable row level security;

drop policy if exists "meetup_select_participant" on public.meetup;
create policy "meetup_select_participant"
on public.meetup for select
using (
  auth.uid() = buyer_id
  or auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
);

drop policy if exists "meetup_insert_seller_only" on public.meetup;
drop policy if exists "meetup_insert_participant" on public.meetup;
create policy "meetup_insert_participant"
on public.meetup for insert
to authenticated
with check (
  proposed_by = auth.uid()
  and (
    auth.uid() = buyer_id
    or auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
  )
);

drop policy if exists "meetup_update_participant" on public.meetup;
create policy "meetup_update_participant"
on public.meetup for update
to authenticated
using (
  auth.uid() = buyer_id
  or auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
)
with check (
  auth.uid() = buyer_id
  or auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
);


-- ---------- notification (通知) ----------
alter table public.notification enable row level security;

drop policy if exists "notification_select_own" on public.notification;
create policy "notification_select_own"
on public.notification for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notification_update_own" on public.notification;
create policy "notification_update_own"
on public.notification for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
-- insertポリシーは作らない → 通知はDB側のトリガー/RPC(SECURITY DEFINER)から
-- 作られている想定のため、一般ユーザーが直接insertする経路は塞いだままにする


-- ---------- storage: images バケット ----------
drop policy if exists "images_insert_authenticated" on storage.objects;
create policy "images_insert_authenticated"
on storage.objects for insert
to authenticated
with check (bucket_id = 'images');
-- 読み取り(表示)は、バケット自体がPublic設定になっていればRLSと無関係に可能。
-- update/deleteのポリシーは作らない → 誰も他人の画像を上書き・削除できないようにする


-- ============================================================
-- PART B: item テーブル(このパートは下の「事前確認」を先に実行してから)
-- ============================================================

-- --- 事前確認: mark_item_sold / mark_item_received がSECURITY DEFINERか確認 ---
-- 以下を単独で実行し、結果の prosecdef が両方 true になっているか確認すること。
--
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
--        p.prosecdef
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('mark_item_sold', 'mark_item_received');
--
-- prosecdef が false(または結果が0件)の場合、下のitemポリシーを先に適用すると
-- 「購入する」「受け取れました」ボタンが動かなくなる。
-- その場合は、上のクエリで取れた args をそのまま使って次を実行してから
-- (関数名・引数はプロジェクトの実際の定義に合わせて調整すること):
--
-- alter function public.mark_item_sold(<argsをここに>) security definer set search_path = public;
-- alter function public.mark_item_received(<argsをここに>) security definer set search_path = public;
--
-- 補足: 現在のフロントは mark_item_sold を { p_item_id } のみで呼んでいる
--   (buyer_id を渡していない)。つまり関数側で auth.uid() を買い手として
--   書き込んでいる前提。この関数がSECURITY DEFINERでない場合、
--   買い手(出品者ではない人)からのUPDATEはowner-onlyポリシーで拒否されるため、
--   購入ボタンが必ず失敗する。

alter table public.item enable row level security;

drop policy if exists "item_select_all" on public.item;
create policy "item_select_all"
on public.item for select
using (true); -- 一覧・詳細ページは未ログインでも閲覧できる仕様のため、閲覧は誰でも許可

drop policy if exists "item_insert_own" on public.item;
create policy "item_insert_own"
on public.item for insert
to authenticated
with check (auth.uid() = user_id); -- 自分の名義でしか出品できない

drop policy if exists "item_update_owner_only" on public.item;
create policy "item_update_owner_only"
on public.item for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
-- 出品者本人以外は直接UPDATEできない。
-- 購入(sold化)・受け取り確認は、出品者以外のユーザーが行うため、
-- 上の「事前確認」でSECURITY DEFINER化したRPC経由でのみ可能になる。

drop policy if exists "item_delete_own" on public.item;
create policy "item_delete_own"
on public.item for delete
to authenticated
using (
  auth.uid() = user_id
  or (auth.jwt() ->> 'email') in (
    'debuchi.sora.b0@elms.hokudai.ac.jp',
    'goto.kanata.w1@elms.hokudai.ac.jp'
  )
); -- 自分の出品、または管理者(admin/reports画面用)のみ削除できる


-- ============================================================
-- PART C: 北大メール限定チェックをDB側でも強制する(任意・推奨)
-- ============================================================
--
-- 背景:
--   app/register/page.tsx の isValidEmail() はフロントエンドの入力チェックに
--   過ぎない。Supabaseの anon key はブラウザに公開されているため、
--   登録画面を経由せず直接Supabaseの signUp API を叩けば、
--   北大メール以外(gmail.com等)でも登録できてしまう。
--   これを本当に防ぐには、auth.users への挿入時にDB側でチェックする必要がある。
--
-- 適用方法: PART A/Bと同様にSQL Editorにコピーして実行するだけ。
--   ※ 既存の登録済みユーザーには影響しない(新規登録時のみチェックされる)。

create or replace function public.enforce_hokudai_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email !~* '^[^@]+@(eis\.hokudai\.ac\.jp|hokudai\.ac\.jp|elms\.hokudai\.ac\.jp)$' then
    raise exception '北海道大学のメールアドレスのみ登録できます';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_hokudai_email_trigger on auth.users;
create trigger enforce_hokudai_email_trigger
before insert on auth.users
for each row
execute function public.enforce_hokudai_email();


-- ============================================================
-- PART D: 購入キャンセルRPC・メッセージ通知の出し分け(新機能)
-- ============================================================
--
-- 背景:
--   「商品購入後にキャンセルできない」「通知内容が公開Q&Aと個別チャットで
--   同じで区別がつかない」という要望に対応するための関数。
--   どちらも mark_item_sold / mark_item_received と同じ理由で、
--   買い手・売り手それぞれの相手のデータ(item / notification)を
--   書き換える必要があるため、SECURITY DEFINER 関数として実装する。
--
-- 注意:
--   item.id の型が bigint でない場合(integer など)、
--   下の cancel_purchase(bigint) の引数型を実際の型に合わせて調整すること。
--   また、message テーブルへの新規メッセージ挿入時にすでに何らかの
--   通知作成トリガーが存在する場合、二重に通知が飛ぶ可能性があるため、
--   既存のトリガーがあれば先に drop trigger で削除してから適用すること
--   (Database → Triggers 画面で message テーブルのトリガー一覧を確認)。

create or replace function public.cancel_purchase(p_item_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_title text;
  v_received boolean;
  v_recipient uuid;
begin
  select user_id, buyer_id, title, received
  into v_seller_id, v_buyer_id, v_title, v_received
  from public.item where id = p_item_id;

  if v_buyer_id is null then
    raise exception 'この商品は購入されていません';
  end if;
  if v_received then
    raise exception '受け取り確認済みの取引はキャンセルできません';
  end if;
  if auth.uid() <> v_seller_id and auth.uid() <> v_buyer_id then
    raise exception 'この取引の当事者のみキャンセルできます';
  end if;

  update public.item
  set sold = false, buyer_id = null, received = false
  where id = p_item_id;

  v_recipient := case when auth.uid() = v_seller_id then v_buyer_id else v_seller_id end;
  insert into public.notification (user_id, message, item_id, read)
  values (v_recipient, '「' || v_title || '」の取引がキャンセルされました', p_item_id, false);
end;
$$;

grant execute on function public.cancel_purchase(bigint) to authenticated;


create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_title text;
  v_seller_id uuid;
  v_recipient uuid;
  v_message text;
begin
  select title, user_id into v_item_title, v_seller_id
  from public.item where id = new.item_id;

  if new.buyer_id is null then
    -- 公開Q&A: 自分の投稿以外なら出品者に通知
    if new.user_id = v_seller_id then
      return new;
    end if;
    v_recipient := v_seller_id;
    v_message := '「' || v_item_title || '」に質問が届きました';
  else
    -- 個別チャット: 送った本人以外(取引相手)に通知
    if new.user_id = new.buyer_id then
      v_recipient := new.seller_id;
    else
      v_recipient := new.buyer_id;
    end if;
    v_message := '「' || v_item_title || '」の取引相手からメッセージが届きました';
  end if;

  insert into public.notification (user_id, message, item_id, read)
  values (v_recipient, v_message, new.item_id, false);

  return new;
end;
$$;

drop trigger if exists notify_on_new_message_trigger on public.message;
create trigger notify_on_new_message_trigger
after insert on public.message
for each row
execute function public.notify_on_new_message();


-- ============================================================
-- PART E: 出品者プロフィール(一言メッセージ・性別・年齢)
-- ============================================================
--
-- 背景: 出品者の公開プロフィールページ・マイページに一言メッセージや
--   性別・年齢を表示できるようにするための新規テーブル。
--   auth.users の user_metadata は「本人しか読めない」ため、
--   他人に公開する情報は別テーブルに置く必要がある。

create table if not exists public.profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bio text,
  gender text,
  age integer,
  updated_at timestamptz not null default now()
);

alter table public.profile enable row level security;

drop policy if exists "profile_select_all" on public.profile;
create policy "profile_select_all"
on public.profile for select
using (true); -- 出品者ページで誰でも見られるように公開

drop policy if exists "profile_insert_own" on public.profile;
create policy "profile_insert_own"
on public.profile for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profile_update_own" on public.profile;
create policy "profile_update_own"
on public.profile for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- ============================================================
-- PART F: review.rating を text(good/normal/bad)から
--          integer(1〜5の★評価)に変更(適用済み・記録用)
-- ============================================================
--
-- 背景: 当初 rating は 'good'/'normal'/'bad' という文字列だったが、
--   アプリのUIが★1〜5の数値評価(StarRatingコンポーネント)に変更された。
--   DB側の制約が更新されていなかったため、評価投稿が
--   「new row for relation "review" violates check constraint
--   "review_rating_check"」で必ず失敗していた。
--
-- 2026-09-25頃、以下を実行して修正済み:
--
-- alter table public.review drop constraint if exists review_rating_check;
--
-- alter table public.review
--   alter column rating type integer
--   using (
--     case rating
--       when 'good' then 5
--       when 'normal' then 3
--       when 'bad' then 1
--       else null
--     end
--   );
--
-- alter table public.review
--   add constraint review_rating_check check (rating between 1 and 5);
--
-- 注意: このファイルの他の箇所(PART A等)で rating を good/normal/bad
--   として扱っているコメント・想定は古い情報なので、実装の参考にしないこと。
--   現在の正しい形式は 1〜5 の整数。


-- ============================================================
-- 参考: 通報されたユーザーのBANについて(SQL不要)
-- ============================================================
--
-- Supabase Authには「ユーザーをBANする」機能が標準で搭載されている
-- (auth.users.banned_until)。新しいテーブルや関数は不要で、
-- Supabaseダッシュボードの Authentication → Users から該当ユーザーを
-- 検索し、「Ban user」を選ぶだけで即座にログイン・APIアクセスを
-- 止められる。通報内容は report テーブル(Table Editor)で確認できる。
--
-- アプリ内に「通報一覧→BANボタン」のような管理画面を作ることもできるが、
-- BAN操作には service_role キー(強い権限)が必要になり、
-- そのキーをブラウザ側のコードに置くことは絶対にできない。
-- 作る場合はサーバー側(Next.jsのAPI Routeなど)で安全にキーを扱う
-- 設計が別途必要になるため、今回は対象外としている。


-- ============================================================
-- 重要: 2026-10頃、teammateの方が独自にRLSポリシーをSupabase側で
--   直接設定していたことが判明した。ポリシー名がこのファイルの
--   PART A/Bと異なる(例: item は anyone_can_insert / anyone_can_read /
--   item_delete_admin_only / owner_can_delete など)。
--   つまり、このファイルのPART A/Bに書かれているポリシー名は
--   実際に本番へ適用されているものと一致していない可能性が高い。
--   本番の実態を確認するには、必ず以下を先に実行して現状を見ること:
--
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, policyname;
-- ============================================================


-- ============================================================
-- PART G: 未ログインでの出品・通報投稿を防ぐ(2026-10 監査で発見・適用済み)
-- ============================================================
--
-- 背景:
--   上記の監査で、item テーブルの "anyone_can_insert"(INSERT, with_check = true)
--   と report テーブルの "anyone_can_report" / "report_insert_anyone"
--   (どちらも INSERT, with_check = true)が、認証状態を一切チェックしない
--   完全に無条件のポリシーになっていることが判明した。
--   つまり、ログインしていない人でも anon key を使って直接Supabaseの
--   REST APIを叩けば、出品の投稿・通報の送信が無制限にできてしまう状態
--   だった(フロントエンドの「ログインしてください」はDB側では無力)。
--   下記を実行し、認証済みかつ本人名義でのみ許可するよう修正済み。
--
--   また、item テーブルには UPDATE ポリシーが一つも存在しておらず、
--   出品編集機能(app/items/[id]/edit)が保存時に失敗する状態だったため、
--   本人のみ更新できるポリシーもあわせて追加した。

drop policy if exists "anyone_can_insert" on public.item;
drop policy if exists "item_insert_own" on public.item;
create policy "item_insert_own"
on public.item for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "item_update_own" on public.item;
create policy "item_update_own"
on public.item for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "anyone_can_report" on public.report;
drop policy if exists "report_insert_anyone" on public.report;
drop policy if exists "report_insert_authenticated" on public.report;
create policy "report_insert_authenticated"
on public.report for insert
to authenticated
with check (true);


-- ============================================================
-- PART H: 管理者ダッシュボード(ユーザー一覧・BAN・通報者/通報対象の記録・全チャット閲覧)
-- ============================================================
--
-- 背景:
--   管理者(僕と出淵)専用のページから、全ユーザーの一覧表示・BAN・
--   通報者/通報対象の特定・商品ごとの個別チャット閲覧をできるようにする。
--   service_role キーはアプリの安全性を大きく損なうため一切使わず、
--   既存の mark_item_sold などと同じ SECURITY DEFINER 関数パターンで実現する。
--
--   report テーブルには「誰が通報したか」を記録する列がそもそも
--   存在しなかったため追加。あわせて、商品ページだけでなくユーザー
--   ページからも通報できるよう reported_user_id を追加し、item_id は
--   NOT NULL を外した(どちらか一方が入っていればよい)。

alter table public.report add column if not exists reporter_id uuid references auth.users(id);
alter table public.report add column if not exists reported_user_id uuid references auth.users(id);
alter table public.report alter column item_id drop not null;
alter table public.report drop constraint if exists report_target_check;
alter table public.report add constraint report_target_check check (item_id is not null or reported_user_id is not null);

drop policy if exists "report_insert_authenticated" on public.report;
create policy "report_insert_authenticated"
on public.report for insert
to authenticated
with check (reporter_id = auth.uid());

-- 管理者判定を1箇所にまとめる関数
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (auth.jwt() ->> 'email') = any (array[
    'debuchi.sora.b0@elms.hokudai.ac.jp',
    'goto.kanata.w1@elms.hokudai.ac.jp'
  ]);
$$;

-- 全ユーザー一覧(管理者のみ実行可)。auth.users は anon/authenticated からは
-- 直接読めないため、SECURITY DEFINER 関数の中からのみアクセスする。
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  nickname text,
  avatar_url text,
  created_at timestamptz,
  banned_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  return query
    select u.id,
           u.email::text,
           (u.raw_user_meta_data ->> 'nickname')::text as nickname,
           (u.raw_user_meta_data ->> 'avatar_url')::text as avatar_url,
           u.created_at,
           u.banned_until
    from auth.users u
    order by u.created_at desc;
end;
$$;
grant execute on function public.admin_list_users() to authenticated;

-- BAN / BAN解除(管理者のみ実行可)。banned_until は Supabase Auth(GoTrue)が
-- ログイン時に直接参照する列なので、これを更新するだけでログイン自体を拒否できる。
create or replace function public.admin_set_ban(target_id uuid, should_ban boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if target_id = auth.uid() then
    raise exception '自分自身はBANできません';
  end if;
  update auth.users
  set banned_until = case when should_ban then '2999-12-31'::timestamptz else null end
  where id = target_id;
end;
$$;
grant execute on function public.admin_set_ban(uuid, boolean) to authenticated;

-- 管理者は全ての個別チャット・公開Q&Aを閲覧できる(既存の当事者限定ポリシーに
-- 追加する形。Postgres は同一コマンドの permissive policy を OR で結合するため、
-- 一般ユーザーの閲覧範囲は従来どおり本人分のみに制限されたままになる)。
drop policy if exists "message_select_admin" on public.message;
create policy "message_select_admin"
on public.message for select
to authenticated
using (public.is_admin());

-- 「メアドにメッセージを送る」機能について:
--   このアプリには外部メール配信サービスの導入がないため、管理画面では
--   各ユーザー行に mailto: リンクを置き、管理者自身のメールソフトから
--   手動送信する形にしている。アプリから自動送信したい場合は、Resend等の
--   トランザクションメールサービスの契約とAPIキーが別途必要。


-- ============================================================
-- PART I: 通知insertバグの修正 + 通報の連投制限(1分に1回)
-- ============================================================
--
-- 背景:
--   1) items/[id]/chat/page.tsx の「受け取り確認」で、レビューを促す
--      自分宛の通知を直接 insert しているが、notification テーブルには
--      INSERTポリシーが一つも存在しなかったため、この insert は毎回
--      RLSに拒否されて静かに失敗していた(エラー処理もしていなかった)。
--      自分自身への通知だけを許可するポリシーを追加して修正する。
--
--   2) 通報を1分間に1回までに制限する。report_insert_authenticated の
--      with_check に「直近1分以内に自分が送った通報がないこと」を追加する。

drop policy if exists "notification_insert_own" on public.notification;
create policy "notification_insert_own"
on public.notification for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "report_insert_authenticated" on public.report;
create policy "report_insert_authenticated"
on public.report for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and not exists (
    select 1 from public.report r2
    where r2.reporter_id = auth.uid()
      and r2.created_at > now() - interval '1 minute'
  )
);


-- ============================================================
-- PART J: profileテーブルの実行確認 + meetup重複ポリシー整理 +
--          review/favoriteの閲覧を未ログインにも開放(2026-09-21適用済み)
-- ============================================================
--
-- 背景:
--   pg_policies / information_schema を実際に確認した結果、以下が判明した。
--
--   1) PART E の profile テーブルが一度も実行されておらず、マイページの
--      自己紹介・性別・年齢欄が常にサイレントに機能していなかった。
--      → PART E をそのまま実行して解消。
--
--   2) meetup テーブルに、双方向提案機能への移行時に消し忘れた
--      旧ポリシー "meetup_insert_seller" が残っていた。これは
--      proposed_by 列の整合性を一切チェックせず出品者からのinsertを
--      許可しており、出品者が自分の商品に対して proposed_by を
--      偽装できる抜け穴になっていた。また "meetup_select_participants"
--      "meetup_update_participants" も同内容の重複ポリシーだった。
--      → 3つとも削除(現行の *_participant 単数形のポリシーに統一)。
--
--   3) review_select_authenticated / favorite_select_authenticated が
--      authenticated ロール限定になっており、商品ページ自体は未ログイン
--      でも閲覧できる設計にもかかわらず、未ログインの訪問者には
--      星評価・いいね数が一切表示されていなかった(意図と不一致)。
--      → 誰でも閲覧できる review_select_all / favorite_select_all に統一。

drop policy if exists "meetup_insert_seller" on public.meetup;
drop policy if exists "meetup_select_participants" on public.meetup;
drop policy if exists "meetup_update_participants" on public.meetup;

drop policy if exists "review_select_authenticated" on public.review;
drop policy if exists "review_select_all" on public.review;
create policy "review_select_all"
on public.review for select
using (true);

drop policy if exists "favorite_select_authenticated" on public.favorite;
drop policy if exists "favorite_select_all" on public.favorite;
create policy "favorite_select_all"
on public.favorite for select
using (true);


-- ============================================================
-- PART K: 評価・通報の証拠隠滅を防ぐ + 入力値の制約をDB側にも入れる
-- ============================================================
--
-- 背景:
--   report.item_id と review.item_id がどちらも ON DELETE CASCADE で
--   item を参照していることが判明した。出品者は自分の商品をいつでも
--   削除できるため、
--     ・通報された出品者が商品を消す → 自分への通報記録も消える
--     ・★1を付けられた出品者が商品を消す → 悪い評価が平均から消える
--   という形で、通報・評価の両方を出品者側から無効化できる状態だった。
--
--   FK を張り替えるより、「取引が成立した商品・通報を受けている商品は
--   出品者自身では削除できない」を DELETE ポリシーに入れる方が確実。
--   レビューが付くのは必ず受取確認済み(= buyer_id あり)の商品なので、
--   buyer_id is null の条件だけで評価の消去は防げる。
--   管理者は item_delete_admin_only で引き続き削除できる。
--
--   注意: ポリシー式の中から直接 public.report を参照しても、report は
--   管理者限定のSELECTポリシーしか無いため一般ユーザーからは常に
--   0件に見えてしまい、チェックが素通りする。そのため SECURITY DEFINER
--   関数を経由して判定する。

create or replace function public.item_has_report(p_item_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.report where item_id = p_item_id);
$$;

-- 旧ポリシー。制限なしで自分の商品を削除できる内容で残っていたため、
-- これが生きている限り下の item_delete_own の制限はORで打ち消される。
drop policy if exists "owner_can_delete" on public.item;

drop policy if exists "item_delete_own" on public.item;
create policy "item_delete_own"
on public.item for delete
to authenticated
using (
  auth.uid() = user_id
  and buyer_id is null
  and not public.item_has_report(id)
);

-- 画面側の文字数・価格制限はすべてクライアント側だけだったため、
-- 直接APIを叩けば巨大なテキストや負の価格を投入できる状態だった。
alter table public.item drop constraint if exists item_price_range;
alter table public.item add constraint item_price_range
  check (price >= 0 and price <= 50000);

alter table public.item drop constraint if exists item_title_len;
alter table public.item add constraint item_title_len
  check (char_length(title) between 1 and 45);

alter table public.item drop constraint if exists item_detail_len;
alter table public.item add constraint item_detail_len
  check (detail is null or char_length(detail) <= 150);

alter table public.message drop constraint if exists message_content_len;
alter table public.message add constraint message_content_len
  check (char_length(content) between 1 and 500);

alter table public.review drop constraint if exists review_comment_len;
alter table public.review add constraint review_comment_len
  check (comment is null or char_length(comment) <= 500);

alter table public.report drop constraint if exists report_reason_len;
alter table public.report add constraint report_reason_len
  check (char_length(reason) <= 600);

alter table public.profile drop constraint if exists profile_bio_len;
alter table public.profile add constraint profile_bio_len
  check (bio is null or char_length(bio) <= 300);
