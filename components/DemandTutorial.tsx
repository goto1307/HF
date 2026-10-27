"use client";
import { useState, useSyncExternalStore } from "react";
import { IconX } from "@/components/icons";

// みんなの欲しい！ページの使い方の説明。初めて開いたときに自動で出し、
// 見終わったら(または閉じたら)ブラウザに覚えて、次からは「使い方」ボタンで開く。
const SEEN_KEY = "hokuma-demands-tutorial-seen";

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // 覚えられない環境では、毎回出さないようにする
  }
}

const noop = () => () => {};

// 実際の画面のボタンに似せた見本
function Sample({ children, filled = false }: { children: React.ReactNode; filled?: boolean }) {
  return (
    <span
      className={`inline-block font-bold rounded-full border text-sm px-4 py-1.5 ${
        filled ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-700 border-orange-200"
      }`}
    >
      {children}
    </span>
  );
}

const STEPS: { title: string; body: string; sample: React.ReactNode }[] = [
  {
    title: "みんなの欲しい！ってなに？",
    body: "北大生が「これが欲しい」と書きこめる場所です。だれが書いたかは、ほかの人には表示されません。",
    sample: (
      <div className="flex items-end gap-2">
        <div className="flex flex-wrap justify-center gap-2 pb-6">
          {["水産ハンドブック", "ダウン", "小説"].map((t) => (
            <span key={t} className="bg-white border-2 border-orange-200 rounded-full px-3 py-1 text-sm font-bold text-stone-700 shadow-sm">
              {t}
            </span>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hokkuma-thinking.png" alt="" className="h-24 w-auto shrink-0" />
      </div>
    ),
  },
  {
    title: "欲しいものがあるとき",
    body: "左下の「＋ 欲しい！」から、商品名・出せる金額・いつまでに欲しいかを書きます。合う商品を出品した人が知らせてくれると、通知とメールが届きます。",
    sample: (
      <span className="inline-block bg-gradient-to-br from-orange-600 to-orange-700 text-white px-5 py-2.5 rounded-full font-bold shadow-md">
        ＋ 欲しい！
      </span>
    ),
  },
  {
    title: "同じものが欲しいとき",
    body: "「僕も！」を押すと、欲しい人の数が増えます。合う商品が出品されて知らせが来たときは、あなたにも通知が届きます。",
    sample: <Sample>僕も！</Sample>,
  },
  {
    title: "持っているとき",
    body: "「応える」を押すと、内容が入った出品画面が開きます。出品すると、欲しがっている人に知らせることができます。",
    sample: <Sample filled>応える</Sample>,
  },
];

export default function DemandTutorial() {
  const seen = useSyncExternalStore(noop, readSeen, () => true);
  const [closed, setClosed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [step, setStep] = useState(0);
  const open = manualOpen || (!seen && !closed);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 覚えられなくても閉じる
    }
    setClosed(true);
    setManualOpen(false);
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <button
        onClick={() => { setStep(0); setManualOpen(true); }}
        className="shrink-0 text-xs font-bold text-orange-700 border border-orange-200 bg-white rounded-full px-3 py-1.5 hover:bg-orange-100 transition-colors"
      >
        使い方
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="みんなの欲しい！の使い方"
            className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-stone-400">使い方 {step + 1} / {STEPS.length}</span>
              <button onClick={close} className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="閉じる">
                <IconX size={20} />
              </button>
            </div>
            <div className="bg-orange-50 rounded-xl min-h-24 flex items-center justify-center px-4 py-5 mb-4">{current.sample}</div>
            <p className="font-extrabold text-stone-800 mb-2">{current.title}</p>
            <p className="text-sm text-stone-600 leading-relaxed mb-5 min-h-[4.5rem]">{current.body}</p>
            <div className="flex justify-center gap-1.5 mb-4" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-orange-700" : "w-1.5 bg-stone-300"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 border border-stone-300 text-stone-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors"
                >
                  戻る
                </button>
              )}
              <button
                onClick={() => (last ? close() : setStep(step + 1))}
                className="flex-1 bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors"
              >
                {last ? "はじめる" : "次へ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
