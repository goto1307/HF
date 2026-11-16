"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COUPON_COLUMNS, claimOpen, formatDate, formatWindows, hasEnded, type Coupon } from "@/lib/coupon";
import { shopForCoupon } from "@/lib/shops";

// トップページの商品一覧の上に出す、配布中のクーポンのお知らせ(migration PART AT)。
// 受け取れる期間のクーポンがないときは何も出さない。広告なので「PR・提携」と必ず表示する
export default function CouponBanner() {
  const [coupon, setCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    supabase
      .from("coupon")
      .select(COUPON_COLUMNS)
      .order("use_until")
      .then(({ data }) => {
        // 非公開のクーポンは運営にしか届かないので、動作確認のため受け取り開始前でも出す
        const open = ((data as Coupon[] | null) ?? []).find((c) => claimOpen(c) || (!c.active && !hasEnded(c)));
        setCoupon(open ?? null);
      });
  }, []);

  if (!coupon) return null;
  const shop = shopForCoupon(coupon.id);

  return (
    <Link
      // 押すと、いきなり使う画面ではなく、クーポンとお店の詳細(クーポンの地図の画面)を開く
      href={`/coupons?shop=${shop?.id ?? ""}`}
      className="relative mb-4 flex items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-[#B0306A] to-[#7A3393] text-white pl-5 pr-3 py-4 sm:py-5 shadow-md hover:shadow-lg transition-shadow"
    >
      <span className="min-w-0 flex-1">
        <span className="inline-block text-[10px] font-bold bg-white/25 rounded px-1.5 py-0.5">
          {coupon.active ? "PR・提携" : "非公開"}
        </span>
        <span className="mt-1.5 block text-lg sm:text-xl font-black leading-snug">
          {coupon.shop_name}
          <br />
          クーポン配布中
        </span>
        <span className="mt-1 block text-xs text-white/85">
          {formatDate(coupon.use_from)}〜{formatDate(coupon.use_until)}・{formatWindows(coupon.time_windows)}
        </span>
        <span className="mt-2.5 inline-block text-sm font-bold bg-white text-[#7A3393] rounded-full px-4 py-1.5">
          クーポンを見る →
        </span>
      </span>
      {shop?.illustration && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.illustration} alt="" className="shrink-0 w-28 sm:w-36 h-auto -mb-4 sm:-mb-5 self-end" />
      )}
    </Link>
  );
}
