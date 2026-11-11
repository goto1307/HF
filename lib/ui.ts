// サイト全体で使うボタンの見た目(3段階だけ。これ以外のボタンの形は作らない)
// - 第1(primary): 朱色のベタ塗り。そのページでいちばんやってほしい行動だけに使う(1画面に1つが目安)
// - 第2(secondary): 白地＋朱色の枠。2番目以降の行動
// - 第3(text): 文字だけのリンク。補足的な行動
// 大きさや幅(w-full、py-3 など)は、使う場所で足す
export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-orange-700 font-bold text-white shadow-sm transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700";
export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-orange-700 bg-white font-bold text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700";
export const BTN_TEXT =
  "inline-flex items-center gap-1 font-bold text-orange-700 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700";
