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
alter table public.meetup enable row level security;

drop policy if exists "meetup_select_participant" on public.meetup;
create policy "meetup_select_participant"
on public.meetup for select
using (
  auth.uid() = buyer_id
  or auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
);

drop policy if exists "meetup_insert_seller_only" on public.meetup;
create policy "meetup_insert_seller_only"
on public.meetup for insert
to authenticated
with check (
  auth.uid() = (select i.user_id from public.item i where i.id = meetup.item_id)
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
