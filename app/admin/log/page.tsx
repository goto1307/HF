"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";

type LogRow = {
  id: number;
  admin_id: string;
  action: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
};

type AdminUser = {
  id: string;
  email: string;
  nickname: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  ban: "BAN",
  unban: "BAN解除",
  delete_item: "商品削除",
  delete_message: "メッセージ削除",
  delete_review: "評価削除",
  cancel_purchase: "取引の強制キャンセル",
};

export default function AdminLog() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, AdminUser>>({});
  const [loading, setLoading] = useState(true);

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;

    const fetchData = async () => {
      const { data } = await supabase
        .from("admin_action_log")
        .select("id, admin_id, action, target_id, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data);

      const { data: users } = await supabase.rpc("admin_list_users");
      if (users) {
        const map: Record<string, AdminUser> = {};
        for (const u of users as AdminUser[]) map[u.id] = u;
        setUserMap(map);
      }
      setLoading(false);
    };
    fetchData();
  }, [authLoading, user, isAdmin, router]);

  const describeAdmin = (id: string) => userMap[id]?.nickname || userMap[id]?.email || id;

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
          <h2 className="text-2xl font-bold">管理者操作ログ（{logs.length}件）</h2>
          <div className="flex gap-3">
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
            <Link href="/admin/users" className="text-sm font-bold text-orange-700 hover:underline">ユーザー管理へ</Link>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">操作履歴はありません</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((l) => (
              <div key={l.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="text-sm font-bold">
                    <span className="text-orange-700">{describeAdmin(l.admin_id)}</span>
                    が
                    <span className="ml-1">{ACTION_LABELS[l.action] || l.action}</span>
                  </p>
                  <span className="text-xs text-stone-400 shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                </div>
                {l.target_id && <p className="text-xs text-stone-500">対象ID：{l.target_id}</p>}
                {l.detail && <p className="text-sm text-stone-700 mt-1">理由：{l.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
