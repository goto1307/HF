"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COUPON_COLUMNS, claimOpen, type Coupon } from "@/lib/coupon";

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
        const open = ((data as Coupon[] | null) ?? []).find((c) => claimOpen(c));
        setCoupon(open ?? null);
      });
  }, []);

  if (!coupon) return null;

  return (
    <Link
      href={`/coupons/${coupon.id}`}
      className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <span className="shrink-0 text-[10px] font-bold bg-white/25 rounded px-1.5 py-0.5">PR・提携</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs opacity-90">{coupon.shop_name}</span>
        <span className="block text-sm font-black truncate">
          {coupon.title}：{coupon.benefits.join("／")}
        </span>
      </span>
      <span className="shrink-0 text-xs font-bold bg-white text-orange-700 rounded-full px-3 py-1">受け取る</span>
    </Link>
  );
}
