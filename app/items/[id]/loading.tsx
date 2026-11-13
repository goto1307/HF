// 商品ページ(とその下のチャット・編集のページ)を開くときの、読み込み中の表示。
// 商品ページはアクセスのたびにサーバー(Vercel、いまは米国)で作るページなので、
// これがないと、押してからサーバーの返事が来るまで前の画面(マイページなど)のまま止まって見えていた。
// これを置くと、リンクが画面に入ったときにこの表示を先に読み込んでおけるので、押した瞬間に切り替わる
import Header from "@/components/Header";
import { PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <PageSkeleton />
    </div>
  );
}
