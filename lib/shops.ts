// 提携しているお店の情報(クーポンの地図とお店の情報タブで使う)。
// お店が増えたら、ここに1件足す。地図のピンの位置は lat(緯度)・lng(経度)。
// ※ 書いた内容はそのまま利用者に見えるので、お店に確認できたことだけを書く。
//    確認できていないものは null にしておけば、画面に出さない

export type MenuItem = { name: string; price: number | null; note?: string };

export type Shop = {
  id: string;
  name: string;
  couponIds: string[]; // このお店のクーポン(coupon.id)
  lat: number;
  lng: number;
  address: string;
  access: string;
  genre: string;
  hours: string | null; // 営業時間
  closed: string | null; // 定休日
  menu: MenuItem[];
  menuNote: string | null; // メニューの注意書き(いつ時点の情報かなど)
  photo?: string; // いちばん上に大きく出す写真(public/ に置いた写真のパス。例: "/shops/futagozan/top.jpg")
  photos: string[]; // 「お店の写真」に並べる写真(public/ に置いた写真のパス)
  photoSlots: number; // 写真がまだ届いていないとき、運営に見せる空き枠の数
  benefitPhotos: Record<string, string>; // 特典の名前(｜より前) → 特典のボタンに入れる写真のパス
  couponImage?: string; // 地図のシートで、クーポン名の代わりに出す画像(「空きコマクーポン」のデザイン。public/ に置いた画像のパス)
};

export const SHOPS: Shop[] = [
  {
    id: "futagozan",
    name: "ふたごザン",
    couponIds: ["futagozan-1"],
    // 北15条西4丁目。北大前通り(西5丁目)のすぐ東側(Googleマップの画面と見比べて合わせた)。
    // スクリーンショットから測った値なので、まだ少しずれている可能性がある。
    // 正確に直すには、クーポンの地図で運営だけに出る「位置を調べる」を押してお店の場所をタップし、出た数字を入れる
    lat: 43.07885,
    lng: 141.34598,
    address: "札幌市北区北15条西4丁目2-16 NRK札幌ビル1F",
    access: "地下鉄南北線 北18条駅から徒歩約5分",
    genre: "海鮮丼・ザンギ",
    hours: "11:00〜14:00、17:00〜22:00",
    closed: "月曜日",
    menu: [
      { name: "サーモンまにあ丼", price: 1200 },
      { name: "まぐろマニア丼", price: 1200 },
      { name: "店主の気まぐれ海鮮ちらし丼", price: 980 },
      { name: "ザンギまにあ丼", price: 950 },
      { name: "ザンギ 2個", price: 320 },
      { name: "ザンギ 5個", price: 750 },
      { name: "本日の味噌汁", price: 200 },
    ],
    // 写真は後で入れる。public/shops/futagozan/ に置いて、photo と photos にパスを書く
    photo: undefined,
    photos: [],
    photoSlots: 3,
    // 例: "ご飯を特盛に変更": "/shops/futagozan/tokumori.jpg"
    benefitPhotos: {},
    couponImage: undefined,
    menuNote: null,
  },
];

export function shopForCoupon(couponId: string): Shop | null {
  return SHOPS.find((s) => s.couponIds.includes(couponId)) ?? null;
}
