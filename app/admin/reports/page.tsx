"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";

type Report = {
  id: number;
  item_id: number | null;
  reported_user_id: string | null;
  reporter_id: string | null;
  message_id: number | null;
  demand_id: number | null;
  reason: string;
  created_at: string;
  item: { title: string; user_id: string } | null;
  message: { content: string; user_id: string } | null;
};

type ReportedDemand = { id: number; title: string; note: string | null; status: string };

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
  const [deleteItemTarget, setDeleteItemTarget] = useState<Report | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingItem, setDeletingItem] = useState(false);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<Report | null>(null);
  const [messageDeleteReason, setMessageDeleteReason] = useState("");
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [demandMap, setDemandMap] = useState<Record<number, ReportedDemand>>({});
  const [deleteDemandTarget, setDeleteDemandTarget] = useState<Report | null>(null);
  const [demandDeleteReason, setDemandDeleteReason] = useState("");
  const [deletingDemand, setDeletingDemand] = useState(false);

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(loginPath()); return; }
    if (!isAdmin) return;

    const fetchReports = async () => {
      const { data } = await supabase
        .from("report")
        .select("id, item_id, reported_user_id, reporter_id, message_id, demand_id, reason, created_at, item:item_id(title,user_id), message:message_id(content,user_id)")
        .order("created_at", { ascending: false });
      if (data) setReports(data as unknown as Report[]);

      const { data: users } = await supabase.rpc("admin_list_users");
      if (users) {
        const map: Record<string, AdminUser> = {};
        for (const u of users as AdminUser[]) map[u.id] = u;
        setUserMap(map);
      }

      // 通報された欲しい！の中身(登録者以外は読めないので管理者用の関数で取る)
      const { data: demands } = await supabase.rpc("admin_list_demands");
      if (demands) {
        const map: Record<number, ReportedDemand> = {};
        for (const d of demands as ReportedDemand[]) map[d.id] = d;
        setDemandMap(map);
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
    if (error) { toast("削除に失敗しました"); return; }
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemTarget?.item_id) return;
    if (!deleteReason.trim()) { toast("削除理由を入力してください"); return; }
    setDeletingItem(true);
    const { error } = await supabase.rpc("admin_delete_item", {
      p_item_id: deleteItemTarget.item_id,
      p_reason: deleteReason.trim(),
    });
    setDeletingItem(false);
    if (error) { toast(`商品の削除に失敗しました: ${error.message}`); return; }
    setReports((prev) => prev.filter((r) => r.item_id !== deleteItemTarget.item_id));
    setDeleteItemTarget(null);
    setDeleteReason("");
  };

  const handleConfirmDeleteMessage = async () => {
    if (!deleteMessageTarget?.message_id) return;
    if (!messageDeleteReason.trim()) { toast("削除理由を入力してください"); return; }
    setDeletingMessage(true);
    const { error } = await supabase.rpc("admin_delete_message", {
      p_message_id: deleteMessageTarget.message_id,
      p_reason: messageDeleteReason.trim(),
    });
    setDeletingMessage(false);
    if (error) { toast(`削除に失敗しました: ${error.message}`); return; }
    setReports((prev) => prev.map((r) => (r.id === deleteMessageTarget.id ? { ...r, message: null } : r)));
    setDeleteMessageTarget(null);
    setMessageDeleteReason("");
  };

  const handleConfirmDeleteDemand = async () => {
    if (!deleteDemandTarget?.demand_id) return;
    if (!demandDeleteReason.trim()) { toast("削除理由を入力してください"); return; }
    setDeletingDemand(true);
    const { error } = await supabase.rpc("admin_delete_demand", {
      p_demand_id: deleteDemandTarget.demand_id,
      p_reason: demandDeleteReason.trim(),
    });
    setDeletingDemand(false);
    if (error) { toast(`削除に失敗しました: ${error.message}`); return; }
    const id = deleteDemandTarget.demand_id;
    setDemandMap((prev) => ({ ...prev, [id]: { ...prev[id], status: "removed" } }));
    setDeleteDemandTarget(null);
    setDemandDeleteReason("");
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
          <div className="flex gap-3">
            <Link href="/admin/users" className="text-sm font-bold text-orange-700 hover:underline">ユーザー管理へ</Link>
            <Link href="/admin/demands" className="text-sm font-bold text-orange-700 hover:underline">欲しい！一覧へ</Link>
            <Link href="/admin/items" className="text-sm font-bold text-orange-700 hover:underline">商品/チャットへ</Link>
            <Link href="/admin/reviews" className="text-sm font-bold text-orange-700 hover:underline">評価一覧へ</Link>
            <Link href="/admin/log" className="text-sm font-bold text-orange-700 hover:underline">操作ログへ</Link>
            <Link href="/admin/backup" className="text-sm font-bold text-orange-700 hover:underline">バックアップへ</Link>
          </div>
        </div>

        {reports.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">通報はありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  {r.demand_id ? (
                    <Link href="/admin/demands" className="font-bold text-sm text-orange-700 hover:underline">
                      欲しい！：{demandMap[r.demand_id]?.title || `ID ${r.demand_id}`}
                      {demandMap[r.demand_id]?.status === "removed" && "（削除済み）"}
                    </Link>
                  ) : r.message_id ? (
                    <span className="font-bold text-sm text-orange-700">
                      メッセージ{r.item_id && <> （<Link href={`/items/${r.item_id}`} className="hover:underline">{r.item?.title || `商品ID ${r.item_id}`}</Link>）</>}
                    </span>
                  ) : r.item_id ? (
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
                {r.message_id && (
                  <p className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2 mb-1.5">
                    通報されたメッセージ：{r.message ? `「${r.message.content}」（送信者：${describeUser(r.message.user_id)}）` : "（既に削除されています）"}
                  </p>
                )}
                {r.demand_id && (
                  <p className="text-xs text-stone-500 mb-1.5">登録者：{describeUser(r.reported_user_id)}</p>
                )}
                {r.demand_id && demandMap[r.demand_id]?.note && (
                  <p className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2 mb-1.5 whitespace-pre-wrap break-all">
                    備考：{demandMap[r.demand_id].note}
                  </p>
                )}
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
                    <Link
                      href={`/admin/chats/${r.item_id}`}
                      className="text-xs font-bold border border-stone-300 text-stone-500 px-4 py-1.5 rounded-full hover:bg-stone-100 transition-colors"
                    >
                      チャットを見る
                    </Link>
                  )}
                  {r.message_id && r.message && (
                    <button
                      onClick={() => { setDeleteMessageTarget(r); setMessageDeleteReason(""); }}
                      className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      メッセージを削除する
                    </button>
                  )}
                  {r.demand_id && demandMap[r.demand_id] && demandMap[r.demand_id].status !== "removed" && (
                    <button
                      onClick={() => { setDeleteDemandTarget(r); setDemandDeleteReason(""); }}
                      className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors"
                    >
                      欲しい！を削除する
                    </button>
                  )}
                  {r.item_id && !r.message_id && (
                    <button
                      onClick={() => { setDeleteItemTarget(r); setDeleteReason(""); }}
                      className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      商品ごと削除する
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {deleteItemTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deletingItem && setDeleteItemTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">商品を削除しますか？</p>
            <p className="text-center text-orange-700 font-bold text-sm mb-4 truncate">
              {deleteItemTarget.item?.title || `商品ID ${deleteItemTarget.item_id}`}
            </p>
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
                onClick={() => setDeleteItemTarget(null)}
                disabled={deletingItem}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDeleteItem}
                disabled={deletingItem}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {deletingItem ? "削除中..." : "削除して通知する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDemandTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deletingDemand && setDeleteDemandTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">この欲しい！を削除しますか？</p>
            <p className="text-center text-orange-700 font-bold text-sm mb-4 truncate">
              {deleteDemandTarget.demand_id && demandMap[deleteDemandTarget.demand_id]?.title}
            </p>
            <label className="block text-xs font-bold text-stone-500 mb-1">削除理由（登録者に通知されます）</label>
            <textarea
              value={demandDeleteReason}
              onChange={(e) => setDemandDeleteReason(e.target.value)}
              maxLength={300}
              placeholder="例：不適切な内容のため削除しました"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-4 outline-none h-20 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteDemandTarget(null)}
                disabled={deletingDemand}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDeleteDemand}
                disabled={deletingDemand}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {deletingDemand ? "削除中..." : "削除して通知する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteMessageTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deletingMessage && setDeleteMessageTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">このメッセージを削除しますか？</p>
            <p className="text-center text-stone-500 text-sm mb-4 truncate">
              「{deleteMessageTarget.message?.content}」
            </p>
            <label className="block text-xs font-bold text-stone-500 mb-1">削除理由（送信者に通知されます）</label>
            <textarea
              value={messageDeleteReason}
              onChange={(e) => setMessageDeleteReason(e.target.value)}
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
    </div>
  );
}
