"use client";
// クーポンの画面(地図のシート・クーポンの詳細ページ)で共通に使う部品。
// 白地に、文字は紺 #2F3E5C(ブランドの色)、差し色は朱 #BA421D

import Link from "next/link";
import { formatDate, formatDateLong, formatDateTime, formatWeekdays, formatWindows, parseBenefit, type Coupon } from "@/lib/coupon";

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
// いつから配られて、いつまで使えるか。特典より先に、いちばん上で見せる
// started: 配布が始まっているか(時刻は呼び出し側で決める)
export function CouponPeriod({ coupon, started, ended = false }: { coupon: Coupon; started: boolean; ended?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#BA421D]/10 px-3.5 py-2.5 text-sm font-bold text-[#BA421D]">
      <span>{ended ? "終了しました" : started ? "配布中" : `${formatDateTime(coupon.claim_from)}から配布`}</span>
      <span aria-hidden className="text-[#BA421D]/40">｜</span>
      <span>{formatDate(coupon.use_until)}まで使える</span>
    </p>
  );
}

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
  photos = {},
  isAdmin = false,
}: {
  benefits: string[];
  selected?: string | null;
  onSelect?: (raw: string) => void;
  photos?: Record<string, string>; // 特典の名前 → 写真(lib/shops.ts の benefitPhotos)
  isAdmin?: boolean; // 写真がまだないとき、運営にだけ空き枠を出す
}) {
  const withPhotos = Object.keys(photos).length > 0 || isAdmin;
  const items = benefits.map(parseBenefit);
  const cautions = items.filter((b) => b.caution);
  return (
    <div>
      <ul className={`grid gap-2.5 ${items.length >= 4 ? "grid-cols-2" : "grid-cols-1"}`} role={onSelect ? "radiogroup" : undefined} aria-label="特典">
        {items.map((b) => {
          const active = selected === b.raw;
          const body = (
            <>
              {/* 特典の写真(写真の下に名前と説明) */}
              {withPhotos && (
                <PhotoSlot src={photos[b.name]} alt={b.name} isAdmin={isAdmin} className="mb-2 aspect-[4/3] rounded-xl" />
              )}
              <span className={`block ${withPhotos ? "px-1.5" : ""}`}>
                <span className="block text-[15px] font-extrabold leading-snug">{b.name}</span>
                {b.detail && <span className="block mt-1 text-xs leading-snug text-[#2F3E5C]/75">{b.detail}</span>}
                {b.caution && <span className="mt-1.5 inline-block text-[10px] font-bold rounded px-1.5 py-0.5 bg-[#F2C14E] text-[#1B243A]">注意あり</span>}
              </span>
            </>
          );
          const base = `block h-full min-h-[64px] w-full rounded-2xl text-left transition-colors ${withPhotos ? "p-2 pb-3" : "px-4 py-3"}`;
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

// クーポンのいちばん上に置く見出し(クーポン名・使える時間・曜日と期間)。
// tone: "dark" は朱色の背景の上(クーポンのページ。時間を大きく強調)、
//       "light" は白地の上(地図のシート。クーポン名を朱色の帯に白抜き、時間はふつうの大きさ)
// titleHref: クーポン名を押したときに開くページ。cta: クーポン名のすぐ下に置くボタン
export function CouponHeadline({
  coupon,
  tone = "dark",
  titleHref,
  cta,
}: {
  coupon: Coupon;
  tone?: "dark" | "light";
  titleHref?: string;
  cta?: React.ReactNode;
}) {
  const period = `${formatDateLong(coupon.use_from)}〜${formatDateLong(coupon.use_until)}`;
  if (tone === "light") {
    const title = <span className="block rounded-xl bg-[#BA421D] px-4 py-3 text-[28px] leading-tight font-black tracking-tight text-white">{coupon.title}</span>;
    return (
      <div>
        {titleHref ? <Link href={titleHref} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA421D] rounded-xl">{title}</Link> : <h2>{title}</h2>}
        {cta && <div className="mt-3">{cta}</div>}
        <dl className="mt-4 grid grid-cols-[4.5em_1fr] gap-y-1.5 text-sm">
          <dt className="font-bold text-[#2F3E5C]/60">使える時間</dt>
          <dd className="font-extrabold tabular-nums">{formatWindows(coupon.time_windows)}</dd>
          <dt className="font-bold text-[#2F3E5C]/60">使える日</dt>
          <dd className="font-extrabold">{formatWeekdays(coupon.weekdays)}<span className="block font-bold text-[#2F3E5C]/75">{period}</span></dd>
        </dl>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-[40px] leading-[1.1] font-black tracking-tight text-white">{coupon.title}</h1>
      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-[#1B243A]">
        <p className="text-xs font-bold text-[#BA421D]">使える時間</p>
        {coupon.time_windows.length === 0 ? (
          <p className="text-3xl font-black">営業時間中</p>
        ) : (
          <ul className="mt-0.5">
            {coupon.time_windows.map((w) => (
              <li key={w.from} className="text-[34px] leading-tight font-black tabular-nums tracking-tight">
                {w.from}<span className="mx-1 text-2xl">〜</span>{w.to}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-lg font-extrabold text-white">{formatWeekdays(coupon.weekdays)}</p>
      <p className="text-sm font-bold text-white/85">{period}</p>
    </div>
  );
}

// 写真を入れる枠。写真がまだないときは、運営にだけ「ここに写真が入ります」と出す(利用者には何も出さない)
export function PhotoSlot({ src, alt, isAdmin, className = "" }: { src?: string; alt: string; isAdmin: boolean; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`block w-full object-cover ${className}`} />;
  }
  if (!isAdmin) return null;
  return (
    <div className={`flex w-full flex-col items-center justify-center border-2 border-dashed border-[#2F3E5C]/25 bg-stone-50 text-center text-xs font-bold text-[#2F3E5C]/50 ${className}`}>
      <span>写真が入ります</span>
      <span className="mt-0.5 font-normal">（運営だけに表示）</span>
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
