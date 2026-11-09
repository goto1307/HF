// クーポンのお店が、北大まわりの地図(components/CampusMap.tsx)のどこにあるか。
// 地図は位置関係が分かるように描いたイラストで、本物の縮尺ではない。
// お店が増えたら、ここに1行足す(x・y は地図の中の位置。横 0〜360、縦 0〜440、上が北)。

export type CouponPlace = {
  x: number;
  y: number;
  address: string; // 住所のうち、場所の見当がつく部分
  access: string; // 行き方のひとこと
};

export const COUPON_PLACES: Record<string, CouponPlace> = {
  // ふたごザン: 札幌市北区北15条西4丁目(北大前通り沿い)。地下鉄北18条駅から徒歩5分ほど(食べログの店舗情報より)
  "futagozan-1": { x: 246, y: 214, address: "北15条西4丁目", access: "地下鉄北18条駅から徒歩約5分" },
};
