"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TERMS_UPDATE } from "@/lib/terms";

// 利用規約を変えたときのお知らせ。lib/terms.ts の TERMS_UPDATE.showUntil まで表示する。
// detail を付けると、変更内容の一覧も出す(利用規約ページ用)
export default function TermsNotice({ detail = false }: { detail?: boolean }) {
  // 日付の判定はブラウザで行う(サーバーで作ったページが古いまま残っても、期限が過ぎたら消えるように)
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(Date.now() < new Date(TERMS_UPDATE.showUntil).getTime());
  }, []);

  if (!show) return null;

  if (!detail) {
    return (
      <Link
        href="/terms"
        className="mb-3 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-stone-800 hover:bg-orange-100 transition-colors"
      >
        <span className="shrink-0 text-[10px] font-bold text-white bg-orange-700 rounded px-1.5 py-0.5">お知らせ</span>
        <span className="min-w-0 flex-1 text-sm font-bold">
          {TERMS_UPDATE.effectiveOn}から利用規約が変わります
        </span>
        <span className="shrink-0 text-xs font-bold text-orange-700">見る</span>
      </Link>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-stone-800 leading-relaxed">
      <p className="font-bold">利用規約の変更のお知らせ（{TERMS_UPDATE.announcedOn}）</p>
      <p className="mt-2">
        {TERMS_UPDATE.effectiveOn}から、利用規約を次のとおり変更します。下の規約は、変更後の内容です。
      </p>
      <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
        {TERMS_UPDATE.changes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mt-2">
        {TERMS_UPDATE.effectiveOn}以降に本サービスを利用した場合は、変更後の利用規約に同意したものとみなします。
      </p>
    </div>
  );
}
