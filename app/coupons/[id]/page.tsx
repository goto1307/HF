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
  claimOpen,
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekdays,
  formatWindows,
  hasEnded,
  jstNow,
  usableNow,
  type Coupon,
  type CouponClaim,
} from "@/lib/coupon";
import { rememberSource } from "@/lib/visitSource";
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

// クーポンのページを開いたことを記録する(ブラウザごとに1回。誰が見たかは記録しない)
function recordView(couponId: string, loggedIn: boolean) {
  const key = `hokuma-coupon-viewed-${couponId}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // 保存できないブラウザでは、開くたびに数えないよう記録しない
    return;
  }
  supabase.from("coupon_view").insert({ coupon_id: couponId, logged_in: loggedIn }).then(() => {});
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
    recordView(coupon.id, !!user);
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
    if (!coupon || !benefit || firstVisit === null) return;
    const ok = confirm(
      `「${benefit}」で使います。\n\nお店の人に画面を見せながら押してください。押すと使用済みになり、元に戻せません。`
    );
    if (!ok) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("use_coupon", {
      p_coupon: id,
      p_benefit: benefit,
      p_first_visit: firstVisit,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error)); return; }
    setClaim(data as CouponClaim);
  };

  const handleReset = async () => {
    if (!confirm("動作確認用：自分の受け取り記録を消して、最初からやり直します。")) return;
    const { error } = await supabase.rpc("reset_my_coupon", { p_coupon: id });
    if (error) { toast(errorMessage(error)); return; }
    setBenefit(null);
    setFirstVisit(null);
    setClaim(null);
    toast("受け取り記録を消しました");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="max-w-md mx-auto p-4">
          <div className="h-64 rounded-2xl bg-stone-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="flex flex-col items-center py-20 px-4 text-center">
          <HokkumaMascot size={88} className="mb-3 opacity-90" />
          <p className="text-stone-500 mb-4">このクーポンは見つかりませんでした</p>
          <Link href="/coupons" className="text-orange-700 font-bold underline">クーポン一覧へ</Link>
        </div>
      </div>
    );
  }

  const usable = usableNow(coupon, now);
  const ended = hasEnded(coupon, now);
  const usedToday = claim?.used_at ? jstNow(new Date(claim.used_at)).date === jstNow(now).date : false;
  const rules = `${formatDate(coupon.use_from)}〜${formatDate(coupon.use_until)}の${formatWeekdays(coupon.weekdays)}、${formatWindows(coupon.time_windows)}`;

  // ---------- 使用済み(お店の人に見せる画面) ----------
  if (claim?.used_at) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="max-w-md mx-auto p-4">
          <div className="rounded-3xl bg-gradient-to-br from-orange-600 to-orange-700 text-white p-6 shadow-lg text-center relative overflow-hidden">
            <p className="text-sm font-bold opacity-90">{coupon.shop_name}・{coupon.title}</p>
            <p className="mt-4 text-xs opacity-80">特典</p>
            <p className="text-3xl font-black mt-1">{claim.benefit}</p>
            <div className="mt-5 rounded-2xl bg-white text-stone-800 py-3">
              <p className="text-xs text-stone-500">使った時刻</p>
              <p className="text-2xl font-black">
                {formatDateTime(claim.used_at)} {formatTime(claim.used_at)}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              {/* 動いていることで、スクリーンショットではないと分かるようにする */}
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-300 animate-ping" />
              <span className="font-mono font-bold tabular-nums">
                現在 {jstNow(now).time}:{String(now.getSeconds()).padStart(2, "0")}
              </span>
            </div>
            {usedToday ? (
              <p className="mt-4 text-sm font-bold bg-white/15 rounded-xl py-2">
                お店の方へ：上の特典を1つお出しください
              </p>
            ) : (
              <p className="mt-4 text-sm font-bold bg-white/15 rounded-xl py-2">このクーポンは使用済みです</p>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-4 text-center">ご利用ありがとうございました！</p>
          {isAdmin && (
            <button onClick={handleReset} className="mt-6 w-full text-xs text-stone-400 underline">
              （運営の動作確認用）受け取りをやり直す
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <div className="max-w-md mx-auto p-4 pb-24">
        <button onClick={() => goBack(router, "/coupons")} className="text-sm text-stone-500 mb-3">
          ← 戻る
        </button>

        {!coupon.active && (
          <p className="mb-3 rounded-xl bg-stone-800 text-white text-xs font-bold px-3 py-2">
            非公開（運営の2人にだけ表示されています）。期間・時間に関係なく試せます。
          </p>
        )}

        {/* クーポンの中身 */}
        <div className="rounded-3xl bg-white border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white p-5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-white/25 rounded px-1.5 py-0.5">PR・提携</span>
              <span className="text-sm font-bold">{coupon.shop_name}</span>
            </div>
            <h1 className="text-2xl font-black mt-2">{coupon.title}</h1>
            <p className="text-sm mt-2 opacity-95">{coupon.description}</p>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <div>
              <p className="text-xs font-bold text-stone-400">特典（使うときに1つ選びます）</p>
              <ul className="mt-1 space-y-1">
                {coupon.benefits.map((b) => (
                  <li key={b} className="font-bold text-stone-800">・{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400">使える日時</p>
              <p className="text-stone-800">{rules}</p>
            </div>
            {coupon.notes && <p className="text-xs text-stone-500 leading-relaxed">{coupon.notes}</p>}
          </div>
        </div>

        {/* 受け取り・使う */}
        <div className="mt-4">
          {!user ? (
            ended ? (
              <p className="text-center text-stone-500 text-sm py-4">このクーポンの配布は終了しました</p>
            ) : (
              <div className="rounded-2xl bg-white border border-stone-200 p-5 text-center">
                <p className="text-sm text-stone-700 mb-3">
                  受け取るには、北大のメールアドレスで HOKUMA にログインしてください。
                </p>
                <Link
                  href={loginPath()}
                  className="block w-full bg-gradient-to-br from-orange-600 to-orange-700 text-white py-3 rounded-full font-bold shadow-md"
                >
                  ログインして受け取る
                </Link>
                <Link href="/join" className="block mt-3 text-sm text-orange-700 font-bold underline">
                  はじめての方は新規登録（無料）
                </Link>
              </div>
            )
          ) : !claim ? (
            ended ? (
              <p className="text-center text-stone-500 text-sm py-4">このクーポンの配布は終了しました</p>
            ) : claimOpen(coupon, now) || isAdmin ? (
              <button
                onClick={handleClaim}
                disabled={busy}
                className="w-full bg-gradient-to-br from-orange-600 to-orange-700 text-white py-3.5 rounded-full font-bold shadow-md disabled:opacity-50"
              >
                {busy ? "受け取り中..." : "クーポンを受け取る"}
              </button>
            ) : (
              <p className="text-center text-stone-600 text-sm py-4 font-bold">
                {formatDateTime(coupon.claim_from)}から受け取れます
              </p>
            )
          ) : (
            <div className="rounded-2xl bg-white border-2 border-orange-600 p-5">
              <p className="text-center font-black text-orange-700">受け取り済み</p>
              <p className="text-center text-xs text-stone-500 mt-1">
                お店で食券を買ったら、店員さんにこの画面を見せながら「使う」を押してください
              </p>

              <p className="text-xs font-bold text-stone-500 mt-5 mb-2">① 特典を選ぶ</p>
              <div className="grid gap-2">
                {coupon.benefits.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBenefit(b)}
                    className={`py-2.5 rounded-xl border-2 font-bold text-sm transition-colors ${
                      benefit === b ? "border-orange-600 bg-orange-50 text-orange-800" : "border-stone-200 text-stone-700"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-stone-500 mt-5 mb-2">② このお店に来たのは？</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: true, label: "はじめて" },
                  { v: false, label: "前にも来た" },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setFirstVisit(o.v)}
                    className={`py-2.5 rounded-xl border-2 font-bold text-sm transition-colors ${
                      firstVisit === o.v ? "border-orange-600 bg-orange-50 text-orange-800" : "border-stone-200 text-stone-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleUse}
                disabled={busy || !benefit || firstVisit === null || !(usable || isAdmin)}
                className="mt-5 w-full bg-gradient-to-br from-orange-600 to-orange-700 text-white py-3.5 rounded-full font-bold shadow-md disabled:opacity-40"
              >
                {busy ? "処理中..." : "③ お店で使う"}
              </button>
              {!usable && (
                <p className="text-xs text-stone-500 mt-2 text-center">
                  {ended ? "使える期間は終了しました" : `今は使えない時間です。使えるのは${rules}です。`}
                  {isAdmin && "（運営は動作確認のため押せます）"}
                </p>
              )}
              {isAdmin && (
                <button onClick={handleReset} className="mt-4 w-full text-xs text-stone-400 underline">
                  （運営の動作確認用）受け取りをやり直す
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-stone-400 mt-6 leading-relaxed">
          このクーポンは HOKUMA と{coupon.shop_name}の提携によるものです。お店に、あなたの名前やメールアドレスなどの個人情報が伝わることはありません（お店には、使われた回数などの数字だけをお伝えします）。
        </p>
      </div>
    </div>
  );
}
