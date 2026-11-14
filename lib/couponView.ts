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

// いま配布中のクーポンを、ログインしている人のクーポンボックスに自動で入れる(migration PART BC)。
// 「受け取る」ボタンはなくし、クーポンの画面やクーポンボックスを開いたときにこれを呼ぶ。失敗しても画面は止めない
export async function claimOpenCoupons() {
  try {
    await supabase.rpc("claim_open_coupons");
  } catch {
    // 何もしない(次に開いたときにもう一度試す)
  }
}
