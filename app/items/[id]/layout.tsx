// 商品ページ(とその下のチャット・編集のページ)の外枠。
// 商品ページの中身は、ブラウザでデータを読んでから出す作り(サーバーでは人ごと・商品ごとの中身を作らない)。
// それなのに、これまではアクセスのたびにサーバー(Vercel、米国ワシントン)で作り直していて、
// 押してから画面が変わるまで 0.25〜0.55 秒以上かかっていた。
// 空の一覧を返すと、商品ごとのページを最初に開かれたときに1回だけ作って、あとは作り置きを配る(トップページと同じ)。
// 作り置きされるのは外枠だけで、商品の内容・ログインの状態は、今までどおり開くたびにブラウザで読む
export async function generateStaticParams() {
  return [];
}

export default function ItemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
