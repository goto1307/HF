"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

type Item = {
  id: number;
  title: string;
  price: number;
  category: string;
  detail: string;
  nickname: string;
  image_url: string | null;
  image_urls: string[] | null;
  user_id: string;
};

type Message = {
  id: number;
  buyer_id: string | null;
  nickname: string;
  content: string;
  user_id: string;
  created_at: string;
};

const RATING_LABELS: Record<string, string> = { good: "良い", normal: "普通", bad: "悪い" };

export default function ItemDetail() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reporting, setReporting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState("good");
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [hasChatted, setHasChatted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: itemData } = await supabase.from("item").select("*").eq("id", params.id).single();
      if (itemData) setItem(itemData);

      const { data: msgData } = await supabase
        .from("message")
        .select("*")
        .eq("item_id", params.id)
        .is("buyer_id", null)
        .order("created_at");
      if (msgData) setMessages(msgData);
    };
    fetchData();

    const channel = supabase
      .channel(`item-public-chat-${params.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "message",
        filter: `item_id=eq.${params.id}`,
      }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.buyer_id) return;
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  useEffect(() => {
    if (!user) { setAlreadyReviewed(false); setHasChatted(false); return; }
    const checkReview = async () => {
      const { data } = await supabase
        .from("review")
        .select("id")
        .eq("item_id", params.id)
        .eq("reviewer_id", user.id)
        .maybeSingle();
      setAlreadyReviewed(!!data);
    };
    const checkChatted = async () => {
      const { data } = await supabase
        .from("message")
        .select("id")
        .eq("item_id", params.id)
        .eq("buyer_id", user.id)
        .limit(1)
        .maybeSingle();
      setHasChatted(!!data);
    };
    checkReview();
    checkChatted();
  }, [params.id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!user) { alert("メッセージを送るにはログインしてください"); router.push("/login"); return; }

    const content = input;
    setInput("");

    const { data, error } = await supabase
      .from("message")
      .insert({
        item_id: params.id,
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
    }
  };

  const handleReport = async () => {
    if (!reportReason) { alert("通報理由を選択してください"); return; }
    if (reportReason === "その他" && !reportDetail.trim()) { alert("詳細を入力してください"); return; }
    setReporting(true);
    const { error } = await supabase.from("report").insert({
      item_id: item?.id,
      reason: reportReason === "その他" ? `その他：${reportDetail}` : reportReason,
    });
    setReporting(false);
    if (error) { alert("通報に失敗しました"); return; }
    alert("通報しました。ご協力ありがとうございます。");
    setShowReport(false);
    setReportReason("");
    setReportDetail("");
  };

  const handleSubmitReview = async () => {
    if (!user || !item) return;
    setSubmittingReview(true);
    const { error } = await supabase.from("review").insert({
      item_id: item.id,
      seller_id: item.user_id,
      reviewer_id: user.id,
      reviewer_nickname: user.user_metadata?.nickname || "匿名ユーザー",
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });
    setSubmittingReview(false);
    if (error) { alert("評価の投稿に失敗しました"); return; }
    alert("評価を投稿しました！");
    setShowReviewForm(false);
    setAlreadyReviewed(true);
  };

  const isOwnItem = !!user && !!item && item.user_id === user.id;
  const canReview = !!user && !!item && hasChatted && !isOwnItem && !alreadyReviewed;
  const gallery = item?.image_urls?.length ? item.image_urls : item?.image_url ? [item.image_url] : [];

  if (!item) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-emerald-700 font-bold mb-6 flex items-center gap-1 hover:text-emerald-800 transition-colors">
          <span aria-hidden>←</span> 戻る
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-4">
          {gallery.length > 0 ? (
            <img src={gallery[activeImage]} alt={item.title} className="w-full h-64 object-cover" />
          ) : (
            <div className="bg-emerald-50 h-48 flex items-center justify-center text-emerald-200 text-4xl">📦</div>
          )}
          {gallery.length > 1 && (
            <div className="flex gap-2 p-2 overflow-x-auto">
              {gallery.map((url, i) => (
                <button
                  key={url + i}
                  onClick={() => setActiveImage(i)}
                  className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${activeImage === i ? "border-emerald-600" : "border-transparent"}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-4">
          <p className="text-sm text-emerald-700 font-bold mb-1">{item.category}</p>
          <h2 className="text-2xl font-bold mb-2">{item.title}</h2>
          <p className="text-3xl text-emerald-700 font-bold mb-3">
            {item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}
          </p>
          <p className="text-stone-600 mb-2 whitespace-pre-wrap">{item.detail}</p>
          <p className="text-sm text-stone-500">出品者：{item.nickname}</p>
        </div>

        {canReview && !showReviewForm && (
          <button onClick={() => setShowReviewForm(true)} className="text-emerald-700 text-xs font-bold mb-2 block hover:text-emerald-800 transition-colors">
            ★ 出品者を評価する
          </button>
        )}
        {alreadyReviewed && (
          <p className="text-xs text-stone-400 mb-2">この出品者への評価は投稿済みです</p>
        )}

        {showReviewForm && (
          <div className="border border-emerald-200 rounded-2xl p-4 mb-4 bg-emerald-50">
            <p className="font-bold text-sm mb-2">出品者の評価</p>
            <div className="flex gap-3 mb-3">
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="reviewRating"
                    value={value}
                    checked={reviewRating === value}
                    onChange={() => setReviewRating(value)}
                    className="accent-emerald-700"
                  />
                  {label}
                </label>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="コメント（任意）"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-3 outline-none h-20 resize-none bg-white focus:border-emerald-600 transition-colors"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReviewForm(false)} className="flex-1 border border-stone-300 text-stone-600 py-2 rounded-full text-sm font-bold bg-white hover:bg-stone-50 transition-colors">キャンセル</button>
              <button onClick={handleSubmitReview} disabled={submittingReview} className="flex-1 bg-emerald-700 text-white py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-emerald-800 transition-colors">
                {submittingReview ? "送信中..." : "評価を送信"}
              </button>
            </div>
          </div>
        )}

        <button onClick={() => setShowReport(!showReport)} className="text-red-400 text-xs mb-4 block hover:text-red-500 transition-colors">
          ⚠ この商品を通報する
        </button>

        {showReport && (
          <div className="border border-red-200 rounded-2xl p-4 mb-6 bg-red-50">
            <p className="font-bold text-sm mb-2 text-red-600">通報理由</p>
            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-3 outline-none bg-white">
              <option value="">選択してください</option>
              <option value="禁止商品">禁止商品</option>
              <option value="詐欺・偽物">詐欺・偽物</option>
              <option value="不適切な内容">不適切な内容</option>
              <option value="その他">その他</option>
            </select>
            {reportReason === "その他" && (
              <textarea value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} placeholder="詳細を入力してください" className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-3 outline-none h-20 resize-none bg-white" />
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowReport(false)} className="flex-1 border border-stone-300 text-stone-600 py-2 rounded-full text-sm font-bold bg-white hover:bg-stone-50 transition-colors">キャンセル</button>
              <button onClick={handleReport} disabled={reporting} className="flex-1 bg-red-500 text-white py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors">{reporting ? "送信中..." : "通報する"}</button>
            </div>
          </div>
        )}

        <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
          <div className="bg-emerald-700 text-white px-4 py-3 font-bold">みんなの質問チャット</div>
          <div className="p-4 h-64 overflow-y-auto flex flex-col gap-3 bg-stone-50">
            {messages.length === 0 && (
              <p className="text-center text-stone-400 text-sm">まだメッセージがありません</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.user_id === user?.id ? "flex-row-reverse" : "flex-row"}`}>
                <div className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {msg.nickname?.[0] || "?"}
                </div>
                <div className={`max-w-xs ${msg.user_id === user?.id ? "items-end" : "items-start"} flex flex-col`}>
                  <p className="text-xs text-stone-500 mb-1 flex items-center gap-1">
                    {msg.nickname}
                    {msg.user_id === item.user_id && (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">出品者</span>
                    )}
                  </p>
                  <div className={`px-4 py-2 rounded-2xl text-sm ${msg.user_id === user?.id ? "bg-emerald-700 text-white" : "bg-white border border-stone-200 text-stone-700"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex border-t border-stone-200">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={user ? "メッセージを入力..." : "ログインするとメッセージを送れます"}
              className="flex-1 px-4 py-3 outline-none text-sm"
              disabled={!user}
            />
            <button onClick={sendMessage} disabled={!user} className="bg-emerald-700 text-white px-6 font-bold text-sm disabled:opacity-50 hover:bg-emerald-800 transition-colors">
              送信
            </button>
          </div>
        </div>

        {!isOwnItem && (
          user ? (
            <button
              onClick={() => router.push(`/items/${item.id}/chat`)}
              className="w-full bg-emerald-700 text-white py-3 rounded-full font-bold hover:bg-emerald-800 transition-colors shadow-sm"
            >
              購入する
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="w-full border border-emerald-700 text-emerald-700 py-3 rounded-full font-bold hover:bg-emerald-50 transition-colors"
            >
              ログインして購入する
            </button>
          )
        )}
      </main>
    </div>
  );
}
