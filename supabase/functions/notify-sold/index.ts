// 商品が購入されたら、出品者の登録メールアドレスにお知らせメールを送る Edge Function。
//
// 呼び出し元は DB のトリガー notify_sold_email()(migration PART AA)だけ。
// - 合言葉(x-hook-secret)が一致しない呼び出しは拒否する
// - 受け取るのは item_id だけ。送り先と文面は呼び出し側に決めさせず、
//   DB で「本当に売れた商品」かを確かめてから、その出品者に決まった文面で送る
// - 商品名など利用者が入力した文字は HTML として扱わない(テキストメールのみ)
//
// 必要な Secrets(Supabase ダッシュボード → Edge Functions → Secrets):
//   RESEND_API_KEY  … Resend の API キー
//   HOOK_SECRET     … DB の Vault に保存した sold_email_hook_secret と同じ値
//   MAIL_FROM       … 任意。既定は "HOKUMA <noreply@hokuma-market.com>"
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で渡す。
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = "https://www.hokuma-market.com";

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, "method not allowed");

  const secret = Deno.env.get("HOOK_SECRET");
  if (!secret || req.headers.get("x-hook-secret") !== secret) {
    return json(401, "unauthorized");
  }

  let itemId: number;
  try {
    const body = await req.json();
    itemId = Number(body.item_id);
  } catch {
    return json(400, "bad request");
  }
  if (!Number.isInteger(itemId) || itemId <= 0) return json(400, "bad request");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 呼び出し内容を信用せず、DB で売却済みかを確かめ直す
  const { data: item } = await admin
    .from("item")
    .select("id,title,user_id,sold,buyer_id")
    .eq("id", itemId)
    .single();
  if (!item || !item.sold || !item.buyer_id || !item.user_id) return json(200, "skip");

  const { data: seller } = await admin.auth.admin.getUserById(item.user_id);
  const email = seller?.user?.email;
  // 退会済み(メールアドレスを書き換え済み)の人には送らない
  if (!email || email.endsWith("@deleted.invalid")) return json(200, "skip");

  const title = String(item.title ?? "").replace(/[\r\n]+/g, " ").slice(0, 45);
  const text = [
    `「${title}」が購入されました。`,
    "",
    "取引ページで購入者と連絡を取り、受け渡しの日時と場所を決めましょう。",
    `${SITE_URL}/items/${item.id}/chat`,
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
      subject: `【HOKUMA】「${title}」が購入されました`,
      text,
    }),
  });
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return json(502, "send failed");
  }
  return json(200, "sent");
});
