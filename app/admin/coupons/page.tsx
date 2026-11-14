"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { COUPON_COLUMNS, benefitName, formatDate, type Coupon } from "@/lib/coupon";
import Header from "@/components/Header";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";

// admin_coupon_stats()(migration PART AT)の戻り値。運営2人の分は含まない
type Day = { date: string; views: number; claims: number; uses: number; lunch: number; evening: number; first_visits: number };
type CouponStats = {
  totals: {
    views: number;
    views_logged_out: number;
    claims: number;
    uses: number;
    users_used?: number; // 1回以上使った人数(PART AV から)
    first_visits: number;
    repeat_visits: number;
    lunch: number;
    evening: number;
    new_users_claimed: number;
    signup_from_coupon_links: number;
  };
  benefits: { benefit: string | null; uses: number }[];
  daily: Day[];
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

// "2026-11-18" → その週の月曜 "2026-11-16"
function weekStart(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function sum(days: Day[], key: keyof Omit<Day, "date">) {
  return days.reduce((n, d) => n + d[key], 0);
}

function percent(a: number, b: number) {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : "—";
}

// 店へ LINE で送る報告文(数字だけ。個人を特定できる情報は入れない)
function reportText(coupon: Coupon, weekDays: Day[], stats: CouponStats) {
  const usedDays = weekDays.filter((d) => d.date >= coupon.use_from && d.date <= coupon.use_until);
  const range = usedDays.length > 0 ? `${formatDate(usedDays[0].date)}〜${formatDate(usedDays[usedDays.length - 1].date)}` : "";
  const t = stats.totals;
  return [
    `${coupon.shop_name}様`,
    `HOKUMAクーポンの${range}のご報告です。`,
    "",
    `・使われた回数：${sum(usedDays, "uses")}回（13時台 ${sum(usedDays, "lunch")}回／夕方 ${sum(usedDays, "evening")}回）`,
    `・うち、初めて来店した方：${sum(usedDays, "first_visits")}人`,
    "",
    `【これまでの合計】`,
    `・クーポンを受け取った人：${t.claims}人`,
    ...(t.users_used !== undefined ? [`・使った人：${t.users_used}人`] : []),
    `・使われた回数：${t.uses}回（初めて来店 ${t.first_visits}人）`,
    ...(stats.benefits.length > 0
      ? [`・選ばれた特典：${stats.benefits.map((b) => `${benefitName(b.benefit)} ${b.uses}回`).join("、")}`]
      : []),
    "",
    "お客様の個人情報はお送りしていません。引き続きよろしくお願いいたします。",
  ].join("\n");
}

function downloadCsv(coupon: Coupon, days: Day[]) {
  const header = "日付,ページを見た(ブラウザ数),受け取り,使用,うち13時台,うち夕方,うち初来店";
  const rows = days.map((d) => [d.date, d.views, d.claims, d.uses, d.lunch, d.evening, d.first_visits].join(","));
  const blob = new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hokuma-coupon-${coupon.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(loginPath()); return; }
    if (!isAdmin) return;
    supabase
      .from("coupon")
      .select(COUPON_COLUMNS)
      .order("use_from", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErrorMsg(error.message); return; }
        const list = (data as Coupon[] | null) ?? [];
        setCoupons(list);
        setSelected((cur) => cur ?? list[0]?.id ?? null);
      });
  }, [authLoading, user, isAdmin, router]);

  useEffect(() => {
    if (!selected) return;
    supabase.rpc("admin_coupon_stats", { p_coupon: selected }).then(({ data, error }) => {
      if (error) setErrorMsg(error.message);
      else setStats(data as CouponStats);
    });
  }, [selected]);

  const coupon = coupons.find((c) => c.id === selected) ?? null;

  // 月曜はじまりの週ごとにまとめる(新しい週が上)
  const weeks = useMemo(() => {
    const map = new Map<string, Day[]>();
    for (const d of stats?.daily ?? []) {
      const w = weekStart(d.date);
      map.set(w, [...(map.get(w) ?? []), d]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [stats]);

  const copyReport = async (days: Day[]) => {
    if (!coupon || !stats) return;
    try {
      await navigator.clipboard.writeText(reportText(coupon, days, stats));
      toast("報告文をコピーしました");
    } catch {
      toast("コピーできませんでした");
    }
  };

  if (!authLoading && !isAdmin) {
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
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold">クーポン集計</h2>
          <Link href="/admin/stats" className="text-sm font-bold text-orange-700 hover:underline">サイト全体の集計へ</Link>
        </div>
        <p className="text-xs text-stone-500 mb-6">
          運営2人のアカウントの受け取り・使用は数えていません。「ページを見た」はブラウザごとに1回で数えています（同じ人が別の端末で見ると2回になります）。
        </p>

        {errorMsg && <p className="text-sm text-red-600 mb-4">読み込みに失敗しました: {errorMsg}</p>}

        {coupons.length > 1 && (
          <select
            value={selected ?? ""}
            onChange={(e) => { setStats(null); setSelected(e.target.value); }}
            className="mb-4 border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {coupons.map((c) => (
              <option key={c.id} value={c.id}>{c.shop_name}・{c.title}</option>
            ))}
          </select>
        )}

        {!coupon || !stats ? (
          <div className="p-8 text-center text-stone-400">{coupons.length === 0 && !errorMsg ? "クーポンがありません" : "読み込み中..."}</div>
        ) : (
          <>
            <p className="text-sm text-stone-600 mb-3">
              {coupon.shop_name}・{coupon.title}（{formatDate(coupon.use_from)}〜{formatDate(coupon.use_until)}）
              <Link href={`/coupons/${coupon.id}`} className="ml-2 text-orange-700 font-bold hover:underline">ページを開く</Link>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Tile label="ページを見た" value={stats.totals.views} note={`うち未ログイン ${stats.totals.views_logged_out}`} />
              <Tile label="受け取った人" value={stats.totals.claims} note={`見た人の ${percent(stats.totals.claims, stats.totals.views)}`} />
              <Tile
                label="使った人"
                value={stats.totals.users_used ?? stats.totals.uses}
                note={`受け取った人の ${percent(stats.totals.users_used ?? stats.totals.uses, stats.totals.claims)}・使用 ${stats.totals.uses}回`}
              />
              <Tile
                label="初めて来店"
                value={stats.totals.first_visits}
                note={`使った人の ${percent(stats.totals.first_visits, stats.totals.users_used ?? stats.totals.uses)}・2回目以降・常連の使用 ${stats.totals.repeat_visits}回`}
              />
            </div>
            {/* クーポンのリンクから来て登録した人数は、管理者の「集計」の「どこから来たか」で見る */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <Tile label="13時台に使用" value={stats.totals.lunch} />
              <Tile label="夕方に使用" value={stats.totals.evening} />
              <Tile label="配布開始後に登録して受け取った" value={stats.totals.new_users_claimed} note="クーポンがきっかけの可能性が高い" />
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm mb-6">
              <p className="text-sm font-bold text-stone-700 mb-2">選ばれた特典</p>
              {stats.benefits.length === 0 ? (
                <p className="text-sm text-stone-400">まだ使われていません</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {stats.benefits.map((b) => (
                    <li key={b.benefit ?? ""} className="flex justify-between">
                      <span>{benefitName(b.benefit)}</span>
                      <span className="font-bold">{b.uses}回</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-extrabold text-stone-700">週ごと・日ごと</h3>
              <button onClick={() => downloadCsv(coupon, stats.daily)} className="text-sm font-bold text-orange-700 hover:underline">
                CSVで保存
              </button>
            </div>
            <div className="space-y-4">
              {weeks.map(([w, days]) => (
                <div key={w} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-stone-700">
                      {formatDate(w)}の週：使用 {sum(days, "uses")}回・初来店 {sum(days, "first_visits")}人
                    </p>
                    <button
                      onClick={() => copyReport(days)}
                      className="shrink-0 text-xs font-bold bg-orange-700 text-white rounded-full px-3 py-1"
                    >
                      店への報告文をコピー
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right tabular-nums">
                      <thead className="text-stone-400">
                        <tr>
                          <th className="text-left font-normal py-1">日付</th>
                          <th className="font-normal">見た</th>
                          <th className="font-normal">受取</th>
                          <th className="font-normal">使用</th>
                          <th className="font-normal">13時台</th>
                          <th className="font-normal">夕方</th>
                          <th className="font-normal">初来店</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((d) => (
                          <tr key={d.date} className="border-t border-stone-100">
                            <td className="text-left py-1">{formatDate(d.date)}</td>
                            <td>{d.views}</td>
                            <td>{d.claims}</td>
                            <td className="font-bold">{d.uses}</td>
                            <td>{d.lunch}</td>
                            <td>{d.evening}</td>
                            <td>{d.first_visits}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
