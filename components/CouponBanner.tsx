"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COUPON_COLUMNS, claimOpen, formatDate, formatWindows, hasEnded, type Coupon } from "@/lib/coupon";
import { shopForCoupon } from "@/lib/shops";
import { IconX } from "@/components/icons";

// 閉じた(小さくした)かを、ブラウザごとに覚えておく
const CLOSED_KEY = "hokuma-coupon-banner-closed";

function readClosed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

function ChevronUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

// トップページの商品一覧の上に出す、配布中のクーポンのお知らせ(migration PART AT)。
// 受け取れる期間のクーポンがないときは何も出さない。広告なので「PR・提携」と必ず表示する。
// 右上のボタンで細い帯に閉じられ、帯の「^」を押すとまた開く
export default function CouponBanner() {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [closed, setClosed] = useState(readClosed);

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

  const toggle = (next: boolean) => {
    setClosed(next);
    try {
      if (next) localStorage.setItem(CLOSED_KEY, "1");
      else localStorage.removeItem(CLOSED_KEY);
    } catch {
      // 覚えられなくても、この画面では開け閉めできる
    }
  };

  if (!coupon) return null;
  const shop = shopForCoupon(coupon.id);
  const label = coupon.active ? "PR・提携" : "非公開";

  if (closed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        className="mb-3 w-full flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B0306A] to-[#7A3393] text-white pl-3 pr-2 py-1.5 text-left shadow-sm"
        aria-label="クーポンのお知らせを開く"
      >
        <span className="shrink-0 text-[10px] font-bold bg-white/25 rounded px-1.5 py-0.5">{label}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-black">{coupon.shop_name}　クーポン配布中</span>
        <span className="shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
          <ChevronUp />
        </span>
      </button>
    );
  }

  return (
    <div className="relative mb-3">
      <Link
        // 押すと、いきなり使う画面ではなく、クーポンとお店の詳細(クーポンの地図の画面)を開く
        href={`/coupons?shop=${shop?.id ?? ""}`}
        className="flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#B0306A] to-[#7A3393] text-white pl-4 pr-10 py-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">{coupon.shop_name}　クーポン配布中</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/85">
            <span className="shrink-0 text-[10px] font-bold bg-white/25 text-white rounded px-1.5 py-0.5">{label}</span>
            <span className="truncate">
              {formatDate(coupon.use_from)}〜{formatDate(coupon.use_until)}・{formatWindows(coupon.time_windows)}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold bg-white text-[#7A3393] rounded-full px-3 py-1">見る</span>
      </Link>
      <button
        type="button"
        onClick={() => toggle(true)}
        className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
        aria-label="クーポンのお知らせを閉じる"
      >
        <IconX size={16} />
      </button>
    </div>
  );
}
