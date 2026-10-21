// 運営と誤解される名前は使えない。DB 側の is_reserved_nickname() と同じ条件にすること
// (migration PART V)。こちらは入力時にわかりやすく知らせるためのもの。
const RESERVED_NICKNAME = /(運営|公式|管理者|hokuma|ホクマ|ほくま|admin|official)/i;

export function isReservedNickname(nickname: string): boolean {
  return RESERVED_NICKNAME.test(nickname);
}
