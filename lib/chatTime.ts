// チャットのメッセージに付ける時刻の表示。
// 今日なら「14:05」、昨日なら「昨日 14:05」、今年なら「11/5 14:05」、それより前なら「2025/11/5 14:05」。
// 利用者は北大生なので、端末の設定に関係なく日本時間で表示する。

const TZ = "Asia/Tokyo";

// 日本時間での「年・月・日・時・分」を取り出す
function parts(d: Date) {
  const p = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function formatChatTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const t = parts(date);
  const today = parts(now);
  const yesterday = parts(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  if (t.y === today.y && t.m === today.m && t.d === today.d) return t.time;
  if (t.y === yesterday.y && t.m === yesterday.m && t.d === yesterday.d) return `昨日 ${t.time}`;
  if (t.y === today.y) return `${t.m}/${t.d} ${t.time}`;
  return `${t.y}/${t.m}/${t.d} ${t.time}`;
}
