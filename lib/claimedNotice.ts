// 「クーポンを受け取る」を押したあとに、画面いっぱいに出すお知らせ。
// どの画面からでも showClaimed() を呼べば、ルートレイアウトの <ClaimedOverlay /> に表示される(toast と同じ仕組み)。

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeClaimed(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isClaimedOpen() {
  return open;
}

export function isClaimedOpenOnServer() {
  return false;
}

export function showClaimed() {
  open = true;
  emit();
}

export function closeClaimed() {
  open = false;
  emit();
}
