"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";

type Item = {
  id: number;
  title: string;
  user_id: string;
  nickname: string;
  sold: boolean;
  created_at: string;
};

export default function AdminItems() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;

    const fetchItems = async () => {
      const { data } = await supabase
        .from("item")
        .select("id, title, user_id, nickname, sold, created_at")
        .order("created_at", { ascending: false });
      if (data) setItems(data);
      setLoading(false);
    };
    fetchItems();
  }, [authLoading, user, isAdmin, router]);

  const filtered = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return i.title.toLowerCase().includes(q) || i.nickname.toLowerCase().includes(q);
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!deleteReason.trim()) { alert("削除理由を入力してください"); return; }
    setDeleting(true);
    const { error } = await supabase.rpc("admin_delete_item", {
      p_item_id: deleteTarget.id,
      p_reason: deleteReason.trim(),
    });
    setDeleting(false);
    if (error) { alert(`商品の削除に失敗しました: ${error.message}`); return; }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
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
          <h2 className="text-2xl font-bold">商品一覧（{items.length}件）</h2>
          <div className="flex gap-3">
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
            <Link href="/admin/users" className="text-sm font-bold text-orange-700 hover:underline">ユーザー管理へ</Link>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="商品名・出品者名で検索"
          className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-6 outline-none bg-white"
        />

        <div className="flex flex-col gap-3">
          {filtered.map((i) => (
            <div key={i.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/items/${i.id}`} className="font-bold text-sm text-orange-700 hover:underline block truncate">
                  {i.title}
                </Link>
                <p className="text-xs text-stone-500">
                  出品者：<Link href={`/users/${i.user_id}`} className="hover:underline">{i.nickname}</Link>
                  {i.sold && <span className="ml-2 text-stone-400">売却済み</span>}
                </p>
                <p className="text-[11px] text-stone-400">{new Date(i.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-1.5 items-end shrink-0">
                <Link
                  href={`/admin/chats/${i.id}`}
                  className="text-xs font-bold border border-stone-300 text-stone-500 px-3 py-1.5 rounded-full hover:bg-stone-100 transition-colors"
                >
                  チャットを見る
                </Link>
                <button
                  onClick={() => { setDeleteTarget(i); setDeleteReason(""); }}
                  className="text-xs font-bold bg-red-500 text-white px-3 py-1.5 rounded-full hover:bg-red-600 transition-colors"
                >
                  削除する
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">商品を削除しますか？</p>
            <p className="text-center text-orange-700 font-bold text-sm mb-4 truncate">{deleteTarget.title}</p>
            <label className="block text-xs font-bold text-stone-500 mb-1">削除理由（出品者に通知されます）</label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              maxLength={300}
              placeholder="例：禁止出品物のため削除しました"
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
