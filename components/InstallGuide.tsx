"use client";
import { useEffect, useState } from "react";
import { IconX } from "@/components/icons";

// スマホのホーム画面に HOKUMA を追加する方法の案内。
// Android の Chrome などは、ボタン1つで追加できる(beforeinstallprompt)。
// iPhone(Safari)はボタンで追加できないので、手順を文章で案内する。

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// ページを開いた直後に届くイベントなので、モジュールを読み込んだ時点から受け取っておく
let deferredPrompt: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  });
}

type Platform = "standalone" | "ios" | "android" | "other";

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  const ua = navigator.userAgent;
  // iPadOS の Safari は Mac と名乗るので、タッチ対応かどうかでも見分ける
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export default function InstallGuide({ onClose }: { onClose: () => void }) {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [canPrompt, setCanPrompt] = useState(() => deferredPrompt !== null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanPrompt(false);
    if (outcome === "accepted") setInstalled(true);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pwa-icon-192.png" alt="" className="w-12 h-12 rounded-xl border border-stone-200" />
            <h2 className="text-lg font-extrabold text-stone-700">ホーム画面に追加</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="閉じる">
            <IconX size={20} />
          </button>
        </div>
        <p className="text-sm text-stone-600 mb-4">ホーム画面のアイコンから、アプリのようにすぐ HOKUMA を開けるようになります。</p>

        {installed || platform === "standalone" ? (
          <p className="text-sm font-bold text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            {installed ? "ホーム画面に追加しました！" : "いまホーム画面から開いています。追加済みです！"}
          </p>
        ) : canPrompt ? (
          <button
            onClick={handleInstall}
            className="w-full bg-orange-700 text-white py-3 rounded-full font-bold hover:bg-orange-800 transition-colors"
          >
            ホーム画面に追加する
          </button>
        ) : platform === "ios" ? (
          <ol className="text-sm text-stone-700 flex flex-col gap-3 list-decimal pl-5">
            <li>
              画面の下(iPad は上)にある<span className="font-bold">共有ボタン</span>
              <span className="inline-flex items-center justify-center mx-1 px-1.5 rounded border border-stone-300 text-xs">□↑</span>
              を押します
            </li>
            <li>出てきたメニューを下にずらして、<span className="font-bold">「ホーム画面に追加」</span>を押します</li>
            <li>右上の<span className="font-bold">「追加」</span>を押せば完了です</li>
            <li className="text-xs text-stone-500 list-none -ml-5">うまくいかないときは、Safari で HOKUMA を開いてからお試しください。</li>
          </ol>
        ) : platform === "android" ? (
          <ol className="text-sm text-stone-700 flex flex-col gap-3 list-decimal pl-5">
            <li>Chrome の右上の<span className="font-bold">「︙」</span>(メニュー)を押します</li>
            <li><span className="font-bold">「ホーム画面に追加」</span>または<span className="font-bold">「アプリをインストール」</span>を押します</li>
            <li>確認が出たら<span className="font-bold">「追加」</span>(「インストール」)を押せば完了です</li>
          </ol>
        ) : (
          <div className="text-sm text-stone-700 flex flex-col gap-2">
            <p>スマホで HOKUMA を開いて、このメニューからもう一度「ホーム画面に追加」を選んでください。</p>
            <p className="text-xs text-stone-500">パソコンの Chrome や Edge では、アドレスバーの右側のインストールのアイコンからも追加できます。</p>
          </div>
        )}
      </div>
    </div>
  );
}
