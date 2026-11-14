// 運営と誤解される名前は使えない。DB 側の is_reserved_nickname() と同じ条件にすること
// (migration PART V)。こちらは入力時にわかりやすく知らせるためのもの。
const RESERVED_NICKNAME = /(運営|公式|管理者|hokuma|ホクマ|ほくま|admin|official)/i;

export function isReservedNickname(nickname: string): boolean {
  return RESERVED_NICKNAME.test(nickname);
}

// ニックネームに使える文字: ひらがな・カタカナ(半角も)・漢字・英数字(全角も)・「ー」「・」「_」「-」・スペース。
// @ などの記号や絵文字は使えない。DB 側の nickname_chars_ok() と同じ条件にすること(migration PART BC)
const ALLOWED_NICKNAME = /^[ぁ-ゖァ-ヺー々〆一-龯A-Za-z0-9Ａ-Ｚａ-ｚ０-９ｦ-ﾟ・＿_－ 　-]+$/u;

export function hasOnlyAllowedChars(nickname: string): boolean {
  return ALLOWED_NICKNAME.test(nickname);
}

// 使えないニックネームなら理由を返す(使えるなら null)
export function nicknameProblem(nickname: string): string | null {
  const n = nickname.trim();
  if (!n) return "ニックネームを入力してください";
  if (isReservedNickname(n)) return "このニックネームは使用できません（「運営」「公式」などを含む名前は使えません）";
  if (!hasOnlyAllowedChars(n)) return "ニックネームに使えるのは、ひらがな・カタカナ・漢字・英数字と「ー」「・」「_」「-」、スペースだけです（@ などの記号や絵文字は使えません）";
  return null;
}
