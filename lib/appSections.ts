// HOKUMA の中のサービス(フリマ・クーポンなど)の一覧と、「最後に開いていたサービス」の記録。
// ☰ から開くホーム画面(components/AppLauncher.tsx)と、
// アプリを開き直したときに前回のサービスから始める仕組み(components/LastSectionRestore.tsx)で使う。
// ※ いまは運営(管理者)だけに出している試作。一般公開するときは、これを使っている画面の isAdmin の条件を外す

export type SectionKey = "market" | "coupons" | "account";

export const SECTIONS: Record<SectionKey, { home: string; label: string; subtitle: string }> = {
  market: { home: "/", label: "フリマ", subtitle: "北大生専用のフリマ" },
  coupons: { home: "/coupons", label: "クーポン", subtitle: "北大まわりの空きコマクーポン" },
  account: { home: "/me", label: "マイページ", subtitle: "マイページ" },
};

// ページの場所から、どのサービスの中にいるかを決める(どれにも当たらないページは null)
export function sectionOf(pathname: string): SectionKey | null {
  if (pathname === "/me" || pathname.startsWith("/me/")) return "account";
  if (pathname === "/coupons" || pathname.startsWith("/coupons/")) return "coupons";
  if (
    pathname === "/" ||
    pathname.startsWith("/items") ||
    pathname.startsWith("/demands") ||
    pathname.startsWith("/sell") ||
    pathname.startsWith("/mypage")
  ) {
    return "market";
  }
  return null;
}

const KEY = "hokuma-last-section";

export function rememberSection(section: SectionKey) {
  try {
    localStorage.setItem(KEY, section);
  } catch {
    // 保存できないブラウザでは、毎回フリマから始まるだけ
  }
}

export function lastSection(): SectionKey | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "market" || v === "coupons" ? v : null;
  } catch {
    return null;
  }
}

// アプリ(タブ)を開いて最初のページかどうか。同じタブでページを移動しているあいだは false になる
const LAUNCH_KEY = "hokuma-launched";

export function isFreshLaunch() {
  try {
    if (sessionStorage.getItem(LAUNCH_KEY)) return false;
    sessionStorage.setItem(LAUNCH_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
