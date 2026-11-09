"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import {
  COUPON_COLUMNS,
  claimOpen,
  formatDate,
  formatDateTime,
  formatWeekdays,
  formatWindows,
  hasEnded,
  type Coupon,
} from "@/lib/coupon";
import Header from "@/components/Header";
import HokkumaMascot from "@/components/HokkumaMascot";
import CouponMapView from "@/components/CouponMapView";
import { isAdminEmail } from "@/lib/adminEmails";

type MyClaim = { coupon_id: string; used_at: string | null };

// 提携しているお店のクーポンの一覧(migration PART AT)
export default function CouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [claims, setClaims] = useState<Record<string, MyClaim>>({});
  const [loading, setLoading] = useState(true);
  // 地図のページは、いまは運営だけの試作
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const { data } = await supabase.from("coupon").select(COUPON_COLUMNS).order("use_until", { ascending: false });
      setCoupons((data as Coupon[] | null) ?? []);
      if (user) {
        const { data: mine } = await supabase
          .from("coupon_claim")
          .select("coupon_id,used_at")
          .eq("user_id", user.id);
        setClaims(Object.fromEntries(((mine as MyClaim[] | null) ?? []).map((c) => [c.coupon_id, c])));
      }
      setLoading(false);
    })();
  }, [authLoading, user]);

  const status = (c: Coupon) => {
    const mine = claims[c.id];
    if (mine?.used_at) return { label: "使用済み", tone: "bg-stone-200 text-stone-600" };
    if (hasEnded(c)) return { label: "終了", tone: "bg-stone-200 text-stone-500" };
    if (mine) return { label: "受け取り済み", tone: "bg-orange-100 text-orange-800" };
    if (claimOpen(c)) return { label: "受け取れます", tone: "bg-yellow-200 text-yellow-900" };
    return { label: `${formatDateTime(c.claim_from)}から`, tone: "bg-stone-100 text-stone-600" };
  };

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#EEF2F5]">
        <Header section="coupons" />
        {loading ? (
          <div className="max-w-md mx-auto aspect-[9/11] bg-[#E3E9EE] animate-pulse" />
        ) : (
          <CouponMapView coupons={coupons} claims={claims} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <div className="max-w-md mx-auto p-4 pb-24">
        <h1 className="text-xl font-black text-stone-800">クーポン</h1>
        <p className="text-sm text-stone-500 mt-1">
          HOKUMA と提携している北大周辺のお店で使えるクーポンです。
        </p>

        {loading ? (
          <div className="mt-4 h-32 rounded-2xl bg-stone-100 animate-pulse" />
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <HokkumaMascot size={88} className="mb-3 opacity-90" />
            <p className="text-stone-400 text-sm">いま配布中のクーポンはありません</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {coupons.map((c) => {
              const s = status(c);
              return (
                <Link
                  key={c.id}
                  href={`/coupons/${c.id}`}
                  className={`block rounded-2xl bg-white border border-stone-200 shadow-sm p-4 hover:shadow-md transition-shadow ${
                    hasEnded(c) ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-stone-100 text-stone-500 rounded px-1.5 py-0.5">PR・提携</span>
                    <span className="text-sm font-bold text-stone-700">{c.shop_name}</span>
                    {!c.active && <span className="text-[10px] font-bold bg-stone-800 text-white rounded px-1.5 py-0.5">非公開</span>}
                    <span className={`ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 ${s.tone}`}>{s.label}</span>
                  </div>
                  <p className="text-lg font-black text-orange-700 mt-1">{c.title}</p>
                  <p className="text-sm text-stone-700">{c.description}</p>
                  <p className="text-sm font-bold text-stone-800">{c.benefits.join("／")}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {formatDate(c.use_from)}〜{formatDate(c.use_until)}・{formatWeekdays(c.weekdays)}・{formatWindows(c.time_windows)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
