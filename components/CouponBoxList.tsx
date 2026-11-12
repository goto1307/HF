"use client";
import Link from "next/link";
import { benefitName, formatDate, formatDateTime, formatTime, formatWindows, hasEnded, usableNow, usedUp, type Coupon, type CouponClaim } from "@/lib/coupon";

// クーポンボックスの一覧(クーポンボックスのページと、HOKUMA のマイページで使う)。
// 使える順: まだ使えて期限内 → 期限切れ → 使用済み(使える回数を使い切ったもの)
// theme: "light" は白地のページ(クーポンボックス)、"dark" は紺のページ(マイページ)に置くとき
export default function CouponBoxList({
  rows,
  compact = false,
  theme = "dark",
}: {
  rows: { claim: CouponClaim; coupon: Coupon }[];
  compact?: boolean;
  theme?: "light" | "dark";
}) {
  const light = theme === "light";
  if (rows.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed p-6 text-center ${light ? "border-stone-300" : "border-white/25"}`}>
        <p className="font-bold">まだクーポンがありません</p>
        <p className={`mt-1 text-sm ${light ? "text-[#2F3E5C]/70" : "text-white/80"}`}>地図からお店を選んで、クーポンを受け取りましょう。</p>
        <Link
          href="/coupons"
          className={`mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-extrabold ${light ? "bg-[#BA421D] text-white" : "bg-white text-[#1B243A]"}`}
        >
          クーポンを見る
        </Link>
      </div>
    );
  }

  const rank = (r: { claim: CouponClaim; coupon: Coupon }) => (usedUp(r.coupon, r.claim) ? 2 : hasEnded(r.coupon) ? 1 : 0);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || a.coupon.use_until.localeCompare(b.coupon.use_until));

  return (
    <ul className="space-y-3">
      {sorted.map(({ claim, coupon }) => {
        const used = usedUp(coupon, claim);
        const ended = !used && hasEnded(coupon);
        const now = !used && !ended && usableNow(coupon);
        return (
          <li key={claim.id}>
            <Link
              href={`/coupons/${coupon.id}`}
              className={`block rounded-2xl p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E] ${
                used || ended
                  ? light ? "bg-stone-100 text-[#2F3E5C]/55" : "bg-black/10 text-white/80"
                  : light ? "border border-stone-200 bg-white text-[#2F3E5C] shadow-sm hover:bg-stone-50" : "bg-white text-[#1B243A] hover:bg-stone-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs ${used || ended ? "" : "text-stone-500"}`}>{coupon.shop_name}</p>
                  <p className="text-lg font-extrabold leading-tight">{coupon.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    used || ended ? (light ? "bg-stone-200" : "bg-white/10") : now ? "bg-[#BA421D] text-white" : "bg-[#F2C14E] text-[#1B243A]"
                  }`}
                >
                  {used ? "使用済み" : ended ? "期限切れ" : now ? "いま使えます" : claim.use_count > 0 ? `${claim.use_count}回使用` : "未使用"}
                </span>
              </div>
              {!compact && (
                <p className={`mt-2 text-xs ${used || ended ? "" : "text-stone-600"}`}>
                  {used
                    ? `${formatDateTime(claim.used_at!)} ${formatTime(claim.used_at!)}に「${benefitName(claim.benefit)}」で使いました`
                    : `${formatDate(coupon.use_until)}まで・${formatWindows(coupon.time_windows)}${
                        claim.used_at ? `（前回 ${formatDateTime(claim.used_at)}「${benefitName(claim.benefit)}」）` : ""
                      }`}
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
