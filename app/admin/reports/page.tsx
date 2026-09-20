"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

const ADMIN_EMAILS = ["debuchi.sora.b0@elms.hokudai.ac.jp", "goto.kanata.w1@elms.hokudai.ac.jp"];

type Report = {
  id: number;
  item_id: number;
  reason: string;
  created_at: string;
  item: { title: string } | null;
};

export default function AdminReports() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isAdmin = !!user && !!user.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;

    const fetchReports = async () => {
      const { data } = await supabase
        .from("report")
        .select("id, item_id, reason, created_at, item:item_id(title)")
        .order("created_at", { ascending: false });
      if (data) setReports(data as unknown as Report[]);
      setLoading(false);
    };
    fetchReports();
  }, [authLoading, user, isAdmin, router]);

  const handleDelete = async (report: Report) => {
    if (!confirm("この通報を削除しますか？")) return;
    setDeletingId(report.id);
    const { error } = await supabase.from("report").delete().eq("id", report.id);
    setDeletingId(null);
    if (error) { alert("削除に失敗しました"); return; }
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  };

  const handleDeleteItem = async (report: Report) => {
    if (!confirm("通報された商品自体を削除しますか？この操作は取り消せません。")) return;
    setDeletingId(report.id);
    const { error } = await supabase.from("item").delete().eq("id", report.item_id);
    setDeletingId(null);
    if (error) { alert("商品の削除に失敗しました"); return; }
    setReports((prev) => prev.filter((r) => r.item_id !== report.item_id));
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
        <h2 className="text-2xl font-bold mb-6">通報一覧（{reports.length}件）</h2>

        {reports.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">通報はありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <Link href={`/items/${r.item_id}`} className="font-bold text-sm text-orange-700 hover:underline">
                    {r.item?.title || `商品ID: ${r.item_id}`}
                  </Link>
                  <span className="text-xs text-stone-400 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-stone-700 mb-3">{r.reason}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    className="text-xs font-bold border border-stone-300 text-stone-500 px-4 py-1.5 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-50"
                  >
                    通報を削除する
                  </button>
                  <button
                    onClick={() => handleDeleteItem(r)}
                    disabled={deletingId === r.id}
                    className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === r.id ? "処理中..." : "商品ごと削除する"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
