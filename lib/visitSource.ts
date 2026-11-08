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
