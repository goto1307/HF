"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { CLAIM_COLUMNS, COUPON_COLUMNS, type Coupon, type CouponClaim } from "@/lib/coupon";
import { loginPath } from "@/lib/nav";
import Header from "@/components/Header";
import CouponBoxList from "@/components/CouponBoxList";

// HOKUMA のマイページ(フリマ・クーポンなど、HOKUMA 全体の自分の情報)。
// フリマの出品・購入は、フリマのマイページ(/mypage)にある。
// ※ いまは運営だけの試作(☰ のホーム画面から開く)。プロフィールの編集・退会は、まだフリマのマイページにある
export default function MePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<{ claim: CouponClaim; coupon: Coupon }[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(loginPath("/me")); return; }
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

  const nickname: string = user?.user_metadata?.nickname || "ニックネーム未設定";
  const avatar: string | undefined = user?.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-[#2F3E5C] text-white">
      <Header section="account" />
      <main className="mx-auto max-w-md px-6 pb-16 pt-8">
        {/* 自分 */}
        <div className="flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-16 w-16 rounded-full bg-white object-cover ring-2 ring-white/20" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-extrabold text-[#2F3E5C]">
              {nickname.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold leading-tight">{nickname}</p>
            <Link href="/mypage" className="mt-1 inline-block text-xs font-bold text-white/70 underline hover:text-white">
              プロフィールを編集する
            </Link>
          </div>
        </div>

        {/* クーポンボックス */}
        <section className="mt-10" aria-labelledby="box-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="box-heading" className="text-xl font-extrabold">クーポンボックス</h2>
            <Link href="/coupons/box" className="text-sm font-bold text-[#F2C14E]">すべて見る</Link>
          </div>
          <div className="mt-4">
            {rows === null ? <div className="h-24 rounded-2xl bg-white/5 animate-pulse" /> : <CouponBoxList rows={rows.slice(0, 3)} compact />}
          </div>
        </section>

        {/* フリマ */}
        <section className="mt-10" aria-labelledby="market-heading">
          <h2 id="market-heading" className="text-xl font-extrabold">フリマ</h2>
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl bg-white/5">
            {[
              { href: "/mypage#selling", label: "出品中の商品" },
              { href: "/mypage#purchased", label: "購入した商品" },
              { href: "/mypage#sold", label: "売れた商品" },
              { href: "/demands?mine=1", label: "自分の「欲しい！」" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center justify-between px-4 py-3.5 font-bold hover:bg-white/5">
                  {l.label}
                  <span aria-hidden className="text-white/40">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* アカウント */}
        <section className="mt-10" aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-xl font-extrabold">アカウント</h2>
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl bg-white/5">
            <li><Link href="/mypage" className="block px-4 py-3.5 font-bold hover:bg-white/5">プロフィール・ブロック・退会</Link></li>
            <li><Link href="/privacy" className="block px-4 py-3.5 font-bold hover:bg-white/5">プライバシーポリシー</Link></li>
            <li><Link href="/logout" className="block px-4 py-3.5 font-bold text-red-300 hover:bg-white/5">ログアウト</Link></li>
          </ul>
        </section>
      </main>
    </div>
  );
}
