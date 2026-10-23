"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { jstToday } from "@/lib/demand";
import { IconX } from "@/components/icons";

// ログイン後、画面右下で上を向いて考え事をしているホックマのまわりに、
// みんなの欲しい！の商品名を吹き出しでポンポン出す。

type Bubble = { id: number; title: string };

// 吹き出しを置く場所(右下の箱の右端・下端からの距離 px)。ホックマの頭の左上に、
// 重ならないように並べる。m はスマホ、d は PC。m が null の場所はスマホでは使わない。
const SLOTS: { m: [number, number] | null; d: [number, number] }[] = [
  { m: [56, 140], d: [70, 178] },
  { m: [10, 180], d: [16, 240] },
  { m: [150, 160], d: [150, 214] },
  { m: null, d: [170, 140] },
  { m: null, d: [190, 262] },
];
const SWAP_INTERVAL_MS = 3500;
const CACHE_MS = 60_000;
const HIDE_KEY = "demandBubblesHidden";

// フォームやチャットの入力欄にかぶる画面では出さない
const HIDDEN_PATHS = [/^\/sell/, /^\/demands\/new/, /^\/items\/[^/]+\/(chat|edit)/, /^\/admin/];

// ページを移動するたびに取り直さないよう、少しの間だけ覚えておく
let cache: { at: number; bubbles: Bubble[] } | null = null;

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DemandBubbles() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [pool, setPool] = useState<Bubble[] | null>(null);
  // slots[i] = その場所に今出ている吹き出し(key は出し直すたびに変えてアニメーションを再生する)
  const [slots, setSlots] = useState<({ bubble: Bubble; key: number } | null)[]>([]);
  // 吹き出しは読み込みが終わるまで出さないので、サーバーの描画と食い違うことはない
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const isHiddenPath = HIDDEN_PATHS.some((re) => re.test(pathname));

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (!cache || Date.now() - cache.at >= CACHE_MS) {
        const { data } = await supabase
          .from("demand")
          .select("id,title")
          .eq("status", "open")
          .gte("deadline", jstToday())
          .order("created_at", { ascending: false })
          .limit(30);
        cache = { at: Date.now(), bubbles: (data ?? []) as Bubble[] };
      }
      // 最初は空いている場所へ順番に出す
      const bubbles = shuffle(cache.bubbles);
      setPool(bubbles);
      setSlots(bubbles.slice(0, SLOTS.length).map((bubble, i) => ({ bubble, key: i })));
    };
    load();
  }, [user]);

  // 欲しい！が場所の数より多いときは、1つずつ入れ替える
  useEffect(() => {
    if (!pool || pool.length <= SLOTS.length) return;
    let next = SLOTS.length;
    let key = SLOTS.length;

    const timer = setInterval(() => {
      const bubble = pool[next % pool.length];
      next++;
      setSlots((prev) => {
        const target = Math.floor(Math.random() * prev.length);
        return prev.map((s, i) => (i === target ? { bubble, key: key++ } : s));
      });
    }, SWAP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pool]);

  if (!user || hidden || isHiddenPath || pool === null) return null;

  const hide = () => {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {}
    setHidden(true);
  };

  return (
    <div className="fixed bottom-0 right-0 z-10 w-[320px] h-[300px] pointer-events-none">
      {pool.length === 0 ? (
        <Link
          href="/demands/new"
          className="pointer-events-auto absolute right-14 bottom-[140px] sm:right-[70px] sm:bottom-[178px] animate-bubble-pop max-w-[150px] bg-white border border-orange-200 text-orange-800 text-xs font-bold px-3 py-2 rounded-2xl shadow-md hover:bg-orange-50 transition-colors"
        >
          みんなの欲しい！を待ってるよ
        </Link>
      ) : (
        slots.map((slot, i) => {
          if (!slot) return null;
          const pos = SLOTS[i];
          const [mr, mb] = pos.m ?? pos.d;
          return (
            <Link
              key={slot.key}
              href={`/demands?id=${slot.bubble.id}`}
              className={`pointer-events-auto absolute animate-bubble-pop right-(--mr) bottom-(--mb) sm:right-(--dr) sm:bottom-(--db) ${pos.m ? "" : "hidden sm:block"}`}
              style={{
                "--mr": `${mr}px`, "--mb": `${mb}px`, "--dr": `${pos.d[0]}px`, "--db": `${pos.d[1]}px`,
                animationDelay: slot.key < SLOTS.length ? `${i * 250}ms` : undefined,
              } as React.CSSProperties}
            >
              <span
                className="animate-bubble-float block max-w-[130px] truncate bg-white border border-orange-200 text-stone-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-md hover:border-orange-400 hover:text-orange-800 transition-colors"
                style={{ animationDelay: `${i * 400}ms` }}
              >
                {slot.bubble.title}
              </span>
            </Link>
          );
        })
      )}

      <div className="pointer-events-auto absolute right-3 bottom-3 sm:right-4 sm:bottom-4">
        <Link href="/demands" aria-label="みんなの欲しい！を見る" className="block hover:-translate-y-0.5 transition-transform">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hokkuma-thinking.png" alt="考え事をしているホックマ" className="h-[110px] sm:h-[150px] w-auto drop-shadow-md" />
        </Link>
        <button
          onClick={hide}
          className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-white/90 border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm"
          aria-label="ホックマをしばらく隠す"
        >
          <IconX size={11} />
        </button>
      </div>
    </div>
  );
}
