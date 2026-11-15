"use client";
// クーポンの画面(地図のシート・クーポンの詳細ページ)で共通に使う部品。
// 白地に、文字は紺 #2F3E5C(ブランドの色)、差し色は朱 #BA421D

import { PHOTO_NO } from "@/lib/shops";
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

// 特典の一覧。枠で囲まず「名前 → 説明 → 写真」の順にシンプルに並べる。
// selectable(onSelect あり)のときは1つ選べる(お店で使うとき。左の丸で選んだものがわかる)。
// size: "large" はクーポンのページ(写真を横幅いっぱい)、"small" は地図のシート(写真を小さく、2列)
export function BenefitCards({
  benefits,
  selected = null,
  onSelect,
  photos = {},
  isAdmin = false,
  size = "large",
}: {
  benefits: string[];
  selected?: string | null;
  onSelect?: (raw: string) => void;
  photos?: Record<string, string>; // 特典の名前 → 写真(lib/shops.ts の benefitPhotos)
  isAdmin?: boolean; // 写真がまだないとき、運営にだけ空き枠を出す
  size?: "large" | "small";
}) {
  const items = benefits.map(parseBenefit);
  const cautions = items.filter((b) => b.caution);
  const small = size === "small";

  // 選ぶとき(クーポンのページで使う直前): 1行ずつのリスト。左に写真、真ん中に名前と説明、右に丸。
  // 縦に長くならず、下まで探しに行かなくて済むようにする
  if (onSelect) {
    return (
      <div>
        <ul className="space-y-2.5" role="radiogroup" aria-label="特典">
          {items.map((b, i) => {
            const active = selected === b.raw;
            const hasPhoto = !!photos[b.name] || isAdmin;
            return (
              <li key={b.raw}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(b.raw)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA421D] ${
                    active ? "border-[#BA421D] bg-[#BA421D]/[0.06]" : "border-stone-200 bg-white"
                  }`}
                >
                  {hasPhoto && (
                    <span className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl">
                      <PhotoSlot src={photos[b.name]} alt="" isAdmin={isAdmin} no={PHOTO_NO.benefitFrom + i} label="" className="h-full" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block text-base font-extrabold leading-snug ${active ? "text-[#BA421D]" : ""}`}>{b.name}</span>
                    {b.detail && <span className="mt-0.5 block text-xs leading-snug text-[#2F3E5C]/75">{b.detail}</span>}
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[#BA421D]" : "border-stone-300"}`}
                  >
                    {active && <span className="h-3 w-3 rounded-full bg-[#BA421D]" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {cautions.map((b) => (
          <p key={b.raw} className="mt-3 flex gap-2 rounded-xl bg-[#F2C14E]/20 px-3 py-2.5 text-xs leading-relaxed text-[#1B243A]">
            <span aria-hidden className="font-extrabold text-[#BA421D]">!</span>
            <span><span className="font-bold">{b.name}：</span>{b.caution}</span>
          </p>
        ))}
      </div>
    );
  }

  // 見るだけのとき(特典の紹介): 名前 → 写真 → 説明 の順。あくまで説明なので控えめの大きさ
  return (
    <div>
      <ul className={small ? "grid grid-cols-2 gap-x-3 gap-y-5" : "grid grid-cols-2 gap-x-4 gap-y-6"} aria-label="特典">
        {items.map((b, i) => {
          const hasPhoto = !!photos[b.name] || isAdmin;
          return (
            <li key={b.raw}>
              <span className={`block font-extrabold leading-snug ${small ? "text-sm" : "text-[15px]"}`}>{b.name}</span>
              {hasPhoto && (
                <PhotoSlot src={photos[b.name]} alt={b.name} isAdmin={isAdmin} no={PHOTO_NO.benefitFrom + i} className="mt-1.5 aspect-[4/3] rounded-xl" />
              )}
              {b.detail && <span className="mt-1.5 block text-xs leading-snug text-[#2F3E5C]/75">{b.detail}</span>}
            </li>
          );
        })}
      </ul>
      {/* 注意書きのある特典(店主のおまかせ一品など)は、特典のすぐ下に出す */}
      {cautions.map((b) => (
        <p key={b.raw} className="mt-4 flex gap-2 rounded-xl bg-[#F2C14E]/20 px-3 py-2.5 text-xs leading-relaxed text-[#1B243A]">
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
  cta,
}: {
  coupon: Coupon;
  tone?: "dark" | "light";
  titleHref?: string;
  cta?: React.ReactNode;
  titleImage?: string; // light のとき、クーポン名の代わりに出す画像(lib/shops.ts の couponImage)
  isAdmin?: boolean;
}) {
  const period = `${formatDateLong(coupon.use_from)}〜${formatDateLong(coupon.use_until)}`;
  if (tone === "light") {
    // 10番の画像の枠はやめて、「空きコマクーポン配布中」のバナーにする(受け取るボタンの朱色と見分けるため紺)
    const title = (
      <span className="-mx-6 -mt-5 flex items-center justify-between gap-3 bg-[#2F3E5C] px-6 py-4 text-white">
        <span className="text-[24px] leading-tight font-black tracking-tight">{coupon.title}</span>
        <span className="shrink-0 rounded-full bg-[#F2C14E] px-3 py-1 text-sm font-extrabold text-[#1B243A]">配布中</span>
      </span>
    );
    return (
      <div>
        {/* バナーは押しても移動しない(シートの幅いっぱいに、角なしで出す) */}
        <h2>{title}</h2>
        {cta && <div className="mt-3">{cta}</div>}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="whitespace-nowrap font-bold text-[#2F3E5C]/60">使える時間</dt>
          <dd className="font-extrabold tabular-nums">{formatWindows(coupon.time_windows)}</dd>
          <dt className="whitespace-nowrap font-bold text-[#2F3E5C]/60">使える日</dt>
          <dd className="font-extrabold">{formatWeekdays(coupon.weekdays)}<span className="block font-bold text-[#2F3E5C]/75">{period}</span></dd>
        </dl>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-[32px] leading-[1.15] font-black tracking-tight text-white">{coupon.title}</h1>
      <div className="mt-3 inline-block rounded-xl bg-white px-3 py-2 text-[#1B243A]">
        <p className="text-[11px] font-bold text-[#BA421D]">使える時間</p>
        <p className="text-lg font-black tabular-nums leading-tight">{formatWindows(coupon.time_windows)}</p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-sm font-extrabold text-white">{formatWeekdays(coupon.weekdays)}</p>
        {/* 期限は右下に小さく */}
        <p className="text-right text-[11px] font-bold text-white/80">{period}</p>
      </div>
    </div>
  );
}

// 写真を入れる枠。写真がまだないときは、運営にだけ「ここに写真が入ります」と出す(利用者には何も出さない)
export function PhotoSlot({
  src,
  alt,
  isAdmin,
  className = "",
  label = "写真が入ります",
  no,
  position,
  eager = false,
}: {
  src?: string;
  alt: string;
  isAdmin: boolean;
  className?: string;
  label?: string; // 空き枠に出す文字
  no?: number; // 空き枠に出す番号(lib/shops.ts の PHOTO_NO)
  position?: string; // 写真のどこを見せるか(object-position)
  eager?: boolean; // true: すぐ読み込む(画面のいちばん上の写真)。false: 画面に近づいてから読み込む
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" style={position ? { objectPosition: position } : undefined} className={`block w-full object-cover ${className}`} />;
  }
  if (!isAdmin) return null;
  return (
    <div className={`flex w-full flex-col items-center justify-center border-2 border-dashed border-[#2F3E5C]/25 bg-stone-50 text-center text-xs font-bold text-[#2F3E5C]/50 ${className}`}>
      {no !== undefined && <span className="text-3xl font-black leading-none text-[#BA421D]">{no}</span>}
      <span className={no !== undefined ? "mt-1" : ""}>{label}</span>
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

// クーポンを受け取った直後に出すお知らせ。受け取ってすぐ使う画面には移らず、
// 「お店で注文するときに使うボタンを押してね」と伝える(家で特典を選んで押してしまわないように)
export function ClaimedDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claimed-title"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-[#1B243A] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p id="claimed-title" className="text-xl font-extrabold">クーポンを受け取りました</p>
        <p className="mt-2 text-sm leading-relaxed text-[#2F3E5C]/80">{message}</p>
        <button
          autoFocus
          onClick={onClose}
          className="mt-5 block w-full rounded-full bg-[#BA421D] py-3.5 font-extrabold text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}
