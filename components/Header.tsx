"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

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

export default function Header() {
  const { user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setLoggingOut(false);
    setShowLogoutConfirm(false);
    if (error) {
      alert("ログアウトに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-orange-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3.5">
          <Link href="/" className="flex flex-col hover:opacity-90 transition-opacity shrink-0 leading-tight">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight">北フリ</span>
            <span className="text-[10px] sm:text-[13px] font-bold text-white whitespace-nowrap">北大生専用のフリマ</span>
          </Link>
          {pathname === "/" && (
            <div className="flex-1 max-w-md hidden sm:flex items-center bg-white rounded-full px-4 py-2">
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
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="border border-white/70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  ログアウト
                </button>
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
          </nav>
        </div>
      </header>

      {showLogoutConfirm && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="border border-red-200 rounded-2xl p-4 bg-red-50 shadow-sm">
            <p className="font-bold text-sm mb-3 text-red-600">本当にログアウトしますか？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {loggingOut ? "ログアウト中..." : "ログアウトする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
