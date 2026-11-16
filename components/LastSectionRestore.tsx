"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { isFreshLaunch, lastSection, rememberSection, SECTIONS, sectionOf, useAppsOpen } from "@/lib/appSections";

// 最後に開いていたサービスを覚えておき、アプリ(タブ)を開き直してトップに来たときは、そのサービスから始める。
// 例: クーポンのページを見たまま閉じる → 次にホーム画面のアイコンから開くと、クーポンのページから始まる。
// リンクやQRで特定のページを直接開いたときは、そのページをそのまま表示する(トップに来たときだけ移動する)。
// ※ 運営はいつでも、一般の人は公開日時(APPS_PUBLIC_AT)から
export default function LastSectionRestore() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const appsOpen = useAppsOpen(user?.email);
  const checked = useRef(false);

  // 開き直したときの移動(タブを開いて最初の1回だけ)
  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    const fresh = isFreshLaunch();
    if (!appsOpen || !fresh || pathname !== "/") return;
    const last = lastSection();
    if (last && last !== "market") router.replace(SECTIONS[last].home);
  }, [loading, appsOpen, pathname, router]);

  // 今いるサービスを覚える
  useEffect(() => {
    if (!appsOpen) return;
    const section = sectionOf(pathname);
    // マイページは「前回のサービス」として覚えない(開き直したらフリマかクーポンから始める)
    if (section && section !== "account") rememberSection(section);
  }, [appsOpen, pathname]);

  return null;
}
