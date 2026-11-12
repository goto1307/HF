"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { CLAIM_COLUMNS, COUPON_COLUMNS, type Coupon, type CouponClaim } from "@/lib/coupon";
import { loginPath } from "@/lib/nav";
import Header from "@/components/Header";
import CouponBoxList from "@/components/CouponBoxList";

// クーポンボックス: 受け取ったクーポンの一覧。使う前のものを上に出す
// (期限が近いときのお知らせは、まだ作っていない)
export default function CouponBoxPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const router = useRouter();
  const [rows, setRows] = useState<{ claim: CouponClaim; coupon: Coupon }[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(loginPath("/coupons/box")); return; }
    (async () => {
      const { data: claims } = await supabase.from("coupon_claim").select(CLAIM_COLUMNS).eq("user_id", user.id);
      const list = (claims as CouponClaim[] | null) ?? [];
      const ids = list.map((c) => c.coupon_id);
      const { data: coupons } = ids.length
        ? await supabase.from("coupon").select(COUPON_COLUMNS).in("id", ids)
        : { data: [] as Coupon[] };
      const byId = new Map(((coupons as Coupon[] | null) ?? []).map((c) => [c.id, c]));
      setRows(list.filter((c) => byId.has(c.coupon_id)).map((claim) => ({ claim, coupon: byId.get(claim.coupon_id)! })));
    })();
  }, [authLoading, user, router]);

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
            <CouponBoxList rows={rows} theme="light" />
          )}
        </div>
      </main>
    </div>
  );
}
