"use client";
import Link from "next/link";
import { benefitName, formatDate, formatDateTime, formatTime, formatWindows, hasEnded, usableNow, type Coupon, type CouponClaim } from "@/lib/coupon";

// クーポンボックスの一覧(クーポンボックスのページと、HOKUMA のマイページで使う)。
// 使える順: 使う前で期限内 → 期限切れ → 使用済み
export default function CouponBoxList({ rows, compact = false }: { rows: { claim: CouponClaim; coupon: Coupon }[]; compact?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/25 p-6 text-center">
        <p className="font-bold">まだクーポンがありません</p>
        <p className="mt-1 text-sm text-white/65">地図からお店を選んで、クーポンを受け取りましょう。</p>
        <Link href="/coupons" className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#1B243A]">
          クーポンの地図を見る
        </Link>
      </div>
    );
  }

  const rank = (r: { claim: CouponClaim; coupon: Coupon }) => (r.claim.used_at ? 2 : hasEnded(r.coupon) ? 1 : 0);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || a.coupon.use_until.localeCompare(b.coupon.use_until));

  return (
    <ul className="space-y-3">
      {sorted.map(({ claim, coupon }) => {
        const used = !!claim.used_at;
        const ended = !used && hasEnded(coupon);
        const now = !used && !ended && usableNow(coupon);
        return (
          <li key={claim.id}>
            <Link
              href={`/coupons/${coupon.id}`}
              className={`block rounded-2xl p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E] ${
                used || ended ? "bg-white/5 text-white/55" : "bg-white text-[#1B243A] hover:bg-stone-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs ${used || ended ? "" : "text-stone-500"}`}>{coupon.shop_name}</p>
                  <p className="text-lg font-extrabold leading-tight">{coupon.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    used || ended ? "bg-white/10" : now ? "bg-[#BA421D] text-white" : "bg-[#F2C14E] text-[#1B243A]"
                  }`}
                >
                  {used ? "使用済み" : ended ? "期限切れ" : now ? "いま使えます" : "未使用"}
                </span>
              </div>
              {!compact && (
                <p className={`mt-2 text-xs ${used || ended ? "" : "text-stone-600"}`}>
                  {used
                    ? `${formatDateTime(claim.used_at!)} ${formatTime(claim.used_at!)}に「${benefitName(claim.benefit)}」で使いました`
                    : `${formatDate(coupon.use_until)}まで・${formatWindows(coupon.time_windows)}`}
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
