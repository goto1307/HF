"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { formatBudget, formatDeadline, isActiveDemand, type Demand } from "@/lib/demand";
import Header from "@/components/Header";

type AdminDemand = Demand & {
  user_id: string;
  email: string | null;
  nickname: string | null;
  votes: number;
  reports: number;
};

const STATUS_FILTERS = [
  { key: "active", label: "受付中" },
  { key: "reported", label: "通報あり" },
  { key: "all", label: "すべて" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const STATUS_LABEL: Record<Demand["status"], string> = {
  open: "受付中",
  fulfilled: "買えた！",
  withdrawn: "取り下げ",
  removed: "運営により削除",
};

function statusLabel(d: AdminDemand) {
  return d.status === "open" && !isActiveDemand(d) ? "期限切れ" : STATUS_LABEL[d.status];
}

export default function AdminDemands() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [demands, setDemands] = useState<AdminDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [deleteTarget, setDeleteTarget] = useState<AdminDemand | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;
    const load = async () => {
      const { data, error } = await supabase.rpc("admin_list_demands");
      if (error) setErrorMsg(error.message);
      else setDemands(data as AdminDemand[]);
      setLoading(false);
    };
    load();
  }, [authLoading, user, isAdmin, router]);

  const q = query.trim().toLowerCase();
  const visible = demands.filter((d) => {
    if (filter === "active" && !isActiveDemand(d)) return false;
    if (filter === "reported" && d.reports === 0) return false;
    if (!q) return true;
    return [d.title, d.note ?? "", d.nickname ?? "", d.email ?? "", ...d.tags].some((s) => s.toLowerCase().includes(q));
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!deleteReason.trim()) { alert("削除理由を入力してください"); return; }
    setDeleting(true);
    const { error } = await supabase.rpc("admin_delete_demand", { p_demand_id: deleteTarget.id, p_reason: deleteReason.trim() });
    setDeleting(false);
    if (error) { alert(`削除に失敗しました: ${error.message}`); return; }
    setDemands((prev) => prev.map((d) => (d.id === deleteTarget.id ? { ...d, status: "removed" } : d)));
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">欲しい！一覧（{visible.length}件）</h2>
          <div className="flex gap-3">
            <Link href="/admin/stats" className="text-sm font-bold text-orange-700 hover:underline">集計へ</Link>
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
            <Link href="/admin/log" className="text-sm font-bold text-orange-700 hover:underline">操作ログへ</Link>
          </div>
        </div>

        {errorMsg && <p className="text-sm text-red-500 mb-4">読み込みに失敗しました: {errorMsg}</p>}

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="商品名・備考・タグ・ニックネーム・メールで検索"
          className="w-full border border-stone-200 rounded-full px-4 py-2 text-sm outline-none focus:border-orange-600 bg-white mb-3"
        />
        <div className="flex gap-2 mb-5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                filter === f.key ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">該当する欲しい！はありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((d) => (
              <div key={d.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${d.reports > 0 && d.status !== "removed" ? "border-red-200" : "border-stone-200"}`}>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="font-bold text-sm break-all">{d.title}</p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 shrink-0">{statusLabel(d)}</span>
                </div>
                <p className="text-xs text-stone-500 mb-1">
                  {formatBudget(d.budget)}・{formatDeadline(d.deadline)}・僕も！{d.votes}件
                  {d.reports > 0 && <span className="text-red-500 font-bold">・通報{d.reports}件</span>}
                </p>
                {d.tags.length > 0 && <p className="text-xs text-orange-600 mb-1">{d.tags.map((t) => `#${t}`).join(" ")}</p>}
                {d.note && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg px-3 py-2 mb-1 whitespace-pre-wrap break-all">{d.note}</p>}
                <p className="text-xs text-stone-400 mb-3">
                  登録者：
                  <Link href={`/users/${d.user_id}`} className="hover:underline">
                    {d.nickname ? `${d.nickname}（${d.email ?? "不明"}）` : d.email ?? d.user_id}
                  </Link>
                  ・{new Date(d.created_at).toLocaleString()}
                </p>
                {d.status !== "removed" && (
                  <button
                    onClick={() => { setDeleteTarget(d); setDeleteReason(""); }}
                    className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors"
                  >
                    削除する
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">この欲しい！を削除しますか？</p>
            <p className="text-center text-orange-700 font-bold text-sm mb-4 truncate">{deleteTarget.title}</p>
            <label className="block text-xs font-bold text-stone-500 mb-1">削除理由（登録者に通知されます）</label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              maxLength={300}
              placeholder="例：不適切な内容のため削除しました"
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
                onClick={handleDelete}
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
