"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { claimOpen, formatDateTime, hasEnded, usedUp, type Coupon, type CouponClaim } from "@/lib/coupon";
import { PHOTO_NO, SHOPS, type Shop } from "@/lib/shops";
import { recordCouponView } from "@/lib/couponView";
import { rememberSource } from "@/lib/visitSource";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";
import { BenefitCards, ClaimedDialog, CouponHeadline, CouponNotes, PhotoSlot } from "@/components/CouponParts";
import { IconX } from "@/components/icons";

// 地図はブラウザでだけ動くので、サーバーでは描かない
const ShopMap = dynamic(() => import("@/components/ShopMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#EEF2F5] animate-pulse" />,
});

export type MyClaim = Pick<CouponClaim, "coupon_id" | "used_at" | "use_count">;

type Props = {
  coupons: Coupon[];
  claims: Record<string, MyClaim>;
  onClaimed: (claim: MyClaim) => void;
  loggedIn: boolean;
  isAdmin: boolean;
};

const SHEET_RATIO = 0.72; // シートの高さ(地図の高さに対する割合)。max-h-[72%] と合わせる
// パソコンなど横に広い画面(md = 幅768px以上)では、シートを下からではなく、
// Googleマップのように左端に上から下までの縦長のパネルで出す。
// 幅は下の md:w-[400px] と合わせる(地図をずらす量に使う)
const PANEL_WIDTH = 400;
const WIDE_QUERY = "(min-width: 768px)";
function subscribeWide(cb: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
// 横に広い画面かどうか(サーバーで描くときはスマホとして扱う)
function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

function errorMessage(e: { message?: string } | null) {
  const m = e?.message ?? "";
  return /[ぁ-んァ-ン一-龥]/.test(m) ? m : "うまくいきませんでした。時間をおいてもう一度お試しください。";
}

// クーポンのページ(運営だけの試作)。指で動かせる地図に、クーポンが使えるお店のピンを出す。
// ピンを押すと、下からシートが出て「クーポン」と「お店の情報」を切り替えて見られる
export default function CouponExplorer({ coupons, claims, onClaimed, loggedIn, isAdmin }: Props) {
  // 配布中(終わっていない)クーポンがあるお店だけを地図に出す
  const live = useMemo(() => coupons.filter((c) => !hasEnded(c)), [coupons]);
  const shops = useMemo(() => SHOPS.filter((s) => s.couponIds.some((id) => live.some((c) => c.id === id))), [live]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"coupon" | "shop">("coupon");
  const [busy, setBusy] = useState(false);
  // 運営だけ: 地図をタップした場所の緯度・経度を調べる(お店のピンの位置を直すため)
  const [picking, setPicking] = useState(false);

  const handleMapTap = async (lat: number, lng: number) => {
    if (!picking) return;
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast(`この場所は ${text}（コピーしました）`, "success");
    } catch {
      toast(`この場所は ${text}`, "success");
    }
  };

  const shop = shops.find((s) => s.id === selectedId) ?? null;
  const coupon = shop ? live.find((c) => shop.couponIds.includes(c.id)) ?? null : null;
  // まだ使えるもの(使い切っていない・終わっていない)を数える
  const boxCount = Object.values(claims).filter((c) => {
    const cp = coupons.find((x) => x.id === c.coupon_id);
    return cp ? !usedUp(cp, c) && !hasEnded(cp) : !c.used_at;
  }).length;

  // シートを下へなぞって閉じる。80px 以上下げて離したら閉じ、それより少なければ元の位置に戻す
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; dy: number; id: number } | null>(null);
  const dragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // ボタン(閉じる・タブ)を押したときは、なぞる動きとして扱わない
    if ((e.target as HTMLElement).closest("button, a")) return;
    // パソコンの横のパネルは、なぞって閉じない(×ボタンで閉じる)
    if (window.matchMedia(WIDE_QUERY).matches) return;
    drag.current = { startY: e.clientY, dy: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };
  const dragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    el.style.transform = `translateY(${d.dy}px)`;
  };
  const dragEnd = () => {
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = "transform 200ms ease-out";
    if (d.dy > 80) {
      el.style.transform = "translateY(100%)";
      setTimeout(() => select(null), 190);
    } else {
      el.style.transform = "";
    }
  };

  const select = (id: string | null) => {
    setSelectedId(id);
    setTab("coupon");
  };

  // シートを開いたら「見た」を記録する(ブラウザごとに1回)
  useEffect(() => {
    if (!coupon) return;
    recordCouponView(coupon.id, loggedIn);
    if (!loggedIn) rememberSource("coupon");
  }, [coupon, loggedIn]);

  const handleClaim = async (c: Coupon) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_coupon", { p_coupon: c.id });
    setBusy(false);
    if (error) { toast(errorMessage(error)); return; }
    const claim = data as CouponClaim;
    onClaimed({ coupon_id: claim.coupon_id, used_at: claim.used_at, use_count: claim.use_count });
    // 受け取っても使う画面には移らず、お知らせを出す。閉じるとシートのボタンが「このクーポンを使う」に変わる
    setJustClaimed(true);
  };
  const [justClaimed, setJustClaimed] = useState(false);
  const wide = useWide();

  return (
    <div className="relative flex-1 overflow-hidden">
      <ShopMap
        shops={shops}
        selectedId={selectedId}
        onSelect={select}
        bottomPadding={selectedId && !wide ? SHEET_RATIO : 0.2}
        leftPadding={selectedId && wide ? PANEL_WIDTH : 0}
        attributionClass="right-1 bottom-1"
        onMapTap={isAdmin ? handleMapTap : undefined}
        showLocate
        locateClass="right-3 top-[64px]"
      />
      {isAdmin && (
        <button
          onClick={() => setPicking((v) => !v)}
          className={`absolute left-3 top-[60px] z-10 ${shop ? "md:left-[412px]" : ""} rounded-full px-3 py-1.5 text-xs font-bold shadow-md ${
            picking ? "bg-[#F2C14E] text-[#1B243A]" : "bg-white/95 text-[#2F3E5C]"
          }`}
        >
          {picking ? "タップで位置をコピー（終了）" : "（運営）位置を調べる"}
        </button>
      )}

      {/* 上に浮かべるもの: 件数とクーポンボックス */}
      {/* パソコンでパネルが開いている間は、パネルの右側に寄せる */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 ${shop ? "md:pl-[412px]" : ""}`}>
        {/* 押せない、ただの表示(四角い札) */}
        <p className="pointer-events-auto rounded-sm bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#1B243A]">
          現在配布中のクーポン <span className="text-[#BA421D]">{live.length}件</span>
        </p>
        {loggedIn && (
          <Link
            href="/coupons/box"
            className="pointer-events-auto relative rounded-lg bg-[#BA421D] px-3.5 py-2 text-sm font-extrabold text-white"
          >
            クーポンボックス
            {boxCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-[#F2C14E] px-1 text-center text-xs font-extrabold leading-5 text-[#1B243A]">
                {boxCount}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* 何も選んでいないとき: 下にお店のカードを小さく出す(押すとシートが開く) */}
      {!shop && shops.length > 0 && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex gap-3 overflow-x-auto p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {shops.map((s) => {
            return (
              <button
                key={s.id}
                onClick={() => select(s.id)}
                className="min-w-[78%] sm:min-w-0 sm:w-auto sm:max-w-sm shrink-0 rounded-2xl bg-[#BA421D] p-4 text-left text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]"
              >
                <span className="text-xs text-white/85">{s.genre}</span>
                <span className="block text-lg font-extrabold leading-tight">{s.name}</span>
                <span className="mt-1.5 inline-block rounded-full bg-[#F2C14E] px-2.5 py-0.5 text-xs font-extrabold text-[#1B243A]">
                  クーポン配布中
                </span>
                <span className="mt-2 block text-xs text-white/85">押すとクーポンとお店の情報を見られます</span>
              </button>
            );
          })}
        </div>
      )}
      {shops.length === 0 && (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-[#BA421D] p-5 text-white shadow-lg">
          <p className="font-bold">いま配布中のクーポンはありません</p>
          <p className="mt-1 text-sm text-white/85">提携しているお店が決まったら、この地図に表示します。</p>
        </div>
      )}

      {/* お店を選んだとき: スマホは下からシート。md 以上(パソコン)は左端に上から下までの縦長のパネル */}
      {shop && (
        <section
          ref={sheetRef}
          aria-label={`${shop.name}の情報`}
          className="absolute inset-x-0 bottom-0 z-20 max-h-[72%] overflow-y-auto overscroll-contain rounded-t-[28px] md:inset-x-auto md:left-0 md:top-0 md:w-[400px] md:max-h-none md:rounded-none bg-white text-[#2F3E5C] shadow-[0_-8px_24px_rgba(27,36,58,.25)] md:shadow-[8px_0_24px_rgba(27,36,58,.2)] animate-[sheet-up_260ms_ease-out] md:animate-[panel-in_220ms_ease-out] motion-reduce:animate-none"
        >
          {/* 上の部分(つまみ・店名・タブ)を下へなぞると閉じる */}
          <div
            className="sticky top-0 z-10 touch-none"
            onPointerDown={dragStart}
            onPointerMove={dragMove}
            onPointerUp={dragEnd}
            onPointerCancel={dragEnd}
          >
            {/* 店名のところだけ朱色 */}
            <div className="rounded-t-[28px] md:rounded-none bg-[#BA421D] px-6 pb-5 pt-2.5 md:pt-5 text-white">
              {/* つまみ(なぞって閉じる印)はスマホだけ */}
              <div className="mx-auto h-1.5 w-10 rounded-full bg-white/35 md:hidden" aria-hidden />
              <div className="mt-3 md:mt-0 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-white/90">
                    {shop.genre}
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">PR・提携</span>
                    {coupon && !coupon.active && (
                      <span className="rounded bg-[#F2C14E] px-1.5 py-0.5 text-[10px] font-bold text-[#1B243A]">非公開・運営だけに表示中</span>
                    )}
                  </p>
                  <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{shop.name}</h1>
                </div>
                <button
                  onClick={() => select(null)}
                  aria-label="閉じる"
                  className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b border-stone-200 bg-white px-6" role="tablist" aria-label="表示する内容">
              {[
                { key: "coupon" as const, label: "クーポン" },
                { key: "shop" as const, label: "お店の情報" },
              ].map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px border-b-[3px] py-3 text-sm font-extrabold transition-colors ${
                    tab === t.key ? "border-[#BA421D] text-[#BA421D]" : "border-transparent text-[#2F3E5C]/55"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-5">
            {tab === "coupon" ? (
              coupon ? (
                <CouponTab
                  coupon={coupon}
                  shop={shop}
                  claim={claims[coupon.id]}
                  loggedIn={loggedIn}
                  isAdmin={isAdmin}
                  busy={busy}
                  onClaim={() => handleClaim(coupon)}
                />
              ) : (
                <p className="text-sm text-[#2F3E5C]/75">このお店のクーポンは、いま配布していません。</p>
              )
            ) : (
              <ShopTab shop={shop} isAdmin={isAdmin} />
            )}
          </div>
        </section>
      )}

      {justClaimed && (
        <ClaimedDialog
          message="クーポンボックスに入れました。お店で注文するときに「このクーポンを使う」を押して使ってください。"
          onClose={() => setJustClaimed(false)}
        />
      )}

      <style>{`@keyframes sheet-up { from { transform: translateY(40%); opacity: .6; } to { transform: none; opacity: 1; } } @keyframes panel-in { from { transform: translateX(-24px); opacity: .6; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}

function CouponTab({
  coupon,
  shop,
  claim,
  loggedIn,
  isAdmin,
  busy,
  onClaim,
}: {
  coupon: Coupon;
  shop: Shop;
  claim: MyClaim | undefined;
  loggedIn: boolean;
  isAdmin: boolean;
  busy: boolean;
  onClaim: () => void;
}) {
  const primary = "block w-full rounded-full py-3.5 text-center font-extrabold";
  const enabled = `${primary} bg-[#BA421D] text-white shadow-[0_3px_0_#1B243A] active:translate-y-[2px] active:shadow-[0_1px_0_#1B243A] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]`;
  const disabled = `${primary} bg-stone-200 text-stone-500 cursor-not-allowed`;
  const beforeStart = !claimOpen(coupon) && !hasEnded(coupon);

  let cta: React.ReactNode;
  let note: React.ReactNode = null;
  if (usedUp(coupon, claim)) {
    cta = <span className={disabled}>このクーポンは使用済みです</span>;
  } else if (claim) {
    cta = <Link href={`/coupons/${coupon.id}`} className={enabled}>このクーポンを使う</Link>;
    note = "クーポンボックスにも入っています。お店で注文するときに押してください";
  } else if (!loggedIn) {
    cta = <Link href={loginPath()} className={enabled}>ログインして受け取る</Link>;
    note = <Link href="/join" className="underline">はじめての方は新規登録（無料・北大のメールアドレス）</Link>;
  } else if (beforeStart) {
    cta = <button disabled aria-disabled className={disabled}>{formatDateTime(coupon.claim_from)}から受け取れます</button>;
    if (isAdmin) note = <button onClick={onClaim} disabled={busy} className="underline">（運営の動作確認用）開始前に受け取って試す</button>;
  } else {
    cta = <button onClick={onClaim} disabled={busy} className={enabled}>{busy ? "受け取り中..." : "クーポンを受け取る"}</button>;
  }

  return (
    <div>
      {/* クーポン名(押すとクーポンのページへ)と、そのすぐ下に受け取るボタン */}
      <CouponHeadline
        coupon={coupon}
        tone="light"
        titleHref={`/coupons/${coupon.id}`}
        titleImage={shop.couponImage}
        isAdmin={isAdmin}
        cta={
          <>
            {cta}
            {note && <p className="mt-2 text-center text-xs text-[#2F3E5C]/70">{note}</p>}
          </>
        }
      />
      <h2 className="mt-7 text-xl font-extrabold">特典</h2>
      <p className="mt-1 mb-4 text-sm text-[#2F3E5C]/75">{coupon.description}</p>
      <BenefitCards benefits={coupon.benefits} photos={shop.benefitPhotos} isAdmin={isAdmin} />
      <CouponNotes notes={coupon.notes} />
    </div>
  );
}

function ShopTab({ shop, isAdmin }: { shop: Shop; isAdmin: boolean }) {
  return (
    <div className="space-y-6 text-sm">
      {/* お店の写真(届いたら lib/shops.ts の photo・photos に足す。まだないときは運営にだけ空き枠を出す) */}
      {(shop.photo || shop.photos.length > 0 || isAdmin) && (
        <section aria-label="お店の写真" className="space-y-2">
          <PhotoSlot src={shop.photo} alt={`${shop.name}の写真`} isAdmin={isAdmin} no={PHOTO_NO.top} className="aspect-square rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: Math.max(shop.photos.length, isAdmin ? shop.photoSlots : 0) }, (_, i) => shop.photos[i]).slice(0, 3).map((src, i) => (
              <PhotoSlot key={src ?? i} src={src} alt={`${shop.name}の写真${i + 1}`} isAdmin={isAdmin} no={PHOTO_NO.smallFrom + i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </section>
      )}
      <dl className="grid grid-cols-[5em_1fr] gap-y-3">
        <dt className="text-[#2F3E5C]/60">ジャンル</dt>
        <dd className="font-bold">{shop.genre}</dd>
        <dt className="text-[#2F3E5C]/60">住所</dt>
        <dd className="font-bold">
          {shop.address}
          <span className="block font-normal text-[#2F3E5C]/70">{shop.access}</span>
        </dd>
        {shop.hours && (
          <>
            <dt className="text-[#2F3E5C]/60">営業時間</dt>
            <dd className="font-bold">{shop.hours}</dd>
          </>
        )}
        {shop.closed && (
          <>
            <dt className="text-[#2F3E5C]/60">定休日</dt>
            <dd className="font-bold">{shop.closed}</dd>
          </>
        )}
        {shop.phone && (
          <>
            <dt className="text-[#2F3E5C]/60">電話</dt>
            <dd>
              <a href={`tel:${shop.phone.replace(/-/g, "")}`} className="font-bold text-[#BA421D] underline">
                {shop.phone}
              </a>
            </dd>
          </>
        )}
      </dl>


      {shop.menu.length > 0 && (
        <section aria-labelledby="menu-heading">
          <h2 id="menu-heading" className="text-lg font-extrabold">メニュー</h2>
          <ul className="mt-3 divide-y divide-stone-200">
            {shop.menu.map((m) => (
              <li key={m.name} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="font-bold">{m.name}</span>
                {m.price !== null ? (
                  <span className="tabular-nums text-[#2F3E5C]/80">{m.price.toLocaleString()}円</span>
                ) : m.note ? (
                  <span className="text-right text-xs text-[#2F3E5C]/80">{m.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {shop.menuNote && <p className="mt-2 text-xs text-[#2F3E5C]/60">{shop.menuNote}</p>}
        </section>
      )}
    </div>
  );
}
