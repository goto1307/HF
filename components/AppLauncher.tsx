"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionOf, type SectionKey } from "@/lib/appSections";
import { loginPath } from "@/lib/nav";
import { IconX } from "@/components/icons";

// ☰ から開く、HOKUMA の中のホーム画面。画面の右上から丸く広がって、サービスのアイコンが並ぶ。
// ※ いまは運営(管理者)だけの試作(components/Header.tsx から開く)

const NAVY = "#2F3E5C";
const LINE = "#1B243A";
const SHU = "#BA421D";

// アイコンは、ホックマと同じ「紺の丸い線」で描く。朱色はひとつだけ差し色に使う
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" width={40} height={40} fill="none" stroke={LINE} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  // 教科書を積んだところ(フリマ)
  market: (
    <Glyph>
      <rect x="9" y="27" width="30" height="8" rx="2" fill={SHU} />
      <rect x="12" y="17" width="26" height="8" rx="2" />
      <rect x="9" y="7" width="27" height="8" rx="2" />
      <path d="M14 11h10M17 21h9M14 31h10" stroke={LINE} />
      <path d="M8 41h32" />
    </Glyph>
  ),
  // 吹き出しとハート(みんなの欲しい！)
  demands: (
    <Glyph>
      <path d="M8 12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H21l-8 8v-8a5 5 0 0 1-5-5z" />
      <path d="M24 26c-5-3.2-7.5-6-7.5-8.6a3.6 3.6 0 0 1 7.5-1.3 3.6 3.6 0 0 1 7.5 1.3c0 2.6-2.5 5.4-7.5 8.6z" fill={SHU} stroke={SHU} strokeWidth={1.4} />
    </Glyph>
  ),
  // 湯気の立つ丼(空きコマクーポン)
  coupons: (
    <Glyph>
      <path d="M6 24h36a18 15 0 0 1-36 0z" fill={SHU} />
      <path d="M6 24h36" />
      <path d="M15 40h18" />
      <path d="M17 17c-2-3 2-4 0-7M24 17c-2-3 2-4 0-7M31 17c-2-3 2-4 0-7" />
    </Glyph>
  ),
  // カメラ(出品する)
  sell: (
    <Glyph>
      <path d="M7 16a4 4 0 0 1 4-4h5l3-4h10l3 4h5a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z" />
      <circle cx="24" cy="24" r="7" fill={SHU} />
    </Glyph>
  ),
  // 人(マイページ)
  mypage: (
    <Glyph>
      <circle cx="24" cy="16" r="7" />
      <path d="M10 40c1.5-8 7-12 14-12s12.5 4 14 12" fill={SHU} />
    </Glyph>
  ),
};

type Tile = { key: string; label: string; href: string; section?: SectionKey; note?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
  isAdmin: boolean;
  onShowGuide: () => void;
  onShowInstall: () => void;
};

const ADMIN_LINKS = [
  { href: "/admin/reports", label: "通報一覧" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/items", label: "商品/チャット" },
  { href: "/admin/reviews", label: "評価一覧" },
  { href: "/admin/demands", label: "欲しい！一覧" },
  { href: "/admin/stats", label: "集計" },
  { href: "/admin/coupons", label: "クーポン集計" },
  { href: "/admin/log", label: "操作ログ" },
  { href: "/admin/backup", label: "データバックアップ" },
];

export default function AppLauncher({ open, onClose, loggedIn, isAdmin, onShowGuide, onShowInstall }: Props) {
  const pathname = usePathname();
  const current = sectionOf(pathname);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    // 後ろのページがスクロールしないようにする
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const tiles: Tile[] = [
    { key: "market", label: "フリマ", href: "/", section: "market" },
    { key: "coupons", label: "空きコマクーポン", href: "/coupons", section: "coupons" },
    { key: "demands", label: "みんなの欲しい！", href: "/demands" },
    { key: "sell", label: "出品する", href: loggedIn ? "/sell" : loginPath("/sell") },
    ...(loggedIn ? [{ key: "mypage", label: "マイページ", href: "/mypage" }] : []),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HOKUMAのサービス"
      className="launcher fixed inset-0 z-50 overflow-y-auto text-white"
      data-shown={open}
      aria-hidden={!open}
      style={{ backgroundColor: NAVY }}
    >
      <div className="max-w-md mx-auto px-6 pt-4 pb-12">
        <div className="flex items-center justify-between h-12">
          <p className="text-xl font-extrabold tracking-tight">HOKUMA</p>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="閉じる"
            className="w-10 h-10 -mr-1 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-yellow-300 transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <p className="mt-6 text-sm text-white/70">どれを使いますか？</p>

        <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-6">
          {tiles.map((t, i) => {
            const isCurrent = t.section !== undefined && t.section === current;
            return (
              <li key={t.key} className="launcher-tile" style={{ transitionDelay: `${60 + i * 35}ms` }}>
                <Link
                  href={t.href}
                  onClick={onClose}
                  className="group flex flex-col items-center gap-2 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300"
                >
                  <span
                    className={`relative w-[76px] h-[76px] rounded-[22px] bg-white flex items-center justify-center transition-transform group-active:scale-95 ${
                      isCurrent ? "ring-[3px] ring-yellow-300 ring-offset-[3px]" : ""
                    }`}
                    style={isCurrent ? { ["--tw-ring-offset-color" as string]: NAVY } : undefined}
                  >
                    {GLYPHS[t.key]}
                  </span>
                  <span className="text-[12px] font-bold leading-tight text-center whitespace-nowrap tracking-tight">{t.label}</span>
                  {isCurrent && <span className="sr-only">（いま開いています）</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="launcher-tile mt-10 border-t border-white/15 pt-4 text-sm" style={{ transitionDelay: "240ms" }}>
          <button onClick={() => { onClose(); onShowGuide(); }} className="block w-full text-left py-2.5 font-bold text-white/85 hover:text-white">
            初めての方に
          </button>
          <button onClick={() => { onClose(); onShowInstall(); }} className="block w-full text-left py-2.5 font-bold text-white/85 hover:text-white">
            ホーム画面に追加
          </button>
          <a href="https://www.instagram.com/hokuma.official/" target="_blank" rel="noopener noreferrer" className="block py-2.5 font-bold text-white/85 hover:text-white">
            公式Instagram：@hokuma.official
          </a>
          <a href="mailto:hokuma.official639@gmail.com" className="block py-2.5 font-bold text-white/85 hover:text-white">
            お問い合わせ
          </a>
          <Link href="/terms" onClick={onClose} className="block py-2.5 font-bold text-white/85 hover:text-white">
            利用規約
          </Link>
          {loggedIn && (
            <Link href="/logout" onClick={onClose} className="block py-2.5 font-bold text-red-300 hover:text-red-200">
              ログアウト
            </Link>
          )}
        </div>

        {isAdmin && (
          <details className="launcher-tile mt-6 rounded-2xl bg-white/5 px-4 py-3 text-sm" style={{ transitionDelay: "280ms" }}>
            <summary className="cursor-pointer font-bold text-white/70">管理者メニュー</summary>
            <div className="mt-2 grid grid-cols-2 gap-x-4">
              {ADMIN_LINKS.map((l) => (
                <Link key={l.href} href={l.href} onClick={onClose} className="py-2 text-white/85 hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>

      <style>{`
        /* 右上の ☰ のあたりから、丸く広がって開く */
        /* 閉じているときは見えない・押せない(閉じるアニメーションが終わってから隠す) */
        .launcher {
          visibility: hidden;
          clip-path: circle(0px at calc(100% - 28px) 30px);
          transition: clip-path 320ms cubic-bezier(.3,.7,.2,1), visibility 0s linear 320ms;
        }
        .launcher[data-shown="true"] {
          visibility: visible;
          clip-path: circle(150% at calc(100% - 28px) 30px);
          transition: clip-path 320ms cubic-bezier(.3,.7,.2,1), visibility 0s;
        }
        .launcher .launcher-tile {
          opacity: 0;
          transform: translateY(6px) scale(.96);
          transition: opacity 220ms ease, transform 220ms ease;
        }
        .launcher[data-shown="true"] .launcher-tile {
          opacity: 1;
          transform: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .launcher, .launcher .launcher-tile { transition: none; }
        }
      `}</style>
    </div>
  );
}
