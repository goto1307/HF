-- ============================================================
-- 取引系の関数（購入・受け取り・キャンセル）をログイン必須にする
-- ============================================================
--
-- 問題:
--   1. mark_item_sold はログインしているかを確認しておらず、anon にも
--      実行権限があったため、ログインしていない人が API を直接呼ぶと
--      任意の商品を「売り切れ（購入者なし）」にできた。
--      また、出品者が自分の商品を購入することも防げていなかった。
--   2. cancel_purchase は auth.uid() が NULL のとき当事者チェックが
--      NULL になって素通りし、ログインしていない人でも取引を取り消せた。
--      （関数は既定で PUBLIC に実行権限があるため、anon からも呼べる）
--
-- 対応: 関数の中でログインを確認し、実行権限も authenticated だけにする。

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
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select user_id, buyer_id, title, received
  into v_seller_id, v_buyer_id, v_title, v_received
  from public.item where id = p_item_id;

  if v_buyer_id is null then
    raise exception 'この商品は購入されていません';
  end if;
  if v_received then
    raise exception '受け取り確認済みの取引はキャンセルできません';
  end if;
  if auth.uid() is distinct from v_seller_id and auth.uid() is distinct from v_buyer_id then
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

-- 引数の型に関係なく、3つの関数の実行権限をログインユーザーだけにする
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('mark_item_sold', 'mark_item_received', 'cancel_purchase')
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end;
$$;
