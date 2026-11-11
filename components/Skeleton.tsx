// 読み込み中の表示(サイト全体でこの1種類だけを使う)。
// 文字の「読み込み中...」は使わず、出てくる中身の形に合わせてこれを並べる
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-xl bg-stone-200/70 animate-pulse motion-reduce:animate-none ${className}`} />;
}

// 画面の読み上げ用に「読み込み中」と伝える(見た目には出ない)
export function LoadingLabel() {
  return <span className="sr-only" role="status">読み込み中</span>;
}

// ページ全体を読み込んでいる間の表示(写真＋文字のカードの形)
export function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <LoadingLabel />
      <Skeleton className="h-5 w-16 mb-6" />
      <Skeleton className="aspect-[4/3] w-full mb-4 rounded-2xl" />
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-7 w-3/4 mb-3" />
      <Skeleton className="h-8 w-28 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
