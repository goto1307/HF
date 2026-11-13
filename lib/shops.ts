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
  phone: string | null; // 電話番号(押すと電話をかけられる)
  menu: MenuItem[];
  menuNote: string | null; // メニューの注意書き(いつ時点の情報かなど)
  photoPosition?: string; // いちばん上の写真のどこを見せるか(CSS の object-position。例: "50% 12%")
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
    phone: "011-600-6525",
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
    photo: "/shops/futagozan/top.jpg", // 1番: 店の外観(看板)
    photoPosition: "50% 12%", // 横長の枠で看板が切れないよう、上のほうを見せる
    photos: ["/shops/futagozan/salmon-don.jpg", "/shops/futagozan/interior.jpg"], // 2番: サーモン丼、3番: 店内
    photoSlots: 3,
    benefitPhotos: {
      // 5番。写真ではなく、フォント「Yuji Boku」(SIL Open Font License 1.1。商用利用可)で文字を並べた画像。
      // 画像生成AIの絵ではない。実物の特盛の写真が手に入ったら差し替える
      "ご飯を特盛に変更": "/shops/futagozan/tokumori.jpg",
      "ザンギ増量": "/shops/futagozan/zangi.jpg", // 6番
      // 8番。名前を「昆布茶1杯」→「あっつアツ昆布茶」に変えた(PART BB)。SQL の実行前後どちらでも出るよう両方に付ける
      "あっつアツ昆布茶": "/shops/futagozan/konbucha.jpg",
      "昆布茶1杯": "/shops/futagozan/konbucha.jpg",
      // 9番。フォント「Yuji Boku」(SIL Open Font License 1.1)の「？」を朱色で置いた画像(画像生成AIの絵ではない)。
      // 名前を「パルプンテ」→「店主のおまかせ一品」に変えた(PART AZ)。SQL の実行前後どちらでも出るよう両方に付ける
      "店主のおまかせ一品": "/shops/futagozan/omakase.jpg",
      "パルプンテ": "/shops/futagozan/omakase.jpg",
    },
    couponImage: undefined,
    menuNote: null,
  },
];

// 写真の空き枠に振る番号(写真を送るときに「何番にこの写真」と伝えるため。運営にだけ見える)
// 1: いちばん上の大きな写真 / 2〜4: お店の情報の小さい写真 / 5〜9: 特典(並び順) / 10: クーポン名の画像
export const PHOTO_NO = { top: 1, smallFrom: 2, benefitFrom: 5, couponImage: 10 };

export function shopForCoupon(couponId: string): Shop | null {
  return SHOPS.find((s) => s.couponIds.includes(couponId)) ?? null;
}
