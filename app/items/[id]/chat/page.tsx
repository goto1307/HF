"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

type Item = {
  id: number;
  title: string;
  nickname: string;
  user_id: string;
  sold: boolean;
  buyer_id: string | null;
  received: boolean;
};

type Message = {
  id: number;
  item_id: number;
  buyer_id: string;
  seller_id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
};

type Conversation = {
  buyer_id: string;
  buyer_nickname: string;
  last_message: string;
  last_created_at: string;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function quickTimeValue(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const COMMON_LOCATIONS = ["北部食堂前", "正門前", "生協前", "図書館前"];
const QUICK_TIMES = [
  { label: "今日18時", value: () => quickTimeValue(0, 18) },
  { label: "明日12時", value: () => quickTimeValue(1, 12) },
  { label: "明日18時", value: () => quickTimeValue(1, 18) },
];

export default function ItemChat() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [meetupAt, setMeetupAt] = useState("");
  const [meetupUpdatedAt, setMeetupUpdatedAt] = useState<string | null>(null);
  const [meetupBuyerAgreed, setMeetupBuyerAgreed] = useState(false);
  const [savingMeetup, setSavingMeetup] = useState(false);
  const [agreeingMeetup, setAgreeingMeetup] = useState(false);
  const [showMeetupForm, setShowMeetupForm] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    const fetchItem = async () => {
      const { data } = await supabase.from("item").select("id,title,nickname,user_id,sold,buyer_id,received").eq("id", params.id).single();
      if (data) setItem(data);
    };
    fetchItem();
  }, [authLoading, user, params.id, router]);

  const handleReceived = async () => {
    if (!item || !user) return;
    setReceiving(true);
    const { error } = await supabase.rpc("mark_item_received", { p_item_id: item.id });
    setReceiving(false);
    if (error) { alert("受け取り確認に失敗しました"); return; }
    setItem({ ...item, received: true });
    alert("受け取り完了を記録しました！商品ページから出品者を評価できます。");
  };

  const isSeller = !!item && !!user && item.user_id === user.id;
  const buyerId = isSeller ? selectedBuyerId : user?.id ?? null;

  useEffect(() => {
    if (isSeller && item?.sold && item.buyer_id && !selectedBuyerId) {
      setSelectedBuyerId(item.buyer_id);
    }
  }, [isSeller, item, selectedBuyerId]);

  useEffect(() => {
    if (!item || !isSeller) return;

    const loadConversations = async () => {
      setConversationsLoading(true);
      const { data } = await supabase
        .from("message")
        .select("buyer_id, user_id, nickname, content, created_at")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false });

      if (data) {
        const lastByBuyer = new Map<string, (typeof data)[number]>();
        const nicknameByBuyer = new Map<string, string>();
        for (const m of data) {
          if (!m.buyer_id) continue;
          if (!lastByBuyer.has(m.buyer_id)) lastByBuyer.set(m.buyer_id, m);
          if (m.user_id === m.buyer_id && !nicknameByBuyer.has(m.buyer_id)) {
            nicknameByBuyer.set(m.buyer_id, m.nickname);
          }
        }
        setConversations(
          Array.from(lastByBuyer.entries()).map(([id, m]) => ({
            buyer_id: id,
            buyer_nickname: nicknameByBuyer.get(id) || "取引相手",
            last_message: m.content,
            last_created_at: m.created_at,
          }))
        );
      }
      setConversationsLoading(false);
    };
    loadConversations();
  }, [item, isSeller]);

  useEffect(() => {
    if (!item || !buyerId) { setMessages([]); return; }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("message")
        .select("*")
        .eq("item_id", item.id)
        .eq("buyer_id", buyerId)
        .order("created_at");
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`item-chat-${item.id}-${buyerId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "message",
        filter: `item_id=eq.${item.id}`,
      }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.buyer_id !== buyerId) return;
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [item, buyerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setShowMeetupForm(false);
    if (!item || !buyerId) {
      setMeetupLocation("");
      setMeetupAt("");
      setMeetupUpdatedAt(null);
      setMeetupBuyerAgreed(false);
      return;
    }

    const fetchMeetup = async () => {
      const { data } = await supabase
        .from("meetup")
        .select("*")
        .eq("item_id", item.id)
        .eq("buyer_id", buyerId)
        .maybeSingle();
      if (data) {
        setMeetupLocation(data.location || "");
        setMeetupAt(data.meet_at ? toLocalInputValue(data.meet_at) : "");
        setMeetupUpdatedAt(data.updated_at);
        setMeetupBuyerAgreed(!!data.buyer_agreed);
      } else {
        setMeetupLocation("");
        setMeetupAt("");
        setMeetupUpdatedAt(null);
        setMeetupBuyerAgreed(false);
      }
    };
    fetchMeetup();

    const channel = supabase
      .channel(`item-meetup-${item.id}-${buyerId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "meetup",
        filter: `item_id=eq.${item.id}`,
      }, (payload) => {
        const row = payload.new as { buyer_id: string; location: string | null; meet_at: string | null; updated_at: string; buyer_agreed: boolean } | null;
        if (!row || row.buyer_id !== buyerId) return;
        setMeetupLocation(row.location || "");
        setMeetupAt(row.meet_at ? toLocalInputValue(row.meet_at) : "");
        setMeetupUpdatedAt(row.updated_at);
        setMeetupBuyerAgreed(!!row.buyer_agreed);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [item, buyerId]);

  const handleSaveMeetup = async () => {
    if (!item || !buyerId) return;
    setSavingMeetup(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("meetup").upsert(
      {
        item_id: item.id,
        buyer_id: buyerId,
        location: meetupLocation.trim() || null,
        meet_at: meetupAt ? new Date(meetupAt).toISOString() : null,
        updated_at: nowIso,
        buyer_agreed: false,
      },
      { onConflict: "item_id,buyer_id" }
    );
    setSavingMeetup(false);
    if (error) { alert("待ち合わせ情報の保存に失敗しました"); return; }
    setMeetupUpdatedAt(nowIso);
    setMeetupBuyerAgreed(false);
  };

  const handleAgreeMeetup = async () => {
    if (!item || !buyerId) return;
    setAgreeingMeetup(true);
    const { error } = await supabase
      .from("meetup")
      .update({ buyer_agreed: true })
      .eq("item_id", item.id)
      .eq("buyer_id", buyerId);
    setAgreeingMeetup(false);
    if (error) { alert("同意の送信に失敗しました"); return; }
    setMeetupBuyerAgreed(true);
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !item || !buyerId) return;

    const content = input;
    setInput("");

    const { data, error } = await supabase
      .from("message")
      .insert({
        item_id: item.id,
        buyer_id: buyerId,
        seller_id: item.user_id,
        user_id: user.id,
        nickname: user.user_metadata?.nickname || "匿名ユーザー",
        content,
      })
      .select()
      .single();

    if (error) {
      alert("メッセージの送信に失敗しました");
      setInput(content);
      return;
    }
    if (data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
      if (isSeller) {
        setConversations((prev) => {
          const others = prev.filter((c) => c.buyer_id !== buyerId);
          const current = prev.find((c) => c.buyer_id === buyerId);
          return [
            { buyer_id: buyerId, buyer_nickname: current?.buyer_nickname || "取引相手", last_message: content, last_created_at: data.created_at },
            ...others,
          ];
        });
      }
    }
  };

  if (authLoading || !item) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  const hasMeetup = !!meetupLocation || !!meetupAt;

  const meetupPanel = buyerId && (
    <div className="mb-4">
      {isSeller ? (
        !showMeetupForm ? (
          <button
            onClick={() => setShowMeetupForm(true)}
            className="w-full flex items-center justify-between border border-orange-200 rounded-2xl px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
          >
            <span className="text-sm font-bold text-orange-800">
              {hasMeetup
                ? `📍 ${meetupLocation || "場所未定"}・${meetupAt ? new Date(meetupAt).toLocaleString() : "日時未定"}`
                : "📍 待ち合わせを決める"}
            </span>
            <span className="text-xs text-orange-700 font-bold shrink-0 ml-2">
              {hasMeetup ? (meetupBuyerAgreed ? "相手が同意済み" : "相手の確認待ち") : "決める"}
            </span>
          </button>
        ) : (
          <div className="border border-orange-200 rounded-2xl p-4 bg-orange-50">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-sm">📍 待ち合わせ（あなたが設定します）</p>
              <button onClick={() => setShowMeetupForm(false)} className="text-xs text-stone-500 hover:text-stone-700 transition-colors">
                閉じる
              </button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              ⚠ 待ち合わせは、人通りが多く明るい場所がおすすめです。
            </p>

            <p className="text-xs text-stone-500 mb-1.5">場所（ボタンを押すか、直接入力）</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {COMMON_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setMeetupLocation(loc)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    meetupLocation === loc ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-700 border-orange-200 hover:border-orange-400"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={meetupLocation}
              onChange={(e) => setMeetupLocation(e.target.value)}
              placeholder="場所を入力（例：北部食堂前）"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none bg-white focus:border-orange-600 transition-colors mb-3"
            />

            <p className="text-xs text-stone-500 mb-1.5">日時（ボタンを押すか、直接指定）</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {QUICK_TIMES.map((qt) => (
                <button
                  key={qt.label}
                  onClick={() => setMeetupAt(qt.value())}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white text-orange-700 border-orange-200 hover:border-orange-400 transition-colors"
                >
                  {qt.label}
                </button>
              ))}
            </div>
            <div className="mb-3">
              <input
                type="datetime-local"
                value={meetupAt}
                onChange={(e) => setMeetupAt(e.target.value)}
                className="border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none bg-white focus:border-orange-600 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-stone-400">
                {meetupUpdatedAt ? `最終更新：${new Date(meetupUpdatedAt).toLocaleString()}` : "まだ決まっていません"}
              </p>
              <button
                onClick={handleSaveMeetup}
                disabled={savingMeetup}
                className="bg-orange-700 text-white px-5 py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shrink-0"
              >
                {savingMeetup ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="border border-orange-200 rounded-2xl p-4 bg-orange-50">
          <p className="font-bold text-sm mb-2">📍 待ち合わせ</p>
          {!hasMeetup ? (
            <p className="text-sm text-stone-500">出品者からの提案をお待ちください</p>
          ) : (
            <>
              <p className="text-sm text-stone-700 mb-1">場所：{meetupLocation || "未定"}</p>
              <p className="text-sm text-stone-700 mb-3">日時：{meetupAt ? new Date(meetupAt).toLocaleString() : "未定"}</p>
              {meetupBuyerAgreed ? (
                <p className="text-sm font-bold text-orange-700">✓ 同意済みです</p>
              ) : (
                <button
                  onClick={handleAgreeMeetup}
                  disabled={agreeingMeetup}
                  className="w-full bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors"
                >
                  {agreeingMeetup ? "送信中..." : "この内容に同意する"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  const chatPanel = (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col h-[28rem]">
      <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3 bg-stone-50">
        {!buyerId ? (
          <p className="text-center text-stone-400 text-sm m-auto">左の一覧から会話を選んでください</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-stone-400 text-sm m-auto">まだメッセージがありません。最初のメッセージを送りましょう。</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.user_id === user?.id ? "flex-row-reverse" : "flex-row"}`}>
              <div className="w-8 h-8 bg-orange-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {msg.nickname?.[0] || "?"}
              </div>
              <div className={`max-w-xs ${msg.user_id === user?.id ? "items-end" : "items-start"} flex flex-col`}>
                <p className="text-xs text-stone-500 mb-1 flex items-center gap-1">
                  {msg.nickname}
                  {msg.user_id === item.user_id && (
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">出品者</span>
                  )}
                </p>
                <div className={`px-4 py-2 rounded-2xl text-sm ${msg.user_id === user?.id ? "bg-orange-700 text-white" : "bg-white border border-stone-200 text-stone-700"}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex border-t border-stone-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={buyerId ? "メッセージを入力..." : "会話を選んでください"}
          className="flex-1 px-4 py-3 outline-none text-sm"
          disabled={!buyerId}
        />
        <button onClick={sendMessage} disabled={!buyerId} className="bg-orange-700 text-white px-6 font-bold text-sm disabled:opacity-50 hover:bg-orange-800 transition-colors">
          送信
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => router.push(`/items/${item.id}`)} className="text-orange-700 font-bold mb-6 flex items-center gap-1 hover:text-orange-800 transition-colors">
          <span aria-hidden>←</span> 商品ページへ戻る
        </button>
        <h2 className="text-xl font-bold mb-1">{item.title}</h2>
        <p className="text-sm text-stone-500 mb-6">{isSeller ? "問い合わせ一覧" : `出品者：${item.nickname}`}</p>

        {isSeller ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 border border-stone-200 rounded-2xl bg-white shadow-sm overflow-hidden h-fit">
              {conversationsLoading ? (
                <p className="p-4 text-sm text-stone-400 text-center">読み込み中...</p>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-stone-400 text-center">まだ問い合わせがありません</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.buyer_id}
                    onClick={() => setSelectedBuyerId(c.buyer_id)}
                    className={`w-full text-left px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 transition-colors ${selectedBuyerId === c.buyer_id ? "bg-orange-50" : ""}`}
                  >
                    <p className="font-bold text-sm truncate">{c.buyer_nickname}</p>
                    <p className="text-xs text-stone-400 truncate">{c.last_message}</p>
                  </button>
                ))
              )}
            </div>
            <div className="sm:col-span-2">
              {meetupPanel}
              {chatPanel}
            </div>
          </div>
        ) : (
          <>
            {meetupPanel}
            {chatPanel}
            {item.sold && item.buyer_id === user?.id && (
              <div className="mt-4">
                {item.received ? (
                  <p className="text-center text-sm font-bold text-orange-700 py-2">✓ 受け取り済みです</p>
                ) : (
                  <button
                    onClick={handleReceived}
                    disabled={receiving}
                    className="w-full bg-orange-700 text-white py-3 rounded-full font-bold hover:bg-orange-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {receiving ? "処理中..." : "受け取れました"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
