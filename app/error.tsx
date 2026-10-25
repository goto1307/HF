"use client"; // エラーの受け皿はクライアントコンポーネントにする必要がある
import { useEffect } from "react";
import Link from "next/link";
import HokkumaMascot from "@/components/HokkumaMascot";

// 予期しないエラーが起きたときの表示。retry() でそのページを読み込み直す
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <HokkumaMascot size={96} className="mx-auto mb-4" />
        <h1 className="text-xl font-extrabold text-stone-700 mb-2">うまく表示できませんでした</h1>
        <p className="text-sm text-stone-500 mb-6">
          通信が不安定なときに起きることがあります。もう一度読み込むか、少し時間をおいてからお試しください。
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => retry()} className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors">
            もう一度読み込む
          </button>
          <Link href="/" className="border border-orange-200 text-orange-700 px-6 py-3 rounded-full font-bold bg-white hover:bg-orange-100 transition-colors">
            トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
