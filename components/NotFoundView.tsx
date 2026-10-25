import Link from "next/link";
import HokkumaMascot from "@/components/HokkumaMascot";

// ページや商品が見つからないときの表示(app/not-found.tsx・商品ページで共通)
export default function NotFoundView({
  title = "ページが見つかりませんでした",
  message = "URL が間違っているか、ページが削除された可能性があります。",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <HokkumaMascot size={96} className="mx-auto mb-4" />
      <h1 className="text-xl font-extrabold text-stone-700 mb-2">{title}</h1>
      <p className="text-sm text-stone-500 mb-6">{message}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/" className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors">
          商品を探す
        </Link>
        <Link href="/demands" className="border border-orange-200 text-orange-700 px-6 py-3 rounded-full font-bold bg-white hover:bg-orange-100 transition-colors">
          みんなの欲しい！を見る
        </Link>
      </div>
    </div>
  );
}
