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
  photo?: string; // public/ に置いた写真のパス
};

export const SHOPS: Shop[] = [
  {
    id: "futagozan",
    name: "ふたごザン",
    couponIds: ["futagozan-1"],
    // 北15条西4丁目。北12条駅(43.0748, 141.3484)と、北18条駅から約330mという情報から出した、おおよその位置。
    // 実際の位置とずれていたら、Googleマップでお店を長押しして出る数字に直す
    lat: 43.0786,
    lng: 141.3468,
    address: "札幌市北区北15条西4丁目2-16 NRK札幌ビル1F",
    access: "地下鉄南北線 北18条駅から徒歩約5分",
    genre: "海鮮丼・ザンギ",
    // 細かい時間はお店に確認中。分かっていること(昼は14時まで・夜は17時から)だけを書いている
    hours: "昼は14:00まで、夜は17:00から（詳しい時間はお店にご確認ください）",
    closed: "月曜日",
    menu: [
      { name: "ザンギまにあ丼", price: 950 },
      { name: "海鮮ちらし丼", price: 980 },
      { name: "まぐろまにあ丼", price: 1200 },
      { name: "サーモンまにあ丼", price: 1200 },
      { name: "2個ザンギ", price: 320 },
    ],
    menuNote: "2025年10月時点のメニューの一部です。値段が変わっている場合があります。",
  },
];

export function shopForCoupon(couponId: string): Shop | null {
  return SHOPS.find((s) => s.couponIds.includes(couponId)) ?? null;
}
