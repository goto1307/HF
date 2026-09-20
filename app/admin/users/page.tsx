"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";

type AdminUser = {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  banned_until: string | null;
};

function isBanned(u: AdminUser) {
  return !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
}

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = isAdminEmail(user?.email);

  const fetchUsers = async () => {
    setErrorMsg("");
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) { setErrorMsg(error.message); setLoading(false); return; }
    setUsers(data as AdminUser[]);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin, router]);

  const handleToggleBan = async (target: AdminUser) => {
    const willBan = !isBanned(target);
    if (!confirm(willBan ? `${target.nickname || target.email} をBANしますか？` : `${target.nickname || target.email} のBANを解除しますか？`)) return;
    setProcessingId(target.id);
    const { error } = await supabase.rpc("admin_set_ban", { target_id: target.id, should_ban: willBan });
    setProcessingId(null);
    if (error) { alert(`操作に失敗しました: ${error.message}`); return; }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, banned_until: willBan ? "2999-12-31T00:00:00Z" : null } : u)));
  };

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || (u.nickname ?? "").toLowerCase().includes(q);
  });

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
          <h2 className="text-2xl font-bold">ユーザー一覧（{users.length}人）</h2>
          <div className="flex gap-3">
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
            <Link href="/admin/items" className="text-sm font-bold text-orange-700 hover:underline">商品/チャットへ</Link>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="メールアドレス・ニックネームで検索"
          className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-6 outline-none bg-white"
        />

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            取得に失敗しました：{errorMsg}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((u) => {
            const banned = isBanned(u);
            return (
              <div key={u.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-700 text-white flex items-center justify-center font-bold shrink-0 overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.nickname?.[0] ?? u.email[0])}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${u.id}`} className="font-bold text-sm text-orange-700 hover:underline">
                    {u.nickname || "（出品なし）"}
                  </Link>
                  <p className="text-xs text-stone-500 truncate">{u.email}</p>
                  <p className="text-[11px] text-stone-400">登録：{new Date(u.created_at).toLocaleDateString()}</p>
                  {banned && <p className="text-[11px] font-bold text-red-500">BAN中</p>}
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  <a
                    href={`mailto:${u.email}`}
                    className="text-xs font-bold border border-stone-300 text-stone-500 px-3 py-1 rounded-full hover:bg-stone-100 transition-colors"
                  >
                    メールを送る
                  </a>
                  <button
                    onClick={() => handleToggleBan(u)}
                    disabled={processingId === u.id}
                    className={`text-xs font-bold px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
                      banned ? "border border-stone-300 text-stone-500 hover:bg-stone-100" : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  >
                    {processingId === u.id ? "処理中..." : banned ? "BAN解除" : "BANする"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
