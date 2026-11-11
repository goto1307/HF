"use client";
import { useEffect } from "react";

// このコンポーネントがある間、ページ全体のスクロールと、端で引っ張ったときの伸び(バウンド)を止める。
// 画面いっぱいの地図のページで使う(地図を動かしたつもりで、ページごと動いてしまわないように)
export default function LockPageScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { htmlOverscroll: html.style.overscrollBehavior, bodyOverscroll: body.style.overscrollBehavior, bodyOverflow: body.style.overflow };
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    return () => {
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.overflow = prev.bodyOverflow;
    };
  }, []);
  return null;
}
