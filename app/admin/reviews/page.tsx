"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";
import StarRating from "@/components/StarRating";

type Review = {
  id: number;
  item_id: number;
  seller_id: string;
  reviewer_id: string;
  reviewer_nickname: string;
  rating: number;
  comment: string | null;
  created_at: string;
  item: { title: string } | null;
};

export default function AdminReviews() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;

    const fetchReviews = async () => {
      const { data } = await supabase
        .from("review")
        .select("id, item_id, seller_id, reviewer_id, reviewer_nickname, rating, comment, created_at, item:item_id(title)")
        .order("created_at", { ascending: false });
      if (data) setReviews(data as unknown as Review[]);
      setLoading(false);
    };
    fetchReviews();
  }, [authLoading, user, isAdmin, router]);

  const filtered = reviews.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.comment ?? "").toLowerCase().includes(q) || r.reviewer_nickname.toLowerCase().includes(q) || (r.item?.title ?? "").toLowerCase().includes(q);
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!deleteReason.trim()) { alert("削除理由を入力してください"); return; }
    setDeleting(true);
    const { error } = await supabase.rpc("admin_delete_review", {
      p_review_id: deleteTarget.id,
      p_reason: deleteReason.trim(),
    });
    setDeleting(false);
    if (error) { alert(`削除に失敗しました: ${error.message}`); return; }
    setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleteReason("");
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

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">評価一覧（{reviews.length}件）</h2>
          <div className="flex gap-3">
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
            <Link href="/admin/items" className="text-sm font-bold text-orange-700 hover:underline">商品/チャットへ</Link>
            <Link href="/admin/log" className="text-sm font-bold text-orange-700 hover:underline">操作ログへ</Link>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="コメント・投稿者名・商品名で検索"
          className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-6 outline-none bg-white"
        />

        {filtered.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">評価はありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => (
              <div key={r.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <Link href={`/items/${r.item_id}`} className="font-bold text-sm text-orange-700 hover:underline">
                    {r.item?.title || `商品ID ${r.item_id}`}
                  </Link>
                  <span className="text-xs text-stone-400 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <StarRating value={r.rating} size={13} />
                  <span className="text-xs text-stone-500">
                    投稿者：<Link href={`/users/${r.reviewer_id}`} className="hover:underline">{r.reviewer_nickname}</Link>
                  </span>
                </div>
                {r.comment && <p className="text-sm text-stone-700 mb-3 whitespace-pre-wrap">{r.comment}</p>}
                <button
                  onClick={() => { setDeleteTarget(r); setDeleteReason(""); }}
                  className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors"
                >
                  削除する
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">この評価を削除しますか？</p>
            <p className="text-center text-stone-500 text-sm mb-4 truncate">「{deleteTarget.comment || "(コメントなし)"}」</p>
            <label className="block text-xs font-bold text-stone-500 mb-1">削除理由（投稿者に通知されます）</label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              maxLength={300}
              placeholder="例：誹謗中傷を含むため削除しました"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-4 outline-none h-20 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {deleting ? "削除中..." : "削除して通知する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
