"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { formatBudget, formatDeadline } from "@/lib/demand";
import Header from "@/components/Header";
import { loginPath } from "@/lib/nav";

// admin_site_stats()(migration PART AJ)の戻り値。サイト全体の数字
type SiteWeek = {
  week_start: string;
  new_users: number;
  users_total: number;
  new_items: number;
  active_sellers: number;
  new_sellers: number;
  sellers_total: number;
  sold: number;
  messages: number;
  qr_scans: number;
};
type SiteStats = {
  totals: { users: number; sellers: number; items: number; listed: number; sold: number; received: number; qr_scans: number; messages: number };
  weekly: SiteWeek[];
};

// 週ごとの表の列(CSV の列もこの順)
const SITE_COLUMNS: { key: keyof SiteWeek; label: string }[] = [
  { key: "new_users", label: "新規登録" },
  { key: "users_total", label: "登録者(累計)" },
  { key: "new_items", label: "出品数" },
  { key: "active_sellers", label: "出品した人" },
  { key: "new_sellers", label: "初出品の人" },
  { key: "sellers_total", label: "出品者(累計)" },
  { key: "sold", label: "取引成立" },
  { key: "messages", label: "メッセージ" },
  { key: "qr_scans", label: "QR読込" },
];

function downloadSiteCsv(weekly: SiteWeek[]) {
  const header = ["週(月曜はじまり)", ...SITE_COLUMNS.map((c) => c.label)].join(",");
  const rows = weekly.map((w) => [w.week_start, ...SITE_COLUMNS.map((c) => w[c.key])].join(","));
  // Excel で文字化けしないよう、先頭に BOM を付ける
  const blob = new Blob(["\ufeff" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hokuma-weekly-${weekly[weekly.length - 1]?.week_start ?? "stats"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [site, setSite] = useState<SiteStats | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(loginPath()); return; }
    if (!isAdmin) return;
    const load = async () => {
      const [{ data, error }, { data: siteData, error: siteError }] = await Promise.all([
        supabase.rpc("admin_demand_stats"),
        supabase.rpc("admin_site_stats"),
      ]);
      if (error || siteError) setErrorMsg((error ?? siteError)!.message);
      else { setStats(data as Stats); setSite(siteData as SiteStats); }
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

  if (!stats || !site) {
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
          <h2 className="text-2xl font-bold">集計</h2>
          <div className="flex gap-3">
            <Link href="/admin/demands" className="text-sm font-bold text-orange-700 hover:underline">欲しい！一覧へ</Link>
            <Link href="/admin/reports" className="text-sm font-bold text-orange-700 hover:underline">通報一覧へ</Link>
          </div>
        </div>

        {/* ---------- サイト全体 ---------- */}
        <h3 className="text-lg font-extrabold text-stone-700 mb-3">サイト全体</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Tile label="登録者" value={site.totals.users} note="退会した人を除く" />
          <Tile label="出品したことがある人" value={site.totals.sellers} />
          <Tile label="出品中の商品" value={site.totals.listed} note={`これまでの出品 ${site.totals.items}件`} />
          <Tile label="取引成立" value={site.totals.sold} note={`受け取り完了 ${site.totals.received}件`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <WeeklyBars title="週ごとの新規登録" data={site.weekly.map((w) => ({ week_start: w.week_start, value: w.new_users }))} />
          <WeeklyBars title="週ごとの出品数" data={site.weekly.map((w) => ({ week_start: w.week_start, value: w.new_items }))} />
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm mb-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-bold text-stone-700">週ごとの数字（直近12週・月曜はじまり）</p>
            <button
              onClick={() => downloadSiteCsv(site.weekly)}
              className="shrink-0 text-xs font-bold border border-orange-200 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
            >
              CSVで保存
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-[11px] text-stone-400 text-right">
                  <th className="font-normal pb-1 text-left pr-3">週</th>
                  {SITE_COLUMNS.map((col) => (
                    <th key={col.key} className="font-normal pb-1 px-2">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...site.weekly].reverse().map((w) => (
                  <tr key={w.week_start} className="border-t border-stone-100 text-right tabular-nums">
                    <td className="py-1 text-left pr-3 text-stone-500">{weekLabel(w.week_start)}〜</td>
                    {SITE_COLUMNS.map((col) => (
                      <td key={col.key} className={`py-1 px-2 ${w[col.key] === 0 ? "text-stone-300" : "font-bold text-stone-700"}`}>{w[col.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            取引成立は、売れた日時を記録し始める前のものは「売れました！」の通知の日時で数えています。管理者が削除した商品は含まれません。
          </p>
        </div>

        {/* ---------- みんなの欲しい！ ---------- */}
        <h3 className="text-lg font-extrabold text-stone-700 mb-3">みんなの欲しい！</h3>
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
