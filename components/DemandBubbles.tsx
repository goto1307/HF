"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { jstToday, type DemandVote } from "@/lib/demand";
import { IconX } from "@/components/icons";

// ログイン後、商品を探すページ(/)の右下で上を向いて考え事をしているホックマの
// まわりに、みんなの欲しい！の商品名を吹き出しでポンポン出す。

type Bubble = { id: number; title: string };

// 吹き出しを置く場所(右下の箱の右端・下端からの距離 px)。ホックマの頭の左上に、
// 重ならないように並べる。m はスマホ、d は PC。m が null の場所はスマホでは使わない。
// ホックマの下の説明文の分だけ上にずらしてある。
const SLOTS: { m: [number, number] | null; d: [number, number] }[] = [
  { m: [56, 176], d: [70, 218] },
  { m: [10, 216], d: [16, 280] },
  { m: [150, 196], d: [150, 254] },
  { m: null, d: [170, 180] },
  { m: null, d: [190, 302] },
];
const SWAP_INTERVAL_MS = 1500;
const CACHE_MS = 60_000;
const HIDE_KEY = "demandBubblesHidden";

// 登録したばかりの人に、最初に一度だけホックマを紹介する(人ごとにブラウザへ覚える)
const INTRO_KEY = "hokuma-hokkuma-intro-seen";
const INTRO_NEW_USER_DAYS = 14;

function introSeen(userId: string) {
  try {
    return localStorage.getItem(`${INTRO_KEY}-${userId}`) === "1";
  } catch {
    return true; // 覚えられない環境では、毎回出さないようにする
  }
}

// 出すのは商品を探すページだけ
const SHOWN_PATH = "/";

// 欲しい人が多い欲しい！と新しい欲しい！を優先して出す。
// 優先度 = 僕も！の人数 × VOTE_WEIGHT + 新しさ(登録から FRESH_DAYS 日以内なら最大 FRESH_BONUS)
const VOTE_WEIGHT = 2;
const FRESH_DAYS = 7;
const FRESH_BONUS = 4;
const POOL_SIZE = 15;

function priority(b: Bubble & { created_at: string }, votes: number) {
  const ageDays = (Date.now() - new Date(b.created_at).getTime()) / 86400000;
  const fresh = Math.max(0, 1 - ageDays / FRESH_DAYS) * FRESH_BONUS;
  return votes * VOTE_WEIGHT + fresh + Math.random() * 0.5; // 同じくらいの優先度なら毎回少し入れ替わる
}

// ページを移動するたびに取り直さないよう、少しの間だけ覚えておく
let cache: { at: number; bubbles: Bubble[] } | null = null;

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

  const isHiddenPath = pathname !== SHOWN_PATH;
  // ホックマの紹介を出しているか(登録から日が浅く、まだ見ていない人だけ。読み込み後に決める)
  const [introOpen, setIntroOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (!cache || Date.now() - cache.at >= CACHE_MS) {
        const [{ data }, { data: voteData }] = await Promise.all([
          supabase
            .from("demand")
            .select("id,title,created_at")
            .eq("status", "open")
            .gte("deadline", jstToday())
            .order("created_at", { ascending: false })
            .limit(100),
          supabase.rpc("demand_vote_summary"),
        ]);
        const votes = new Map(((voteData ?? []) as DemandVote[]).map((v) => [v.demand_id, v.votes]));
        const bubbles = ((data ?? []) as (Bubble & { created_at: string })[])
          .map((b) => ({ b, p: priority(b, votes.get(b.id) ?? 0) }))
          .sort((x, y) => y.p - x.p)
          .slice(0, POOL_SIZE)
          .map(({ b }) => ({ id: b.id, title: b.title }));
        cache = { at: Date.now(), bubbles };
      }
      // 優先度の高い順に、最初は空いている場所へ順番に出す
      const bubbles = cache.bubbles;
      setPool(bubbles);
      setSlots(bubbles.slice(0, SLOTS.length).map((bubble, i) => ({ bubble, key: i })));
      const isNewUser = Date.now() - new Date(user.created_at).getTime() < INTRO_NEW_USER_DAYS * 86400000;
      setIntroOpen(isNewUser && !introSeen(user.id));
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

  const showIntro = introOpen;
  const closeIntro = () => {
    try {
      localStorage.setItem(`${INTRO_KEY}-${user.id}`, "1");
    } catch {}
    setIntroOpen(false);
  };

  const hide = () => {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {}
    setHidden(true);
  };

  return (
    <>
    {showIntro && (
      <div className="fixed inset-0 z-40 bg-black/50" onClick={closeIntro}>
        <div
          role="dialog"
          aria-label="ホックマの紹介"
          className="absolute left-4 right-4 bottom-[300px] sm:left-auto sm:right-[340px] sm:bottom-[120px] sm:w-[320px] bg-white rounded-2xl shadow-xl p-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ホックマの方を指すしっぽ(スマホは右下、PCは右) */}
          <span aria-hidden className="absolute w-4 h-4 bg-white rotate-45 -bottom-2 right-20 sm:bottom-12 sm:-right-2" />
          <p className="text-sm text-stone-700 leading-relaxed mb-4">
            この子は<span className="font-extrabold text-orange-700">ホックマ</span>。北大生が教えてくれた「欲しい！」を呟いています。ホックマの呟きが気になったら、<span className="font-bold">みんなの欲しい！</span>を覗いてみましょう。
          </p>
          <div className="flex gap-2">
            <button
              onClick={closeIntro}
              className="flex-1 border border-stone-300 text-stone-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors"
            >
              わかった
            </button>
            <Link
              href="/demands"
              onClick={closeIntro}
              className="flex-1 text-center bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors"
            >
              覗いてみる
            </Link>
          </div>
        </div>
      </div>
    )}
    <div className={`fixed bottom-0 right-0 w-[320px] h-[340px] pointer-events-none ${showIntro ? "z-[45]" : "z-10"}`}>
      {pool.length === 0 ? (
        <Link
          href="/demands/new"
          className="pointer-events-auto absolute right-14 bottom-[176px] sm:right-[70px] sm:bottom-[218px] animate-bubble-pop max-w-[150px] bg-white border border-orange-200 text-orange-800 text-xs font-bold px-3 py-2 rounded-2xl shadow-md hover:bg-orange-50 transition-colors"
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
        {/* 紹介中は、ホックマのまわりを明るく光らせて目立たせる */}
        {showIntro && (
          <>
            <span aria-hidden className="absolute -inset-2 rounded-[28px] bg-white ring-4 ring-yellow-300" />
            <span aria-hidden className="absolute -inset-3.5 rounded-[34px] ring-4 ring-yellow-200 animate-pulse" />
          </>
        )}
        <Link href="/demands" onClick={showIntro ? closeIntro : undefined} className="relative flex flex-col items-end group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hokkuma-thinking.png"
            alt="考え事をしているホックマ"
            className="h-[110px] sm:h-[150px] w-auto mr-3 drop-shadow-md group-hover:-translate-y-0.5 transition-transform"
          />
          {/* 吹き出しが何なのかを文章で伝える */}
          <span className="mt-1 bg-white/95 border border-orange-200 rounded-xl px-2.5 py-1 text-right leading-tight shadow-sm group-hover:border-orange-400 transition-colors">
            <span className="block text-[11px] sm:text-xs font-bold text-orange-800 whitespace-nowrap">ふきだしは、みんなの欲しい！</span>
            <span className="block text-[10px] sm:text-[11px] text-stone-500 whitespace-nowrap">持っていたら出品してみよう →</span>
          </span>
        </Link>
        <button
          onClick={hide}
          className="absolute -top-1 right-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/90 border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm"
          aria-label="ホックマをしばらく隠す"
        >
          <IconX size={11} />
        </button>
      </div>
    </div>
    </>
  );
}
