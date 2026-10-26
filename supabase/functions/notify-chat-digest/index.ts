// 見ていない間に届いたチャットのメッセージを、1時間おきにまとめてメールで知らせる Edge Function。
//
// 呼び出し元は DB の send_chat_digests()(migration PART AO、pg_cron で毎時0分)だけ。
// - 合言葉(x-hook-secret)が一致しない呼び出しは拒否する(購入メールと同じ合言葉)
// - 受け取るのは送り先の recipient_id と message_ids だけ。メッセージは DB から読み直し、
//   送り先が本当にそのメッセージの取引相手であるものだけを載せる
// - メッセージの中身はメールに載せない(プライバシーのため。続きはサイトで読んでもらう)
// - 利用者が入力した文字(商品名・ニックネーム)は HTML として扱わない(テキストメールのみ)
//
// 必要な Secrets は notify-sold と同じ(RESEND_API_KEY / HOOK_SECRET / 任意で MAIL_FROM)。
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で渡す。
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = "https://www.hokuma-market.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// 件名や本文に入れる前に、改行を消して長さをそろえる
const oneLine = (value: unknown, max: number) =>
  String(value ?? "").replace(/[\r\n]+/g, " ").slice(0, max);

type Message = { id: number; item_id: number; buyer_id: string | null; seller_id: string | null; user_id: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, "method not allowed");

  const secret = Deno.env.get("HOOK_SECRET");
  if (!secret || req.headers.get("x-hook-secret") !== secret) {
    return json(401, "unauthorized");
  }

  let recipientId: string;
  let messageIds: number[];
  try {
    const body = await req.json();
    recipientId = String(body.recipient_id ?? "");
    messageIds = Array.isArray(body.message_ids) ? body.message_ids.map(Number) : [];
  } catch {
    return json(400, "bad request");
  }
  if (!UUID.test(recipientId)) return json(400, "bad request");
  messageIds = messageIds.filter((id) => Number.isInteger(id) && id > 0).slice(0, 50);
  if (messageIds.length === 0) return json(200, "skip");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 呼び出し内容を信用せず、メッセージを DB から読み直して、送り先が取引相手のものだけ残す
  const { data: rows } = await admin
    .from("message")
    .select("id,item_id,buyer_id,seller_id,user_id")
    .in("id", messageIds);
  const messages = ((rows ?? []) as Message[]).filter((m) => {
    if (!m.buyer_id || !m.seller_id) return false;
    const to = m.user_id === m.buyer_id ? m.seller_id : m.buyer_id;
    return to === recipientId && m.user_id !== recipientId;
  });
  if (messages.length === 0) return json(200, "skip");

  const { data: recipient } = await admin.auth.admin.getUserById(recipientId);
  const email = recipient?.user?.email;
  // 退会済み(メールアドレスを書き換え済み)の人には送らない
  if (!email || email.endsWith("@deleted.invalid")) return json(200, "skip");

  // 取引(商品と購入者の組)ごとにまとめる
  const threads = new Map<string, { itemId: number; senderId: string; count: number }>();
  for (const m of messages) {
    const key = `${m.item_id}:${m.buyer_id}`;
    const thread = threads.get(key) ?? { itemId: m.item_id, senderId: m.user_id, count: 0 };
    thread.count++;
    threads.set(key, thread);
  }

  const itemIds = [...new Set([...threads.values()].map((t) => t.itemId))];
  const senderIds = [...new Set([...threads.values()].map((t) => t.senderId))];
  const { data: items } = await admin.from("item").select("id,title").in("id", itemIds);
  // 送った人の名前は、なりすませない正式なニックネームを使う
  const { data: names } = await admin.from("user_nickname").select("user_id,nickname").in("user_id", senderIds);
  const titleById = new Map((items ?? []).map((i: { id: number; title: string }) => [i.id, i.title]));
  const nameById = new Map((names ?? []).map((n: { user_id: string; nickname: string }) => [n.user_id, n.nickname]));

  const lines: string[] = [];
  for (const t of threads.values()) {
    if (!titleById.has(t.itemId)) continue; // 商品が削除されていれば載せない
    const title = oneLine(titleById.get(t.itemId), 45);
    const sender = oneLine(nameById.get(t.senderId) || "取引相手", 30);
    lines.push(`・「${title}」 ${sender}さんから ${t.count}件`);
    lines.push(`  ${SITE_URL}/items/${t.itemId}/chat`);
  }
  if (lines.length === 0) return json(200, "skip");
  const total = messages.length;

  const text = [
    "見ていない間に、取引のメッセージが届いています。",
    "",
    ...lines,
    "",
    "メッセージの内容は、チャットの画面で確かめて返信しましょう。",
    "",
    "※このお知らせは、見ていない間にメッセージが届いたときに、1時間ごとにまとめて送っています。",
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
      subject: `【HOKUMA】未読のメッセージが${total}件あります`,
      text,
    }),
  });
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return json(502, "send failed");
  }
  return json(200, "sent");
});
