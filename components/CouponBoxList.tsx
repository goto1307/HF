"use client";
import Link from "next/link";
import { benefitName, formatDate, formatDateTime, formatTime, formatWindows, hasEnded, usableNow, usedUp, type Coupon, type CouponClaim } from "@/lib/coupon";
import { shopForCoupon } from "@/lib/shops";
import { PhotoSlot } from "@/components/CouponParts";

// クーポンボックスの一覧(クーポンボックスのページと、HOKUMA のマイページで使う)。
// 使える順: まだ使えて期限内 → 期限切れ → 使用済み(使える回数を使い切ったもの)
// claim が null の行は「まだ受け取っていない配布中のクーポン」。右の小さい札が「受け取る」ボタンになる。
// 受け取ったあとの行は、押すとクーポンを使う画面へ移る
// theme: "light" は白地のページ(クーポンボックス)、"dark" は紺のページ(マイページ)に置くとき
// 左に正方形でお店のロゴを出す(lib/shops.ts の logo)。ロゴがまだないときは、運営には「ロゴが入ります」の空き枠、
// 利用者にはお店の名前の1文字目を出す
export default function CouponBoxList({
  rows,
  compact = false,
  theme = "dark",
  isAdmin = false,
  onClaim,
  busyId = null,
}: {
  rows: { claim: CouponClaim | null; coupon: Coupon }[];
  compact?: boolean;
  theme?: "light" | "dark";
  isAdmin?: boolean;
  onClaim?: (couponId: string) => void; // 「受け取る」を押したとき
  busyId?: string | null; // 受け取り中のクーポン
}) {
  const light = theme === "light";
  if (rows.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed p-6 text-center ${light ? "border-stone-300" : "border-white/25"}`}>
        <p className="font-bold">まだクーポンがありません</p>
        <p className={`mt-1 text-sm ${light ? "text-[#2F3E5C]/70" : "text-white/80"}`}>配布中のクーポンが出ると、ここで受け取れます。</p>
        <Link
          href="/coupons"
          className={`mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-extrabold ${light ? "bg-[#BA421D] text-white" : "bg-white text-[#1B243A]"}`}
        >
          クーポンを見る
        </Link>
      </div>
    );
  }

  const rank = (r: { claim: CouponClaim | null; coupon: Coupon }) => (usedUp(r.coupon, r.claim) ? 2 : hasEnded(r.coupon) ? 1 : 0);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || a.coupon.use_until.localeCompare(b.coupon.use_until));

  return (
    <ul className="space-y-3">
      {sorted.map(({ claim, coupon }) => {
        const used = usedUp(coupon, claim);
        const ended = !used && hasEnded(coupon);
        const now = !used && !ended && usableNow(coupon);
        const logo = shopForCoupon(coupon.id)?.logo;
        return (
          <li key={coupon.id}>
            <Wrap
              href={claim ? `/coupons/${coupon.id}` : null}
              className={`block rounded-2xl p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E] ${
                used || ended
                  ? light ? "bg-stone-100 text-[#2F3E5C]/55" : "bg-black/10 text-white/80"
                  : light ? "border border-stone-200 bg-white text-[#2F3E5C] shadow-sm hover:bg-stone-50" : "bg-white text-[#1B243A] hover:bg-stone-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* お店のロゴ(正方形) */}
                <div className={`shrink-0 overflow-hidden rounded-xl ${compact ? "h-14 w-14" : "h-20 w-20"} ${used || ended ? "opacity-60" : ""}`}>
                  {logo || isAdmin ? (
                    <PhotoSlot src={logo} alt={`${coupon.shop_name}のロゴ`} isAdmin={isAdmin} label="ロゴ" className="h-full rounded-xl object-contain bg-white" />
                  ) : (
                    <span aria-hidden className="flex h-full w-full items-center justify-center bg-[#BA421D]/10 text-2xl font-black text-[#BA421D]">
                      {coupon.shop_name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs ${used || ended ? "" : "text-stone-500"}`}>{coupon.shop_name}</p>
                      <p className="text-lg font-extrabold leading-tight">{coupon.title}</p>
                    </div>
                    {!claim ? (
                      // まだ受け取っていない: 小さい札が「受け取る」ボタン
                      <button
                        type="button"
                        onClick={() => onClaim?.(coupon.id)}
                        disabled={busyId === coupon.id}
                        className="shrink-0 rounded-lg bg-[#BA421D] px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
                      >
                        {busyId === coupon.id ? "受け取り中..." : "受け取る"}
                      </button>
                    ) : (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        used || ended ? (light ? "bg-stone-200" : "bg-white/10") : now ? "bg-[#BA421D] text-white" : "bg-[#F2C14E] text-[#1B243A]"
                      }`}
                    >
                      {used ? "使用済み" : ended ? "期限切れ" : now ? "いま使えます" : claim.use_count > 0 ? `${claim.use_count}回使用` : "未使用"}
                    </span>
                    )}
                  </div>
                  {!compact && (
                    <p className={`mt-2 text-xs ${used || ended ? "" : "text-stone-600"}`}>
                      {used && claim
                        ? `${formatDateTime(claim.used_at!)} ${formatTime(claim.used_at!)}に「${benefitName(claim.benefit)}」で使いました`
                        : `${formatDate(coupon.use_until)}まで・${formatWindows(coupon.time_windows)}${
                            claim?.used_at ? `（前回 ${formatDateTime(claim.used_at)}「${benefitName(claim.benefit)}」）` : ""
                          }`}
                    </p>
                  )}
                </div>
              </div>
            </Wrap>
          </li>
        );
      })}
    </ul>
  );
}

// 受け取ったクーポンはリンク(押すと使う画面へ)、まだのものはただの箱(中の「受け取る」だけ押せる)
function Wrap({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
