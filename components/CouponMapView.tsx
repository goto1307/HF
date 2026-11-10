"use client";
import { useState } from "react";
import Link from "next/link";
import CampusMap from "@/components/CampusMap";
import { BenefitCards, CouponConditions, CouponNotes } from "@/components/CouponParts";
import { COUPON_PLACES } from "@/lib/couponPlaces";
import {
  claimOpen,
  formatDateTime,
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold bg-white/15 rounded px-1.5 py-0.5">PR・提携</span>
            {!selected.active && <span className="text-[10px] font-bold bg-[#F2C14E] text-[#1B243A] rounded px-1.5 py-0.5">非公開・運営だけに表示中</span>}
          </div>
          <h1 className="mt-2 text-[30px] leading-tight font-extrabold tracking-tight">{selected.shop_name}</h1>
          <p className="mt-1 text-base font-bold text-[#F2C14E]">{selected.title}</p>
          {status(selected) && (
            <p className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{status(selected)}</p>
          )}

          <h2 className="mt-7 text-xl font-extrabold">どれか1つが無料</h2>
          <p className="mt-1 mb-4 text-sm text-white/70">{selected.description}</p>
          <BenefitCards benefits={selected.benefits} />

          <div className="mt-7">
            <CouponConditions coupon={selected} place={COUPON_PLACES[selected.id]} />
          </div>

          <Link
            href={`/coupons/${selected.id}`}
            className="mt-8 block w-full rounded-full bg-[#BA421D] py-3.5 text-center font-extrabold shadow-[0_3px_0_#1B243A] active:translate-y-[2px] active:shadow-[0_1px_0_#1B243A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 transition-transform"
          >
            {claims[selected.id] ? "クーポンを開く" : claimOpen(selected) ? "クーポンを受け取る" : "クーポンの詳細を見る"}
          </Link>
          <CouponNotes notes={selected.notes} />
        </section>
      )}
    </div>
  );
}
