"use client";
import { useEffect, useState, type RefObject } from "react";

// 下のほうまで読んだら出てくる「↑ 上へ」ボタン。押すといちばん上まで戻る。
// target: 中だけが動く箱(地図のシートなど)。指定しなければページ全体
export default function ScrollTopButton({
  target,
  className = "",
}: {
  target?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = target?.current ?? null;
    const read = () => {
      const top = el ? el.scrollTop : window.scrollY;
      const height = el ? el.clientHeight : window.innerHeight;
      const full = el ? el.scrollHeight : document.documentElement.scrollHeight;
      // ある程度下に動いていて、下の端に近づいたら出す
      setShow(top > 200 && top + height >= full - 160);
    };
    const src: HTMLElement | Window = el ?? window;
    src.addEventListener("scroll", read, { passive: true });
    read();
    return () => src.removeEventListener("scroll", read);
  }, [target]);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => (target?.current ?? window).scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="いちばん上へ戻る"
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#2F3E5C] text-xl font-black text-white shadow-lg active:opacity-80 ${className}`}
    >
      ↑
    </button>
  );
}
