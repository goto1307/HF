import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

// ---------- ログインしたら元のページに戻す ----------

// ログイン後に戻してはいけないページ(ログイン・登録まわり)
const NO_RETURN = /^\/(login|join|register|logout|reset|update-password)(\/|$|\?)/;

// 今いるページ(パス + クエリ)。サーバーで描画するときは空
export function currentPath() {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

// ログイン画面へのリンク。next にログイン後に戻るページを付ける
export function loginPath(next: string = currentPath()) {
  const safe = safeNext(next);
  return safe === "/" ? "/login" : `/login?next=${encodeURIComponent(safe)}`;
}

// 外部サイトや登録まわりへは戻さない(サイト内の / で始まるパスだけ許す)
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  // タブ・改行などの見えない文字や「\」は使わない。ブラウザは URL を読むときに
  // これらを取り除いたり「/」とみなしたりするため、「/(タブ)/偽サイト」が
  // 「//偽サイト」として外部サイトへの移動になってしまう
  if (/[\u0000-\u001F\u007F\s\\]/.test(next)) return "/";
  // 念のため、ブラウザと同じ方法で読んで、同じサイトのままかを確かめる
  if (typeof window !== "undefined") {
    try {
      const url = new URL(next, window.location.origin);
      if (url.origin !== window.location.origin) return "/";
      next = url.pathname + url.search + url.hash;
    } catch {
      return "/";
    }
  }
  if (NO_RETURN.test(next)) return "/";
  return next;
}

// ---------- 「戻る」ボタン ----------

// このタブでサイト内のページ移動をした回数(NavTracker が数える)。
// 0 のまま = インスタや LINE のリンクから直接開いたなど、戻る先がサイト内に無い
let internalNavigations = 0;
export function countInternalNavigation() {
  internalNavigations++;
}

// サイト内に戻る先があれば戻り、無ければ fallback(既定はトップ)へ
export function goBack(router: Router, fallback = "/") {
  if (internalNavigations > 0) router.back();
  else router.push(fallback);
}
