"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { claimOpen, formatDateTime, hasEnded, usedUp, type Coupon, type CouponClaim } from "@/lib/coupon";
import { SHOPS, type Shop } from "@/lib/shops";
import { recordCouponView } from "@/lib/couponView";
import { rememberSource } from "@/lib/visitSource";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";
import { BenefitCards, CouponConditions, CouponNotes, CouponPeriod } from "@/components/CouponParts";
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

function errorMessage(e: { message?: string } | null) {
  const m = e?.message ?? "";
  return /[ぁ-んァ-ン一-龥]/.test(m) ? m : "うまくいきませんでした。時間をおいてもう一度お試しください。";
}

// クーポンのページ(運営だけの試作)。指で動かせる地図に、クーポンが使えるお店のピンを出す。
// ピンを押すと、下からシートが出て「クーポン」と「お店の情報」を切り替えて見られる
export default function CouponExplorer({ coupons, claims, onClaimed, loggedIn, isAdmin }: Props) {
  const router = useRouter();
  // 配布中(終わっていない)クーポンがあるお店だけを地図に出す
  const live = useMemo(() => coupons.filter((c) => !hasEnded(c)), [coupons]);
  const shops = useMemo(() => SHOPS.filter((s) => s.couponIds.some((id) => live.some((c) => c.id === id))), [live]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"coupon" | "shop">("coupon");
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
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
    setJustClaimed(c.id);
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <ShopMap
        shops={shops}
        selectedId={selectedId}
        onSelect={select}
        bottomPadding={selectedId ? SHEET_RATIO : 0.2}
        attributionClass="right-3 top-[60px]"
        onMapTap={isAdmin ? handleMapTap : undefined}
      />
      {isAdmin && (
        <button
          onClick={() => setPicking((v) => !v)}
          className={`absolute left-3 top-[60px] z-10 rounded-full px-3 py-1.5 text-xs font-bold shadow-md ${
            picking ? "bg-[#F2C14E] text-[#1B243A]" : "bg-white/95 text-[#2F3E5C]"
          }`}
        >
          {picking ? "タップで位置をコピー（終了）" : "（運営）位置を調べる"}
        </button>
      )}

      {/* 上に浮かべるもの: 件数とクーポンボックス */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <p className="pointer-events-auto rounded-full bg-white/95 px-3.5 py-2 text-sm font-bold text-[#1B243A] shadow-md">
          現在配布中のクーポン <span className="text-[#BA421D]">{live.length}件</span>
        </p>
        {loggedIn && (
          <Link
            href="/coupons/box"
            className="pointer-events-auto relative rounded-full bg-[#BA421D] px-3.5 py-2 text-sm font-bold text-white shadow-md"
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
        <div className="absolute inset-x-0 bottom-0 z-10 flex gap-3 overflow-x-auto p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {shops.map((s) => {
            const c = live.find((x) => s.couponIds.includes(x.id));
            return (
              <button
                key={s.id}
                onClick={() => select(s.id)}
                className="min-w-[78%] shrink-0 rounded-2xl bg-[#BA421D] p-4 text-left text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]"
              >
                <span className="text-xs text-white/85">{s.genre}</span>
                <span className="block text-lg font-extrabold leading-tight">{s.name}</span>
                <span className="mt-1.5 inline-block rounded-full bg-[#F2C14E] px-2.5 py-0.5 text-xs font-extrabold text-[#1B243A]">
                  {c?.title ?? "クーポン"}配布中
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

      {/* お店を選んだとき: 下からシート */}
      {shop && (
        <section
          aria-label={`${shop.name}の情報`}
          className="absolute inset-x-0 bottom-0 z-20 max-h-[72%] overflow-y-auto rounded-t-[28px] bg-white text-[#2F3E5C] shadow-[0_-8px_24px_rgba(27,36,58,.25)] animate-[sheet-up_260ms_ease-out] motion-reduce:animate-none"
        >
          <div className="sticky top-0 z-10">
            {/* 店名のところだけ朱色 */}
            <div className="rounded-t-[28px] bg-[#BA421D] px-6 pb-5 pt-2.5 text-white">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-white/35" aria-hidden />
              <div className="mt-3 flex items-start justify-between gap-3">
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
              <ShopTab shop={shop} />
            )}
          </div>
        </section>
      )}

      {/* 受け取った直後: 今すぐ使うか、クーポンボックスに入れるか */}
      {justClaimed && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="claimed-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-[#1B243A] shadow-xl">
            <p id="claimed-title" className="text-xl font-extrabold">クーポンを受け取りました</p>
            <p className="mt-1 text-sm text-stone-600">お店にいるなら、今すぐ使えます。あとで使うなら、クーポンボックスに入れておきましょう。</p>
            <button
              onClick={() => router.push(`/coupons/${justClaimed}`)}
              className="mt-5 block w-full rounded-full bg-[#BA421D] py-3.5 font-extrabold text-white shadow-[0_3px_0_#1B243A]"
            >
              今すぐ使う
            </button>
            <button
              onClick={() => { setJustClaimed(null); toast("クーポンボックスに入れました"); }}
              className="mt-3 block w-full rounded-full border-2 border-[#BA421D] py-3 font-extrabold text-[#BA421D]"
            >
              クーポンボックスに入れる
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes sheet-up { from { transform: translateY(40%); opacity: .6; } to { transform: none; opacity: 1; } }`}</style>
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
    note = "クーポンボックスに入っています。お店で食券を買ったら開いてください";
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
      <div className="mb-4"><CouponPeriod coupon={coupon} started={!beforeStart} /></div>
      <p className="text-base font-bold text-[#BA421D]">{coupon.title}</p>
      <h2 className="mt-1 text-xl font-extrabold">特典はどれか1つ</h2>
      <p className="mt-1 mb-4 text-sm text-[#2F3E5C]/75">{coupon.description}</p>
      <BenefitCards benefits={coupon.benefits} />
      <div className="mt-7">
        <CouponConditions coupon={coupon} place={{ address: shop.address.replace(/^札幌市北区/, ""), access: shop.access }} />
      </div>
      <div className="mt-7">
        {cta}
        {note && <p className="mt-2 text-center text-xs text-[#2F3E5C]/70">{note}</p>}
      </div>
      <CouponNotes notes={coupon.notes} />
    </div>
  );
}

function ShopTab({ shop }: { shop: Shop }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
  return (
    <div className="space-y-6 text-sm">
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
      </dl>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-full border-2 border-[#2F3E5C]/25 py-3 text-center font-extrabold hover:bg-stone-50"
      >
        地図アプリで道順を見る
      </a>

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
