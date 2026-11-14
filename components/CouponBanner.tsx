"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COUPON_COLUMNS, claimOpen, hasEnded, type Coupon } from "@/lib/coupon";

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

  return (
    <Link
      href={`/coupons/${coupon.id}`}
      className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#B0306A] to-[#7A3393] text-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <span className="shrink-0 text-[10px] font-bold bg-white/25 rounded px-1.5 py-0.5">
        {coupon.active ? "PR・提携" : "非公開"}
      </span>
      <span className="min-w-0 flex-1">
        {/* 特典を全部並べると見切れるので、短く「店名 クーポン配布中」だけにする */}
        <span className="block text-sm font-black truncate">
          {coupon.shop_name}　クーポン配布中
        </span>
      </span>
      <span className="shrink-0 text-xs font-bold bg-white text-[#7A3393] rounded-full px-3 py-1">見る</span>
    </Link>
  );
}
