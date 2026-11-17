"use client";
import { useState, useSyncExternalStore } from "react";
import { closeClaimed, getClaimedTitle, isClaimedOpen, isClaimedOpenOnServer, subscribeClaimed } from "@/lib/claimedNotice";

// 「クーポンを受け取る」を押したあとに出す、大きなお知らせ。下にホックマの「いただきます」の絵を出す。
// 絵は public/hokkuma-itadakimasu.png に置く(まだ置いていないときは、絵なしで文字だけ出す)
export default function ClaimedOverlay() {
  const open = useSyncExternalStore(subscribeClaimed, isClaimedOpen, isClaimedOpenOnServer);
  const [noImage, setNoImage] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claimed-title"
      onClick={closeClaimed}
      onKeyDown={(e) => e.key === "Escape" && closeClaimed()}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white px-6 pt-7 pb-6 text-center text-[#1B243A] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="claimed-title" className="text-2xl font-extrabold leading-snug text-[#BA421D]">
          {getClaimedTitle()}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#2F3E5C]">
          お店で「お店で使う」を押して、
          <br />
          出てきた画面をお店の方に見せてください
        </p>
        {!noImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hokkuma-itadakimasu.png"
            alt="いただきますをするホックマ"
            className="mx-auto mt-4 max-h-56 w-auto"
            onError={() => setNoImage(true)}
          />
        )}
        <button
          autoFocus
          onClick={closeClaimed}
          className="mt-5 block w-full rounded-full bg-[#BA421D] py-3.5 text-lg font-extrabold text-white active:opacity-80"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
