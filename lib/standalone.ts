import { useSyncExternalStore } from "react";

// ホーム画面のアイコンから開いているか(アプリのように全画面で開いているか)。
// ※ 分かるのは「いまホーム画面から開いているか」だけ。追加済みでもブラウザから開いたときは false になる
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useIsStandalone() {
  return useSyncExternalStore(subscribe, isStandalone, () => false);
}
