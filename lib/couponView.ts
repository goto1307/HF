import { supabase } from "@/lib/supabase";

// クーポンのページ(地図のシート・詳細ページ)を開いたことを記録する(migration PART AT の coupon_view)。
// ブラウザごとに1回だけ。誰が見たかは記録しない
export function recordCouponView(couponId: string, loggedIn: boolean) {
  const key = `hokuma-coupon-viewed-${couponId}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // 保存できないブラウザでは、開くたびに数えないよう記録しない
    return;
  }
  supabase.from("coupon_view").insert({ coupon_id: couponId, logged_in: loggedIn }).then(() => {});
}
