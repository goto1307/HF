// 個別チャット(取引のメッセージ)が届いたら、受け取った人にお知らせメールを送る Edge Function。
//
// 呼び出し元は DB のトリガー notify_chat_message_email()(migration PART AO)だけ。
// - 合言葉(x-hook-secret)が一致しない呼び出しは拒否する(購入メールと同じ合言葉)
// - 受け取るのは message_id だけ。送り先と文面は呼び出し側に決めさせず、
//   DB でメッセージを読み直して、送った人の取引相手に決まった文面で送る
// - メッセージの中身はメールに載せない(プライバシーのため。続きはサイトで読んでもらう)
// - 利用者が入力した文字(商品名・ニックネーム)は HTML として扱わない(テキストメールのみ)
// - いつ送るか(相手がチャットを見ていないときだけ・相手が開くまでは1通だけ・
//   1人1日10通まで)は DB 側で決める
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

  let messageId: number;
  try {
    const body = await req.json();
    messageId = Number(body.message_id);
  } catch {
    return json(400, "bad request");
  }
  if (!Number.isInteger(messageId) || messageId <= 0) return json(400, "bad request");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 呼び出し内容を信用せず、メッセージを DB から読み直す
  const { data: message } = await admin
    .from("message")
    .select("id,item_id,buyer_id,seller_id,user_id")
    .eq("id", messageId)
    .single();
  // 公開Q&A(buyer_id が無いもの)は対象外
  if (!message || !message.buyer_id || !message.seller_id) return json(200, "skip");

  const recipientId = message.user_id === message.buyer_id ? message.seller_id : message.buyer_id;
  if (!recipientId || recipientId === message.user_id) return json(200, "skip");

  const { data: item } = await admin
    .from("item")
    .select("id,title")
    .eq("id", message.item_id)
    .single();
  if (!item) return json(200, "skip");

  const { data: recipient } = await admin.auth.admin.getUserById(recipientId);
  const email = recipient?.user?.email;
  // 退会済み(メールアドレスを書き換え済み)の人には送らない
  if (!email || email.endsWith("@deleted.invalid")) return json(200, "skip");

  // 送った人の名前は、なりすませない正式なニックネームを使う
  const { data: sender } = await admin
    .from("user_nickname")
    .select("nickname")
    .eq("user_id", message.user_id)
    .maybeSingle();

  const itemTitle = oneLine(item.title, 45);
  const senderName = oneLine(sender?.nickname || "取引相手", 30);
  const text = [
    `「${itemTitle}」の取引で、${senderName}さんからメッセージが届きました。`,
    "",
    "メッセージの内容は、チャットの画面で確かめて返信しましょう。",
    `${SITE_URL}/items/${item.id}/chat`,
    "",
    "※チャットを開くまでは、続けてメッセージが届いてもこのお知らせは1通だけです。",
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
      subject: `【HOKUMA】「${itemTitle}」の取引でメッセージが届きました`,
      text,
    }),
  });
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return json(502, "send failed");
  }
  return json(200, "sent");
});
