// 商品ページの「みんなの質問チャット」の書き込みを、3時間おきにまとめてメールで知らせる Edge Function。
//
// 呼び出し元は DB の send_qa_digests()(migration PART AU、pg_cron で3時間ごと)だけ。
// - 合言葉(x-hook-secret)が一致しない呼び出しは拒否する(購入メールと同じ合言葉)
// - 受け取るのは送り先の recipient_id と message_ids だけ。メッセージは DB から読み直し、次のものだけを載せる
//     ・送り先が出品者: 出品者以外の誰かの書き込み
//     ・送り先が質問した人: 出品者の書き込みで、送り先がそれより前に同じ質問チャットへ書き込んでいたもの
// - メッセージの中身や書き込んだ人の名前はメールに載せない(プライバシーのため。続きはサイトで読んでもらう)
// - 利用者が入力した文字(商品名)は HTML として扱わない(テキストメールのみ)
//
// 必要な Secrets は notify-sold・notify-chat-digest と同じ(RESEND_API_KEY / HOOK_SECRET / 任意で MAIL_FROM)。
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

type Message = { id: number; item_id: number; buyer_id: string | null; user_id: string; created_at: string };

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

  // 呼び出し内容を信用せず、メッセージを DB から読み直す(質問チャットの書き込みで、本人以外のものだけ)
  const { data: rows } = await admin
    .from("message")
    .select("id,item_id,buyer_id,user_id,created_at")
    .in("id", messageIds);
  const candidates = ((rows ?? []) as Message[]).filter((m) => m.buyer_id === null && m.user_id !== recipientId);
  if (candidates.length === 0) return json(200, "skip");

  const itemIds = [...new Set(candidates.map((m) => m.item_id))];
  const { data: items } = await admin.from("item").select("id,title,user_id").in("id", itemIds);
  const itemById = new Map(
    (items ?? []).map((i: { id: number; title: string; user_id: string }) => [i.id, i]),
  );

  // 送り先が書き込んだ、それぞれの商品の質問チャットでいちばん古い時刻
  const { data: mine } = await admin
    .from("message")
    .select("item_id,created_at")
    .in("item_id", itemIds)
    .is("buyer_id", null)
    .eq("user_id", recipientId)
    .order("created_at", { ascending: true });
  const firstPostAt = new Map<number, string>();
  for (const m of (mine ?? []) as { item_id: number; created_at: string }[]) {
    if (!firstPostAt.has(m.item_id)) firstPostAt.set(m.item_id, m.created_at);
  }

  // 出品者へは「出品者以外の書き込み」、質問した人へは「出品者の書き込み」だけ残す
  const messages = candidates.filter((m) => {
    const item = itemById.get(m.item_id);
    if (!item) return false; // 商品が削除されていれば載せない
    if (item.user_id === recipientId) return m.user_id !== recipientId;
    if (m.user_id !== item.user_id) return false;
    const first = firstPostAt.get(m.item_id);
    return !!first && new Date(first).getTime() < new Date(m.created_at).getTime();
  });
  if (messages.length === 0) return json(200, "skip");

  const { data: recipient } = await admin.auth.admin.getUserById(recipientId);
  const email = recipient?.user?.email;
  // 退会済み(メールアドレスを書き換え済み)の人には送らない
  if (!email || email.endsWith("@deleted.invalid")) return json(200, "skip");

  // 商品ごとにまとめる
  const countByItem = new Map<number, number>();
  for (const m of messages) countByItem.set(m.item_id, (countByItem.get(m.item_id) ?? 0) + 1);

  const lines: string[] = [];
  for (const [itemId, count] of countByItem) {
    const item = itemById.get(itemId)!;
    const title = oneLine(item.title, 45);
    const what = item.user_id === recipientId
      ? `（あなたの出品）新しい書き込み ${count}件`
      : `出品者からの書き込み ${count}件`;
    lines.push(`・「${title}」 ${what}`);
    lines.push(`  ${SITE_URL}/items/${itemId}`);
  }
  const total = messages.length;

  const text = [
    "見ていない間に、質問チャットに新しい書き込みがありました。",
    "",
    ...lines,
    "",
    "書き込みの内容は、商品ページの「みんなの質問チャット」で確かめましょう。",
    "",
    "※このお知らせは、あなたの出品に書き込みがあったとき、または書き込んだことのある商品で出品者が書き込んだときに、3時間ごとにまとめて送っています（1日3通まで）。",
    "※このメールは、HOKUMAに登録したメールアドレスに送っています。送信専用のため、返信はできません。",
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
      subject: `【HOKUMA】質問チャットに新しい書き込みが${total}件あります`,
      text,
    }),
  });
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return json(502, "send failed");
  }
  return json(200, "sent");
});
