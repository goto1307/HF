// 飲食店の提携クーポン(migration PART AT)。
// 受け取り・使用のチェック(期間・曜日・時間帯・1人1回)は DB 側の claim_coupon・use_coupon で行う。
// ここにある判定は、画面の表示(ボタンを押せるか、案内の文)のためのもの。

export const COUPON_COLUMNS =
  "id,shop_name,title,description,benefits,notes,claim_from,use_from,use_until,weekdays,time_windows,max_claims,active";
export const CLAIM_COLUMNS = "id,coupon_id,claimed_at,used_at,benefit,first_visit";

export type TimeWindow = { from: string; to: string }; // "13:00" のような日本時間

export type Coupon = {
  id: string;
  shop_name: string;
  title: string;
  description: string;
  benefits: string[];
  notes: string;
  claim_from: string; // 受け取りを始める日時
  use_from: string; // YYYY-MM-DD
  use_until: string; // YYYY-MM-DD(この日まで)
  weekdays: number[]; // 1=月 … 7=日
  time_windows: TimeWindow[];
  max_claims: number | null;
  active: boolean;
};

export type CouponClaim = {
  id: number;
  coupon_id: string;
  claimed_at: string;
  used_at: string | null;
  benefit: string | null;
  first_visit: boolean | null;
};

const WEEKDAY_LABELS = ["", "月", "火", "水", "木", "金", "土", "日"];

// 日本時間の「今」(日付・曜日・時刻)
export function jstNow(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = jst.toISOString().slice(0, 10);
  const day = jst.getUTCDay(); // 0=日
  const isoDow = day === 0 ? 7 : day;
  const time = jst.toISOString().slice(11, 16); // "13:05"
  return { date, isoDow, time };
}

// 今このクーポンを使えるか(DB の coupon_usable_now() と同じ決まり)
export function usableNow(c: Coupon, now = new Date()) {
  const { date, isoDow, time } = jstNow(now);
  if (date < c.use_from || date > c.use_until) return false;
  if (!c.weekdays.includes(isoDow)) return false;
  if (c.time_windows.length === 0) return true;
  return c.time_windows.some((w) => time >= w.from && time < w.to);
}

// 受け取れる期間か
export function claimOpen(c: Coupon, now = new Date()) {
  return now.getTime() >= new Date(c.claim_from).getTime() && jstNow(now).date <= c.use_until;
}

export function hasEnded(c: Coupon, now = new Date()) {
  return jstNow(now).date > c.use_until;
}

// "2026-11-17" → "11/17(火)"
export function formatDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAY_LABELS[dow === 0 ? 7 : dow]})`;
}

// 日時 → 日本時間の "11/16(月)"
export function formatDateTime(iso: string) {
  return formatDate(jstNow(new Date(iso)).date);
}

// 日時 → 日本時間の "13:05"
export function formatTime(iso: string) {
  return jstNow(new Date(iso)).time;
}

// [2,3,4,5] → "火〜金"、[1,3,5] → "月・水・金"
export function formatWeekdays(days: number[]) {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "毎日";
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length >= 3) {
    return `${WEEKDAY_LABELS[sorted[0]]}〜${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => WEEKDAY_LABELS[d]).join("・");
}

export function formatWindows(windows: TimeWindow[]) {
  if (windows.length === 0) return "営業時間中";
  return windows.map((w) => `${w.from}〜${w.to}`).join("、");
}
