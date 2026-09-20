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
  item_id: number | null;
  reported_user_id: string | null;
  reporter_id: string | null;
  reason: string;
  created_at: string;
  item: { title: string; user_id: string } | null;
};

type AdminUser = {
  id: string;
  email: string;
  nickname: string | null;
};

export default function AdminReports() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [userMap, setUserMap] = useState<Record<string, AdminUser>>({});
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
        .select("id, item_id, reported_user_id, reporter_id, reason, created_at, item:item_id(title,user_id)")
        .order("created_at", { ascending: false });
      if (data) setReports(data as unknown as Report[]);

      const { data: users } = await supabase.rpc("admin_list_users");
      if (users) {
        const map: Record<string, AdminUser> = {};
        for (const u of users as AdminUser[]) map[u.id] = u;
        setUserMap(map);
      }
      setLoading(false);
    };
    fetchReports();
  }, [authLoading, user, isAdmin, router]);

  const describeUser = (id: string | null) => {
    if (!id) return "不明";
    const u = userMap[id];
    if (!u) return id;
    return u.nickname ? `${u.nickname}（${u.email}）` : u.email;
  };

  const handleDelete = async (report: Report) => {
    if (!confirm("この通報を削除しますか？")) return;
    setDeletingId(report.id);
    const { error } = await supabase.from("report").delete().eq("id", report.id);
    setDeletingId(null);
    if (error) { alert("削除に失敗しました"); return; }
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  };

  const handleDeleteItem = async (report: Report) => {
    if (!report.item_id) return;
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">通報一覧（{reports.length}件）</h2>
          <Link href="/admin/users" className="text-sm font-bold text-orange-700 hover:underline">ユーザー管理へ</Link>
        </div>

        {reports.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">通報はありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  {r.item_id ? (
                    <Link href={`/items/${r.item_id}`} className="font-bold text-sm text-orange-700 hover:underline">
                      商品：{r.item?.title || `ID ${r.item_id}`}
                    </Link>
                  ) : (
                    <Link href={`/users/${r.reported_user_id}`} className="font-bold text-sm text-orange-700 hover:underline">
                      ユーザー：{describeUser(r.reported_user_id)}
                    </Link>
                  )}
                  <span className="text-xs text-stone-400 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-stone-500 mb-1.5">通報者：{describeUser(r.reporter_id)}</p>
                <p className="text-sm text-stone-700 mb-3">{r.reason}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    className="text-xs font-bold border border-stone-300 text-stone-500 px-4 py-1.5 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-50"
                  >
                    通報を削除する
                  </button>
                  {r.item_id && (
                    <>
                      <Link
                        href={`/admin/chats/${r.item_id}`}
                        className="text-xs font-bold border border-stone-300 text-stone-500 px-4 py-1.5 rounded-full hover:bg-stone-100 transition-colors"
                      >
                        チャットを見る
                      </Link>
                      <button
                        onClick={() => handleDeleteItem(r)}
                        disabled={deletingId === r.id}
                        className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingId === r.id ? "処理中..." : "商品ごと削除する"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
