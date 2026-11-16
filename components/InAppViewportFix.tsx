"use client";
import { useEffect } from "react";

// インスタ・LINE・Facebook のアプリの中で開いたページ(アプリ内ブラウザ)は、
// 入力欄を押したときや2本指で触れたときに拡大され、そのまま戻らないことがある
// (画面の左右が切れて、☰ やボタンが押せなくなる)。
// アプリ内ブラウザのときだけ、ページの拡大を止める。ふつうのブラウザ(Safari・Chrome)は今までどおり拡大できる
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Line\//i;

export default function InAppViewportFix() {
  useEffect(() => {
    if (!IN_APP.test(navigator.userAgent)) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
  }, []);
  return null;
}
