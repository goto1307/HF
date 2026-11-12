// 飲食店の提携クーポン(migration PART AT)。
// 受け取り・使用のチェック(期間・曜日・時間帯・使える回数)は DB 側の claim_coupon・use_coupon で行う。
// 何回でも使えるクーポン(max_uses_per_user が null)は PART AV から。
// ここにある判定は、画面の表示(ボタンを押せるか、案内の文)のためのもの。

export const COUPON_COLUMNS =
  "id,shop_name,title,description,benefits,notes,claim_from,use_from,use_until,weekdays,time_windows,max_claims,max_uses_per_user,active";
export const CLAIM_COLUMNS = "id,coupon_id,claimed_at,used_at,benefit,first_visit,use_count";

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
  max_uses_per_user: number | null; // 1人が使える回数(null = 上限なし)
  active: boolean;
};

export type CouponClaim = {
  id: number;
  coupon_id: string;
  claimed_at: string;
  used_at: string | null; // いちばん最近使った日時
  benefit: string | null; // いちばん最近選んだ特典
  first_visit: boolean | null;
  use_count: number; // 使った回数
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

// もう使えないか(上限の回数まで使い切った)
export function usedUp(c: Pick<Coupon, "max_uses_per_user">, claim: Pick<CouponClaim, "use_count"> | null | undefined) {
  if (!claim) return false;
  return c.max_uses_per_user !== null && claim.use_count >= c.max_uses_per_user;
}

// 何回でも使えるクーポンか
export function unlimitedUses(c: Pick<Coupon, "max_uses_per_user">) {
  return c.max_uses_per_user === null;
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

// "2026-11-17" → "11月17日(火)"(期間を大きく見せるとき用)
export function formatDateLong(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}月${d}日(${WEEKDAY_LABELS[dow === 0 ? 7 : dow]})`;
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
  // 1日だけ休み(お店の定休日)のときは「営業日全日」と書く
  if (sorted.length === 6) return "営業日全日";
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

// 特典の書き方: 「特典名｜ひとこと｜注意書き」(｜は全角の縦線。ひとこと・注意書きはなくてもよい)
// 例: "ザンギ増量｜2個注文で+1個、5個注文で+2個"
//     "パルプンテ｜何が出てくるかはお楽しみ｜変更・キャンセルはできません。好き嫌いやアレルギーがある方はご利用をお控えください"
// DB(coupon.benefits)にはこの文字列のまま入れる。使ったときに記録されるのも、この文字列そのもの
export type Benefit = { raw: string; name: string; detail: string | null; caution: string | null };

export function parseBenefit(raw: string): Benefit {
  const [name, detail, caution] = raw.split("｜").map((s) => s.trim());
  return { raw, name: name || raw, detail: detail || null, caution: caution || null };
}

// 記録された特典の文字列から、名前だけを出す(使用済みの画面・集計で使う)
export function benefitName(raw: string | null) {
  return raw ? parseBenefit(raw).name : "";
}
