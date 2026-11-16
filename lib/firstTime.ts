// 「初めての人向けの表示」(使い方・吹き出し・紹介など)を、もう一度出せるようにする(運営の動作確認用)。
// どれもブラウザに「もう見た」を覚えて2回目からは出さない作りなので、その記録を消す。
// 管理者メニュー(components/AppLauncher.tsx)からだけ呼ぶ。

// ホックマの紹介(components/DemandBubbles.tsx)は「登録して14日以内の人」にしか出ない。
// 運営が確かめられるよう、これが入っている間は登録日に関係なく出す(紹介を閉じると消える)
export const FORCE_INTRO_KEY = "hokuma-force-intro";

// ブラウザに覚えている「もう見た・閉じた」の記録
const LOCAL_KEYS = [
  "heroDismissed", // トップの案内
  "hokuma-demands-tutorial-seen", // 欲しい！の使い方(4ステップ)
  "hokuma-coupon-tip-seen", // 「クーポンはこちら」の吹き出し
  "hokuma-coupon-tip-guest-seen", // 登録していない人向けの「クーポンはここから見られます」
  "hokuma-coupon-banner-closed", // トップのクーポンの帯を閉じたか
  "hokuma-coupon-detail-tip-seen", // クーポンの地図の「詳細はこちら」の吹き出し
  "hokuma-coupon-detail-tip-guest-seen", // 同じ(登録前の人向け)
];
const LOCAL_PREFIXES = ["hokuma-hokkuma-intro-seen"]; // ホックマの紹介(人ごと)
const SESSION_KEYS = ["demandBubblesHidden"]; // 欲しい！の吹き出しを隠したか

export function resetFirstTimeViews() {
  try {
    for (const k of LOCAL_KEYS) localStorage.removeItem(k);
    for (const k of Object.keys(localStorage)) {
      if (LOCAL_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }
    for (const k of SESSION_KEYS) sessionStorage.removeItem(k);
    localStorage.setItem(FORCE_INTRO_KEY, "1");
  } catch {
    // 覚えられないブラウザでは何もしない
  }
}

export function forceIntro() {
  try {
    return localStorage.getItem(FORCE_INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

// ---------- ホックマの紹介がこれから出るか ----------
// 登録したばかりの人には、トップでホックマの紹介(components/DemandBubbles.tsx)が先に出る。
// 「クーポンはこちら」の吹き出しは、紹介を閉じたあとに出す(同時に出すと紹介の暗い画面に隠れるため)
export const INTRO_SEEN_PREFIX = "hokuma-hokkuma-intro-seen";
export const INTRO_NEW_USER_DAYS = 14;
export const INTRO_CLOSED_EVENT = "hokuma-intro-closed";

export function introPending(userId: string, createdAt: string | undefined) {
  try {
    if (localStorage.getItem(`${INTRO_SEEN_PREFIX}-${userId}`) === "1") return false;
    const isNewUser = !!createdAt && Date.now() - new Date(createdAt).getTime() < INTRO_NEW_USER_DAYS * 86400000;
    return isNewUser || forceIntro();
  } catch {
    return false;
  }
}

// 紹介が閉じられたら知らせてもらう(useSyncExternalStore 用)
export function subscribeIntroClosed(cb: () => void) {
  window.addEventListener(INTRO_CLOSED_EVENT, cb);
  return () => window.removeEventListener(INTRO_CLOSED_EVENT, cb);
}
