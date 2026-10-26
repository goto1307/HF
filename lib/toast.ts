// 画面内に出す短いお知らせ(トースト)。ブラウザの alert() の代わりに使う。
// どのページからでも toast("...") を呼べば、ルートレイアウトの <Toaster /> に表示される。
// ページを移動しても消えないので、「出品しました！」のあとに router.push しても大丈夫。

export type ToastKind = "success" | "error";
export type Toast = { id: number; message: string; kind: ToastKind };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getToasts() {
  return toasts;
}

const EMPTY: Toast[] = [];
export function getServerToasts() {
  return EMPTY;
}

export function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// 「〜しました」は完了のお知らせ、それ以外(入力の不備や失敗)は注意のお知らせとして色を変える
function guessKind(message: string): ToastKind {
  return /しました|送りました|受け付けました/.test(message) && !/失敗|エラー/.test(message) ? "success" : "error";
}

export function toast(message: string, kind: ToastKind = guessKind(message)) {
  // 同じお知らせが連打で重ならないように、表示中の同じ文はいったん消して出し直す
  const same = toasts.find((t) => t.message === message);
  if (same) dismissToast(same.id);
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }].slice(-3);
  emit();
  // 長い文ほど長めに表示する(最短3.5秒、最長8秒)
  const ms = Math.min(8000, Math.max(3500, message.length * 120));
  timers.set(id, setTimeout(() => dismissToast(id), ms));
}
