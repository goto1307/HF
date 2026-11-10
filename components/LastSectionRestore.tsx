"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { isFreshLaunch, lastSection, rememberSection, SECTIONS, sectionOf } from "@/lib/appSections";

// 最後に開いていたサービスを覚えておき、アプリ(タブ)を開き直してトップに来たときは、そのサービスから始める。
// 例: クーポンのページを見たまま閉じる → 次にホーム画面のアイコンから開くと、クーポンのページから始まる。
// リンクやQRで特定のページを直接開いたときは、そのページをそのまま表示する(トップに来たときだけ移動する)。
// ※ いまは運営(管理者)だけの試作
export default function LastSectionRestore() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const checked = useRef(false);

  // 開き直したときの移動(タブを開いて最初の1回だけ)
  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    const fresh = isFreshLaunch();
    if (!isAdmin || !fresh || pathname !== "/") return;
    const last = lastSection();
    if (last && last !== "market") router.replace(SECTIONS[last].home);
  }, [loading, isAdmin, pathname, router]);

  // 今いるサービスを覚える
  useEffect(() => {
    if (!isAdmin) return;
    const section = sectionOf(pathname);
    // マイページは「前回のサービス」として覚えない(開き直したらフリマかクーポンから始める)
    if (section && section !== "account") rememberSection(section);
  }, [isAdmin, pathname]);

  return null;
}
