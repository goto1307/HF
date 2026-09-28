"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";

export default function AdminBackup() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [lastDownloadedAt, setLastDownloadedAt] = useState<string | null>(null);

  const isAdmin = isAdminEmail(user?.email);

  const handleDownload = async () => {
    setDownloading(true);
    const { data, error } = await supabase.rpc("admin_export_all");
    setDownloading(false);
    if (error) { alert(`バックアップの取得に失敗しました: ${error.message}`); return; }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `hokufuri-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setLastDownloadedAt(now.toLocaleString());
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  if (!user) { router.push("/login"); return null; }

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
          <h2 className="text-2xl font-bold">データバックアップ</h2>
          <div className="flex gap-3">
            <Link href="/admin/log" className="text-sm font-bold text-orange-700 hover:underline">操作ログへ</Link>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6">
          <p className="text-sm text-stone-600 mb-4">
            出品・チャット・評価・通報・ユーザー一覧など、DB内の全データをJSONファイルとしてダウンロードします。
            画像ファイル自体（Storage内のバイナリ）は含まれません。
          </p>
          <p className="text-xs text-stone-400 mb-4">
            ダウンロードした時点のスナップショットです。定期的に（例：週1回）ご自身で実行し、安全な場所に保管してください。
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm"
          >
            {downloading ? "取得中..." : "バックアップをダウンロード"}
          </button>
          {lastDownloadedAt && (
            <p className="text-xs text-stone-400 mt-3">最終ダウンロード：{lastDownloadedAt}</p>
          )}
        </div>
      </main>
    </div>
  );
}
