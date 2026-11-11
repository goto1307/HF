"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import {
  CLAIM_COLUMNS,
  COUPON_COLUMNS,
  benefitName,
  claimOpen,
  formatDateTime,
  formatTime,
  formatWeekdays,
  formatWindows,
  hasEnded,
  jstNow,
  unlimitedUses,
  usableNow,
  usedUp,
  type Coupon,
  type CouponClaim,
} from "@/lib/coupon";
import dynamic from "next/dynamic";
import { shopForCoupon } from "@/lib/shops";
import { BenefitCards, CouponConditions, CouponHeadline, CouponNotes, CouponPeriod, PhotoSlot } from "@/components/CouponParts";

// 上に出す小さな地図(ブラウザでだけ動く)
const ShopMap = dynamic(() => import("@/components/ShopMap"), { ssr: false, loading: () => <div className="h-full bg-[#EEF2F5]" /> });
import { rememberSource } from "@/lib/visitSource";
import { recordCouponView } from "@/lib/couponView";
import Header from "@/components/Header";
import HokkumaMascot from "@/components/HokkumaMascot";
import { goBack, loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";

// 1秒ごとに進む時計。使用済みの画面に出して、スクリーンショットの使い回しと見分けられるようにする
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function errorMessage(e: { message?: string } | null) {
  const m = e?.message ?? "";
  // DB の関数が返す日本語のメッセージはそのまま出す
  return /[ぁ-んァ-ン一-龥]/.test(m) ? m : "うまくいきませんでした。時間をおいてもう一度お試しください。";
}

export default function CouponPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const now = useNow();

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [claim, setClaim] = useState<CouponClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [benefit, setBenefit] = useState<string | null>(null);
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  // 何回でも使えるクーポンで、使ったあとに「もう一度使う」を押したか
  const [again, setAgain] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const { data } = await supabase.from("coupon").select(COUPON_COLUMNS).eq("id", id).maybeSingle();
      setCoupon((data as Coupon | null) ?? null);
      if (user && data) {
        const { data: mine } = await supabase
          .from("coupon_claim")
          .select(CLAIM_COLUMNS)
          .eq("coupon_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        setClaim((mine as CouponClaim | null) ?? null);
      } else {
        setClaim(null);
      }
      setLoading(false);
    })();
  }, [authLoading, id, user]);

  useEffect(() => {
    if (authLoading || !coupon) return;
    recordCouponView(coupon.id, !!user);
    // 未登録の人がここから登録したら「クーポンから来た人」として数える(すでに別の目印があればそちらを優先)
    if (!user) rememberSource("coupon");
  }, [authLoading, coupon, user]);

  const handleClaim = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_coupon", { p_coupon: id });
    setBusy(false);
    if (error) { toast(errorMessage(error)); return; }
    setClaim(data as CouponClaim);
    toast("クーポンを受け取りました");
  };

  const handleUse = async () => {
    if (!coupon || !claim || !benefit) return;
    const firstTime = claim.use_count === 0;
    if (firstTime && firstVisit === null) return;
    const ok = confirm(
      `「${benefitName(benefit)}」で使います。\n\nお店の人に画面を見せながら押してください。押すと${unlimitedUses(coupon) ? "「使った」と記録され" : "使用済みになり"}、元に戻せません。`
    );
    if (!ok) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("use_coupon", {
      p_coupon: id,
      p_benefit: benefit,
      // 2回目からは DB 側で「前にも来た」として記録される
      p_first_visit: firstTime ? firstVisit : false,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error)); return; }
    setClaim(data as CouponClaim);
    setAgain(false);
    setBenefit(null);
  };

  const handleReset = async () => {
    if (!confirm("動作確認用：自分の受け取り記録を消して、最初からやり直します。")) return;
    const { error } = await supabase.rpc("reset_my_coupon", { p_coupon: id });
    if (error) { toast(errorMessage(error)); return; }
    setBenefit(null);
    setFirstVisit(null);
    setAgain(false);
    setClaim(null);
    toast("受け取り記録を消しました");
  };

  // 読み込み中・見つからない・使用済み(店員さんに見せる画面)は朱色の背景
  const NAVY = "bg-[#BA421D]";

  if (loading || authLoading) {
    return (
      <div className={`min-h-screen ${NAVY}`}>
        <Header section={isAdmin ? "coupons" : "market"} />
        <div className="max-w-md mx-auto">
          <div className="h-52 bg-[#E3E9EE] animate-pulse" />
          <div className="p-6 space-y-3">
            <div className="h-8 w-40 rounded-lg bg-white/10" />
            <div className="h-24 rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className={`min-h-screen ${NAVY} text-white`}>
        <Header section={isAdmin ? "coupons" : "market"} />
        <div className="flex flex-col items-center py-20 px-6 text-center">
          <HokkumaMascot size={88} className="mb-4" />
          <p className="font-bold">このクーポンは見つかりませんでした</p>
          <p className="text-sm text-white/80 mt-1">配布が終わったか、URLが違う可能性があります。</p>
          <Link href="/coupons" className="mt-5 rounded-full bg-white text-[#1B243A] font-bold px-5 py-2.5">クーポンの一覧へ</Link>
        </div>
      </div>
    );
  }

  const shop = shopForCoupon(coupon.id);
  const place = shop ? { address: shop.address.replace(/^札幌市北区/, ""), access: shop.access } : undefined;
  const usable = usableNow(coupon, now);
  const ended = hasEnded(coupon, now);
  const usedToday = claim?.used_at ? jstNow(new Date(claim.used_at)).date === jstNow(now).date : false;
  const finished = usedUp(coupon, claim);
  // 何回でも使えるクーポンは、使ってから15分間だけお店に見せる画面を出す(そのあとは次に使う画面に戻る)
  const justUsed = claim?.used_at ? now.getTime() - new Date(claim.used_at).getTime() < 15 * 60 * 1000 : false;
  const showUsedScreen = !!claim?.used_at && (finished || (justUsed && !again));
  const useCount = claim?.use_count ?? 0;
  const whenUsable = `${formatWeekdays(coupon.weekdays)}の${formatWindows(coupon.time_windows)}`;

  // ---------- 使用済み(お店の人に見せる画面) ----------
  if (claim?.used_at && showUsedScreen) {
    return (
      <div className={`min-h-screen ${NAVY} text-white`}>
        <Header section={isAdmin ? "coupons" : "market"} />
        <div className="max-w-md mx-auto px-6 pt-8 pb-16 text-center">
          <p className="text-sm font-bold text-white/75">{coupon.shop_name}・{coupon.title}</p>
          <p className="mt-6 text-xs text-white/80">特典</p>
          <p className="mt-1 inline-block rounded-2xl bg-[#F2C14E] text-[#1B243A] text-3xl font-extrabold px-6 py-3">
            {benefitName(claim.benefit)}
          </p>
          <div className="mt-6 rounded-2xl bg-white text-[#1B243A] py-4">
            <p className="text-xs text-stone-500">使った時刻</p>
            <p className="text-2xl font-extrabold">{formatDateTime(claim.used_at)} {formatTime(claim.used_at)}</p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {/* 動いていることで、スクリーンショットではないと分かるようにする */}
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#F2C14E] opacity-70 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#F2C14E]" />
            </span>
            <span className="font-bold tabular-nums">
              現在 {jstNow(now).time}:{String(now.getSeconds()).padStart(2, "0")}
            </span>
          </div>
          {/* お店の方への案内は、運営から直接お店に伝えるので画面には出さない */}
          {!usedToday && finished && (
            <p className="mt-6 rounded-xl bg-white/10 py-3 text-sm font-bold">このクーポンは使用済みです</p>
          )}
          <p className="text-xs text-white/80 mt-5">ご利用ありがとうございました！</p>
          {!finished && (
            <div className="mt-8">
              <p className="text-xs text-white/80">このクーポンは期間中なら何回でも使えます（{useCount}回使用）</p>
              <button
                onClick={() => { setAgain(true); setBenefit(null); }}
                className="mt-2 rounded-full bg-white text-[#1B243A] font-bold px-5 py-2.5 text-sm"
              >
                次に来たときに使う
              </button>
            </div>
          )}
          {isAdmin && (
            <button onClick={handleReset} className="mt-8 text-xs text-white/50 underline">
              （運営の動作確認用）受け取りをやり直す
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- 下に固定するボタン ----------
  const primary = "block w-full rounded-full py-3.5 text-center font-extrabold transition-transform";
  const enabled = `${primary} bg-[#BA421D] text-white shadow-[0_3px_0_#1B243A] active:translate-y-[2px] active:shadow-[0_1px_0_#1B243A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]`;
  const disabled = `${primary} bg-stone-200 text-stone-500 cursor-not-allowed`;
  const beforeStart = !claim && !claimOpen(coupon, now) && !ended;

  let cta: React.ReactNode;
  let ctaNote: React.ReactNode = null;
  if (!user) {
    cta = ended ? <span className={disabled}>配布は終了しました</span> : <Link href={loginPath()} className={enabled}>ログインして受け取る</Link>;
    if (!ended) ctaNote = <Link href="/join" className="underline">はじめての方は新規登録（無料・北大のメールアドレス）</Link>;
  } else if (!claim) {
    if (ended) cta = <span className={disabled}>配布は終了しました</span>;
    else if (beforeStart) {
      cta = <button disabled aria-disabled className={disabled}>{formatDateTime(coupon.claim_from)}から受け取れます</button>;
      if (isAdmin) ctaNote = <button onClick={handleClaim} disabled={busy} className="underline">（運営の動作確認用）開始前に受け取って試す</button>;
    } else cta = <button onClick={handleClaim} disabled={busy} className={enabled}>{busy ? "受け取り中..." : "クーポンを受け取る"}</button>;
  } else {
    const ready = !!benefit && (useCount > 0 || firstVisit !== null);
    const canUse = ready && (usable || isAdmin);
    cta = (
      <button onClick={handleUse} disabled={!canUse || busy} className={canUse ? enabled : disabled}>
        {busy ? "処理中..." : !ready ? (useCount > 0 ? "特典を選んでください" : "特典と来店の回数を選んでください") : !usable && !isAdmin ? "今は使えない時間です" : "お店で使う"}
      </button>
    );
    ctaNote = !usable
      ? ended ? "使える期間は終了しました" : `使えるのは${whenUsable}です${isAdmin ? "（運営は動作確認のため押せます）" : ""}`
      : "店員さんにこの画面を見せながら押してください";
  }

  return (
    <div className="min-h-screen bg-white text-[#2F3E5C]">
      <Header section={isAdmin ? "coupons" : "market"} />
      <main className="max-w-md mx-auto pb-40">
        {/* いちばん上: お店の写真。まだないときは、運営には写真の枠、利用者には北大との位置関係の地図 */}
        <div className="relative">
          {shop?.photo || (shop && isAdmin) ? (
            <PhotoSlot src={shop.photo} alt={`${coupon.shop_name}の写真`} isAdmin={isAdmin} className="h-56" />
          ) : shop ? (
            <div className="relative h-56 overflow-hidden bg-[#EEF2F5]">
              <ShopMap shops={[shop]} selectedId={shop.id} onSelect={() => {}} bottomPadding={0} interactive={false} attributionClass="right-1 top-1" />
            </div>
          ) : (
            <div className="h-40 flex items-end justify-center bg-[#EEF2F5]">
              <HokkumaMascot size={96} />
            </div>
          )}
        </div>

        {/* 店名のところだけ朱色 */}
        <div className="-mt-6 relative rounded-t-[28px] bg-[#BA421D] px-6 pb-6 pt-6 text-white">
          <button onClick={() => goBack(router, "/coupons")} className="-ml-1 mb-3 px-1 py-1 text-sm font-bold text-white/90 hover:text-white">
            ← 戻る
          </button>
          {/* 店名(大) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5">PR・提携</span>
            {!coupon.active && <span className="text-[10px] font-bold bg-[#F2C14E] text-[#1B243A] rounded px-1.5 py-0.5">非公開・運営だけに表示中</span>}
          </div>
          <p className="mt-2 text-base font-extrabold text-[#F2C14E]">{coupon.shop_name}</p>
          {/* クーポン名と使える時間をいちばん大きく */}
          <div className="mt-1">
            <CouponHeadline coupon={coupon} />
          </div>
          {claim && (
            <p className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              受け取り済み{useCount > 0 && `・${useCount}回使用`}
            </p>
          )}
        </div>

        {/* ここから下は白地 */}
        <div className="px-6">
          {/* いつから・いつまで(いちばん上) */}
          {!claim && <div className="mt-6"><CouponPeriod coupon={coupon} started={!beforeStart} ended={ended} /></div>}
          {/* 特典(中) */}
          <section className={claim ? "mt-8" : "mt-6"} aria-labelledby="benefit-heading">
            <h2 id="benefit-heading" className="text-xl font-extrabold">
              {claim ? "使う特典を1つ選ぶ" : "特典はどれか1つ"}
            </h2>
            <p className="mt-1 mb-4 text-sm text-[#2F3E5C]/75">{coupon.description}</p>
            <BenefitCards benefits={coupon.benefits} selected={benefit} onSelect={claim ? setBenefit : undefined} />
          </section>

          {claim && useCount === 0 && (
            <section className="mt-8" aria-labelledby="visit-heading">
              <h2 id="visit-heading" className="text-xl font-extrabold">このお店に来たのは？</h2>
              <p className="mt-1 mb-4 text-sm text-[#2F3E5C]/75">お店への報告に使います（名前などは伝わりません）。</p>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-labelledby="visit-heading">
                {[
                  { v: true, label: "はじめて" },
                  { v: false, label: "前にも来た" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={firstVisit === o.v}
                    onClick={() => setFirstVisit(o.v)}
                    className={`min-h-[52px] rounded-2xl border-2 font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BA421D] ${
                      firstVisit === o.v ? "border-[#BA421D] bg-[#BA421D]/[0.07] text-[#BA421D] shadow-[inset_0_0_0_1px_#BA421D]" : "border-stone-200 bg-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 条件(小) */}
          <section className="mt-8" aria-label="使える日時と場所">
            <CouponConditions coupon={coupon} place={place} />
          </section>

          {/* お店の写真(届いたら lib/shops.ts の photos に足す) */}
          {shop && (shop.photos.length > 0 || isAdmin) && (
            <section className="mt-8" aria-labelledby="photos-heading">
              <h2 id="photos-heading" className="text-xl font-extrabold">お店の写真</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(shop.photos.length > 0 ? shop.photos : Array.from({ length: shop.photoSlots }, () => undefined)).map((src, i) => (
                  <PhotoSlot key={src ?? i} src={src} alt={`${shop.name}の写真${i + 1}`} isAdmin={isAdmin} className="aspect-square rounded-2xl" />
                ))}
              </div>
            </section>
          )}

          <CouponNotes notes={coupon.notes} />
          <p className="mt-3 text-[11px] leading-relaxed text-[#2F3E5C]/55">
            このクーポンは HOKUMA と{coupon.shop_name}の提携によるものです。お店に、あなたの名前やメールアドレスが伝わることはありません。
          </p>
          {isAdmin && claim && (
            <button onClick={handleReset} className="mt-6 text-xs text-[#2F3E5C]/50 underline">
              （運営の動作確認用）受け取りをやり直す
            </button>
          )}
        </div>
      </main>

      {/* ボタンは画面の下に固定 */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-white/95 backdrop-blur border-t border-stone-200">
        <div className="max-w-md mx-auto px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {cta}
          {ctaNote && <p className="mt-2 text-center text-xs text-[#2F3E5C]/70">{ctaNote}</p>}
        </div>
      </div>
    </div>
  );
}
