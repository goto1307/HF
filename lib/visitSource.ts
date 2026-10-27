// 「どこから HOKUMA を知ったか」の目印(/qr?from=insta など)を、登録するまでブラウザに覚えておく。
// 登録するときに user_metadata.source として保存し、管理者の集計ページで
// 「インスタから来て登録した人の数」などを数える(migration PART AP)。

// DB 側(migration PART AN・AP)と同じ決まり
export const SOURCE_PATTERN = /^[a-z0-9_-]{1,32}$/;

const KEY = "hokuma-visit-source";
const KEEP_DAYS = 30;

// 最初に来たときの目印を優先する(あとからポスターを見ても上書きしない)。
// 30日たったら、新しい目印で覚え直す。
export function rememberSource(source: string) {
  if (!SOURCE_PATTERN.test(source)) return;
  try {
    if (getSource()) return;
    localStorage.setItem(KEY, JSON.stringify({ source, at: Date.now() }));
  } catch {
    // プライベートブラウズなどで保存できなくても、そのまま進める
  }
}

export function getSource(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { source?: unknown; at?: unknown } | null;
    if (!saved || typeof saved.source !== "string" || typeof saved.at !== "number") return null;
    if (Date.now() - saved.at > KEEP_DAYS * 24 * 60 * 60 * 1000) return null;
    return SOURCE_PATTERN.test(saved.source) ? saved.source : null;
  } catch {
    return null;
  }
}

// 学内アンケートなどで、登録前のアンケートと同じ内容にもう答えてくれた人の印。
// /qr?from=street&survey=done で付け、新規登録(/join)でGoogleフォームを飛ばして
// 登録画面へ案内する。サイトはふつうに見て回れるよう、トップに着いてから使う。
const SURVEY_KEY = "hokuma-survey-done";

export function markSurveyDone() {
  try {
    localStorage.setItem(SURVEY_KEY, String(Date.now()));
  } catch {
    // 保存できないときは、ふつうにアンケートから登録してもらう
  }
}

export function isSurveyDone(): boolean {
  try {
    const at = Number(localStorage.getItem(SURVEY_KEY));
    return at > 0 && Date.now() - at <= KEEP_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
