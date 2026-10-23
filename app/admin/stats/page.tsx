"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { formatBudget, formatDeadline } from "@/lib/demand";
import Header from "@/components/Header";

// admin_demand_stats()(migration PART AH)の戻り値
type Stats = {
  counts: { active: number; expired: number; fulfilled: number; withdrawn: number; removed: number; total: number };
  posters: number;
  votes_total: number;
  wanters_active: number;
  fulfilled_people: number;
  fulfilled_by_purchase: number;
  offers: number;
  offered_items: number;
  offered_items_sold: number;
  avg_days_to_fulfill: number | null;
  budget_active: { avg: number | null; median: number | null };
  weekly: { week_start: string; created: number; fulfilled: number }[];
  top_tags: { tag: string; demands: number; wanters: number }[];
  top_demands: { id: number; title: string; budget: number; deadline: string; wanters: number }[];
};

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-stone-800 tracking-tight">{value}</p>
      {note && <p className="text-[11px] text-stone-400 mt-0.5">{note}</p>}
    </div>
  );
}

function weekLabel(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}/${d}`;
}

// 週ごとの件数の棒グラフ(1系列なので凡例は付けず、見出しで何の数かを示す)
function WeeklyBars({ title, data }: { title: string; data: { week_start: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const maxIndex = data.findIndex((d) => d.value === max);
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
      <p className="text-sm font-bold text-stone-700 mb-3">{title}</p>
      <div className="relative h-36 flex items-end gap-[2px] border-b border-stone-200">
        {data.map((d, i) => (
          <div
            key={d.week_start}
            className="relative flex-1 h-full flex flex-col justify-end items-center cursor-default"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {(i === maxIndex || hover === i) && d.value > 0 && (
              <span className="text-[11px] font-bold text-stone-600 mb-0.5">{d.value}</span>
            )}
            <div
              className={`w-full max-w-8 rounded-t-[4px] transition-colors ${hover === i ? "bg-orange-800" : "bg-orange-600"}`}
              style={{ height: `${(d.value / max) * 85}%`, minHeight: d.value > 0 ? 2 : 0 }}
            />
            {hover === i && (
              <div className="absolute bottom-full mb-1 z-10 whitespace-nowrap bg-stone-800 text-white text-[11px] rounded-lg px-2 py-1 shadow">
                {weekLabel(d.week_start)}の週：{d.value}件
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map((d) => (
          <span key={d.week_start} className="flex-1 text-center text-[10px] text-stone-400">{weekLabel(d.week_start)}</span>
        ))}
      </div>
    </div>
  );
}

export default function AdminStats() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;
    const load = async () => {
      const { data, error } = await supabase.rpc("admin_demand_stats");
      if (error) setErrorMsg(error.message);
      else setStats(data as Stats);
    };
    load();
  }, [authLoading, user, isAdmin, router]);

  if (!authLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">このページを見る権限がありません</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">{errorMsg ? `読み込みに失敗しました: ${errorMsg}` : "読み込み中..."}</div>
      </div>
    );
  }

  const c = stats.counts;
  const sellRate = stats.offered_items > 0 ? Math.round((stats.offered_items_sold / stats.offered_items) * 100) : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold">欲しい！の集計</h2>
          <div className="flex gap-3">
            <Link href="/admin/demands" className="text-sm font-bold text-orange-700 hover:underline">欲しい！一覧へ</Link>
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
          </div>
        </div>

        <h3 className="font-bold text-sm text-stone-600 mb-2">いまの需要</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Tile label="受付中の欲しい！" value={c.active} />
          <Tile label="まだ欲しい人（のべ）" value={stats.wanters_active} note="登録者＋僕も！" />
          <Tile label="出せる金額（中央値）" value={stats.budget_active.median === null ? "-" : `¥${Math.round(stats.budget_active.median).toLocaleString()}`} />
          <Tile label="出せる金額（平均）" value={stats.budget_active.avg === null ? "-" : `¥${Math.round(stats.budget_active.avg).toLocaleString()}`} />
        </div>

        <h3 className="font-bold text-sm text-stone-600 mb-2">マッチングの効果</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Tile label="買えた！になった人（のべ）" value={stats.fulfilled_people} note={`うち購入から ${stats.fulfilled_by_purchase}人`} />
          <Tile label="出品者からのお知らせ" value={stats.offers} note={`商品 ${stats.offered_items}件`} />
          <Tile label="お知らせした商品の売れた割合" value={sellRate === null ? "-" : `${sellRate}%`} note={`${stats.offered_items_sold} / ${stats.offered_items}件`} />
          <Tile label="登録から買えた！まで" value={stats.avg_days_to_fulfill === null ? "-" : `${stats.avg_days_to_fulfill}日`} note="登録者の平均" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <WeeklyBars title="週ごとの欲しい！登録数" data={stats.weekly.map((w) => ({ week_start: w.week_start, value: w.created }))} />
          <WeeklyBars title="週ごとの買えた！の人数" data={stats.weekly.map((w) => ({ week_start: w.week_start, value: w.fulfilled }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-stone-700 mb-2">よく欲しがられているタグ（受付中）</p>
            {stats.top_tags.length === 0 ? (
              <p className="text-xs text-stone-400">まだありません</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-stone-400 text-left">
                    <th className="font-normal pb-1">タグ</th>
                    <th className="font-normal pb-1 text-right">欲しい人</th>
                    <th className="font-normal pb-1 text-right">件数</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_tags.map((t) => (
                    <tr key={t.tag} className="border-t border-stone-100">
                      <td className="py-1 text-orange-700">#{t.tag}</td>
                      <td className="py-1 text-right font-bold tabular-nums">{t.wanters}</td>
                      <td className="py-1 text-right text-stone-500 tabular-nums">{t.demands}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-stone-700 mb-2">欲しい人が多い欲しい！（受付中）</p>
            {stats.top_demands.length === 0 ? (
              <p className="text-xs text-stone-400">まだありません</p>
            ) : (
              <ul className="flex flex-col">
                {stats.top_demands.map((d) => (
                  <li key={d.id} className="border-t border-stone-100 first:border-t-0 py-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-bold truncate">{d.title}</span>
                      <span className="shrink-0 font-bold tabular-nums">{d.wanters}人</span>
                    </div>
                    <p className="text-[11px] text-stone-400">{formatBudget(d.budget)}・{formatDeadline(d.deadline)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <h3 className="font-bold text-sm text-stone-600 mb-2">欲しい！の内訳（これまでの合計 {c.total}件・登録した人 {stats.posters}人・僕も！ {stats.votes_total}件）</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <Tile label="受付中" value={c.active} />
          <Tile label="期限切れ" value={c.expired} />
          <Tile label="買えた！" value={c.fulfilled} />
          <Tile label="取り下げ" value={c.withdrawn} />
          <Tile label="運営により削除" value={c.removed} />
        </div>
      </main>
    </div>
  );
}
