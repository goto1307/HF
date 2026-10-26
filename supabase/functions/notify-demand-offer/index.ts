// 出品者が自分の商品を誰かの「欲しい！」に知らせたとき、その欲しい！を登録した人に
// お知らせメールを送る Edge Function。
//
// 呼び出し元は DB のトリガー notify_demand_offer_email()(migration PART AM)だけ。
// - 合言葉(x-hook-secret)が一致しない呼び出しは拒否する(購入メールと同じ合言葉)
// - 受け取るのは demand_id と item_id だけ。送り先と文面は呼び出し側に決めさせず、
//   DB で「本当に知らせが記録されていて、欲しい！が募集中で、商品が売れていない」ことを
//   確かめてから、欲しい！を登録した人に決まった文面で送る
// - 利用者が入力した文字(欲しい！の名前・商品名)は HTML として扱わない(テキストメールのみ)
//
// 必要な Secrets は notify-sold と同じ(RESEND_API_KEY / HOOK_SECRET / 任意で MAIL_FROM)。
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で渡す。
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = "https://www.hokuma-market.com";

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// 件名や本文に入れる前に、改行を消して長さをそろえる
const oneLine = (value: unknown, max: number) =>
  String(value ?? "").replace(/[\r\n]+/g, " ").slice(0, max);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, "method not allowed");

  const secret = Deno.env.get("HOOK_SECRET");
  if (!secret || req.headers.get("x-hook-secret") !== secret) {
    return json(401, "unauthorized");
  }

  let demandId: number;
  let itemId: number;
  try {
    const body = await req.json();
    demandId = Number(body.demand_id);
    itemId = Number(body.item_id);
  } catch {
    return json(400, "bad request");
  }
  if (!Number.isInteger(demandId) || demandId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    return json(400, "bad request");
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 呼び出し内容を信用せず、本当に知らせが記録されているかを DB で確かめる
  const { data: offer } = await admin
    .from("demand_offer")
    .select("demand_id")
    .eq("demand_id", demandId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (!offer) return json(200, "skip");

  const { data: demand } = await admin
    .from("demand")
    .select("id,user_id,title,status,owner_fulfilled_at")
    .eq("id", demandId)
    .single();
  if (!demand || demand.status !== "open" || demand.owner_fulfilled_at) return json(200, "skip");

  const { data: item } = await admin
    .from("item")
    .select("id,title,sold")
    .eq("id", itemId)
    .single();
  if (!item || item.sold) return json(200, "skip");

  const { data: owner } = await admin.auth.admin.getUserById(demand.user_id);
  const email = owner?.user?.email;
  // 退会済み(メールアドレスを書き換え済み)の人には送らない
  if (!email || email.endsWith("@deleted.invalid")) return json(200, "skip");

  const demandTitle = oneLine(demand.title, 20);
  const itemTitle = oneLine(item.title, 45);
  const text = [
    `あなたの欲しい！「${demandTitle}」に合いそうな「${itemTitle}」が出品されました。`,
    "",
    "商品ページで、写真や説明を確かめてみましょう。",
    `${SITE_URL}/items/${item.id}`,
    "",
    "※取引は北大のキャンパス内で、明るい時間帯（18時まで）に行うのがおすすめです。",
    "※このメールは送信専用です。返信はできません。",
    "お問い合わせ：公式Instagram（@hokuma.official）／hokuma.official639@gmail.com",
    "",
    "HOKUMA（北大生専用のフリマ）",
    SITE_URL,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") ?? "HOKUMA <noreply@hokuma-market.com>",
      to: [email],
      subject: `【HOKUMA】欲しい！「${demandTitle}」に合いそうな商品が出品されました`,
      text,
    }),
  });
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return json(502, "send failed");
  }
  return json(200, "sent");
});
