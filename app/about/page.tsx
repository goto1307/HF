import type { Metadata } from "next";
import Link from "next/link";
import FoxMascot from "@/components/FoxMascot";

export const metadata: Metadata = {
  title: "北フリ | 北海道大学の学生専用フリマアプリ",
  description:
    "北フリは北海道大学の学生だけが使えるフリマアプリです。教科書・自転車・部屋のものを、北大生同士で安心して売り買いできます。北大メールで登録、1分で出品開始。",
};

export default function About() {
  return (
    <div className="bg-[#faf6ef] text-[#211a14]">
      <style>{`
        @keyframes riseIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bobFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        .rise { opacity: 0; animation: riseIn 0.8s ease forwards; }
        .bob { animation: bobFloat 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rise { opacity: 1; animation: none; }
          .bob { animation: none; }
        }
      `}</style>

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_900px_500px_at_75%_-10%,#4a2716_0%,#211a14_55%)] text-[#fbf3e9] py-20 sm:py-28">
        <div className="absolute w-[420px] h-[420px] rounded-full blur-[2px] opacity-50 bg-[radial-gradient(circle,rgba(217,83,31,0.35),transparent_70%)] -top-40 -right-20" aria-hidden />
        <div className="absolute w-[280px] h-[280px] rounded-full blur-[2px] opacity-50 bg-[radial-gradient(circle,rgba(255,138,82,0.18),transparent_70%)] -bottom-32 left-[6%]" aria-hidden />

        <div className="relative max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 items-center text-center md:text-left">
          <div>
            <span className="rise inline-flex items-center gap-2 text-xs font-extrabold tracking-wide bg-white/10 border border-white/15 px-3.5 py-1.5 rounded-full mb-5" style={{ animationDelay: "0.05s" }}>
              🦊 北海道大学の学生限定
            </span>
            <h1 className="rise text-4xl sm:text-5xl font-extrabold leading-tight mb-5 text-balance" style={{ animationDelay: "0.18s" }}>
              いらないが、<br />誰かの<span className="text-[#ff8a52]">「ちょうどいい」</span>になる。
            </h1>
            <p className="rise text-base leading-relaxed text-[#d9c9b8] max-w-md mx-auto md:mx-0 mb-8" style={{ animationDelay: "0.3s" }}>
              教科書、自転車、部屋のもの。北フリは、北大生同士だけでちょうどいい売り買いができる、キャンパスの中だけのフリマです。
            </p>
            <div className="rise flex flex-wrap gap-3 justify-center md:justify-start" style={{ animationDelay: "0.42s" }}>
              <Link href="/register" className="bg-orange-700 text-white font-extrabold text-sm px-7 py-3.5 rounded-full shadow-[0_14px_30px_-12px_rgba(217,83,31,0.6)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-12px_rgba(217,83,31,0.75)] transition-all">
                新規登録してはじめる
              </Link>
              <Link href="/login" className="border border-white/35 text-[#fbf3e9] font-extrabold text-sm px-6 py-3.5 rounded-full hover:bg-white/10 hover:border-white/60 transition-colors">
                ログイン
              </Link>
            </div>
          </div>

          <div className="rise" style={{ animationDelay: "0.36s" }}>
            <div className="relative mx-auto w-[min(340px,78vw)] drop-shadow-[0_28px_30px_rgba(0,0,0,0.45)]">
              <FoxMascot size={340} className="w-full h-auto" />
              <span className="bob absolute top-10 left-4 text-2xl" style={{ animationDelay: "-1.5s" }}>📘</span>
              <span className="bob absolute top-16 right-2 text-2xl" style={{ animationDelay: "-3s" }}>🚲</span>
              <span className="bob absolute bottom-16 left-0 text-2xl">✅</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= WHY ================= */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="font-mono text-xs tracking-widest uppercase text-orange-700 font-bold mb-3">Why 北フリ</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug mb-10 max-w-md text-balance">
            使わなくなったものが、キャンパスのどこかで待たれている。
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <span className="font-mono text-xs text-orange-700 font-bold block mb-3">01</span>
              <h3 className="font-extrabold text-base mb-2">北大生しか登録できない</h3>
              <p className="text-sm leading-relaxed text-stone-500">北大メールでの本人確認があるので、知らない誰かではなく、同じキャンパスの学生同士で安心してやり取りできます。</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <span className="font-mono text-xs text-orange-700 font-bold block mb-3">02</span>
              <h3 className="font-extrabold text-base mb-2">大まかな場所で探せる</h3>
              <p className="text-sm leading-relaxed text-stone-500">住所は書きません。「北8条エリア」「工学部周辺」のような大まかなエリアと、待ち合わせ場所の相談だけで完結します。</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <span className="font-mono text-xs text-orange-700 font-bold block mb-3">03</span>
              <h3 className="font-extrabold text-base mb-2">売れて終わりじゃない</h3>
              <p className="text-sm leading-relaxed text-stone-500">受け取り確認・取引完了のチェックまでアプリの中で完結。取引が終わったらお互いを評価できます。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW ================= */}
      <section className="bg-[#2c2319] text-[#fbf3e9] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="font-mono text-xs tracking-widest uppercase text-[#ff8a52] font-bold mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-12 max-w-sm text-balance">使い方は、かんたん3ステップ。</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0 relative">
            <div className="hidden sm:block absolute top-[34px] left-[12%] right-[12%] h-px bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.25)_0_8px,transparent_8px_16px)]" aria-hidden />
            {[
              { icon: "📷", title: "出品する", desc: "写真を撮って、タイトルと価格を入れるだけ。最短1分で出品できます。" },
              { icon: "💬", title: "やりとりする", desc: "チャットで質問し、購入後は待ち合わせ場所と日時をその場で相談します。" },
              { icon: "🤝", title: "受け渡し・評価", desc: "人通りの多い場所で直接受け渡し。取引完了後にお互いを評価できます。" },
            ].map((s) => (
              <div key={s.title} className="relative text-center px-4">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-3xl mx-auto mb-4">
                  {s.icon}
                </div>
                <h3 className="font-extrabold text-sm mb-2">{s.title}</h3>
                <p className="text-xs leading-relaxed text-[#d9c9b8] max-w-[30ch] mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= MASCOT ================= */}
      <section className="bg-white border-y border-stone-200 py-20">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-10 items-center text-center sm:text-left">
          <FoxMascot size={220} className="w-full max-w-[220px] mx-auto" />
          <div>
            <h2 className="text-xl font-extrabold mb-3">
              はじめまして、<span className="text-orange-700">フリ太郎</span>です。
            </h2>
            <p className="text-sm leading-relaxed text-stone-500 max-w-lg mx-auto sm:mx-0 mb-2">
              キタキツネがモチーフの北フリの案内役。掘り出し物を見つけるのが得意で、いいものを見つけるとすぐ教えたくなる性格です。
            </p>
            <p className="text-sm leading-relaxed text-stone-500 max-w-lg mx-auto sm:mx-0">
              商品が見つからないときや、初めての方向けの説明のところにも顔を出すので、見かけたらよろしくお願いします。
            </p>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="bg-[#211a14] text-[#fbf3e9] py-24 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-4 text-balance">
            次に捨てるはずだったもの、<br />誰かの「ちょうどいい」にしませんか。
          </h2>
          <p className="text-sm text-[#d9c9b8] mb-8">登録は北大メールだけ。1分で始められます。</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/register" className="bg-orange-700 text-white font-extrabold text-sm px-7 py-3.5 rounded-full shadow-[0_14px_30px_-12px_rgba(217,83,31,0.6)] hover:-translate-y-0.5 transition-transform">
              新規登録してはじめる
            </Link>
            <Link href="/" className="border border-white/35 text-[#fbf3e9] font-extrabold text-sm px-6 py-3.5 rounded-full hover:bg-white/10 transition-colors">
              サイトを見てみる
            </Link>
          </div>
          <p className="mt-14 pt-6 border-t border-white/10 text-xs text-[#a5947f] leading-relaxed">
            北フリは北海道大学非公認の、学生個人が運営する非公式サービスです。北海道大学とは関係ありません。
            <br />
            <Link href="/privacy" className="underline">プライバシーポリシー</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
