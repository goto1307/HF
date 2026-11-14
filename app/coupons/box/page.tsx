"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { CLAIM_COLUMNS, COUPON_COLUMNS, claimOpen, hasEnded, type Coupon, type CouponClaim } from "@/lib/coupon";
import { toast } from "@/lib/toast";
import { loginPath } from "@/lib/nav";
import Header from "@/components/Header";
import CouponBoxList from "@/components/CouponBoxList";

// クーポンボックス: 配布中のクーポン(まだのものは「受け取る」)と、受け取ったクーポンの一覧。使う前のものを上に出す
// (期限が近いときのお知らせは、まだ作っていない)
export default function CouponBoxPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const router = useRouter();
  const [rows, setRows] = useState<{ claim: CouponClaim | null; coupon: Coupon }[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(loginPath("/coupons/box")); return; }
    (async () => {
      // 自分が受け取ったクーポンと、すべてのクーポン(非公開は運営にだけ届く)を同時に読む
      const [{ data: claims }, { data: coupons }] = await Promise.all([
        supabase.from("coupon_claim").select(CLAIM_COLUMNS).eq("user_id", user.id),
        supabase.from("coupon").select(COUPON_COLUMNS),
      ]);
      const list = (claims as CouponClaim[] | null) ?? [];
      const all = (coupons as Coupon[] | null) ?? [];
      const mine = new Map(list.map((c) => [c.coupon_id, c]));
      const received = all.filter((c) => mine.has(c.id)).map((coupon) => ({ claim: mine.get(coupon.id)!, coupon }));
      // まだ受け取っていない、配布中のクーポン(運営は動作確認のため、配布開始前のものも出す)
      const notYet = all
        .filter((c) => !mine.has(c.id) && !hasEnded(c) && (claimOpen(c) || isAdmin))
        .map((coupon) => ({ claim: null, coupon }));
      setRows([...notYet, ...received]);
    })();
  }, [authLoading, user, router, isAdmin]);

  const handleClaim = async (couponId: string) => {
    setBusyId(couponId);
    const { data, error } = await supabase.rpc("claim_coupon", { p_coupon: couponId });
    setBusyId(null);
    if (error) {
      toast(/[ぁ-んァ-ン一-龥]/.test(error.message) ? error.message : "うまくいきませんでした。時間をおいてもう一度お試しください。");
      return;
    }
    const claim = data as CouponClaim;
    setRows((prev) => (prev ?? []).map((r) => (r.coupon.id === couponId ? { ...r, claim } : r)));
    toast("受け取りました。お店で押すと使えます", "success");
  };

  return (
    <div className="min-h-screen bg-white text-[#2F3E5C]">
      <Header section={isAdmin ? "coupons" : "market"} />
      <main className="mx-auto max-w-md px-6 pb-16 pt-6">
        <Link href="/coupons" className="text-sm font-bold text-[#2F3E5C]/70 hover:text-[#2F3E5C]">← クーポンの地図へ</Link>
        <h1 className="mt-3 text-[28px] font-extrabold leading-tight">クーポンボックス</h1>
        <div className="mt-6">
          {rows === null ? (
            <div className="h-28 rounded-2xl bg-stone-100 animate-pulse" />
          ) : (
            <CouponBoxList rows={rows} theme="light" isAdmin={isAdmin} onClaim={handleClaim} busyId={busyId} />
          )}
        </div>
      </main>
    </div>
  );
}
