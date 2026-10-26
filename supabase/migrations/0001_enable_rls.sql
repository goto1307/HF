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


-- ============================================================
-- PART L: 自己退会(アカウント削除)機能
-- ============================================================
--
-- 背景:
--   ユーザーが自分でアカウントを削除できるようにする。実データを
--   物理削除すると外部キー先(item/message/review等)が壊れるため、
--   ソフトデリート方式にする: deleted_users テーブルに記録し、
--   banned_until を遠い未来にしてログイン自体もBANと同じ仕組みで
--   拒否する(即時性がない点はBAN機能と同じ既知の制約)。
--
--   退会後は「管理者以外」から、その人の個人ページ(profile)・
--   出品商品・評価(自分が評価された分)が見えなくなるようにする。
--   ただし、進行中の取引を突然失わせないよう、その商品の
--   出品者本人・購入者本人からは引き続き見える(is_deletedの
--   条件に auth.uid() = user_id / buyer_id の除外を入れている)。
--
--   注意点(今までと同じ罠): RLSポリシーの式の中から直接
--   deleted_users や item を素で参照すると、参照先のRLSが
--   適用されて意図通りに動かない。is_deleted() を SECURITY DEFINER
--   関数にして経由させることで回避する。

create table if not exists public.deleted_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_users enable row level security;
-- 一般ユーザー向けのポリシーは意図的に作らない。is_deleted() 関数
-- (テーブルオーナー権限で実行される)経由でのみ参照される想定。

create or replace function public.is_deleted(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.deleted_users where user_id = p_user_id);
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_email text;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  -- 元のメールアドレスをこのユーザーの行に残したままだと、Supabaseは
  -- アカウント存在確認を防ぐため同じメールでの再登録を無言でブロックする
  -- (エラーも出ず確認メールも届かない)。別物に書き換えて元のアドレスを
  -- 解放する。enforce_hokudai_email_trigger は before insert のみなので
  -- この update には影響しない。
  v_new_email := 'deleted_' || auth.uid()::text || '@deleted.invalid';

  insert into public.deleted_users (user_id) values (auth.uid())
    on conflict (user_id) do nothing;

  update auth.users
  set banned_until = '2999-12-31'::timestamptz,
      email = v_new_email
  where id = auth.uid();

  update auth.identities
  set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new_email))
  where user_id = auth.uid();
end;
$$;

-- item: 退会した出品者/購入者が絡む商品を、当事者以外・管理者以外から隠す
drop policy if exists "anyone_can_read" on public.item;
drop policy if exists "item_select_all" on public.item;
create policy "item_select_all"
on public.item for select
using (
  public.is_admin()
  or auth.uid() = user_id
  or auth.uid() = buyer_id
  or (not public.is_deleted(user_id) and (buyer_id is null or not public.is_deleted(buyer_id)))
);

-- profile: 退会した人のプロフィールを隠す
drop policy if exists "profile_select_all" on public.profile;
create policy "profile_select_all"
on public.profile for select
using (public.is_admin() or not public.is_deleted(user_id));

-- review: 退会した出品者への評価(平均点の元データ)を隠す
-- (退会した人が"書いた"レビュー = 現役セラーへの評価はそのまま残す)
drop policy if exists "review_select_all" on public.review;
create policy "review_select_all"
on public.review for select
using (public.is_admin() or not public.is_deleted(seller_id));

-- mark_item_sold: 退会済み出品者の商品を直接RPCで購入されるのを防ぐ
-- (ついでに、既に売却済みの場合に無言で何も起きない既存の不具合も
--  例外を投げる形に直す)
create or replace function public.mark_item_sold(p_item_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_title text;
  v_seller uuid;
begin
  select user_id into v_seller from public.item where id = p_item_id;
  if v_seller is null then
    raise exception '商品が見つかりません';
  end if;
  if public.is_deleted(v_seller) then
    raise exception 'この商品は購入できません';
  end if;

  update public.item
  set sold = true, buyer_id = auth.uid()
  where id = p_item_id and sold = false
  returning title, user_id into v_title, v_seller;

  if v_seller is null then
    raise exception 'この商品はすでに売却済みです';
  end if;

  insert into public.notification (user_id, message, item_id)
  values (v_seller, '「' || v_title || '」が売れました！', p_item_id);
end;
$function$;

-- message: 公開Q&A(buyer_id is null)の投稿に、商品の存在確認が
-- 一つもかかっていなかった(個別チャット側にはあった)。item のSELECT
-- ポリシーが上で退会ユーザーを隠す形になったのに合わせて、こちらも
-- 存在確認を入れて一貫させる。
drop policy if exists "message_insert_valid" on public.message;
create policy "message_insert_valid"
on public.message for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (buyer_id is null and exists (select 1 from public.item i where i.id = message.item_id))
    or (
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


-- ============================================================
-- PART M: 管理者による商品削除(理由付き・出品者へ通知)
-- ============================================================
--
-- 背景:
--   管理者は item_delete_admin_only ポリシーで既にどの商品でも
--   削除できるが、削除しても出品者には何も伝わらなかった
--   (/admin/reports の「商品ごと削除する」は理由なしの無言削除)。
--   理由を添えて通知するには、出品者本人以外への notification
--   insert が必要になる(notification_insert_own は本人分しか
--   許可しない)ため、SECURITY DEFINER 関数にまとめる。

create or replace function public.admin_delete_item(p_item_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  select title, user_id into v_title, v_owner from public.item where id = p_item_id;
  if v_owner is null then
    raise exception '商品が見つかりません';
  end if;

  delete from public.item where id = p_item_id;

  insert into public.notification (user_id, message, item_id, read)
  values (
    v_owner,
    '「' || v_title || '」が運営により削除されました。理由: ' || p_reason,
    null,
    false
  );
end;
$$;

grant execute on function public.admin_delete_item(bigint, text) to authenticated;


-- ============================================================
-- PART N: 管理者権限の強化(BAN時に出品も隠す/個別メッセージ・
--          レビューの削除/取引の強制キャンセル)
-- ============================================================
--
-- 背景: 「管理者権限で他に足りないところ」を洗い出した結果、
--   admin_set_ban が banned_until を変えるだけで deleted_users に
--   触れておらず、悪質ユーザーをBANしてもその出品・プロフィールは
--   誰からでも見え続けてしまうことが判明した(BANの目的が半分しか
--   達成されない)。あわせて、個別メッセージ・レビュー単体を
--   削除する手段が管理者にも一切なく、揉めた取引を強制的に
--   リセットする手段もなかったため、まとめて追加する。

-- BAN時にis_deleted()の対象にもする。自主退会(delete_own_account)は
-- メールアドレスを書き換えて再登録できるようにするが、管理者BANは
-- 悪用対策のためメールアドレスはそのまま(書き換えない = 再登録の
-- 抜け道を作らない)。/admin/users側では email が
-- deleted_%@deleted.invalid かどうかで「退会済み」と「BAN中」を
-- 見分ける。
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

  if should_ban then
    insert into public.deleted_users (user_id) values (target_id)
      on conflict (user_id) do nothing;
  else
    delete from public.deleted_users where user_id = target_id;
  end if;
end;
$$;

-- 個別メッセージの削除(通報された暴言・個人情報等の単体削除用)
create or replace function public.admin_delete_message(p_message_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  select user_id into v_sender from public.message where id = p_message_id;
  if v_sender is null then
    raise exception 'メッセージが見つかりません';
  end if;

  delete from public.message where id = p_message_id;

  insert into public.notification (user_id, message, item_id, read)
  values (v_sender, 'あなたのメッセージが運営により削除されました。理由: ' || p_reason, null, false);
end;
$$;
grant execute on function public.admin_delete_message(bigint, text) to authenticated;

-- 個別レビューの削除(誹謗中傷・個人情報を含むコメント等の単体削除用)
create or replace function public.admin_delete_review(p_review_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  select reviewer_id into v_reviewer from public.review where id = p_review_id;
  if v_reviewer is null then
    raise exception 'レビューが見つかりません';
  end if;

  delete from public.review where id = p_review_id;

  insert into public.notification (user_id, message, item_id, read)
  values (v_reviewer, 'あなたが投稿した評価が運営により削除されました。理由: ' || p_reason, null, false);
end;
$$;
grant execute on function public.admin_delete_review(bigint, text) to authenticated;

-- もめた取引の強制キャンセル(当事者双方が音信不通/紛争時に管理者が
-- 使う。cancel_purchase と同じ処理だが当事者チェックの代わりに
-- is_admin()で許可し、両者に理由付きで通知する)
create or replace function public.admin_cancel_purchase(p_item_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_title text;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '理由を入力してください';
  end if;

  select user_id, buyer_id, title into v_seller_id, v_buyer_id, v_title
  from public.item where id = p_item_id;

  if v_seller_id is null then
    raise exception '商品が見つかりません';
  end if;
  if v_buyer_id is null then
    raise exception 'この商品は購入されていません';
  end if;

  update public.item
  set sold = false, buyer_id = null, received = false
  where id = p_item_id;

  insert into public.notification (user_id, message, item_id, read)
  values
    (v_seller_id, '「' || v_title || '」の取引が運営によりキャンセルされました。理由: ' || p_reason, null, false),
    (v_buyer_id, '「' || v_title || '」の取引が運営によりキャンセルされました。理由: ' || p_reason, null, false);
end;
$$;
grant execute on function public.admin_cancel_purchase(bigint, text) to authenticated;


-- ============================================================
-- PART O: 管理者操作の監査ログ / ユーザーブロック機能 /
--          メッセージ単体の通報 / (フロント側)購入履歴表示の修正
-- ============================================================
--
-- 背景: 「追加した方がいい機能」を洗い出した結果の4点。
--   1) 管理者操作(BAN・商品/メッセージ/評価削除・取引強制キャンセル)
--      が誰にも記録されておらず、2人の管理者間で「どっちがやったか」
--      を後から追えなかった。
--   2) 通報とは別に、特定ユーザーからのメッセージだけを遮断する
--      ミュート機能が無かった。
--   3) 商品・ユーザー単位でしか通報できず、特定の1メッセージを
--      名指しで通報できなかった。
--   4) マイページの「購入した商品」がメッセージ履歴から算出されており、
--      cancel_purchase 等で取引をキャンセルしてもチャット履歴が
--      残る限り表示され続けていた(フロント側で別途修正)。

-- ---------- 1) 管理者操作ログ ----------
create table if not exists public.admin_action_log (
  id bigserial primary key,
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_id text,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.admin_action_log enable row level security;

drop policy if exists "admin_action_log_select_admin" on public.admin_action_log;
create policy "admin_action_log_select_admin"
on public.admin_action_log for select
to authenticated
using (public.is_admin());
-- insertポリシーは作らない。ログはSECURITY DEFINER関数の中からのみ
-- (テーブルオーナー権限でRLSを迂回して)書き込まれる想定。

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

  if should_ban then
    insert into public.deleted_users (user_id) values (target_id)
      on conflict (user_id) do nothing;
  else
    delete from public.deleted_users where user_id = target_id;
  end if;

  insert into public.admin_action_log (admin_id, action, target_id, detail)
  values (auth.uid(), case when should_ban then 'ban' else 'unban' end, target_id::text, null);
end;
$$;

create or replace function public.admin_delete_item(p_item_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  select title, user_id into v_title, v_owner from public.item where id = p_item_id;
  if v_owner is null then
    raise exception '商品が見つかりません';
  end if;

  delete from public.item where id = p_item_id;

  insert into public.notification (user_id, message, item_id, read)
  values (v_owner, '「' || v_title || '」が運営により削除されました。理由: ' || p_reason, null, false);

  insert into public.admin_action_log (admin_id, action, target_id, detail)
  values (auth.uid(), 'delete_item', p_item_id::text, p_reason);
end;
$$;

create or replace function public.admin_delete_message(p_message_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  select user_id into v_sender from public.message where id = p_message_id;
  if v_sender is null then
    raise exception 'メッセージが見つかりません';
  end if;

  delete from public.message where id = p_message_id;

  insert into public.notification (user_id, message, item_id, read)
  values (v_sender, 'あなたのメッセージが運営により削除されました。理由: ' || p_reason, null, false);

  insert into public.admin_action_log (admin_id, action, target_id, detail)
  values (auth.uid(), 'delete_message', p_message_id::text, p_reason);
end;
$$;

create or replace function public.admin_delete_review(p_review_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  select reviewer_id into v_reviewer from public.review where id = p_review_id;
  if v_reviewer is null then
    raise exception 'レビューが見つかりません';
  end if;

  delete from public.review where id = p_review_id;

  insert into public.notification (user_id, message, item_id, read)
  values (v_reviewer, 'あなたが投稿した評価が運営により削除されました。理由: ' || p_reason, null, false);

  insert into public.admin_action_log (admin_id, action, target_id, detail)
  values (auth.uid(), 'delete_review', p_review_id::text, p_reason);
end;
$$;

create or replace function public.admin_cancel_purchase(p_item_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_title text;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '理由を入力してください';
  end if;

  select user_id, buyer_id, title into v_seller_id, v_buyer_id, v_title
  from public.item where id = p_item_id;

  if v_seller_id is null then
    raise exception '商品が見つかりません';
  end if;
  if v_buyer_id is null then
    raise exception 'この商品は購入されていません';
  end if;

  update public.item
  set sold = false, buyer_id = null, received = false
  where id = p_item_id;

  insert into public.notification (user_id, message, item_id, read)
  values
    (v_seller_id, '「' || v_title || '」の取引が運営によりキャンセルされました。理由: ' || p_reason, null, false),
    (v_buyer_id, '「' || v_title || '」の取引が運営によりキャンセルされました。理由: ' || p_reason, null, false);

  insert into public.admin_action_log (admin_id, action, target_id, detail)
  values (auth.uid(), 'cancel_purchase', p_item_id::text, p_reason);
end;
$$;

-- ---------- 2) ユーザーブロック ----------
create table if not exists public.blocked_user (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocked_user enable row level security;

drop policy if exists "blocked_user_select_own" on public.blocked_user;
create policy "blocked_user_select_own"
on public.blocked_user for select
to authenticated
using (auth.uid() = blocker_id);

drop policy if exists "blocked_user_insert_own" on public.blocked_user;
create policy "blocked_user_insert_own"
on public.blocked_user for insert
to authenticated
with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "blocked_user_delete_own" on public.blocked_user;
create policy "blocked_user_delete_own"
on public.blocked_user for delete
to authenticated
using (auth.uid() = blocker_id);

create or replace function public.is_blocked_by(p_blocker uuid, p_blocked uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.blocked_user where blocker_id = p_blocker and blocked_id = p_blocked);
$$;

drop policy if exists "message_insert_own" on public.message;
drop policy if exists "message_insert_valid" on public.message;
create policy "message_insert_valid"
on public.message for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (buyer_id is null
      and exists (select 1 from public.item i where i.id = message.item_id)
      and not public.is_blocked_by(seller_id, auth.uid()))
    or (
      buyer_id is not null
      and (auth.uid() = buyer_id or auth.uid() = seller_id)
      and exists (
        select 1 from public.item i
        where i.id = message.item_id
          and i.user_id = message.seller_id
      )
      and not public.is_blocked_by(
        case when auth.uid() = buyer_id then seller_id else buyer_id end,
        auth.uid()
      )
    )
  )
);

-- ---------- 3) メッセージ単体の通報 ----------
alter table public.report add column if not exists message_id bigint references public.message(id) on delete set null;
alter table public.report drop constraint if exists report_target_check;
alter table public.report add constraint report_target_check
  check (item_id is not null or reported_user_id is not null or message_id is not null);


-- ============================================================
-- PART P: 管理者向けデータバックアップ(全テーブルJSONエクスポート)
-- ============================================================
--
-- 背景: 無料プランのSupabaseにはダッシュボードから使える自動バックアップが
--   無いため、誤操作によるデータ消失やアカウント喪失に備えて、管理者が
--   いつでも全データをJSONとしてダウンロードできるようにする。
--   各テーブルはRLSの制限がバラバラ(通知・待ち合わせ・ブロック等は
--   本人限定で管理者バイパスが無い)ため、個別に緩めるのではなく
--   1つのSECURITY DEFINER関数にまとめてテーブルオーナー権限で
--   全件読み出す。画像ファイル自体(Storageのバイナリ)はここには
--   含まれない。

create or replace function public.admin_export_all()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'users', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email,
        'nickname', u.raw_user_meta_data ->> 'nickname',
        'created_at', u.created_at, 'banned_until', u.banned_until
      )), '[]'::jsonb) from auth.users u),
    'item', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.item t),
    'message', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.message t),
    'review', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.review t),
    'report', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.report t),
    'meetup', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.meetup t),
    'notification', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notification t),
    'favorite', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favorite t),
    'profile', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profile t),
    'blocked_user', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.blocked_user t),
    'deleted_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.deleted_users t),
    'admin_action_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_action_log t)
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_export_all() to authenticated;


-- ============================================================
-- PART Q: 電気通信事業法対応モード(個別の自由記述チャットを停止)
-- ============================================================
--
-- 背景: 個別チャット(買い手・売り手間の自由記述メッセージ)を運営が
--   閲覧できる仕組みは、電気通信事業法の「電気通信事業」の届出が
--   必要になる可能性があることが分かったため、届出の要否を精査する
--   間、個別の自由記述メッセージ機能を一時的に停止していた。
--
--   フロントエンド側(lib/featureFlags.ts の TELECOM_SAFE_MODE)で
--   個別チャットのUIを非表示にしているが、UIを隠すだけでは
--   直接APIを叩けば自由文の私信を送れてしまうため、DB側でも
--   同じ制限をかけていた。フロント側のフラグと合わせて、切り替える
--   ときは必ずこのSQLとセットで実行すること。
--
--   ※ 公開の質問チャット(buyer_id is null、誰でも見られる)は
--     このモードでも従来通り利用できる(第三者間の私信の媒介では
--     ないため、電気通信事業法上の懸念は小さいと考えられる)。
--
--   2026-10-19: 届出要否の件が解決したため、通常モード(個別チャット
--   開放)に戻した。以下「解除」ブロックが現在の状態。再び制限したく
--   なった場合は、下の「有効化」ブロックのコメントを外して実行し、
--   lib/featureFlags.ts の TELECOM_SAFE_MODE もあわせて切り替えること。

-- ---------- 解除(現在の状態: 個別チャットは通常通り自由記述できる) ----------
drop policy if exists "message_insert_valid" on public.message;
create policy "message_insert_valid"
on public.message for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (buyer_id is null
      and exists (select 1 from public.item i where i.id = message.item_id)
      and not public.is_blocked_by(seller_id, auth.uid()))
    or (
      buyer_id is not null
      and (auth.uid() = buyer_id or auth.uid() = seller_id)
      and exists (
        select 1 from public.item i
        where i.id = message.item_id
          and i.user_id = message.seller_id
      )
      and not public.is_blocked_by(
        case when auth.uid() = buyer_id then seller_id else buyer_id end,
        auth.uid()
      )
    )
  )
);

alter table public.meetup drop constraint if exists meetup_location_template_only;

-- ---------- 有効化(電気通信事業法対応モードに戻す場合。使うときは下のブロックだけ実行) ----------
-- drop policy if exists "message_insert_valid" on public.message;
-- create policy "message_insert_valid"
-- on public.message for insert
-- to authenticated
-- with check (
--   auth.uid() = user_id
--   and buyer_id is null
--   and exists (select 1 from public.item i where i.id = message.item_id)
--   and not public.is_blocked_by(seller_id, auth.uid())
-- );
--
-- alter table public.meetup drop constraint if exists meetup_location_template_only;
-- alter table public.meetup add constraint meetup_location_template_only
--   check (location is null or location = any (array['中央図書館前','高等教育推進機構前','クラーク会館前','工学部噴水前']));


-- ============================================================
-- PART R: 未ログインでは商品ページの公開Q&Aを見られないようにする
-- ============================================================
--
-- 背景: message_select_public_or_own ポリシーが to public(anonロール
--   含む)になっており、buyer_id is null の公開Q&Aは未ログインでも
--   読めてしまっていた。to authenticated に絞る(このテーブルの
--   もう一方のポリシー message_select_admin も to authenticated の
--   ため、これで未ログインは message テーブルを一切読めなくなる)。

drop policy if exists "message_select_public_or_own" on public.message;
create policy "message_select_public_or_own"
on public.message for select
to authenticated
using (
  buyer_id is null
  or auth.uid() = buyer_id
  or auth.uid() = seller_id
);



-- ============================================================
-- PART S: 2026-10 セキュリティ点検で見つかった問題の修正
-- ============================================================
--
-- 背景: 2026-10-21 のセキュリティ点検で、本番DBに対して次の問題を確認した。
--   1) review.rating に 1〜5 の制約が無かった(PART F で追加したはずの
--      review_rating_check が本番に存在しなかった)。APIを直接叩けば
--      rating = -1000000 のような評価を投稿でき、相手の平均評価を壊せた。
--   2) mark_item_sold に回数制限も「自分の商品は買えない」チェックも無く、
--      1人で全商品をまとめて「売却済み」にできた。
--      → 自分の商品の購入を禁止し、同時に取引中(受け取り前)にできるのは
--        1人あたり5件までにする。
--   3) 出品者は message.buyer_id に任意のユーザーを入れられたため、
--      問い合わせをしていない無関係な人にも個別メッセージ(と通知)を
--      送れた。meetup も同様に任意の相手に作れた。
--      → 出品者から送れるのは「その商品で相手から先に問い合わせがある」
--        または「実際の購入者」の場合だけにする。
--   4) storage.objects の "anyone_can_read"(SELECT, to public)により、
--      未ログインでも images バケットの全ファイル名の一覧を取得できた。
--      バケットは Public なので、画像の表示(公開URL)にこのポリシーは
--      不要。削除する。
--   5) meetup の UPDATE ポリシーが当事者なら何でも更新できたため、
--      提案者自身が agreed = true にして「相手が同意済み」を偽装できた。
--      → トリガーで、同意できるのは提案者の相手だけ、提案内容を変えたら
--        同意はリセット、提案者は常に更新した本人、に固定する。

-- ---------- 1) 評価の点数を1〜5に制限 ----------
alter table public.review drop constraint if exists review_rating_check;
alter table public.review add constraint review_rating_check
  check (rating between 1 and 5);

-- ---------- 2) 購入: 自分の商品は不可・取引中は1人5件まで ----------
create or replace function public.mark_item_sold(p_item_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_title text;
  v_seller uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  -- 同じ人の購入を直列化し、同時リクエストで上限をすり抜けられないようにする
  perform pg_advisory_xact_lock(hashtext('mark_item_sold:' || auth.uid()::text));

  select user_id into v_seller from public.item where id = p_item_id;
  if v_seller is null then
    raise exception '商品が見つかりません';
  end if;
  if v_seller = auth.uid() then
    raise exception '自分の商品は購入できません';
  end if;
  if public.is_deleted(v_seller) then
    raise exception 'この商品は購入できません';
  end if;

  if (select count(*) from public.item
      where buyer_id = auth.uid() and received = false) >= 5 then
    raise exception '取引中の商品が5件あります。受け取り完了またはキャンセルしてから購入してください';
  end if;

  update public.item
  set sold = true, buyer_id = auth.uid()
  where id = p_item_id and sold = false
  returning title, user_id into v_title, v_seller;

  if v_seller is null then
    raise exception 'この商品はすでに売却済みです';
  end if;

  insert into public.notification (user_id, message, item_id)
  values (v_seller, '「' || v_title || '」が売れました！', p_item_id);
end;
$function$;

-- ---------- 3) 出品者から無関係な人に個別メッセージ・待ち合わせを送れないようにする ----------
-- その商品について、相手(p_buyer_id)から先に問い合わせがあるか、相手が実際の購入者か。
-- message / item のRLSに左右されないよう SECURITY DEFINER で判定する。
create or replace function public.has_inquiry(p_item_id bigint, p_buyer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.item where id = p_item_id and buyer_id = p_buyer_id)
      or exists (
        select 1 from public.message
        where item_id = p_item_id and buyer_id = p_buyer_id and user_id = p_buyer_id
      );
$$;
revoke execute on function public.has_inquiry(bigint, uuid) from public, anon;
grant execute on function public.has_inquiry(bigint, uuid) to authenticated;

drop policy if exists "message_insert_valid" on public.message;
create policy "message_insert_valid"
on public.message for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (buyer_id is null
      and exists (select 1 from public.item i where i.id = message.item_id)
      and not public.is_blocked_by(seller_id, auth.uid()))
    or (
      buyer_id is not null
      and buyer_id <> seller_id
      and exists (
        select 1 from public.item i
        where i.id = message.item_id
          and i.user_id = message.seller_id
      )
      and (
        auth.uid() = buyer_id
        or (auth.uid() = seller_id and public.has_inquiry(message.item_id, message.buyer_id))
      )
      and not public.is_blocked_by(
        case when auth.uid() = buyer_id then seller_id else buyer_id end,
        auth.uid()
      )
    )
  )
);

drop policy if exists "meetup_insert_participant" on public.meetup;
create policy "meetup_insert_participant"
on public.meetup for insert
to authenticated
with check (
  proposed_by = auth.uid()
  and buyer_id <> (select i.user_id from public.item i where i.id = meetup.item_id)
  and (
    auth.uid() = buyer_id
    or (
      auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
      and public.has_inquiry(meetup.item_id, meetup.buyer_id)
    )
  )
);

-- ---------- 4) 画像ファイル名の一覧を取得できないようにする ----------
drop policy if exists "anyone_can_read" on storage.objects;

-- ---------- 5) 待ち合わせの同意を提案者自身が偽装できないようにする ----------
create or replace function public.meetup_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- SQL Editor など、ログインユーザー以外からの操作はそのまま通す
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.proposed_by := auth.uid();
    new.agreed := false;
    return new;
  end if;

  if new.item_id is distinct from old.item_id or new.buyer_id is distinct from old.buyer_id then
    raise exception '待ち合わせの対象は変更できません';
  end if;

  -- 同意する操作
  if new.agreed and not old.agreed then
    if auth.uid() = old.proposed_by then
      raise exception '自分の提案には同意できません';
    end if;
    if new.location is distinct from old.location
       or new.meet_at is distinct from old.meet_at
       or new.proposed_by is distinct from old.proposed_by then
      raise exception '同意と同時に内容は変更できません';
    end if;
    return new;
  end if;

  -- 同意済みのまま内容も変わらない更新は何もしない
  if new.agreed and old.agreed
     and new.location is not distinct from old.location
     and new.meet_at is not distinct from old.meet_at then
    new.proposed_by := old.proposed_by;
    return new;
  end if;

  -- それ以外は「提案の作成・変更」: 提案者は更新した本人、同意はリセット
  new.proposed_by := auth.uid();
  new.agreed := false;
  return new;
end;
$$;

drop trigger if exists meetup_guard_trigger on public.meetup;
create trigger meetup_guard_trigger
before insert or update on public.meetup
for each row
execute function public.meetup_guard();


-- ============================================================
-- PART T: 個別チャットの通知の文言を公開Q&Aと分ける
-- ============================================================
--
-- 背景: 本番で実際に動いている通知トリガーは、このファイルの PART D
--   (notify_on_new_message / notify_on_new_message_trigger)ではなく、
--   Supabase 上で直接作られた notify_on_message / message_notify_trigger
--   だった(2026-10-22 確認)。こちらは公開Q&Aも個別チャットも
--   「「〇〇」にメッセージが届きました」と同じ文言で通知していたため、
--   フロント(components/Header.tsx)で個別チャットの通知だけを
--   チャット画面に直接開くことができなかった。
--   処理内容(誰に通知するか)は本番の関数のまま変えず、個別チャットの
--   場合だけ文言を「取引相手からメッセージが届きました」にする。
--   この文言を変える場合は Header.tsx の判定も合わせて変えること。

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_owner uuid;
  v_notify uuid;
  v_message text;
begin
  select title, user_id into v_title, v_owner from public.item where id = new.item_id;

  if new.buyer_id is not null then
    -- 個別チャット: 送った本人以外(取引相手)に通知
    if new.user_id = new.buyer_id then
      v_notify := new.seller_id;
    else
      v_notify := new.buyer_id;
    end if;
    v_message := '「' || v_title || '」の取引相手からメッセージが届きました';
  else
    -- 公開Q&A: 出品者以外の投稿なら出品者に通知
    if new.user_id <> v_owner then
      v_notify := v_owner;
    else
      v_notify := null;
    end if;
    v_message := '「' || v_title || '」にメッセージが届きました';
  end if;

  if v_notify is not null and v_notify <> new.user_id then
    insert into public.notification (user_id, message, item_id)
    values (v_notify, v_message, new.item_id);
  end if;

  return new;
end;
$$;


-- ============================================================
-- PART U: ニックネームの変更(1週間に1回まで)
-- ============================================================
--
-- 背景: ニックネームは auth.users の user_metadata に加えて、書き込み時に
--   item.nickname / message.nickname / review.reviewer_nickname へコピーして
--   保存している。マイページからニックネームを変えたときに過去の表示名が
--   古いまま残らないよう、本人の行をまとめて書き換える関数を用意する。
--   message / review には一般ユーザー向けの UPDATE ポリシーが無いため
--   SECURITY DEFINER で実行する(書き換えるのは本人が書いた行だけ)。
--   user_metadata 側はフロントから supabase.auth.updateUser で更新する。
--
--   トラブル後に名前を変えて別人のふりをするのを防ぐため、変更は
--   1週間に1回までにする。最後に変更した日時は nickname_change に記録し、
--   一般ユーザー向けのポリシーは作らない(本人も書き換えられない)。
--   注意: user_metadata は本人がAPIから直接書き換えられるため、この制限は
--   マイページからの通常の変更に対するもの。

create table if not exists public.nickname_change (
  user_id uuid primary key references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now()
);
alter table public.nickname_change enable row level security;

create or replace function public.update_own_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text := trim(p_nickname);
  v_last timestamptz;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if v_nickname is null or char_length(v_nickname) = 0 then
    raise exception 'ニックネームを入力してください';
  end if;
  if char_length(v_nickname) > 30 then
    raise exception 'ニックネームは30文字以内にしてください';
  end if;

  select changed_at into v_last from public.nickname_change where user_id = auth.uid();
  if v_last is not null and v_last > now() - interval '7 days' then
    raise exception 'ニックネームの変更は1週間に1回までです。次に変更できるのは%以降です',
      to_char((v_last + interval '7 days') at time zone 'Asia/Tokyo', 'FMMM月FMDD日 HH24:MI');
  end if;

  update public.item set nickname = v_nickname where user_id = auth.uid();
  update public.message set nickname = v_nickname where user_id = auth.uid();
  update public.review set reviewer_nickname = v_nickname where reviewer_id = auth.uid();

  insert into public.nickname_change (user_id, changed_at) values (auth.uid(), now())
  on conflict (user_id) do update set changed_at = excluded.changed_at;
end;
$$;
revoke execute on function public.update_own_nickname(text) from public, anon;
grant execute on function public.update_own_nickname(text) to authenticated;


-- ============================================================
-- PART V: 購入者の非公開・ニックネームのなりすまし防止・
--          メッセージ連投の制限・画像アップロードの制限
-- ============================================================
--
-- 背景(2026-10-22 の点検で確認):
--   1) item_select_all は誰でも全列を読めるため、未ログインでも
--      item.buyer_id から「誰が何を買ったか」が分かった。
--      → buyer_id だけ列単位で SELECT 権限を外す。購入者が必要な画面は
--        get_item_buyer() / my_purchased_items() 経由で、本人・出品者・
--        管理者にだけ返す。
--      注意: 列単位の権限にしたため、今後 item に列を追加したときは
--        「grant select (新しい列) on public.item to anon, authenticated;」
--        が別途必要。
--      注意: 他テーブルのRLSポリシーのサブクエリで item.buyer_id を参照すると
--        permission denied になる(PGliteで確認済み)。review の INSERT
--        ポリシーは SECURITY DEFINER 関数経由に書き換える。
--   2) item.nickname / message.nickname / review.reviewer_nickname は
--      ブラウザから送った値がそのまま保存され、「HOKUMA運営」などを名乗れた。
--      → 正式なニックネームを user_nickname(本人も直接は書き換え不可)に
--        持ち、INSERT 時にトリガーで上書きする。運営を連想させる名前は禁止。
--   3) message の送信回数に制限が無かった。→ 1分10件・1時間100件まで。
--   4) images バケットに種類・サイズの制限が無かった。
--      → 画像(JPEG/PNG/WebP/GIF)のみ・5MBまで。

-- ---------- 1) 購入者(buyer_id)を本人・出品者・管理者以外に見せない ----------
revoke select on public.item from anon, authenticated;
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'item' and column_name <> 'buyer_id'
  loop
    execute format('grant select (%I) on public.item to anon, authenticated', c);
  end loop;
end;
$$;

-- 商品の購入者。本人(出品者・購入者)と管理者にだけ返し、それ以外は null。
create or replace function public.get_item_buyer(p_item_id bigint)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select buyer_id from public.item
  where id = p_item_id
    and (auth.uid() = user_id or auth.uid() = buyer_id or public.is_admin());
$$;
revoke execute on function public.get_item_buyer(bigint) from public, anon;
grant execute on function public.get_item_buyer(bigint) to authenticated;

-- 自分が購入した商品(マイページ用)
create or replace function public.my_purchased_items()
returns setof public.item
language sql
security definer
set search_path = public
stable
as $$
  select * from public.item where buyer_id = auth.uid() order by created_at desc;
$$;
revoke execute on function public.my_purchased_items() from public, anon;
grant execute on function public.my_purchased_items() to authenticated;

-- 評価できるか(その商品の受け取り済みの購入者か)
create or replace function public.can_review_item(p_item_id bigint, p_seller_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.item
    where id = p_item_id and user_id = p_seller_id
      and buyer_id = auth.uid() and received = true
  );
$$;
revoke execute on function public.can_review_item(bigint, uuid) from public, anon;
grant execute on function public.can_review_item(bigint, uuid) to authenticated;

drop policy if exists "review_insert_confirmed_buyer" on public.review;
drop policy if exists "review_insert_valid_purchase" on public.review;
create policy "review_insert_confirmed_buyer"
on public.review for insert
to authenticated
with check (
  auth.uid() = reviewer_id
  and reviewer_id <> seller_id
  and public.can_review_item(review.item_id, review.seller_id)
);

-- ---------- 2) ニックネームのなりすまし防止 ----------
create table if not exists public.user_nickname (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null
);
alter table public.user_nickname enable row level security;
-- 一般ユーザー向けのポリシーは作らない(SECURITY DEFINER 関数からのみ読み書き)

create or replace function public.is_reserved_nickname(p_nickname text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_nickname, '')) ~ '(運営|公式|管理者|hokuma|ホクマ|ほくま|admin|official)';
$$;

-- 既存ユーザーの正式なニックネームを作る(今の表示名をそのまま引き継ぐ)
insert into public.user_nickname (user_id, nickname)
select id, left(coalesce(nullif(trim(raw_user_meta_data ->> 'nickname'), ''), '匿名ユーザー'), 30)
from auth.users
on conflict (user_id) do nothing;

-- 新規登録時に正式なニックネームを作る。運営を連想させる名前は登録させない。
create or replace function public.create_user_nickname()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), '匿名ユーザー'), 30);
begin
  if public.is_reserved_nickname(v_nickname) then
    raise exception 'このニックネームは使用できません';
  end if;
  insert into public.user_nickname (user_id, nickname) values (new.id, v_nickname)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_user_nickname_trigger on auth.users;
create trigger create_user_nickname_trigger
after insert on auth.users
for each row
execute function public.create_user_nickname();

-- 書き込み時に、ブラウザから送られた名前ではなく正式なニックネームを使う
create or replace function public.apply_official_nickname()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text;
begin
  if auth.uid() is null then
    return new;
  end if;
  select nickname into v_nickname from public.user_nickname where user_id = auth.uid();
  if v_nickname is null then
    v_nickname := '匿名ユーザー';
  end if;
  if tg_table_name = 'review' then
    new.reviewer_nickname := v_nickname;
  else
    new.nickname := v_nickname;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_official_nickname_trigger on public.item;
create trigger apply_official_nickname_trigger
before insert on public.item
for each row execute function public.apply_official_nickname();

drop trigger if exists apply_official_nickname_trigger on public.message;
create trigger apply_official_nickname_trigger
before insert on public.message
for each row execute function public.apply_official_nickname();

drop trigger if exists apply_official_nickname_trigger on public.review;
create trigger apply_official_nickname_trigger
before insert on public.review
for each row execute function public.apply_official_nickname();

-- PART U の変更関数を、正式なニックネームも更新し、運営を連想させる名前を
-- 禁止する形に置き換える
create or replace function public.update_own_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text := trim(p_nickname);
  v_last timestamptz;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if v_nickname is null or char_length(v_nickname) = 0 then
    raise exception 'ニックネームを入力してください';
  end if;
  if char_length(v_nickname) > 30 then
    raise exception 'ニックネームは30文字以内にしてください';
  end if;
  if public.is_reserved_nickname(v_nickname) then
    raise exception 'このニックネームは使用できません';
  end if;

  select changed_at into v_last from public.nickname_change where user_id = auth.uid();
  if v_last is not null and v_last > now() - interval '7 days' then
    raise exception 'ニックネームの変更は1週間に1回までです。次に変更できるのは%以降です',
      to_char((v_last + interval '7 days') at time zone 'Asia/Tokyo', 'FMMM月FMDD日 HH24:MI');
  end if;

  insert into public.user_nickname (user_id, nickname) values (auth.uid(), v_nickname)
  on conflict (user_id) do update set nickname = excluded.nickname;

  update public.item set nickname = v_nickname where user_id = auth.uid();
  update public.message set nickname = v_nickname where user_id = auth.uid();
  update public.review set reviewer_nickname = v_nickname where reviewer_id = auth.uid();

  insert into public.nickname_change (user_id, changed_at) values (auth.uid(), now())
  on conflict (user_id) do update set changed_at = excluded.changed_at;
end;
$$;
revoke execute on function public.update_own_nickname(text) from public, anon;
grant execute on function public.update_own_nickname(text) to authenticated;

-- ---------- 3) メッセージの連投制限(1分10件・1時間100件まで) ----------
create index if not exists message_user_id_created_at_idx on public.message (user_id, created_at);

create or replace function public.limit_message_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (select count(*) from public.message
      where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 10
     or (select count(*) from public.message
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'メッセージの送信が多すぎます。少し時間をおいてから送ってください';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_message_rate_trigger on public.message;
create trigger limit_message_rate_trigger
before insert on public.message
for each row execute function public.limit_message_rate();

-- ---------- 4) 画像アップロードの制限(画像のみ・5MBまで) ----------
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'images';


-- ============================================================
-- PART W: プロフィールはログインした人だけが見られるようにする
-- ============================================================
--
-- 背景: profile_select_all が to public(anon 含む)だったため、未ログインでも
--   一言メッセージ・性別・年齢を読めた。画面側(app/users/[id])で
--   未ログインには表示しないようにしたのに合わせ、DB側も authenticated に絞る。

drop policy if exists "profile_select_all" on public.profile;
create policy "profile_select_all"
on public.profile for select
to authenticated
using (public.is_admin() or not public.is_deleted(user_id));


-- ============================================================
-- PART X: 公開Q&Aのブロック判定を、商品の本当の出品者で行う
-- ============================================================
--
-- 背景: 公開Q&A(buyer_id is null)のブロック判定は
--   is_blocked_by(seller_id, auth.uid()) だったが、フロントが公開Q&Aの投稿で
--   seller_id を送っておらず(null)、ブロックが一度も効いていなかった。
--   また seller_id は送る側が自由に決められるため、でたらめな値でも
--   すり抜けられた。→ 商品の出品者(item.user_id)で判定し、seller_id を
--   入れる場合は出品者と一致するものだけ許可する。個別チャット側は PART S のまま。

drop policy if exists "message_insert_valid" on public.message;
create policy "message_insert_valid"
on public.message for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (
      buyer_id is null
      and exists (select 1 from public.item i where i.id = message.item_id)
      and (
        seller_id is null
        or seller_id = (select i.user_id from public.item i where i.id = message.item_id)
      )
      and not public.is_blocked_by(
        (select i.user_id from public.item i where i.id = message.item_id),
        auth.uid()
      )
    )
    or (
      buyer_id is not null
      and buyer_id <> seller_id
      and exists (
        select 1 from public.item i
        where i.id = message.item_id
          and i.user_id = message.seller_id
      )
      and (
        auth.uid() = buyer_id
        or (auth.uid() = seller_id and public.has_inquiry(message.item_id, message.buyer_id))
      )
      and not public.is_blocked_by(
        case when auth.uid() = buyer_id then seller_id else buyer_id end,
        auth.uid()
      )
    )
  )
);


-- ============================================================
-- PART Y: 購入者・売却済み・受け取り済みを、出品者が直接変えられないようにする
-- ============================================================
--
-- 背景: item_insert_own / item_update_own は user_id しか見ていないため、
--   出品者は自分の商品の buyer_id / sold / received を自由に設定できた。
--   友達を「受け取り済みの購入者」にして評価を水増しする、問い合わせの無い
--   相手を購入者にして個別メッセージを送る(PART S の制限のすり抜け)、
--   他人の「購入した商品」に勝手に商品を出す、などができた。
--   → 列単位の INSERT / UPDATE 権限で、この3列(と id・user_id・created_at)
--     を一般ユーザーから外す。購入・受け取り・キャンセルは SECURITY DEFINER
--     の RPC(mark_item_sold / mark_item_received / cancel_purchase /
--     admin_cancel_purchase)で行うので影響しない。
--   注意: item に列を追加したときは、編集させたい列なら
--     「grant insert (列), update (列) on public.item to authenticated;」も必要。

revoke insert, update on public.item from anon, authenticated;
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'item'
      and column_name not in ('id', 'user_id', 'buyer_id', 'sold', 'received', 'created_at')
  loop
    execute format('grant update (%I) on public.item to authenticated', c);
  end loop;
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'item'
      and column_name not in ('id', 'buyer_id', 'sold', 'received', 'created_at')
  loop
    execute format('grant insert (%I) on public.item to authenticated', c);
  end loop;
end;
$$;


-- ============================================================
-- PART Z: 欲しいもの登録(キーワード+ジャンルが一致する出品があれば通知)
-- ============================================================
--
-- 仕様:
--   - 1人3件まで(将来プレミアムで増やす想定。上限は wish_limit() で決める)
--   - キーワード(1〜30文字)とジャンル(null = 指定なし)を登録
--   - 新しく出品されたとき、キーワードがタイトルかハッシュタグに含まれ
--     (大文字小文字は区別しない)、ジャンルが一致(または指定なし)なら、
--     登録した人にアプリ内通知を送る。同じ出品で複数一致しても通知は1件
--   - 自分の出品・自分がブロックした人の出品・退会済みの人には通知しない
--   - 本人しか読めない(何を欲しがっているかは他人に見せない)

create table if not exists public.wish (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  keyword text not null check (char_length(trim(keyword)) between 1 and 30),
  category text,
  created_at timestamptz not null default now()
);
create index if not exists wish_user_id_idx on public.wish (user_id);
alter table public.wish enable row level security;
revoke all on public.wish from anon;
grant select, insert, delete on public.wish to authenticated;
grant usage, select on sequence public.wish_id_seq to authenticated;

drop policy if exists "wish_select_own" on public.wish;
create policy "wish_select_own"
on public.wish for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "wish_insert_own" on public.wish;
create policy "wish_insert_own"
on public.wish for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "wish_delete_own" on public.wish;
create policy "wish_delete_own"
on public.wish for delete
to authenticated
using (auth.uid() = user_id);

-- 1人あたりの登録上限(プレミアムを入れるときはここを変える)
create or replace function public.wish_limit(p_user_id uuid)
returns integer
language sql
stable
as $$
  select 3;
$$;

create or replace function public.limit_wish_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.keyword := trim(new.keyword);
  if (select count(*) from public.wish where user_id = new.user_id) >= public.wish_limit(new.user_id) then
    raise exception '欲しいものは%件まで登録できます', public.wish_limit(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists limit_wish_count_trigger on public.wish;
create trigger limit_wish_count_trigger
before insert on public.wish
for each row execute function public.limit_wish_count();

-- 出品されたら、一致する「欲しいもの」を登録している人に通知する
create or replace function public.notify_wish_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification (user_id, message, item_id)
  select distinct on (w.user_id)
    w.user_id,
    '欲しいもの「' || w.keyword || '」に一致する「' || new.title || '」が出品されました',
    new.id
  from public.wish w
  where w.user_id <> new.user_id
    and (w.category is null or w.category = new.category)
    and (
      position(lower(w.keyword) in lower(coalesce(new.title, ''))) > 0
      or exists (
        select 1 from unnest(coalesce(new.hashtags, array[]::text[])) as t(tag)
        where position(lower(w.keyword) in lower(t.tag)) > 0
      )
    )
    and not public.is_blocked_by(w.user_id, new.user_id)
    and not public.is_deleted(w.user_id)
  order by w.user_id, w.created_at;
  return new;
end;
$$;

drop trigger if exists notify_wish_match_trigger on public.item;
create trigger notify_wish_match_trigger
after insert on public.item
for each row execute function public.notify_wish_match();


-- ============================================================
-- PART AA: チャット等に表示するアイコン画像を他の利用者にも公開する
-- ============================================================
--
-- 背景: マイページのアイコンは auth.users.raw_user_meta_data(avatar_url)に
--   しか保存しておらず、他人からは読めなかった(admin_list_users 経由の
--   管理者しか見られない)。そのため公開Q&A・個別チャット・ユーザーページで
--   相手のアイコンを表示できず、頭文字の丸アイコンで代用していた。
--   bio/gender/age と同じく public.profile に avatar_url を持たせ、
--   既存の profile_select_all(ログインユーザーなら誰でも閲覧可)に
--   乗せることで、他人のアイコンも表示できるようにする。

alter table public.profile add column if not exists avatar_url text;


-- ============================================================
-- PART AB: 出品したことが無い利用者のページで、ニックネームが
--          「ユーザー」のままになる不具合を修正
-- ============================================================
--
-- 背景: app/users/[id] のニックネームは items[0]?.nickname(その人の出品の
--   1件目に保存されたニックネーム)から取っていた。出品したことが一度も
--   無い、または出品をすべて削除した利用者は items が空になるため、
--   正式なニックネームを登録していても画面側の初期値「ユーザー」のまま
--   表示されていた。
--   正式なニックネームは user_nickname テーブルにあるが、なりすまし防止の
--   ため一般ユーザー向けの SELECT ポリシーを意図的に作っていない。
--   → SECURITY DEFINER 関数で、本人かどうかに関わらず読めるようにする
--   (ニックネームは item/message に既に公開されている情報であり、
--   新たに非公開情報を公開するものではない)。

create or replace function public.get_nickname(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select nickname from public.user_nickname where user_id = p_user_id;
$$;
grant execute on function public.get_nickname(uuid) to authenticated;


-- ============================================================
-- PART AC: ポスターのQRコード読み込み回数を記録する
-- ============================================================
--
-- 背景: ポスターに貼るQRコード(/qr へのリンク)が何回読み込まれたかを
--   知りたい。読み込む人はまだ未登録(未ログイン)の場合がほとんどなので、
--   anon からも INSERT できるようにする。件数の確認は画面を作らず、
--   運営がSupabaseのSQL Editorで次を実行する想定:
--     select count(*) from public.qr_scan;

create table if not exists public.qr_scan (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
alter table public.qr_scan enable row level security;

drop policy if exists "qr_scan_insert_anyone" on public.qr_scan;
create policy "qr_scan_insert_anyone"
on public.qr_scan for insert
to anon, authenticated
with check (true);


-- ============================================================
-- PART AD: 商品が購入されたら、出品者にお知らせメールを送る
-- ============================================================
--
-- 仕組み: item.sold が false → true になったら、pg_net で Edge Function
--   notify-sold(supabase/functions/notify-sold)を呼ぶ。Edge Function が
--   DB で売却済みを確かめ直し、出品者の登録メールアドレスに Resend で送る。
--   - 合言葉は Vault の sold_email_hook_secret に保存し(コードには書かない)、
--     Edge Function の Secrets の HOOK_SECRET と同じ値にする
--   - メール送信で何が起きても購入処理は止めない(例外は警告にして握りつぶす)
--   - 事前に「select vault.create_secret('<ランダムな値>', 'sold_email_hook_secret');」
--     を一度だけ実行しておくこと(値はこのファイルに書かない)

create extension if not exists pg_net;

create or replace function public.notify_sold_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if new.sold and not coalesce(old.sold, false) and new.buyer_id is not null then
    begin
      select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where name = 'sold_email_hook_secret'
      limit 1;

      if v_secret is not null then
        perform net.http_post(
          url := 'https://cchsbakrlranhpgetcwg.supabase.co/functions/v1/notify-sold',
          body := jsonb_build_object('item_id', new.id),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret)
        );
      end if;
    exception when others then
      raise warning 'notify_sold_email failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_sold_email() from public, anon, authenticated;

drop trigger if exists notify_sold_email_trigger on public.item;
create trigger notify_sold_email_trigger
after update of sold on public.item
for each row execute function public.notify_sold_email();


-- ============================================================
-- PART AE: 購入お知らせメールの送りすぎを防ぐ
-- ============================================================
--
-- 背景: PART AD のままだと「購入 → キャンセル → 購入」を繰り返すたびに
--   出品者へメールが飛ぶ。悪意のある利用者が特定の出品者にメールを大量に
--   送りつけたり、Resend の送信枠を使い切らせて他の人の通知を止めたりできた。
--   → 送ったメールを sold_email_log に記録し、次の場合は送らない。
--     - 同じ商品のメールを24時間以内に2通送っている
--     - 同じ購入者がきっかけのメールを24時間以内に10通送っている
--   サイト内の通知(notification)はこれまでどおり毎回作られる。
--   sold_email_log は利用者からは読み書きできない(ポリシー無しのRLS)。

create table if not exists public.sold_email_log (
  id bigint generated always as identity primary key,
  item_id bigint not null,
  buyer_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.sold_email_log enable row level security;
revoke all on public.sold_email_log from anon, authenticated;
create index if not exists sold_email_log_item_idx on public.sold_email_log (item_id, created_at);
create index if not exists sold_email_log_buyer_idx on public.sold_email_log (buyer_id, created_at);

create or replace function public.notify_sold_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if new.sold and not coalesce(old.sold, false) and new.buyer_id is not null then
    begin
      -- 同じ商品は24時間に2通まで
      if (select count(*) from public.sold_email_log
          where item_id = new.id and created_at > now() - interval '24 hours') >= 2 then
        return new;
      end if;
      -- 同じ購入者がきっかけのメールは24時間に10通まで
      if (select count(*) from public.sold_email_log
          where buyer_id = new.buyer_id and created_at > now() - interval '24 hours') >= 10 then
        return new;
      end if;

      select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where name = 'sold_email_hook_secret'
      limit 1;

      if v_secret is not null then
        insert into public.sold_email_log (item_id, buyer_id) values (new.id, new.buyer_id);
        delete from public.sold_email_log where created_at < now() - interval '7 days';
        perform net.http_post(
          url := 'https://cchsbakrlranhpgetcwg.supabase.co/functions/v1/notify-sold',
          body := jsonb_build_object('item_id', new.id),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret)
        );
      end if;
    exception when others then
      raise warning 'notify_sold_email failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_sold_email() from public, anon, authenticated;


-- ============================================================
-- PART AF: みんなの欲しい！(需要の見える化)。PART Z の欲しいもの登録を置き換える
-- ============================================================
--
-- 仕様:
--   - ログインした人は「欲しい！」を登録できる(商品名20文字以内・出せる金額・
--     いつまでに欲しいか・タグ・備考)。期限内で受付中のものはログインした
--     全員が見られるが、誰が登録したか(user_id)は見せない。
--   - 期限が切れた・買えた・取り下げた欲しい！は一覧に出なくなるが、
--     データは消さずに残す(本人は my_demands() でいつでも見られる)。
--   - 出品者は、出品した商品を一致しそうな欲しい！に知らせられる
--     (offer_item_to_demands)。同じ欲しい！に同じ商品で送れるのは1回だけ。
--   - 購入者は、買った商品で満たされた欲しい！を「買えた！」にできる
--     (fulfill_my_demands)。そのとき出品者にありがとうの通知が届く。
--   - 状態の変更はすべて RPC 経由。UPDATE/DELETE の権限は付けない。

-- ---------- PART Z の欲しいもの登録を破棄 ----------
drop trigger if exists notify_wish_match_trigger on public.item;
drop function if exists public.notify_wish_match();
drop table if exists public.wish;
drop function if exists public.limit_wish_count();
drop function if exists public.wish_limit(uuid);

-- 期限の判定は日本時間の日付で行う
create or replace function public.jst_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

create table if not exists public.demand (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 20),
  budget integer not null check (budget between 0 and 50000),
  deadline date not null,
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'fulfilled', 'withdrawn')),
  fulfilled_item_id bigint references public.item(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists demand_open_idx on public.demand (status, deadline);
create index if not exists demand_user_id_idx on public.demand (user_id);
alter table public.demand enable row level security;

-- user_id は列ごと読めなくする(誰が欲しがっているかは見せない)
revoke all on public.demand from anon, authenticated;
grant select (id, title, budget, deadline, tags, note, status, created_at) on public.demand to authenticated;
grant insert (title, budget, deadline, tags, note) on public.demand to authenticated;

drop policy if exists "demand_select_open_or_own" on public.demand;
create policy "demand_select_open_or_own"
on public.demand for select
to authenticated
using (
  auth.uid() = user_id
  or (
    status = 'open'
    and deadline >= public.jst_today()
    and not public.is_deleted(user_id)
    and not public.is_blocked_by(auth.uid(), user_id)  -- 自分がブロックした人の欲しい！は出さない
  )
);

drop policy if exists "demand_insert_own" on public.demand;
create policy "demand_insert_own"
on public.demand for insert
to authenticated
with check (auth.uid() = user_id);

-- 入力値の整形と、受付中の欲しい！は1人10件までの制限
create or replace function public.prepare_demand()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_deleted(new.user_id) then
    raise exception '欲しい！を登録できません';
  end if;

  new.title := trim(new.title);
  new.note := nullif(trim(coalesce(new.note, '')), '');
  new.tags := coalesce((
    select array_agg(t order by min_ord)
    from (
      select t, min(ord) as min_ord
      from unnest(coalesce(new.tags, array[]::text[])) with ordinality as x(raw, ord),
           lateral (select trim(both from regexp_replace(trim(raw), '^#+', ''))) as y(t)
      where t <> ''
      group by t
    ) s
  ), array[]::text[]);
  if exists (select 1 from unnest(new.tags) as t where char_length(t) > 20) then
    raise exception 'タグは20文字以内にしてください';
  end if;

  if new.deadline < public.jst_today() then
    raise exception '期限は今日以降の日付にしてください';
  end if;
  if new.deadline > public.jst_today() + 365 then
    raise exception '期限は1年以内にしてください';
  end if;

  new.status := 'open';
  new.fulfilled_item_id := null;
  new.closed_at := null;
  new.created_at := now();

  perform pg_advisory_xact_lock(hashtext('demand_insert:' || new.user_id::text));
  if (select count(*) from public.demand
      where user_id = new.user_id and status = 'open' and deadline >= public.jst_today()) >= 10 then
    raise exception '受付中の欲しい！は10件まで登録できます';
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_demand_trigger on public.demand;
create trigger prepare_demand_trigger
before insert on public.demand
for each row execute function public.prepare_demand();

-- 出品者が「この商品をこの欲しい！に知らせた」記録(二重通知の防止用)
create table if not exists public.demand_offer (
  demand_id bigint not null references public.demand(id) on delete cascade,
  item_id bigint not null references public.item(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (demand_id, item_id)
);
alter table public.demand_offer enable row level security;
-- 一般ユーザー向けのポリシーは作らない。下の SECURITY DEFINER 関数経由でのみ使う。

-- 自分の欲しい！をすべて(期限切れ・買えた・取り下げも含めて)返す。
-- p_item_id を渡すと、その商品が出品者から知らされていたかを offered に入れる。
create or replace function public.my_demands(p_item_id bigint default null)
returns table (
  id bigint,
  title text,
  budget integer,
  deadline date,
  tags text[],
  note text,
  status text,
  fulfilled_item_id bigint,
  created_at timestamptz,
  offered boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select d.id, d.title, d.budget, d.deadline, d.tags, d.note, d.status,
         d.fulfilled_item_id, d.created_at,
         exists (select 1 from public.demand_offer o where o.demand_id = d.id and o.item_id = p_item_id)
  from public.demand d
  where d.user_id = auth.uid()
  order by d.created_at desc;
$$;
revoke execute on function public.my_demands(bigint) from public, anon;
grant execute on function public.my_demands(bigint) to authenticated;

-- 自分の欲しい！を「買えた！」または「取り下げ」にする(商品なし)
create or replace function public.close_my_demand(p_demand_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if p_status not in ('fulfilled', 'withdrawn') then
    raise exception '不正な状態です';
  end if;
  update public.demand
  set status = p_status, closed_at = now()
  where id = p_demand_id and user_id = auth.uid() and status = 'open';
  if not found then
    raise exception 'この欲しい！は変更できません';
  end if;
end;
$$;
revoke execute on function public.close_my_demand(bigint, text) from public, anon;
grant execute on function public.close_my_demand(bigint, text) to authenticated;

-- 出品者が、自分の出品を欲しい！を登録した人に知らせる。知らせた件数を返す。
create or replace function public.offer_item_to_demands(p_item_id bigint, p_demand_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if cardinality(p_demand_ids) > 10 then
    raise exception '一度に知らせられるのは10件までです';
  end if;

  select title into v_title
  from public.item
  where id = p_item_id and user_id = auth.uid() and sold = false;
  if v_title is null then
    raise exception '商品が見つかりません';
  end if;

  -- 1つの商品から知らせられるのは合計10件まで(無関係な欲しい！への連投を防ぐ)
  perform pg_advisory_xact_lock(hashtext('demand_offer:' || p_item_id::text));
  if (select count(*) from public.demand_offer where item_id = p_item_id) + cardinality(p_demand_ids) > 10 then
    raise exception '1つの商品から知らせられるのは10件までです';
  end if;

  with ins as (
    insert into public.demand_offer (demand_id, item_id)
    select d.id, p_item_id
    from public.demand d
    where d.id = any(p_demand_ids)
      and d.status = 'open'
      and d.deadline >= public.jst_today()
      and d.user_id <> auth.uid()
      and not public.is_deleted(d.user_id)
      and not public.is_blocked_by(d.user_id, auth.uid())
      and not public.is_blocked_by(auth.uid(), d.user_id)
    on conflict do nothing
    returning demand_id
  )
  insert into public.notification (user_id, message, item_id)
  select d.user_id, 'あなたの欲しい！「' || d.title || '」に合いそうな「' || v_title || '」が出品されました', p_item_id
  from ins join public.demand d on d.id = ins.demand_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.offer_item_to_demands(bigint, bigint[]) from public, anon;
grant execute on function public.offer_item_to_demands(bigint, bigint[]) to authenticated;

-- 購入者が、買った商品で満たされた自分の欲しい！を「買えた！」にする。
-- 1件以上変わったら出品者にありがとうの通知を送る。変えた件数を返す。
create or replace function public.fulfill_my_demands(p_item_id bigint, p_demand_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_seller uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select title, user_id into v_title, v_seller
  from public.item
  where id = p_item_id and buyer_id = auth.uid();
  if v_seller is null then
    raise exception 'この商品の購入者ではありません';
  end if;

  update public.demand
  set status = 'fulfilled', fulfilled_item_id = p_item_id, closed_at = now()
  where id = any(p_demand_ids) and user_id = auth.uid() and status = 'open';
  get diagnostics v_count = row_count;

  if v_count > 0 and not public.is_deleted(v_seller) then
    insert into public.notification (user_id, message, item_id)
    values (v_seller, '「' || v_title || '」で、だれかの欲しい！がかないました。出品ありがとう！', p_item_id);
  end if;
  return v_count;
end;
$$;
revoke execute on function public.fulfill_my_demands(bigint, bigint[]) from public, anon;
grant execute on function public.fulfill_my_demands(bigint, bigint[]) to authenticated;

-- 管理者バックアップ(PART P)に demand / demand_offer を追加し、破棄した wish は外す
create or replace function public.admin_export_all()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'users', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email,
        'nickname', u.raw_user_meta_data ->> 'nickname',
        'created_at', u.created_at, 'banned_until', u.banned_until
      )), '[]'::jsonb) from auth.users u),
    'item', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.item t),
    'message', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.message t),
    'review', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.review t),
    'report', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.report t),
    'meetup', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.meetup t),
    'notification', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notification t),
    'favorite', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favorite t),
    'profile', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profile t),
    'blocked_user', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.blocked_user t),
    'deleted_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.deleted_users t),
    'admin_action_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_action_log t),
    'demand', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.demand t),
    'demand_offer', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.demand_offer t)
  ) into result;

  return result;
end;
$$;


-- ============================================================
-- PART AG: 欲しい！の「僕も！」・出品の下書き・欲しい！の通報と管理者による削除
-- ============================================================
--
-- 仕様:
--   - 僕も！: 他の人の欲しい！に「僕も欲しい」を付けられる(もう一度押すと取り消し)。
--     誰が押したかは見せず、人数だけ返す。出品者がその欲しい！に商品を
--     知らせたときは、僕も！を押した人にも通知が届く。
--   - 出品の下書き: 出品フォームの内容(写真以外)を1人10件まで保存できる。本人のみ。
--   - 通報: 欲しい！を通報できる(report.demand_id)。通報は1分に1回まで。
--   - 管理者: 欲しい！の一覧(登録者・僕も！の数・通報数つき)と、理由付きの削除。
--     削除は status = 'removed' にするだけで、データは残す。登録者に通知し、操作ログに残す。

-- ---------- 運営による削除の状態を追加 ----------
alter table public.demand drop constraint if exists demand_status_check;
alter table public.demand add constraint demand_status_check
  check (status in ('open', 'fulfilled', 'withdrawn', 'removed'));

-- ---------- 僕も！ ----------
create table if not exists public.demand_vote (
  demand_id bigint not null references public.demand(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (demand_id, user_id)
);
create index if not exists demand_vote_user_id_idx on public.demand_vote (user_id);
alter table public.demand_vote enable row level security;
-- 一般ユーザー向けのポリシーは作らない。下の SECURITY DEFINER 関数経由でのみ使う。

-- 一覧に出ている欲しい！ごとの僕も！の人数と、自分が押したかどうか
create or replace function public.demand_vote_summary()
returns table (demand_id bigint, votes integer, voted boolean)
language sql
security definer
set search_path = public
stable
as $$
  select d.id,
         (select count(*) from public.demand_vote v where v.demand_id = d.id)::integer,
         exists (select 1 from public.demand_vote v where v.demand_id = d.id and v.user_id = auth.uid())
  from public.demand d
  where auth.uid() is not null
    and (
      d.user_id = auth.uid()
      or (d.status = 'open' and d.deadline >= public.jst_today() and not public.is_deleted(d.user_id))
    );
$$;
revoke execute on function public.demand_vote_summary() from public, anon;
grant execute on function public.demand_vote_summary() to authenticated;

-- 僕も！を付ける/取り消す。押したあとの人数と状態を返す。
create or replace function public.toggle_demand_vote(p_demand_id bigint)
returns table (votes integer, voted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_voted boolean;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select user_id into v_owner
  from public.demand
  where id = p_demand_id and status = 'open' and deadline >= public.jst_today();
  if v_owner is null or public.is_deleted(v_owner) or public.is_blocked_by(auth.uid(), v_owner) then
    raise exception 'この欲しい！は受付が終わりました';
  end if;
  if v_owner = auth.uid() then
    raise exception '自分の欲しい！には押せません';
  end if;

  delete from public.demand_vote where demand_id = p_demand_id and user_id = auth.uid();
  v_voted := not found;
  if v_voted then
    insert into public.demand_vote (demand_id, user_id) values (p_demand_id, auth.uid());
  end if;

  return query
    select (select count(*) from public.demand_vote v where v.demand_id = p_demand_id)::integer, v_voted;
end;
$$;
revoke execute on function public.toggle_demand_vote(bigint) from public, anon;
grant execute on function public.toggle_demand_vote(bigint) to authenticated;

-- PART AF の offer_item_to_demands を、僕も！を押した人にも通知するよう置き換える
create or replace function public.offer_item_to_demands(p_item_id bigint, p_demand_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_count integer;
  v_offered bigint[];
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if cardinality(p_demand_ids) > 10 then
    raise exception '一度に知らせられるのは10件までです';
  end if;

  select title into v_title
  from public.item
  where id = p_item_id and user_id = auth.uid() and sold = false;
  if v_title is null then
    raise exception '商品が見つかりません';
  end if;

  -- 1つの商品から知らせられるのは合計10件まで(無関係な欲しい！への連投を防ぐ)
  perform pg_advisory_xact_lock(hashtext('demand_offer:' || p_item_id::text));
  if (select count(*) from public.demand_offer where item_id = p_item_id) + cardinality(p_demand_ids) > 10 then
    raise exception '1つの商品から知らせられるのは10件までです';
  end if;

  with ins as (
    insert into public.demand_offer (demand_id, item_id)
    select d.id, p_item_id
    from public.demand d
    where d.id = any(p_demand_ids)
      and d.status = 'open'
      and d.deadline >= public.jst_today()
      and d.user_id <> auth.uid()
      and not public.is_deleted(d.user_id)
      and not public.is_blocked_by(d.user_id, auth.uid())
      and not public.is_blocked_by(auth.uid(), d.user_id)
    on conflict do nothing
    returning demand_id
  )
  select coalesce(array_agg(demand_id), array[]::bigint[]) into v_offered from ins;

  -- 登録した人には欲しい！ごとに1件
  insert into public.notification (user_id, message, item_id)
  select d.user_id, 'あなたの欲しい！「' || d.title || '」に合いそうな「' || v_title || '」が出品されました', p_item_id
  from public.demand d
  where d.id = any(v_offered);
  get diagnostics v_count = row_count;

  -- 僕も！を押した人には1人1件(登録した人として通知済みの人・出品者本人は除く)
  insert into public.notification (user_id, message, item_id)
  select distinct on (v.user_id)
    v.user_id, '僕も！を押した欲しい！「' || d.title || '」に合いそうな「' || v_title || '」が出品されました', p_item_id
  from public.demand_vote v
  join public.demand d on d.id = v.demand_id
  where v.demand_id = any(v_offered)
    and v.user_id <> auth.uid()
    and v.user_id not in (select d2.user_id from public.demand d2 where d2.id = any(v_offered))
    and not public.is_deleted(v.user_id)
    and not public.is_blocked_by(v.user_id, auth.uid())
    and not public.is_blocked_by(auth.uid(), v.user_id)
  order by v.user_id, v.created_at;

  return v_count;
end;
$$;

-- ---------- 出品の下書き ----------
create table if not exists public.item_draft (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 45),
  price integer check (price is null or price between 0 and 50000),
  is_free boolean not null default false,
  category text check (category is null or char_length(category) <= 20),
  condition text check (condition is null or char_length(condition) <= 10),
  area text check (area is null or char_length(area) <= 50),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 20),
  detail text not null default '' check (char_length(detail) <= 150),
  demand_id bigint references public.demand(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists item_draft_user_id_idx on public.item_draft (user_id);
alter table public.item_draft enable row level security;
revoke all on public.item_draft from anon, authenticated;
grant select, delete on public.item_draft to authenticated;
grant insert (title, price, is_free, category, condition, area, hashtags, detail, demand_id) on public.item_draft to authenticated;
grant update (title, price, is_free, category, condition, area, hashtags, detail, demand_id, updated_at) on public.item_draft to authenticated;

drop policy if exists "item_draft_select_own" on public.item_draft;
create policy "item_draft_select_own"
on public.item_draft for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "item_draft_insert_own" on public.item_draft;
create policy "item_draft_insert_own"
on public.item_draft for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "item_draft_update_own" on public.item_draft;
create policy "item_draft_update_own"
on public.item_draft for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "item_draft_delete_own" on public.item_draft;
create policy "item_draft_delete_own"
on public.item_draft for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.limit_item_draft_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('item_draft_insert:' || new.user_id::text));
  if (select count(*) from public.item_draft where user_id = new.user_id) >= 10 then
    raise exception '下書きは10件まで保存できます';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_item_draft_count_trigger on public.item_draft;
create trigger limit_item_draft_count_trigger
before insert on public.item_draft
for each row execute function public.limit_item_draft_count();

-- ---------- 欲しい！の通報 ----------
alter table public.report add column if not exists demand_id bigint references public.demand(id) on delete set null;
alter table public.report drop constraint if exists report_target_check;
alter table public.report add constraint report_target_check
  check (item_id is not null or reported_user_id is not null or message_id is not null or demand_id is not null);

-- 通報者には登録した人が分からないので、関数の中で reported_user_id を埋める
create or replace function public.report_demand(p_demand_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '通報理由を入力してください';
  end if;
  if char_length(p_reason) > 600 then
    raise exception '通報理由は600文字以内にしてください';
  end if;

  select user_id into v_owner
  from public.demand
  where id = p_demand_id and status = 'open';
  if v_owner is null then
    raise exception 'この欲しい！は通報できません';
  end if;
  if v_owner = auth.uid() then
    raise exception '自分の欲しい！は通報できません';
  end if;

  perform pg_advisory_xact_lock(hashtext('report_insert:' || auth.uid()::text));
  if exists (
    select 1 from public.report
    where reporter_id = auth.uid() and created_at > now() - interval '1 minute'
  ) then
    raise exception '通報は1分に1回までです。しばらくしてからもう一度お試しください';
  end if;

  insert into public.report (reporter_id, reported_user_id, demand_id, reason)
  values (auth.uid(), v_owner, p_demand_id, trim(p_reason));
end;
$$;
revoke execute on function public.report_demand(bigint, text) from public, anon;
grant execute on function public.report_demand(bigint, text) to authenticated;

-- ---------- 管理者: 欲しい！の一覧と削除 ----------
create or replace function public.admin_list_demands()
returns table (
  id bigint,
  user_id uuid,
  email text,
  nickname text,
  title text,
  budget integer,
  deadline date,
  tags text[],
  note text,
  status text,
  created_at timestamptz,
  votes integer,
  reports integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  return query
    select d.id, d.user_id, u.email::text, (u.raw_user_meta_data ->> 'nickname')::text,
           d.title, d.budget, d.deadline, d.tags, d.note, d.status, d.created_at,
           (select count(*) from public.demand_vote v where v.demand_id = d.id)::integer,
           (select count(*) from public.report r where r.demand_id = d.id)::integer
    from public.demand d
    left join auth.users u on u.id = d.user_id
    order by d.created_at desc;
end;
$$;
revoke execute on function public.admin_list_demands() from public, anon;
grant execute on function public.admin_list_demands() to authenticated;

create or replace function public.admin_delete_demand(p_demand_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception '削除理由を入力してください';
  end if;

  update public.demand
  set status = 'removed', closed_at = now()
  where id = p_demand_id and status <> 'removed'
  returning user_id, title into v_owner, v_title;
  if v_owner is null then
    raise exception '欲しい！が見つからないか、すでに削除されています';
  end if;

  insert into public.notification (user_id, message, item_id, read)
  values (v_owner, 'あなたの欲しい！「' || v_title || '」が運営により削除されました。理由: ' || trim(p_reason), null, false);

  insert into public.admin_action_log (admin_id, action, target_id, detail)
  values (auth.uid(), 'delete_demand', p_demand_id::text, trim(p_reason));
end;
$$;
revoke execute on function public.admin_delete_demand(bigint, text) from public, anon;
grant execute on function public.admin_delete_demand(bigint, text) to authenticated;

-- 管理者バックアップ(PART P)に demand_vote / item_draft を追加
create or replace function public.admin_export_all()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'users', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email,
        'nickname', u.raw_user_meta_data ->> 'nickname',
        'created_at', u.created_at, 'banned_until', u.banned_until
      )), '[]'::jsonb) from auth.users u),
    'item', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.item t),
    'message', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.message t),
    'review', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.review t),
    'report', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.report t),
    'meetup', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.meetup t),
    'notification', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notification t),
    'favorite', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favorite t),
    'profile', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profile t),
    'blocked_user', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.blocked_user t),
    'deleted_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.deleted_users t),
    'admin_action_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_action_log t),
    'demand', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.demand t),
    'demand_offer', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.demand_offer t),
    'demand_vote', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.demand_vote t),
    'item_draft', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.item_draft t)
  ) into result;

  return result;
end;
$$;


-- ============================================================
-- PART AH: 欲しい！の期限のお知らせ・編集(延長)・みんなで買えた！・管理者向け集計
-- ============================================================
--
-- 仕様:
--   - 期限のお知らせ: 期限の3日前〜当日に、登録者がサイトを開いたとき
--     (send_demand_reminders を呼んだとき)に1回だけ通知する。期限を延ばすと
--     新しい期限でもう一度お知らせする。通知には demand_id を入れ、押すと
--     その欲しい！を開けるようにする。
--   - 編集: 登録者は受付中(期限切れを含む)の欲しい！を編集できる。期限を
--     延ばせば、期限切れのものも一覧に戻る。
--   - みんなで買えた！: 登録者が買えた！にしても、まだ買えていない僕も！の人が
--     いる間は受付中のまま一覧に残す。登録者と僕も！の全員が買えた！(または
--     僕も！を取り消し)になったら、欲しい！自体が買えた！になる。
--     僕も！の人も、買った商品で「買えた！」にできる。
--   - 管理者向け集計: admin_demand_stats() で欲しい！の利用状況をまとめて返す。

alter table public.demand add column if not exists owner_fulfilled_at timestamptz;
alter table public.demand add column if not exists reminded_deadline date;
alter table public.demand_vote add column if not exists fulfilled_at timestamptz;
alter table public.demand_vote add column if not exists fulfilled_item_id bigint references public.item(id) on delete set null;
alter table public.notification add column if not exists demand_id bigint references public.demand(id) on delete set null;

-- この PART を入れる前に買えた！にしたものは、登録者が買えた！にしたものとして扱う
update public.demand set owner_fulfilled_at = closed_at
where status = 'fulfilled' and owner_fulfilled_at is null;

-- ---------- 共通の部品 ----------
-- タグの整形(前後の空白と先頭の # を取り、空・重複を除く)
create or replace function public.normalize_demand_tags(p_tags text[])
returns text[]
language sql
immutable
as $$
  select coalesce((
    select array_agg(t order by min_ord)
    from (
      select t, min(ord) as min_ord
      from unnest(coalesce(p_tags, array[]::text[])) with ordinality as x(raw, ord),
           lateral (select trim(both from regexp_replace(trim(raw), '^#+', ''))) as y(t)
      where t <> ''
      group by t
    ) s
  ), array[]::text[]);
$$;

-- 期限・タグの確認(登録と編集で共通)
create or replace function public.check_demand_values(p_deadline date, p_tags text[])
returns void
language plpgsql
stable
as $$
begin
  if exists (select 1 from unnest(p_tags) as t where char_length(t) > 20) then
    raise exception 'タグは20文字以内にしてください';
  end if;
  if cardinality(p_tags) > 5 then
    raise exception 'タグは5個までです';
  end if;
  if p_deadline < public.jst_today() then
    raise exception '期限は今日以降の日付にしてください';
  end if;
  if p_deadline > public.jst_today() + 365 then
    raise exception '期限は1年以内にしてください';
  end if;
end;
$$;

-- まだ買えていない人数(登録者 + 買えていない僕も！)
create or replace function public.demand_wanters(p_demand_id bigint)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select ((select count(*) from public.demand_vote v where v.demand_id = p_demand_id and v.fulfilled_at is null)
        + (select case when d.owner_fulfilled_at is null then 1 else 0 end from public.demand d where d.id = p_demand_id))::integer;
$$;

-- 登録者も僕も！の人も全員買えた！なら、欲しい！自体を買えた！にする
create or replace function public.finalize_demand(p_demand_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.demand
  set status = 'fulfilled', closed_at = now()
  where id = p_demand_id
    and status = 'open'
    and owner_fulfilled_at is not null
    and not exists (select 1 from public.demand_vote v where v.demand_id = p_demand_id and v.fulfilled_at is null);
$$;
revoke execute on function public.finalize_demand(bigint) from public, anon, authenticated;

-- ---------- 登録時の確認を共通の部品に置き換え(上限は、登録者がまだ買えていないものだけ数える) ----------
create or replace function public.prepare_demand()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_deleted(new.user_id) then
    raise exception '欲しい！を登録できません';
  end if;

  new.title := trim(new.title);
  new.note := nullif(trim(coalesce(new.note, '')), '');
  new.tags := public.normalize_demand_tags(new.tags);
  perform public.check_demand_values(new.deadline, new.tags);

  new.status := 'open';
  new.fulfilled_item_id := null;
  new.owner_fulfilled_at := null;
  new.reminded_deadline := null;
  new.closed_at := null;
  new.created_at := now();

  perform pg_advisory_xact_lock(hashtext('demand_insert:' || new.user_id::text));
  if (select count(*) from public.demand
      where user_id = new.user_id and status = 'open' and owner_fulfilled_at is null
        and deadline >= public.jst_today()) >= 10 then
    raise exception '受付中の欲しい！は10件まで登録できます';
  end if;
  return new;
end;
$$;

-- ---------- 自分の欲しい！(登録したもの + 僕も！を押したもの) ----------
drop function if exists public.my_demands(bigint);
create or replace function public.my_demands(p_item_id bigint default null)
returns table (
  id bigint,
  title text,
  budget integer,
  deadline date,
  tags text[],
  note text,
  status text,
  fulfilled_item_id bigint,
  created_at timestamptz,
  offered boolean,
  is_owner boolean,
  my_done boolean,
  wanters integer
)
language sql
security definer
set search_path = public
stable
as $$
  select d.id, d.title, d.budget, d.deadline, d.tags, d.note, d.status,
         d.fulfilled_item_id, d.created_at,
         exists (select 1 from public.demand_offer o where o.demand_id = d.id and o.item_id = p_item_id),
         d.user_id = auth.uid(),
         case when d.user_id = auth.uid() then d.owner_fulfilled_at is not null else mv.fulfilled_at is not null end,
         public.demand_wanters(d.id)
  from public.demand d
  left join public.demand_vote mv on mv.demand_id = d.id and mv.user_id = auth.uid()
  where d.user_id = auth.uid()
     or (mv.user_id is not null and d.status <> 'removed')
  order by d.created_at desc;
$$;
revoke execute on function public.my_demands(bigint) from public, anon;
grant execute on function public.my_demands(bigint) to authenticated;

-- ---------- 一覧用の僕も！の集計 ----------
-- votes = まだ買えていない僕も！の人数、owner_done = 登録者が買えた！済みか
drop function if exists public.demand_vote_summary();
create or replace function public.demand_vote_summary()
returns table (demand_id bigint, votes integer, voted boolean, my_done boolean, owner_done boolean)
language sql
security definer
set search_path = public
stable
as $$
  select d.id,
         (select count(*) from public.demand_vote v where v.demand_id = d.id and v.fulfilled_at is null)::integer,
         mv.user_id is not null,
         coalesce(mv.fulfilled_at is not null, false),
         d.owner_fulfilled_at is not null
  from public.demand d
  left join public.demand_vote mv on mv.demand_id = d.id and mv.user_id = auth.uid()
  where auth.uid() is not null
    and (
      d.user_id = auth.uid()
      or mv.user_id is not null
      or (d.status = 'open' and d.deadline >= public.jst_today() and not public.is_deleted(d.user_id))
    );
$$;
revoke execute on function public.demand_vote_summary() from public, anon;
grant execute on function public.demand_vote_summary() to authenticated;

drop function if exists public.toggle_demand_vote(bigint);
create or replace function public.toggle_demand_vote(p_demand_id bigint)
returns table (votes integer, voted boolean, owner_done boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_owner_done boolean;
  v_voted boolean;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select d.user_id, d.owner_fulfilled_at is not null into v_owner, v_owner_done
  from public.demand d
  where d.id = p_demand_id and d.status = 'open' and d.deadline >= public.jst_today();
  if v_owner is null or public.is_deleted(v_owner) or public.is_blocked_by(auth.uid(), v_owner) then
    raise exception 'この欲しい！は受付が終わりました';
  end if;
  if v_owner = auth.uid() then
    raise exception '自分の欲しい！には押せません';
  end if;
  if exists (select 1 from public.demand_vote v
             where v.demand_id = p_demand_id and v.user_id = auth.uid() and v.fulfilled_at is not null) then
    raise exception 'この欲しい！はもう買えた！にしています';
  end if;

  delete from public.demand_vote v where v.demand_id = p_demand_id and v.user_id = auth.uid();
  v_voted := not found;
  if v_voted then
    insert into public.demand_vote (demand_id, user_id) values (p_demand_id, auth.uid());
  else
    -- 最後の1人が取り消したら、欲しい！自体を買えた！にする場合がある
    perform public.finalize_demand(p_demand_id);
  end if;

  return query
    select (select count(*) from public.demand_vote v where v.demand_id = p_demand_id and v.fulfilled_at is null)::integer,
           v_voted, v_owner_done;
end;
$$;
revoke execute on function public.toggle_demand_vote(bigint) from public, anon;
grant execute on function public.toggle_demand_vote(bigint) to authenticated;

-- ---------- 買えた！・取り下げ ----------
-- fulfilled: 登録者でも僕も！の人でも、自分の分を買えた！にする
-- withdrawn: 登録者のみ。まだ買えていない僕も！の人には通知する
create or replace function public.close_my_demand(p_demand_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  if p_status = 'fulfilled' then
    update public.demand
    set owner_fulfilled_at = now()
    where id = p_demand_id and user_id = auth.uid() and status = 'open' and owner_fulfilled_at is null;
    if not found then
      update public.demand_vote v
      set fulfilled_at = now()
      from public.demand d
      where v.demand_id = p_demand_id and v.user_id = auth.uid() and v.fulfilled_at is null
        and d.id = v.demand_id and d.status = 'open';
      if not found then
        raise exception 'この欲しい！は変更できません';
      end if;
    end if;
    perform public.finalize_demand(p_demand_id);

  elsif p_status = 'withdrawn' then
    update public.demand
    set status = 'withdrawn', closed_at = now()
    where id = p_demand_id and user_id = auth.uid() and status = 'open' and owner_fulfilled_at is null
    returning title into v_title;
    if v_title is null then
      raise exception 'この欲しい！は取り下げられません';
    end if;
    insert into public.notification (user_id, message, item_id, demand_id)
    select v.user_id, '僕も！を押した欲しい！「' || v_title || '」が取り下げられました', null, p_demand_id
    from public.demand_vote v
    where v.demand_id = p_demand_id and v.fulfilled_at is null and not public.is_deleted(v.user_id);

  else
    raise exception '不正な状態です';
  end if;
end;
$$;

-- 購入者が、買った商品で自分の分(登録した欲しい！・僕も！を押した欲しい！)を買えた！にする
create or replace function public.fulfill_my_demands(p_item_id bigint, p_demand_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_seller uuid;
  v_owner_count integer;
  v_vote_count integer;
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select title, user_id into v_title, v_seller
  from public.item
  where id = p_item_id and buyer_id = auth.uid();
  if v_seller is null then
    raise exception 'この商品の購入者ではありません';
  end if;

  update public.demand
  set owner_fulfilled_at = now(), fulfilled_item_id = p_item_id
  where id = any(p_demand_ids) and user_id = auth.uid() and status = 'open' and owner_fulfilled_at is null;
  get diagnostics v_owner_count = row_count;

  update public.demand_vote v
  set fulfilled_at = now(), fulfilled_item_id = p_item_id
  from public.demand d
  where v.demand_id = any(p_demand_ids) and v.user_id = auth.uid() and v.fulfilled_at is null
    and d.id = v.demand_id and d.status = 'open';
  get diagnostics v_vote_count = row_count;

  foreach v_id in array p_demand_ids loop
    perform public.finalize_demand(v_id);
  end loop;

  if v_owner_count + v_vote_count > 0 and not public.is_deleted(v_seller) then
    insert into public.notification (user_id, message, item_id)
    values (v_seller, '「' || v_title || '」で、だれかの欲しい！がかないました。出品ありがとう！', p_item_id);
  end if;
  return v_owner_count + v_vote_count;
end;
$$;

-- ---------- 出品者からのお知らせは、まだ買えていない人にだけ送る ----------
create or replace function public.offer_item_to_demands(p_item_id bigint, p_demand_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_count integer;
  v_offered bigint[];
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if cardinality(p_demand_ids) > 10 then
    raise exception '一度に知らせられるのは10件までです';
  end if;

  select title into v_title
  from public.item
  where id = p_item_id and user_id = auth.uid() and sold = false;
  if v_title is null then
    raise exception '商品が見つかりません';
  end if;

  -- 1つの商品から知らせられるのは合計10件まで(無関係な欲しい！への連投を防ぐ)
  perform pg_advisory_xact_lock(hashtext('demand_offer:' || p_item_id::text));
  if (select count(*) from public.demand_offer where item_id = p_item_id) + cardinality(p_demand_ids) > 10 then
    raise exception '1つの商品から知らせられるのは10件までです';
  end if;

  with ins as (
    insert into public.demand_offer (demand_id, item_id)
    select d.id, p_item_id
    from public.demand d
    where d.id = any(p_demand_ids)
      and d.status = 'open'
      and d.deadline >= public.jst_today()
      and d.user_id <> auth.uid()
      and not public.is_deleted(d.user_id)
      and not public.is_blocked_by(d.user_id, auth.uid())
      and not public.is_blocked_by(auth.uid(), d.user_id)
    on conflict do nothing
    returning demand_id
  )
  select coalesce(array_agg(demand_id), array[]::bigint[]) into v_offered from ins;

  -- 登録した人(まだ買えていない人)には欲しい！ごとに1件
  insert into public.notification (user_id, message, item_id)
  select d.user_id, 'あなたの欲しい！「' || d.title || '」に合いそうな「' || v_title || '」が出品されました', p_item_id
  from public.demand d
  where d.id = any(v_offered) and d.owner_fulfilled_at is null;
  get diagnostics v_count = row_count;

  -- 僕も！を押した(まだ買えていない)人には1人1件(登録した人として通知済みの人・出品者本人は除く)
  insert into public.notification (user_id, message, item_id)
  select distinct on (v.user_id)
    v.user_id, '僕も！を押した欲しい！「' || d.title || '」に合いそうな「' || v_title || '」が出品されました', p_item_id
  from public.demand_vote v
  join public.demand d on d.id = v.demand_id
  where v.demand_id = any(v_offered)
    and v.fulfilled_at is null
    and v.user_id <> auth.uid()
    and v.user_id not in (select d2.user_id from public.demand d2 where d2.id = any(v_offered) and d2.owner_fulfilled_at is null)
    and not public.is_deleted(v.user_id)
    and not public.is_blocked_by(v.user_id, auth.uid())
    and not public.is_blocked_by(auth.uid(), v.user_id)
  order by v.user_id, v.created_at;

  return v_count;
end;
$$;

-- ---------- 編集(期限の延長を含む) ----------
create or replace function public.update_my_demand(
  p_demand_id bigint,
  p_title text,
  p_budget integer,
  p_deadline date,
  p_tags text[],
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tags text[];
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  v_tags := public.normalize_demand_tags(p_tags);
  perform public.check_demand_values(p_deadline, v_tags);

  -- 文字数・金額は demand テーブルの check 制約で確かめる
  update public.demand
  set title = trim(p_title),
      budget = p_budget,
      deadline = p_deadline,
      tags = v_tags,
      note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_demand_id and user_id = auth.uid() and status = 'open' and owner_fulfilled_at is null;
  if not found then
    raise exception 'この欲しい！は編集できません';
  end if;
end;
$$;
revoke execute on function public.update_my_demand(bigint, text, integer, date, text[], text) from public, anon;
grant execute on function public.update_my_demand(bigint, text, integer, date, text[], text) to authenticated;

-- ---------- 期限のお知らせ ----------
-- サイトを開いたとき(通知を読み込むとき)に呼ぶ。送った件数を返す。
create or replace function public.send_demand_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  with due as (
    update public.demand
    set reminded_deadline = deadline
    where user_id = auth.uid()
      and status = 'open'
      and owner_fulfilled_at is null
      and deadline between public.jst_today() and public.jst_today() + 3
      and reminded_deadline is distinct from deadline
    returning id, title, deadline
  )
  insert into public.notification (user_id, message, item_id, demand_id)
  select auth.uid(),
         '欲しい！「' || title || '」の期限(' || to_char(deadline, 'FMMM/FMDD') || ')が近づいています。まだ欲しい場合は、編集から期限を延ばせます',
         null, id
  from due;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.send_demand_reminders() from public, anon;
grant execute on function public.send_demand_reminders() to authenticated;

-- ---------- 管理者向け集計 ----------
create or replace function public.admin_demand_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_today date := public.jst_today();
  -- 週は月曜はじまり(日本時間)
  v_week date := date_trunc('week', v_today)::date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  with active as (
    select d.*, public.demand_wanters(d.id) as wanters
    from public.demand d
    where d.status = 'open' and d.deadline >= v_today
  ),
  fulfilled_people as (
    select owner_fulfilled_at as at, fulfilled_item_id from public.demand where owner_fulfilled_at is not null
    union all
    select fulfilled_at, fulfilled_item_id from public.demand_vote where fulfilled_at is not null
  ),
  weeks as (
    select (v_week - 7 * g)::date as week_start from generate_series(0, 7) as g
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'active', (select count(*) from active),
      'expired', (select count(*) from public.demand where status = 'open' and deadline < v_today),
      'fulfilled', (select count(*) from public.demand where status = 'fulfilled'),
      'withdrawn', (select count(*) from public.demand where status = 'withdrawn'),
      'removed', (select count(*) from public.demand where status = 'removed'),
      'total', (select count(*) from public.demand)
    ),
    'posters', (select count(distinct user_id) from public.demand),
    'votes_total', (select count(*) from public.demand_vote),
    'wanters_active', (select coalesce(sum(wanters), 0) from active),
    'fulfilled_people', (select count(*) from fulfilled_people),
    'fulfilled_by_purchase', (select count(*) from fulfilled_people where fulfilled_item_id is not null),
    'offers', (select count(*) from public.demand_offer),
    'offered_items', (select count(distinct item_id) from public.demand_offer),
    'offered_items_sold', (
      select count(distinct o.item_id) from public.demand_offer o join public.item i on i.id = o.item_id where i.sold
    ),
    'avg_days_to_fulfill', (
      select round(avg(extract(epoch from owner_fulfilled_at - created_at) / 86400)::numeric, 1)
      from public.demand where owner_fulfilled_at is not null
    ),
    'budget_active', (
      select jsonb_build_object(
        'avg', round(avg(budget)),
        'median', percentile_cont(0.5) within group (order by budget)
      ) from active
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start,
        'created', (select count(*) from public.demand d
                    where (d.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                      and (d.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'fulfilled', (select count(*) from fulfilled_people f
                      where (f.at at time zone 'Asia/Tokyo')::date >= w.week_start
                        and (f.at at time zone 'Asia/Tokyo')::date < w.week_start + 7)
      ) order by w.week_start)
      from weeks w
    ),
    'top_tags', (
      select coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'demands', n, 'wanters', w) order by w desc, n desc), '[]'::jsonb)
      from (
        select t.tag, count(*) as n, sum(a.wanters) as w
        from active a, unnest(a.tags) as t(tag)
        group by t.tag
        order by w desc, n desc
        limit 15
      ) s
    ),
    'top_demands', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'budget', budget, 'deadline', deadline, 'wanters', wanters) order by wanters desc, created_at desc), '[]'::jsonb)
      from (select * from active order by wanters desc, created_at desc limit 10) s
    )
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_demand_stats() from public, anon;
grant execute on function public.admin_demand_stats() to authenticated;


-- ============================================================
-- PART AI: 未ログインでも「みんなの欲しい！」を見られるようにする
-- ============================================================
--
-- 背景: 告知を見た人が登録前にサイトを開いても、みんなの欲しい！が見られず
--   「ログインすると見られます」になっていた。閲覧だけは未ログイン(anon)にも許可する。
--   - 見られるのは受付中(期限内)のものだけ。誰が登録したか(user_id)は
--     ログインしている人と同じく列ごと読めない
--   - 僕も！の人数(demand_vote_summary)も見られるようにする。未ログインでは
--     voted / my_done は常に false になる
--   - 登録・僕も！・通報・出品はこれまでどおりログインが必要

grant select (id, title, budget, deadline, tags, note, status, created_at) on public.demand to anon;

drop policy if exists "demand_select_open_anon" on public.demand;
create policy "demand_select_open_anon"
on public.demand for select
to anon
using (
  status = 'open'
  and deadline >= public.jst_today()
  and not public.is_deleted(user_id)
);

-- PART AH の demand_vote_summary から「ログインしていること」の条件を外す
create or replace function public.demand_vote_summary()
returns table (demand_id bigint, votes integer, voted boolean, my_done boolean, owner_done boolean)
language sql
security definer
set search_path = public
stable
as $$
  select d.id,
         (select count(*) from public.demand_vote v where v.demand_id = d.id and v.fulfilled_at is null)::integer,
         mv.user_id is not null,
         coalesce(mv.fulfilled_at is not null, false),
         d.owner_fulfilled_at is not null
  from public.demand d
  left join public.demand_vote mv on mv.demand_id = d.id and mv.user_id = auth.uid()
  where (auth.uid() is not null and (d.user_id = auth.uid() or mv.user_id is not null))
     or (d.status = 'open' and d.deadline >= public.jst_today() and not public.is_deleted(d.user_id));
$$;
grant execute on function public.demand_vote_summary() to anon, authenticated;


-- ============================================================
-- PART AJ: 管理者向けに、サイト全体の数字を週ごとに記録・集計する
-- ============================================================
--
-- 背景: 登録者・出品者・出品・取引・QRコードの読み込みの数を週ごとに追いたい
--   (施策の効果の確認や、発表の資料に使う)。
--   これまで「いつ売れたか」の日時が無かったので item.sold_at を追加し、
--   売れた(sold が false → true になった)ときに自動で記録する。
--   取引がキャンセルされて sold が false に戻ったら sold_at も消す。
--   既に売れている商品は、出品者に届いた「売れました！」の通知の日時で埋める。
--   sold_at は一般ユーザーには公開しない(item の SELECT は列ごとの許可のため、
--   新しい列はそのままでは読めない。管理者は下の関数経由で集計する)。
--
-- 注意: 管理者が削除した商品や退会した人の出品は数に含まれない(データが残らないため)。

alter table public.item add column if not exists sold_at timestamptz;

create or replace function public.set_item_sold_at()
returns trigger
language plpgsql
as $$
begin
  if new.sold and not coalesce(old.sold, false) then
    new.sold_at := now();
  elsif not new.sold then
    new.sold_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_item_sold_at_trigger on public.item;
create trigger set_item_sold_at_trigger
before update of sold on public.item
for each row execute function public.set_item_sold_at();

-- 既に売れている商品は、最後に届いた「売れました！」の通知の日時で埋める
update public.item i
set sold_at = n.at
from (
  select item_id, max(created_at) as at
  from public.notification
  where message like '%」が売れました！'
  group by item_id
) n
where i.id = n.item_id and i.sold and i.sold_at is null;

create or replace function public.admin_site_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_week date := date_trunc('week', public.jst_today())::date;  -- 今週の月曜(日本時間)
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  with weeks as (
    select (v_week - 7 * g)::date as week_start from generate_series(0, 11) as g
  ),
  first_listing as (
    select user_id, min(created_at) as at from public.item group by user_id
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users u where not exists (select 1 from public.deleted_users d where d.user_id = u.id)),
      'sellers', (select count(distinct user_id) from public.item),
      'items', (select count(*) from public.item),
      'listed', (select count(*) from public.item where not sold),
      'sold', (select count(*) from public.item where sold),
      'received', (select count(*) from public.item where received),
      'qr_scans', (select count(*) from public.qr_scan),
      'messages', (select count(*) from public.message)
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start,
        'new_users', (select count(*) from auth.users u
                      where (u.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                        and (u.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'users_total', (select count(*) from auth.users u
                        where (u.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'new_items', (select count(*) from public.item i
                      where (i.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                        and (i.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'active_sellers', (select count(distinct i.user_id) from public.item i
                           where (i.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                             and (i.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'new_sellers', (select count(*) from first_listing f
                        where (f.at at time zone 'Asia/Tokyo')::date >= w.week_start
                          and (f.at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'sellers_total', (select count(*) from first_listing f
                          where (f.at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'sold', (select count(*) from public.item i
                 where i.sold_at is not null
                   and (i.sold_at at time zone 'Asia/Tokyo')::date >= w.week_start
                   and (i.sold_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'messages', (select count(*) from public.message m
                     where (m.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                       and (m.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'qr_scans', (select count(*) from public.qr_scan q
                     where (q.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                       and (q.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7)
      ) order by w.week_start)
      from weeks w
    )
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_site_stats() from public, anon;
grant execute on function public.admin_site_stats() to authenticated;


-- ============================================================
-- PART AK: 管理者が、欲しい！に僕も！した人を見られるようにする
-- ============================================================
--
-- 背景: 運営のために、誰が僕も！を押しているかを管理者ページで確認したい。
--   一般の利用者には引き続き見せない(demand_vote はポリシー無しの RLS のまま)。
--   管理者だけが呼べる関数で、すべての僕も！を登録者の情報つきで返す。

create or replace function public.admin_list_demand_voters()
returns table (
  demand_id bigint,
  user_id uuid,
  email text,
  nickname text,
  created_at timestamptz,
  fulfilled_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  return query
    select v.demand_id, v.user_id, u.email::text, (u.raw_user_meta_data ->> 'nickname')::text,
           v.created_at, v.fulfilled_at
    from public.demand_vote v
    left join auth.users u on u.id = v.user_id
    order by v.demand_id, v.created_at;
end;
$$;
revoke execute on function public.admin_list_demand_voters() from public, anon;
grant execute on function public.admin_list_demand_voters() to authenticated;


-- ============================================================
-- PART AL: 通知をリアルタイムで受け取れるようにする
-- ============================================================
--
-- 背景: ヘッダーの通知の数は、ページを開いたときにしか更新されなかった。
--   notification を Supabase Realtime の配信対象(supabase_realtime)に加え、
--   通知が増えたり既読になったりしたら、開いている画面の数をすぐ更新する。
--   届くのは本人の通知だけ(Realtime にも notification_select_own の RLS が効く)。

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification'
  ) then
    alter publication supabase_realtime add table public.notification;
  end if;
end;
$$;


-- ============================================================
-- PART AM: 欲しい！に商品が知らされたら、登録した人にお知らせメールを送る
-- ============================================================
--
-- 仕組み: demand_offer に行が追加されたら(出品者が offer_item_to_demands で
--   自分の商品を欲しい！に知らせたら)、pg_net で Edge Function
--   notify-demand-offer(supabase/functions/notify-demand-offer)を呼ぶ。
--   Edge Function が DB で状態を確かめ直し、欲しい！を登録した人に Resend で送る。
--   - 合言葉は購入メール(PART AD)と同じ Vault の sold_email_hook_secret を使う
--   - 送るのは欲しい！を登録した本人だけ(僕も！を押した人にはサイト内の通知のみ)
--   - 欲しい！が募集中で、本人がまだ買えていないときだけ送る
--   - 同じ人へのメールは24時間に5通まで。超えた分はサイト内の通知だけになる
--     (Resend の無料枠を購入メール・登録メールと分け合うため)
--   - メール送信で何が起きても、知らせる操作は止めない

create table if not exists public.demand_email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  demand_id bigint not null,
  item_id bigint not null,
  created_at timestamptz not null default now()
);
alter table public.demand_email_log enable row level security;
revoke all on public.demand_email_log from anon, authenticated;
create index if not exists demand_email_log_user_idx on public.demand_email_log (user_id, created_at);

create or replace function public.notify_demand_offer_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_secret text;
begin
  begin
    select d.user_id into v_owner
    from public.demand d
    where d.id = new.demand_id
      and d.status = 'open'
      and d.owner_fulfilled_at is null
      and not public.is_deleted(d.user_id);
    if v_owner is null then
      return new;
    end if;

    -- 同じ人へのメールは24時間に5通まで
    if (select count(*) from public.demand_email_log
        where user_id = v_owner and created_at > now() - interval '24 hours') >= 5 then
      return new;
    end if;

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'sold_email_hook_secret'
    limit 1;

    if v_secret is not null then
      insert into public.demand_email_log (user_id, demand_id, item_id)
      values (v_owner, new.demand_id, new.item_id);
      delete from public.demand_email_log where created_at < now() - interval '7 days';
      perform net.http_post(
        url := 'https://cchsbakrlranhpgetcwg.supabase.co/functions/v1/notify-demand-offer',
        body := jsonb_build_object('demand_id', new.demand_id, 'item_id', new.item_id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret)
      );
    end if;
  exception when others then
    raise warning 'notify_demand_offer_email failed: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.notify_demand_offer_email() from public, anon, authenticated;

drop trigger if exists notify_demand_offer_email_trigger on public.demand_offer;
create trigger notify_demand_offer_email_trigger
after insert on public.demand_offer
for each row execute function public.notify_demand_offer_email();


-- ============================================================
-- PART AN: インスタなど、どこから来た人かを数えられるようにする
-- ============================================================
--
-- 背景: /qr の読み込み回数(PART AC)はポスターのQRからしか数えられず、
--   インスタからどれだけ来ているか分からなかった。
--   /qr?from=insta のように目印を付けたリンクを使うと、その目印(source)を
--   いっしょに記録する。目印なし(これまでのポスターのQR)は source が空のまま。
--   目印は英小文字・数字・_・- の32文字までに限る(誰でも記録できる表なので、
--   長い文や変な文字を入れられないようにする)。
--   admin_site_stats()(PART AJ)は「QR読込」をポスター(目印なし)だけに直し、
--   インスタ(insta で始まる目印)の数と、目印ごとの数も返すようにする。
--   ※ 数えているのは「リンクが開かれた回数」で、同じ人が2回開けば2回になる。

alter table public.qr_scan add column if not exists source text;

alter table public.qr_scan drop constraint if exists qr_scan_source_format;
alter table public.qr_scan add constraint qr_scan_source_format
  check (source is null or source ~ '^[a-z0-9_-]{1,32}$');

create or replace function public.admin_site_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_week date := date_trunc('week', public.jst_today())::date;  -- 今週の月曜(日本時間)
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  with weeks as (
    select (v_week - 7 * g)::date as week_start from generate_series(0, 11) as g
  ),
  first_listing as (
    select user_id, min(created_at) as at from public.item group by user_id
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users u where not exists (select 1 from public.deleted_users d where d.user_id = u.id)),
      'sellers', (select count(distinct user_id) from public.item),
      'items', (select count(*) from public.item),
      'listed', (select count(*) from public.item where not sold),
      'sold', (select count(*) from public.item where sold),
      'received', (select count(*) from public.item where received),
      'qr_scans', (select count(*) from public.qr_scan where source is null),
      'insta', (select count(*) from public.qr_scan where source like 'insta%'),
      'messages', (select count(*) from public.message)
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start,
        'new_users', (select count(*) from auth.users u
                      where (u.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                        and (u.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'users_total', (select count(*) from auth.users u
                        where (u.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'new_items', (select count(*) from public.item i
                      where (i.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                        and (i.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'active_sellers', (select count(distinct i.user_id) from public.item i
                           where (i.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                             and (i.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'new_sellers', (select count(*) from first_listing f
                        where (f.at at time zone 'Asia/Tokyo')::date >= w.week_start
                          and (f.at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'sellers_total', (select count(*) from first_listing f
                          where (f.at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'sold', (select count(*) from public.item i
                 where i.sold_at is not null
                   and (i.sold_at at time zone 'Asia/Tokyo')::date >= w.week_start
                   and (i.sold_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'messages', (select count(*) from public.message m
                     where (m.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                       and (m.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'qr_scans', (select count(*) from public.qr_scan q
                     where q.source is null
                       and (q.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                       and (q.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7),
        'insta', (select count(*) from public.qr_scan q
                  where q.source like 'insta%'
                    and (q.created_at at time zone 'Asia/Tokyo')::date >= w.week_start
                    and (q.created_at at time zone 'Asia/Tokyo')::date < w.week_start + 7)
      ) order by w.week_start)
      from weeks w
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source', x.source, 'total', x.total, 'last7', x.last7, 'first_at', x.first_at
      ) order by x.total desc, x.source), '[]'::jsonb)
      from (
        select q.source,
               count(*) as total,
               count(*) filter (where q.created_at >= now() - interval '7 days') as last7,
               min(q.created_at) as first_at
        from public.qr_scan q
        where q.source is not null
        group by q.source
      ) x
    )
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_site_stats() from public, anon;
grant execute on function public.admin_site_stats() to authenticated;


-- ============================================================
-- PART AO: 見ていない間に届いたチャットのメッセージを、1時間おきにメールで知らせる
-- ============================================================
--
-- 背景: メッセージが届くとサイト内の通知(notification)は作られるが、サイトを
--   開かないと気づけず、待ち合わせの連絡を見逃して取引が流れるおそれがあった。
-- 仕組み:
--   - サイトを開いている間、画面(ヘッダー)が1分ごとに touch_site_presence() で
--     「サイトを見ている」時刻を site_presence に記録する
--   - チャット画面を開いている間、30秒ごとに touch_chat_presence() で
--     「そのチャットを見ている」時刻を chat_presence に記録する
--   - pg_cron で毎時0分に send_chat_digests() を動かす。直前の1時間に届いた
--     個別チャット(buyer_id がある message)のうち、次のものを受け取った人ごとに
--     まとめて、Edge Function notify-chat-digest に渡してメールを送る
--       ・受け取った人が、届いたあとにそのチャットを開いていない
--       ・受け取った人が、届いたあとにそのチャットで返信していない
--     ただし、その時点で受け取った人がサイトを見ている(直近2分以内)なら送らない
--   - 出品者→購入者、購入者→出品者のどちらの向きも同じ
--   - 公開Q&A(buyer_id が無いもの)・退会済みの人は対象外。メッセージの中身は載せない
--   - 合言葉は購入メール(PART AD)と同じ Vault の sold_email_hook_secret を使う
--   - 事前に Supabase の Database → Extensions で pg_cron を有効にしておくこと

-- ---------- サイトを見ている時刻 ----------
create table if not exists public.site_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.site_presence enable row level security;
revoke all on public.site_presence from anon, authenticated;
-- 一般ユーザー向けのポリシーは作らない。下の SECURITY DEFINER 関数経由でのみ使う。

create or replace function public.touch_site_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.site_presence (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;
revoke execute on function public.touch_site_presence() from public, anon;
grant execute on function public.touch_site_presence() to authenticated;

-- ---------- チャットを見ている時刻 ----------
create table if not exists public.chat_presence (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id bigint not null references public.item(id) on delete cascade,
  buyer_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, item_id, buyer_id)
);
alter table public.chat_presence enable row level security;
revoke all on public.chat_presence from anon, authenticated;

-- 自分が当事者のチャット(出品者として購入者 p_buyer_id とのチャット、
-- または購入者として自分のチャット)だけ記録できる
create or replace function public.touch_chat_presence(p_item_id bigint, p_buyer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_buyer_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.item i
    where i.id = p_item_id
      and (
        (i.user_id = auth.uid() and p_buyer_id <> auth.uid())
        or (p_buyer_id = auth.uid() and i.user_id <> auth.uid())
      )
  ) then
    return;
  end if;

  insert into public.chat_presence (user_id, item_id, buyer_id, last_seen_at)
  values (auth.uid(), p_item_id, p_buyer_id, now())
  on conflict (user_id, item_id, buyer_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;
revoke execute on function public.touch_chat_presence(bigint, uuid) from public, anon;
grant execute on function public.touch_chat_presence(bigint, uuid) to authenticated;

-- ---------- 1時間ごとのまとめメール ----------
-- 同じ時間帯に二重に送らないための記録
create table if not exists public.chat_digest_log (
  recipient_id uuid not null,
  window_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (recipient_id, window_start)
);
alter table public.chat_digest_log enable row level security;
revoke all on public.chat_digest_log from anon, authenticated;

create index if not exists message_thread_created_idx on public.message (item_id, buyer_id, created_at);

-- 直前の1時間(p_window_start から1時間)に届いて、まだ見ても返信してもいないメッセージを、
-- 受け取った人ごとにまとめて Edge Function に渡す。送った人数を返す。
create or replace function public.send_chat_digests(p_window_start timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to timestamptz;
  v_from timestamptz;
  v_secret text;
  v_count integer := 0;
  r record;
begin
  v_to := coalesce(p_window_start + interval '1 hour', date_trunc('hour', now()));
  v_from := v_to - interval '1 hour';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sold_email_hook_secret'
  limit 1;
  if v_secret is null then
    return 0;
  end if;

  for r in
    with incoming as (
      select m.id, m.item_id, m.buyer_id, m.created_at,
             case when m.user_id = m.buyer_id then m.seller_id else m.buyer_id end as recipient_id
      from public.message m
      where m.buyer_id is not null
        and m.seller_id is not null
        and m.created_at > v_from
        and m.created_at <= v_to
    )
    select i.recipient_id, array_agg(i.id order by i.created_at) as message_ids
    from incoming i
    where i.recipient_id is not null
      and not public.is_deleted(i.recipient_id)
      -- 届いたあとに、そのチャットを開いていない
      and not exists (
        select 1 from public.chat_presence cp
        where cp.user_id = i.recipient_id and cp.item_id = i.item_id and cp.buyer_id = i.buyer_id
          and cp.last_seen_at >= i.created_at
      )
      -- 届いたあとに、そのチャットで返信していない
      and not exists (
        select 1 from public.message rep
        where rep.item_id = i.item_id and rep.buyer_id = i.buyer_id
          and rep.user_id = i.recipient_id and rep.created_at > i.created_at
      )
      -- 今サイトを見ていない(直近2分以内に見ていない)
      and not exists (
        select 1 from public.site_presence sp
        where sp.user_id = i.recipient_id and sp.last_seen_at > now() - interval '2 minutes'
      )
      -- この時間帯のまとめメールをまだ送っていない
      and not exists (
        select 1 from public.chat_digest_log l
        where l.recipient_id = i.recipient_id and l.window_start = v_from
      )
    group by i.recipient_id
  loop
    begin
      insert into public.chat_digest_log (recipient_id, window_start) values (r.recipient_id, v_from);
      perform net.http_post(
        url := 'https://cchsbakrlranhpgetcwg.supabase.co/functions/v1/notify-chat-digest',
        body := jsonb_build_object('recipient_id', r.recipient_id, 'message_ids', to_jsonb(r.message_ids[1:50])),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret)
      );
      v_count := v_count + 1;
    exception when others then
      raise warning 'send_chat_digests failed for %: %', r.recipient_id, sqlerrm;
    end;
  end loop;

  delete from public.chat_digest_log where window_start < now() - interval '7 days';
  return v_count;
end;
$$;
revoke execute on function public.send_chat_digests(timestamptz) from public, anon, authenticated;

-- 毎時0分に動かす(同じ名前で登録し直すと上書きされる)
create extension if not exists pg_cron;
select cron.schedule('hokuma-chat-digest', '0 * * * *', $$select public.send_chat_digests()$$);


-- ============================================================
-- PART AP: インスタなど、どこから来て登録した人かを数えられるようにする
-- ============================================================
--
-- 背景: PART AN で「リンクが開かれた回数」は目印ごとに数えられるようになったが、
--   そのうち何人が登録まで進んだかは分からなかった。
-- 仕組み:
--   - /qr?from=insta などから来ると、ブラウザがその目印を最長30日覚えておく
--     (lib/visitSource.ts。目印なしのポスターのQRは "poster")
--   - 登録するとき、目印を user_metadata.source として一緒に送る
--   - 登録した瞬間に、トリガーで signup_source 表へ写しておく。
--     user_metadata は本人があとから書き換えられるので、集計には写した方を使う
--   - admin_signup_sources() で、目印ごとの登録者数(退会した人を除く)を管理者だけが見られる
--   ※ 違う端末・違うブラウザ(インスタのアプリ内ブラウザ → Safari など)で登録すると
--     目印が引き継がれず「記録なし」になる。数字は少なめに出ることに注意。

create table if not exists public.signup_source (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source ~ '^[a-z0-9_-]{1,32}$'),
  created_at timestamptz not null default now()
);
alter table public.signup_source enable row level security;
revoke all on public.signup_source from anon, authenticated;
-- 一般ユーザー向けのポリシーは作らない(トリガーと管理者用の関数からだけ使う)

create or replace function public.record_signup_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := lower(trim(new.raw_user_meta_data ->> 'source'));
begin
  if v_source ~ '^[a-z0-9_-]{1,32}$' then
    insert into public.signup_source (user_id, source) values (new.id, v_source)
    on conflict (user_id) do nothing;
  end if;
  return new;
exception when others then
  -- 集計のための記録なので、失敗しても登録は止めない
  return new;
end;
$$;

drop trigger if exists record_signup_source_trigger on auth.users;
create trigger record_signup_source_trigger
after insert on auth.users
for each row
execute function public.record_signup_source();

create or replace function public.admin_signup_sources()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  with users as (
    select u.id, u.created_at, s.source
    from auth.users u
    left join public.signup_source s on s.user_id = u.id
    where not exists (select 1 from public.deleted_users d where d.user_id = u.id)
  )
  select jsonb_build_object(
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', x.source, 'total', x.total, 'last7', x.last7)
                       order by x.total desc, x.source)
      from (
        select source,
               count(*) as total,
               count(*) filter (where created_at >= now() - interval '7 days') as last7
        from users
        where source is not null
        group by source
      ) x
    ), '[]'::jsonb),
    'insta', (select count(*) from users where source like 'insta%'),
    'none', (select count(*) from users where source is null),
    -- この仕組みを入れてから(最初の記録以降)に登録した人のうち、目印の無かった人
    'none_since', (select count(*) from users
                   where source is null
                     and created_at >= (select min(created_at) from public.signup_source)),
    'since', (select min(created_at) from public.signup_source)
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_signup_sources() from public, anon;
grant execute on function public.admin_signup_sources() to authenticated;
