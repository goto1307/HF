"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { needsMfaCode } from "@/lib/mfa";
import Header from "@/components/Header";
import MfaCodeForm from "@/components/MfaCodeForm";

// 管理画面(/admin/*)の入口。運営の2段階認証(認証アプリの6桁)を確かめる。
// - 認証アプリを登録済みで、まだ6桁を入れていない → 6桁の入力欄だけを出す(中身は出さない)
// - まだ登録していない運営 → 登録画面(/admin/mfa)への案内を上に出す
// 本当の守りは DB 側(migration PART BL で is_admin() が6桁済みのログインだけを管理者とみなす)。
// この画面は、運営が迷わないための案内。
type Gate = "checking" | "code" | "unenrolled" | "ok";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("checking");
  const onSetupPage = pathname?.startsWith("/admin/mfa") ?? false;

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (!user || !isAdminEmail(user.email)) {
        // 運営以外は、各ページの今までの処理(ログイン誘導・「権限がありません」)に任せる
        if (!cancelled) setGate("ok");
        return;
      }
      if (await needsMfaCode()) {
        if (!cancelled) setGate("code");
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      if (!cancelled) setGate((data?.totp?.length ?? 0) > 0 ? "ok" : "unenrolled");
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  if (onSetupPage) return <>{children}</>;

  if (gate === "checking") {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <p className="text-center text-stone-400 py-16 text-sm">確認中...</p>
      </div>
    );
  }

  if (gate === "code") {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <main className="max-w-md mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold mb-8 text-center">管理画面</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <MfaCodeForm
              onVerified={() => setGate("ok")}
              onGiveUp={async () => {
                await supabase.auth.signOut();
                router.replace("/");
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      {gate === "unenrolled" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-900 text-center">
          運営アカウントの2段階認証がまだ登録されていません。
          <Link href="/admin/mfa" className="font-bold underline ml-1">登録する</Link>
        </div>
      )}
      {children}
    </>
  );
}
