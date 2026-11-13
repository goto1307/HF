"use client";
// 運営だけ: これまでに出品された写真の「一覧用の小さい写真(サムネイル)」をまとめて作る(lib/thumb.ts)。
// 新しく出品された写真は出品のときに自動で作られるので、ここで作るのは古い写真の分だけ。
// 元の写真・商品のデータは変えない。何度押しても、もうあるものは作り直さない
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import Header from "@/components/Header";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";
import { imageNameFromUrl, thumbUrl, uploadThumb } from "@/lib/thumb";

type Progress = { total: number; done: number; made: number; existed: number; failed: number };

export default function AdminThumbs() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const isAdmin = isAdminEmail(user?.email);

  const run = async () => {
    setRunning(true);
    const { data, error } = await supabase.from("item").select("id,image_url,image_urls");
    if (error || !data) {
      toast(`商品の読み込みに失敗しました: ${error?.message ?? ""}`);
      setRunning(false);
      return;
    }
    // 全商品の写真のURL(重複なし)
    const urls = new Set<string>();
    for (const it of data as { image_url: string | null; image_urls: string[] | null }[]) {
      for (const u of it.image_urls ?? []) if (u) urls.add(u);
      if (it.image_url) urls.add(it.image_url);
    }
    const list = [...urls].filter((u) => imageNameFromUrl(u));
    const p: Progress = { total: list.length, done: 0, made: 0, existed: 0, failed: 0 };
    setProgress({ ...p });

    for (const url of list) {
      const name = imageNameFromUrl(url)!;
      try {
        // もうサムネイルがあれば飛ばす
        const head = await fetch(thumbUrl(url), { method: "HEAD", cache: "no-store" });
        if (head.ok) {
          p.existed++;
        } else {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const result = await uploadThumb(name, await res.blob());
          if (result === "made") p.made++;
          else if (result === "exists") p.existed++;
          else p.failed++;
        }
      } catch {
        p.failed++;
      }
      p.done++;
      setProgress({ ...p });
    }
    setRunning(false);
    toast(p.failed === 0 ? "一覧用の写真を作り終えました" : `作り終えました（${p.failed}枚は作れませんでした）`, p.failed === 0 ? "success" : undefined);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  if (!user) { router.push(loginPath()); return null; }

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
          <h2 className="text-2xl font-bold">一覧用の写真を作る</h2>
          <Link href="/admin/backup" className="text-sm font-bold text-orange-700 hover:underline">バックアップへ</Link>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6">
          <p className="text-sm text-stone-600 mb-2">
            これまでに出品された写真から、一覧に出す小さい写真（1枚30〜50KBほど）を作ります。
            一覧が軽くなり、写真が早く出るようになります。
          </p>
          <p className="text-xs text-stone-400 mb-4">
            元の写真や商品の内容は変わりません。もう作ってある写真は飛ばすので、何度押しても大丈夫です。
            新しく出品された写真は、出品のときに自動で作られます。終わるまでこの画面を開いたままにしてください。
          </p>
          <button
            onClick={run}
            disabled={running}
            className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm"
          >
            {running ? "作成中..." : "一覧用の写真を作る"}
          </button>
          {progress && (
            <div className="mt-4 text-sm text-stone-600">
              <p className="font-bold">
                {progress.done} / {progress.total} 枚
              </p>
              <p className="text-xs text-stone-500 mt-1">
                新しく作った：{progress.made}枚 ／ もうあった：{progress.existed}枚 ／ 作れなかった：{progress.failed}枚
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
