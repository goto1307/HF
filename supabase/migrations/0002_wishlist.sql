-- ============================================================
-- ほしい物リスト
-- ============================================================
--
-- 利用者が「ほしいカテゴリ」を登録しておくと、そのカテゴリで
-- 新しく出品されたときにサイト内の通知（notification）が届く。
-- 誰が何をほしがっているかは本人以外には見せない。

create table if not exists public.wish (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('教科書', '自転車', '家電・家具', '衣類', 'その他')),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.wish enable row level security;

-- ログインしていない人には一切触らせない
revoke all on public.wish from anon;
grant select, insert, delete on public.wish to authenticated;

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

-- 出品されたら、そのカテゴリをほしい物に登録している人へ通知する。
-- 出品者本人と、出品者をブロックしている人には送らない。
create or replace function public.notify_wishers_on_new_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification (user_id, message, item_id, read)
  select
    w.user_id,
    'ほしい物リストの「' || new.category || '」に新しい出品があります：「' || left(new.title, 40) || '」',
    new.id,
    false
  from public.wish w
  where w.category = new.category
    and w.user_id <> new.user_id
    and not exists (
      select 1 from public.blocked_user b
      where b.blocker_id = w.user_id and b.blocked_id = new.user_id
    );
  return new;
end;
$$;

revoke execute on function public.notify_wishers_on_new_item() from public, anon, authenticated;

drop trigger if exists notify_wishers_on_new_item_trigger on public.item;
create trigger notify_wishers_on_new_item_trigger
after insert on public.item
for each row
execute function public.notify_wishers_on_new_item();
