"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";
import StarRating from "@/components/StarRating";

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
  sold: boolean;
  buyer_id: string | null;
  received: boolean;
  condition: string | null;
  area: string | null;
  hashtags: string[] | null;
};

type Message = {
  id: number;
  buyer_id: string | null;
  nickname: string;
  content: string;
  user_id: string;
  created_at: string;
};

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
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [sellerRating, setSellerRating] = useState<{ avg: number; count: number } | null>(null);
  const [sellerDealCount, setSellerDealCount] = useState<number | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buyAgreed, setBuyAgreed] = useState(false);
  const [buying, setBuying] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
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
    if (!item) return;
    const fetchSellerRating = async () => {
      const { data } = await supabase.from("review").select("rating").eq("seller_id", item.user_id);
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setSellerRating({ avg, count: data.length });
      } else {
        setSellerRating(null);
      }
      const { count } = await supabase
        .from("item")
        .select("id", { count: "exact", head: true })
        .eq("user_id", item.user_id)
        .eq("sold", true);
      setSellerDealCount(count ?? 0);
    };
    fetchSellerRating();
  }, [item?.id, item?.user_id]);

  useEffect(() => {
    if (!user) { setAlreadyReviewed(false); return; }
    const checkReview = async () => {
      const { data } = await supabase
        .from("review")
        .select("id")
        .eq("item_id", params.id)
        .eq("reviewer_id", user.id)
        .maybeSingle();
      setAlreadyReviewed(!!data);
    };
    checkReview();
  }, [params.id, user]);

  useEffect(() => {
    const fetchLikes = async () => {
      const { data } = await supabase.from("favorite").select("user_id").eq("item_id", params.id);
      if (data) {
        setLikeCount(data.length);
        setLikedByMe(!!user && data.some((f) => f.user_id === user.id));
      }
    };
    fetchLikes();
  }, [params.id, user]);

  const toggleLike = async () => {
    if (!user) { alert("いいねするにはログインしてください"); router.push("/login"); return; }
    setTogglingLike(true);
    if (likedByMe) {
      const { error } = await supabase.from("favorite").delete().eq("item_id", params.id).eq("user_id", user.id);
      setTogglingLike(false);
      if (error) { alert(`いいねの取り消しに失敗しました: ${error.message}`); return; }
      setLikedByMe(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from("favorite").insert({ item_id: params.id, user_id: user.id });
      setTogglingLike(false);
      if (error) { alert(`いいねに失敗しました: ${error.message}`); return; }
      setLikedByMe(true);
      setLikeCount((c) => c + 1);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!user) { alert("メッセージを送るにはログインしてください"); router.push("/login"); return; }
    if (item?.sold) { alert("この商品は売却済みのため、質問チャットは終了しています"); return; }

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
    if (!user) { alert("通報にはログインしてください"); router.push("/login"); return; }
    if (!reportReason) { alert("通報理由を選択してください"); return; }
    if (reportReason === "その他" && !reportDetail.trim()) { alert("詳細を入力してください"); return; }
    setReporting(true);
    const { error } = await supabase.from("report").insert({
      item_id: item?.id,
      reason: reportDetail.trim() ? `${reportReason}：${reportDetail.trim()}` : reportReason,
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
    if (error) {
      console.error("review insert failed:", error);
      alert(`評価の投稿に失敗しました: ${error.message}`);
      return;
    }
    alert("評価を投稿しました！");
    setShowReviewForm(false);
    setAlreadyReviewed(true);
  };

  const handleBuy = async () => {
    if (!item || !buyAgreed || !user) return;
    setBuying(true);
    const { error } = await supabase.rpc("mark_item_sold", { p_item_id: item.id });
    setBuying(false);
    if (error) { alert("購入処理に失敗しました。もう一度お試しください。"); return; }
    setItem({ ...item, sold: true, buyer_id: user.id });
    router.push(`/items/${item.id}/chat`);
  };

  const isOwnItem = !!user && !!item && item.user_id === user.id;
  const canReview = !!user && !!item && item.received && item.buyer_id === user.id && !isOwnItem && !alreadyReviewed;
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
        <button onClick={() => router.back()} className="text-orange-700 font-bold mb-6 flex items-center gap-1 hover:text-orange-800 transition-colors">
          <span aria-hidden>←</span> 戻る
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-4">
          <div className="relative">
            {gallery.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowLightbox(true)}
                className="block w-full cursor-zoom-in"
                aria-label="画像を拡大表示"
              >
                <img src={gallery[activeImage]} alt={item.title} className={`w-full h-80 sm:h-96 object-cover ${item.sold ? "opacity-50" : ""}`} />
              </button>
            ) : (
              <div className={`bg-orange-50 h-48 flex items-center justify-center text-orange-200 text-4xl ${item.sold ? "opacity-50" : ""}`}>📦</div>
            )}
            {item.sold && (
              <div className="absolute top-4 -right-10 w-40 rotate-45 bg-red-600 text-white text-sm font-extrabold text-center py-1 shadow-md tracking-wider">
                SOLD OUT
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 p-2 overflow-x-auto">
              {gallery.map((url, i) => (
                <button
                  key={url + i}
                  onClick={() => setActiveImage(i)}
                  className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${activeImage === i ? "border-orange-600" : "border-transparent"}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-100">
            <button
              onClick={toggleLike}
              disabled={togglingLike || item.sold}
              className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 disabled:hover:bg-orange-50 rounded-full pl-2 pr-3.5 py-1.5 transition-colors"
            >
              <span className="text-lg">{likedByMe ? "❤️" : "🤍"}</span>
              <span className="text-sm font-bold text-orange-700">{likeCount}件のいいね</span>
            </button>
          </div>
        </div>

        {showLightbox && gallery.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowLightbox(false)}
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 text-white text-3xl leading-none"
              aria-label="閉じる"
            >
              ✕
            </button>
            <img
              src={gallery[activeImage]}
              alt={item.title}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm text-orange-700 font-bold">{item.category}</p>
            {item.condition && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{item.condition}</span>
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2 text-blue-700">{item.title}</h2>
          <p className="text-3xl text-orange-700 font-bold mb-1">
            {item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}
          </p>
          {item.category === "自転車" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              ⚠ 自転車の譲渡には防犯登録の名義変更が必要です。取引の際はお忘れなく。
            </p>
          )}
          <p className="text-stone-600 mb-2 whitespace-pre-wrap">{item.detail}</p>
          {item.area && <p className="text-sm text-stone-500">希望場所：{item.area}</p>}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-stone-500">
              出品者：
              <Link href={`/users/${item.user_id}`} className="text-orange-700 font-bold hover:underline transition-colors">
                {item.nickname}
              </Link>
            </span>
            {sellerRating && (
              <Link href={`/users/${item.user_id}`} className="flex items-center gap-1 text-xs text-orange-700 font-bold hover:underline transition-colors">
                <StarRating value={Math.round(sellerRating.avg)} size={13} />
                {sellerRating.avg.toFixed(1)}（{sellerRating.count}件）
              </Link>
            )}
            {sellerDealCount != null && sellerDealCount > 0 && (
              <span className="text-xs text-stone-400">取引実績 {sellerDealCount}件</span>
            )}
          </div>
          {item.hashtags && item.hashtags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {item.hashtags.map((tag) => (
                <span key={tag} className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">#{tag}</span>
              ))}
            </div>
          )}
          {(isOwnItem || item.buyer_id === user?.id) && item.sold && (
            <button
              onClick={() => router.push(`/items/${item.id}/chat`)}
              className="w-full mt-4 bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors"
            >
              取引ページを見る
            </button>
          )}
        </div>

        {canReview && !showReviewForm && (
          <button onClick={() => setShowReviewForm(true)} className="text-orange-700 text-xs font-bold mb-2 block hover:text-orange-800 transition-colors">
            ★ 出品者を評価する
          </button>
        )}
        {alreadyReviewed && (
          <p className="text-xs text-stone-400 mb-2">この出品者への評価は投稿済みです</p>
        )}
        {!isOwnItem && item.sold && item.buyer_id === user?.id && !item.received && !alreadyReviewed && (
          <p className="text-xs text-stone-400 mb-2">受け取り確認後に評価できます（個別チャットから「受け取れました」を押してください）</p>
        )}

        {showReviewForm && (
          <div className="border border-orange-200 rounded-2xl p-4 mb-4 bg-orange-50">
            <p className="font-bold text-sm mb-2">出品者の評価</p>
            <div className="mb-3">
              <StarRating value={reviewRating} onChange={setReviewRating} size={28} />
            </div>
            <textarea
              maxLength={500}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="コメント（任意）"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-3 outline-none h-20 resize-none bg-white focus:border-orange-600 transition-colors"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReviewForm(false)} className="flex-1 border border-stone-300 text-stone-600 py-2 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors">キャンセル</button>
              <button onClick={handleSubmitReview} disabled={submittingReview} className="flex-1 bg-orange-700 text-white py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors">
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
            <textarea
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
              placeholder={reportReason === "その他" ? "詳細を入力してください" : "詳細（任意）"}
              maxLength={500}
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-3 outline-none h-20 resize-none bg-white"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowReport(false)} className="flex-1 border border-stone-300 text-stone-600 py-2 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors">キャンセル</button>
              <button onClick={handleReport} disabled={reporting} className="flex-1 bg-red-500 text-white py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors">{reporting ? "送信中..." : "通報する"}</button>
            </div>
          </div>
        )}

        <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
          <div className="bg-orange-700 text-white px-4 py-3 font-bold flex items-center justify-between">
            <span>みんなの質問チャット</span>
            {item.sold && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">終了しました</span>}
          </div>
          <div className="p-4 h-64 overflow-y-auto flex flex-col gap-3 bg-stone-50">
            {messages.length === 0 && (
              <p className="text-center text-stone-400 text-sm">まだメッセージがありません</p>
            )}
            {messages.map((msg) => (
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
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex border-t border-stone-200">
            <input
              type="text"
              maxLength={500}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={item.sold ? "質問チャットは終了しました" : user ? "メッセージを入力..." : "ログインするとメッセージを送れます"}
              className="flex-1 px-4 py-3 outline-none text-sm disabled:bg-stone-100"
              disabled={!user || item.sold}
            />
            <button onClick={sendMessage} disabled={!user || item.sold} className="bg-orange-700 text-white px-6 font-bold text-sm disabled:opacity-50 hover:bg-orange-800 transition-colors">
              送信
            </button>
          </div>
        </div>

        {!isOwnItem && (
          item.sold ? (
            <button disabled className="w-full bg-stone-200 text-stone-400 py-3 rounded-full font-bold cursor-not-allowed">
              売り切れました
            </button>
          ) : user ? (
            showBuyConfirm ? (
              <div className="border border-orange-200 rounded-2xl p-4 bg-orange-50">
                <p className="font-bold text-sm mb-3">購入前の確認</p>
                <ul className="text-sm text-stone-600 flex flex-col gap-1.5 mb-3 list-disc pl-5">
                  <li>商品説明・価格・状態を確認しました</li>
                  <li>受け渡し場所・日時はこのあとの個別チャットで相談します</li>
                  <li>自己都合によるドタキャン（無断キャンセル・連絡なしの不参加）はしません</li>
                </ul>
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input
                    type="checkbox"
                    checked={buyAgreed}
                    onChange={(e) => setBuyAgreed(e.target.checked)}
                    className="accent-orange-700 w-4 h-4"
                  />
                  上記に同意して購入する
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowBuyConfirm(false); setBuyAgreed(false); }}
                    className="flex-1 border border-stone-300 text-stone-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBuy}
                    disabled={!buyAgreed || buying}
                    className="flex-1 bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors"
                  >
                    {buying ? "処理中..." : "購入を確定する"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowBuyConfirm(true)}
                className="w-full bg-orange-700 text-white py-3 rounded-full font-bold hover:bg-orange-800 transition-colors shadow-sm"
              >
                購入する
              </button>
            )
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="w-full border border-orange-700 text-orange-700 py-3 rounded-full font-bold hover:bg-orange-100 transition-colors"
            >
              ログインして購入する
            </button>
          )
        )}
      </main>
    </div>
  );
}
