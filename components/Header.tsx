"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import FoxMascot from "@/components/FoxMascot";

type Notification = {
  id: number;
  message: string;
  item_id: number | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  return `${day}日前`;
}

const ADMIN_EMAILS = ["debuchi.sora.b0@elms.hokudai.ac.jp", "goto.kanata.w1@elms.hokudai.ac.jp"];

export default function Header() {
  const { user } = useAuth();
  const isAdmin = !!user && !!user.email && ADMIN_EMAILS.includes(user.email);
  const [showGuide, setShowGuide] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpenNotifications = () => {
    setShowNotifications((v) => !v);
    if (!showNotifications) fetchNotifications();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notification").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await supabase.from("notification").update({ read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setShowNotifications(false);
    if (n.item_id) router.push(`/items/${n.item_id}`);
  };

  const handleSearch = () => {
    const trimmed = query.trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-orange-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3.5">
          <Link href="/" className="flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0">
            <FoxMascot size={34} className="shrink-0 -my-1" />
            <span className="flex flex-col leading-tight">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight">北フリ</span>
              <span className="text-[10px] sm:text-[13px] font-bold text-white whitespace-nowrap">北大生専用のフリマ</span>
            </span>
          </Link>
          {pathname === "/" && (
            <div className="flex-1 hidden sm:flex items-center gap-2">
              <div className="flex-1 max-w-md flex items-center bg-white rounded-full px-4 py-2">
                <span className="text-stone-400 mr-2" aria-hidden>🔍</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="検索"
                  className="flex-1 outline-none text-sm text-stone-800"
                />
              </div>
              {user && (
                <Link
                  href="/mypage#selling"
                  className="hidden md:inline-block text-xs font-bold px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap shrink-0"
                >
                  出品・売れた商品
                </Link>
              )}
            </div>
          )}
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
            {user ? (
              <>
                <div className="relative">
                  <button
                    onClick={handleOpenNotifications}
                    className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    aria-label="通知"
                  >
                    <span className="text-base sm:text-lg">🔔</span>
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white text-stone-800 rounded-2xl shadow-lg border border-stone-200 overflow-hidden z-30">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
                        <p className="font-bold text-sm">通知</p>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-xs text-orange-700 font-bold hover:underline">
                            すべて既読にする
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-center text-stone-400 text-sm py-8">通知はありません</p>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full text-left px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 transition-colors ${!n.read ? "bg-orange-50" : ""}`}
                            >
                              <p className="text-sm text-stone-700">{n.message}</p>
                              <p className="text-xs text-stone-400 mt-0.5">{timeAgo(n.created_at)}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <Link
                    href="/admin/reports"
                    className="border border-white/70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    通報一覧
                  </Link>
                )}
                <Link
                  href="/mypage"
                  className="flex items-center gap-1.5 sm:gap-2 bg-white text-orange-700 pl-1.5 pr-1.5 sm:pl-2 sm:pr-4 py-1.5 rounded-full font-bold text-sm hover:bg-orange-50 transition-colors"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-orange-700 text-white flex items-center justify-center text-xs font-bold">
                      {(user.user_metadata?.nickname || user.email || "?")[0]}
                    </span>
                  )}
                  <span className="hidden sm:inline">マイページ</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="bg-white text-orange-700 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm hover:bg-orange-50 transition-colors whitespace-nowrap"
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="border border-white/70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  新規登録
                </Link>
              </>
            )}
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-lg"
                aria-label="メニュー"
              >
                ☰
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-stone-800 rounded-2xl shadow-lg border border-stone-200 overflow-hidden z-30">
                  <button
                    onClick={() => { setShowMenu(false); setShowGuide(true); }}
                    className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-stone-50 transition-colors border-b border-stone-100"
                  >
                    初めての方に
                  </button>
                  {user && (
                    <Link
                      href="/logout"
                      onClick={() => setShowMenu(false)}
                      className="block w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      ログアウト
                    </Link>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      {showGuide && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGuide(false)}
              className="text-orange-700 font-bold mb-3 flex items-center gap-1 hover:text-orange-800 transition-colors text-sm"
            >
              <span aria-hidden>←</span> 戻る
            </button>
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <FoxMascot size={32} />
                <h2 className="text-xl font-extrabold text-stone-700">初めての方に</h2>
              </div>
              <button onClick={() => setShowGuide(false)} className="text-2xl leading-none text-stone-400 hover:text-stone-600 transition-colors" aria-label="閉じる">
                ×
              </button>
            </div>
            <p className="text-sm text-stone-600 font-bold mb-2">北大生が開発した、北大生専用のフリマサイトです。</p>
            <p className="text-sm text-stone-500 mb-6">いらないが、誰かの「ちょうどいい」になる。北フリの使い方はかんたん3ステップです。</p>

            <div className="flex flex-col gap-3">
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex gap-3">
                <span className="text-2xl shrink-0">📷</span>
                <div>
                  <p className="text-xs font-bold text-orange-700 mb-0.5">STEP 1</p>
                  <p className="font-bold text-sm mb-1">出品する</p>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    写真を撮って、タイトル・価格・カテゴリを入れるだけ。状態や大まかな場所、ハッシュタグも追加できます。
                  </p>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex gap-3">
                <span className="text-2xl shrink-0">💬</span>
                <div>
                  <p className="text-xs font-bold text-orange-700 mb-0.5">STEP 2</p>
                  <p className="font-bold text-sm mb-1">やりとりする</p>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    公開の質問チャットで気軽に質問できます。購入後は個別チャットで待ち合わせ場所・日時を相談します。
                  </p>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex gap-3">
                <span className="text-2xl shrink-0">🤝</span>
                <div>
                  <p className="text-xs font-bold text-orange-700 mb-0.5">STEP 3</p>
                  <p className="font-bold text-sm mb-1">受け渡し・評価</p>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    人通りの多い、明るい場所で直接受け渡し。取引が終わったら「取引を完了する」からお互いを評価できます。
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="font-bold text-xs mb-2 text-orange-800">⚠ 安全なお取引のために</p>
              <ul className="text-xs text-stone-600 list-disc pl-4 flex flex-col gap-1">
                <li>受け渡しは人通りが多く明るい場所で行いましょう</li>
                <li>個人情報（住所など）はやり取りしないようにしましょう</li>
                <li>おかしいと感じた出品・ユーザーは商品ページから通報できます</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
