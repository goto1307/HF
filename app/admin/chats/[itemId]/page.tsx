"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";

type Message = {
  id: number;
  buyer_id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
};

type Item = {
  id: number;
  title: string;
  user_id: string;
  nickname: string;
  sold: boolean;
  buyer_id: string | null;
};

export default function AdminItemChats() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<Message | null>(null);
  const [messageReason, setMessageReason] = useState("");
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const isAdmin = isAdminEmail(user?.email);

  const fetchData = async () => {
    const { data: itemData } = await supabase
      .from("item")
      .select("id,title,user_id,nickname,sold,buyer_id")
      .eq("id", params.itemId)
      .single();
    if (itemData) setItem(itemData);

    const { data: messageData } = await supabase
      .from("message")
      .select("id, buyer_id, user_id, nickname, content, created_at")
      .eq("item_id", params.itemId)
      .order("buyer_id", { ascending: true })
      .order("created_at", { ascending: true });
    if (messageData) setMessages(messageData);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin, router, params.itemId]);

  const handleConfirmDeleteMessage = async () => {
    if (!deleteMessageTarget) return;
    if (!messageReason.trim()) { alert("削除理由を入力してください"); return; }
    setDeletingMessage(true);
    const { error } = await supabase.rpc("admin_delete_message", {
      p_message_id: deleteMessageTarget.id,
      p_reason: messageReason.trim(),
    });
    setDeletingMessage(false);
    if (error) { alert(`削除に失敗しました: ${error.message}`); return; }
    setMessages((prev) => prev.filter((m) => m.id !== deleteMessageTarget.id));
    setDeleteMessageTarget(null);
    setMessageReason("");
  };

  const handleConfirmCancel = async () => {
    if (!item) return;
    if (!cancelReason.trim()) { alert("理由を入力してください"); return; }
    setCancelling(true);
    const { error } = await supabase.rpc("admin_cancel_purchase", {
      p_item_id: item.id,
      p_reason: cancelReason.trim(),
    });
    setCancelling(false);
    if (error) { alert(`キャンセルに失敗しました: ${error.message}`); return; }
    alert("取引をキャンセルしました");
    setShowCancelForm(false);
    setCancelReason("");
    fetchData();
  };

  if (authLoading || (loading && isAdmin)) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">このページを見る権限がありません</div>
      </div>
    );
  }

  const threads = new Map<string, Message[]>();
  for (const m of messages) {
    const list = threads.get(m.buyer_id) ?? [];
    list.push(m);
    threads.set(m.buyer_id, list);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/admin/items" className="text-sm font-bold text-stone-500 hover:underline">← 商品一覧へ戻る</Link>
        <h2 className="text-2xl font-bold mt-2 mb-1">{item?.title || `商品ID: ${params.itemId}`}</h2>
        <p className="text-sm text-stone-500 mb-3">
          出品者：<Link href={`/users/${item?.user_id}`} className="text-orange-700 hover:underline">{item?.nickname}</Link>
        </p>

        {item?.sold && item.buyer_id && (
          <button
            onClick={() => setShowCancelForm(true)}
            className="text-xs font-bold border border-red-300 text-red-500 px-4 py-1.5 rounded-full hover:bg-red-50 transition-colors mb-6"
          >
            この取引を強制キャンセルする
          </button>
        )}

        {threads.size === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">メッセージはありません</p>
        ) : (
          <div className="flex flex-col gap-6">
            {[...threads.entries()].map(([buyerId, msgs]) => (
              <div key={buyerId} className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
                <p className="text-xs font-bold text-stone-500 bg-stone-50 px-4 py-2 border-b border-stone-100">
                  相手：<Link href={`/users/${buyerId}`} className="text-orange-700 hover:underline">{buyerId}</Link>
                </p>
                <div className="flex flex-col gap-3 p-4">
                  {msgs.map((m) => (
                    <div key={m.id} className={`max-w-[80%] ${m.user_id === item?.user_id ? "self-end text-right" : "self-start"}`}>
                      <p className="text-[11px] text-stone-400 mb-0.5">{m.nickname}・{new Date(m.created_at).toLocaleString()}</p>
                      <p className={`inline-block px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${m.user_id === item?.user_id ? "bg-orange-100" : "bg-stone-100"}`}>
                        {m.content}
                      </p>
                      <button
                        onClick={() => { setDeleteMessageTarget(m); setMessageReason(""); }}
                        className="block text-[11px] text-stone-400 hover:text-red-500 transition-colors mt-0.5"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {deleteMessageTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deletingMessage && setDeleteMessageTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">このメッセージを削除しますか？</p>
            <p className="text-center text-stone-500 text-sm mb-4 truncate">「{deleteMessageTarget.content}」</p>
            <label className="block text-xs font-bold text-stone-500 mb-1">削除理由（送信者に通知されます）</label>
            <textarea
              value={messageReason}
              onChange={(e) => setMessageReason(e.target.value)}
              maxLength={300}
              placeholder="例：暴言のため削除しました"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-4 outline-none h-20 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteMessageTarget(null)}
                disabled={deletingMessage}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDeleteMessage}
                disabled={deletingMessage}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {deletingMessage ? "削除中..." : "削除して通知する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !cancelling && setShowCancelForm(false)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">取引を強制キャンセルしますか？</p>
            <p className="text-xs text-stone-400 text-center mb-4">出品は「販売中」に戻り、出品者・購入者の両方に理由付きで通知されます。</p>
            <label className="block text-xs font-bold text-stone-500 mb-1">理由</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={300}
              placeholder="例：取引トラブルのため運営が仲介しキャンセルしました"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-4 outline-none h-20 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelForm(false)}
                disabled={cancelling}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {cancelling ? "処理中..." : "強制キャンセルする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
