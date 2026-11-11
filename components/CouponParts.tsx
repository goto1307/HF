"use client";
// クーポンの画面(地図のシート・クーポンの詳細ページ)で共通に使う部品。
// 白地に、文字は紺 #2F3E5C(ブランドの色)、差し色は朱 #BA421D

import { formatDate, formatWeekdays, formatWindows, parseBenefit, type Coupon } from "@/lib/coupon";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden {...stroke}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden {...stroke}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

// 使える日・時間・場所を、アイコン付きの行で並べる
export function CouponConditions({ coupon, place }: { coupon: Coupon; place?: { address: string; access: string } }) {
  const rows = [
    { icon: <IconCalendar />, label: "使える日", main: formatWeekdays(coupon.weekdays), sub: `${formatDate(coupon.use_from)}〜${formatDate(coupon.use_until)}` },
    { icon: <IconClock />, label: "時間", main: formatWindows(coupon.time_windows), sub: null },
    ...(place ? [{ icon: <IconPin />, label: "場所", main: place.address, sub: place.access }] : []),
  ];
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#BA421D]/10 text-[#BA421D]">{r.icon}</span>
          <span className="min-w-0">
            <span className="sr-only">{r.label}：</span>
            <span className="block text-[15px] font-bold leading-snug">{r.main}</span>
            {r.sub && <span className="block text-xs text-[#2F3E5C]/70 mt-0.5">{r.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// 特典のカード。selectable のときは1つ選べる(お店で使うとき)。そうでなければ見るだけ
export function BenefitCards({
  benefits,
  selected = null,
  onSelect,
}: {
  benefits: string[];
  selected?: string | null;
  onSelect?: (raw: string) => void;
}) {
  const items = benefits.map(parseBenefit);
  const cautions = items.filter((b) => b.caution);
  return (
    <div>
      <ul className={`grid gap-2.5 ${items.length >= 4 ? "grid-cols-2" : "grid-cols-1"}`} role={onSelect ? "radiogroup" : undefined} aria-label="特典">
        {items.map((b) => {
          const active = selected === b.raw;
          const body = (
            <>
              <span className="block text-[15px] font-extrabold leading-snug">{b.name}</span>
              {b.detail && <span className="block mt-1 text-xs leading-snug text-[#2F3E5C]/75">{b.detail}</span>}
              {b.caution && <span className="mt-1.5 inline-block text-[10px] font-bold rounded px-1.5 py-0.5 bg-[#F2C14E] text-[#1B243A]">注意あり</span>}
            </>
          );
          const base = "block h-full min-h-[64px] w-full rounded-2xl px-4 py-3 text-left transition-colors";
          return (
            <li key={b.raw}>
              {onSelect ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(b.raw)}
                  className={`${base} border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA421D] ${
                    active ? "border-[#BA421D] bg-[#BA421D]/[0.07] shadow-[inset_0_0_0_1px_#BA421D]" : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  {body}
                </button>
              ) : (
                <div className={`${base} border border-stone-200 bg-stone-50`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {/* 注意書きのある特典(パルプンテなど)は、特典のすぐ下に出す */}
      {cautions.map((b) => (
        <p key={b.raw} className="mt-3 flex gap-2 rounded-xl bg-[#F2C14E]/20 border border-[#F2C14E] px-3 py-2.5 text-xs leading-relaxed text-[#1B243A]">
          <span aria-hidden className="font-extrabold text-[#BA421D]">!</span>
          <span><span className="font-bold">{b.name}：</span>{b.caution}</span>
        </p>
      ))}
    </div>
  );
}

// 対象外・1回限りなどの注意書き。区切り線のあとに小さく出す
export function CouponNotes({ notes }: { notes: string }) {
  if (!notes) return null;
  return (
    <div className="mt-8 border-t border-stone-200 pt-4">
      <p className="text-xs leading-relaxed text-[#2F3E5C]/70">{notes}</p>
    </div>
  );
}
