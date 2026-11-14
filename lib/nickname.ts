// 運営と誤解される名前は使えない。DB 側の is_reserved_nickname() と同じ条件にすること
// (migration PART V)。こちらは入力時にわかりやすく知らせるためのもの。
const RESERVED_NICKNAME = /(運営|公式|管理者|hokuma|ホクマ|ほくま|admin|official)/i;

export function isReservedNickname(nickname: string): boolean {
  return RESERVED_NICKNAME.test(nickname);
}

// ニックネームに使えない記号: " # $ % & ' ( ) ` @ : ; (半角・全角とも)と、‘ ’ “ ”。
// メールアドレスをそのままニックネームにしてしまう人がいたため(@ を入れられないようにする)。
// ! や ? などのほかの記号は使える。DB 側の nickname_chars_ok() と同じ条件にすること(migration PART BC)
const BLOCKED_NICKNAME_CHARS = /["#$%&'()`@:;＂＃＄％＆＇（）｀＠：；‘’“”]/;

export function hasOnlyAllowedChars(nickname: string): boolean {
  return !BLOCKED_NICKNAME_CHARS.test(nickname);
}

// 使えないニックネームなら理由を返す(使えるなら null)
export function nicknameProblem(nickname: string): string | null {
  const n = nickname.trim();
  if (!n) return "ニックネームを入力してください";
  if (isReservedNickname(n)) return "このニックネームは使用できません（「運営」「公式」などを含む名前は使えません）";
  if (!hasOnlyAllowedChars(n)) return "ニックネームに次の記号は使えません：\" # $ % & ' ( ) ` @ : ;（メールアドレスはニックネームにできません）";
  return null;
}
