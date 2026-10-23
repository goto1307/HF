// みんなの欲しい！(migration PART AD)。user_id は列ごと読めないので含めない。
export const DEMAND_COLUMNS = "id,title,budget,deadline,tags,note,status,created_at";

export const DEMAND_TITLE_MAX = 20;
export const DEMAND_NOTE_MAX = 200;
export const DEMAND_TAG_MAX = 5;

export type Demand = {
  id: number;
  title: string;
  budget: number;
  deadline: string; // YYYY-MM-DD(日本時間の日付)
  tags: string[];
  note: string | null;
  status: "open" | "fulfilled" | "withdrawn" | "removed";
  created_at: string;
};

// my_demands() の戻り値。自分が登録したもの(is_owner)と、僕も！を押したものの両方が入る。
export type MyDemand = Demand & {
  fulfilled_item_id: number | null;
  offered: boolean;
  is_owner: boolean;
  my_done: boolean; // 自分の分は買えた！にしたか
  wanters: number; // まだ買えていない人数(登録者 + 僕も！)
};

// demand_vote_summary() の戻り値。votes はまだ買えていない僕も！の人数。
export type DemandVote = { demand_id: number; votes: number; voted: boolean; my_done: boolean; owner_done: boolean };

// まだ欲しがっている人数 = 登録した本人(買えた！にしていなければ) + 買えていない僕も！の人数
export function wantCount(vote: Pick<DemandVote, "votes" | "owner_done"> | undefined) {
  return (vote?.votes ?? 0) + (vote?.owner_done ? 0 : 1);
}

// 日本時間の今日を YYYY-MM-DD で返す(DB の jst_today() と合わせる)
export function jstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysLeft(deadline: string) {
  const ms = new Date(`${deadline}T00:00:00Z`).getTime() - new Date(`${jstToday()}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

export function formatDeadline(deadline: string) {
  const [, m, d] = deadline.split("-").map(Number);
  const left = daysLeft(deadline);
  const rest = left < 0 ? "期限切れ" : left === 0 ? "今日まで" : `あと${left}日`;
  return `${m}/${d}まで（${rest}）`;
}

export function formatBudget(budget: number) {
  return budget === 0 ? "無料なら欲しい" : `¥${budget.toLocaleString()}まで`;
}

export function isActiveDemand(d: Pick<Demand, "status" | "deadline">) {
  return d.status === "open" && d.deadline >= jstToday();
}

// ---------- 出品と欲しい！の一致判定 ----------
// 出品したときに「この欲しい！の中にありませんか？」と案内する候補を選ぶ。
// 候補に入れる基準はここの2つの値で調整する。
//   - タグ: 欲しい！のタグと出品のハッシュタグが1つでも一致(片方がもう片方を含む)
//   - 商品名: 欲しい！の商品名の2文字の並びのうち、出品のタイトル+ハッシュタグに
//     含まれる割合が DEMAND_TITLE_MATCH_RATIO 以上
export const DEMAND_TAG_MATCH_MIN = 1;
export const DEMAND_TITLE_MATCH_RATIO = 0.5;
export const DEMAND_MATCH_LIMIT = 10; // DB の offer_item_to_demands() の上限と合わせる

function normalize(s: string) {
  return s.normalize("NFKC").toLowerCase().replace(/^#+/, "").replace(/\s+/g, "");
}

function bigrams(s: string) {
  if (s.length < 2) return s ? [s] : [];
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

export function demandMatchScore(demand: Pick<Demand, "title" | "tags">, item: { title: string; hashtags: string[] }) {
  const itemTags = item.hashtags.map(normalize).filter(Boolean);
  const tagHits = demand.tags
    .map(normalize)
    .filter((t) => t && itemTags.some((it) => it.includes(t) || t.includes(it))).length;

  const grams = bigrams(normalize(demand.title));
  const haystack = normalize(item.title) + " " + itemTags.join(" ");
  const titleRatio = grams.length === 0 ? 0 : grams.filter((g) => haystack.includes(g)).length / grams.length;

  const matched = tagHits >= DEMAND_TAG_MATCH_MIN || titleRatio >= DEMAND_TITLE_MATCH_RATIO;
  return { matched, score: tagHits + titleRatio };
}

export function findMatchingDemands<T extends Pick<Demand, "title" | "tags">>(
  demands: T[],
  item: { title: string; hashtags: string[] },
) {
  return demands
    .map((d) => ({ demand: d, ...demandMatchScore(d, item) }))
    .filter((m) => m.matched)
    .sort((a, b) => b.score - a.score)
    .slice(0, DEMAND_MATCH_LIMIT)
    .map((m) => m.demand);
}
