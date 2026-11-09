"use client";
import { useState } from "react";
import Link from "next/link";
import CampusMap from "@/components/CampusMap";
import { COUPON_PLACES } from "@/lib/couponPlaces";
import {
  claimOpen,
  formatDate,
  formatDateTime,
  formatWeekdays,
  formatWindows,
  hasEnded,
  usableNow,
  type Coupon,
} from "@/lib/coupon";

type MyClaim = { coupon_id: string; used_at: string | null };

// クーポンのページ(運営だけの試作)。北大とお店の位置関係の地図を大きく出し、
// 下に選んだお店のクーポンを出す。お店が1軒でも「ここに行ける」が一目で分かることを優先する。
export default function CouponMapView({ coupons, claims }: { coupons: Coupon[]; claims: Record<string, MyClaim> }) {
  // 地図に場所が登録されているクーポンだけを出す(終わったものは出さない)
  const onMap = coupons.filter((c) => COUPON_PLACES[c.id] && !hasEnded(c));
  const [selectedId, setSelectedId] = useState<string | null>(onMap[0]?.id ?? null);
  const selected = onMap.find((c) => c.id === selectedId) ?? null;

  if (onMap.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-bold text-stone-700">いま使えるクーポンはありません</p>
        <p className="text-sm text-stone-500 mt-2">提携しているお店が決まったら、ここの地図に表示します。</p>
      </div>
    );
  }

  const status = (c: Coupon) => {
    const mine = claims[c.id];
    if (mine?.used_at) return "使用済み";
    if (mine) return usableNow(c) ? "いま使えます" : "受け取り済み";
    if (claimOpen(c)) return null;
    return `${formatDateTime(c.claim_from)}から受け取れます`;
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="relative">
        <CampusMap
          pins={onMap.map((c) => ({ id: c.id, label: c.shop_name, place: COUPON_PLACES[c.id] }))}
          selected={selectedId}
          onSelect={setSelectedId}
        />
        <p className="absolute left-3 bottom-12 text-[10px] text-stone-500 bg-white/80 rounded-full px-2 py-0.5">
          位置関係のイメージです（縮尺は正確ではありません）
        </p>
      </div>

      {selected && (
        <section
          aria-label={`${selected.shop_name}のクーポン`}
          className="relative -mt-8 rounded-t-[28px] bg-[#2F3E5C] text-white px-6 pt-6 pb-10"
        >
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-white/80">
            {selected.shop_name}
            <span className="text-[10px] font-bold bg-white/15 rounded px-1.5 py-0.5">PR・提携</span>
            {!selected.active && <span className="text-[10px] font-bold bg-yellow-300 text-[#1B243A] rounded px-1.5 py-0.5">非公開</span>}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">{selected.title}</h1>
          {status(selected) && (
            <p className="mt-2 inline-block text-xs font-bold rounded-full bg-yellow-300 text-[#1B243A] px-3 py-1">
              {status(selected)}
            </p>
          )}

          <dl className="mt-5 grid grid-cols-[4.5em_1fr] gap-y-2.5 text-sm">
            <dt className="text-white/60">使える日</dt>
            <dd className="font-bold">
              {formatWeekdays(selected.weekdays)}（{formatDate(selected.use_from)}〜{formatDate(selected.use_until)}）
            </dd>
            <dt className="text-white/60">時間</dt>
            <dd className="font-bold">{formatWindows(selected.time_windows)}</dd>
            <dt className="text-white/60">場所</dt>
            <dd className="font-bold">
              {COUPON_PLACES[selected.id].address}
              <span className="block font-normal text-white/75">{COUPON_PLACES[selected.id].access}</span>
            </dd>
          </dl>

          <div className="mt-5">
            <p className="text-sm text-white/75">{selected.description}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {selected.benefits.map((b) => (
                <li key={b} className="rounded-full bg-white text-[#1B243A] text-sm font-bold px-3 py-1.5">{b}</li>
              ))}
            </ul>
          </div>

          <Link
            href={`/coupons/${selected.id}`}
            className="mt-7 block w-full rounded-full bg-[#BA421D] py-3.5 text-center font-extrabold shadow-[0_3px_0_#1B243A] active:translate-y-[2px] active:shadow-[0_1px_0_#1B243A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 transition-transform"
          >
            {claims[selected.id] ? "クーポンを開く" : "クーポンを受け取る"}
          </Link>
          {selected.notes && <p className="mt-4 text-xs leading-relaxed text-white/60">{selected.notes}</p>}
        </section>
      )}
    </div>
  );
}
