"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

export default function Header() {
  const { user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
      <header className="sticky top-0 z-20 bg-emerald-700 text-white shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3.5">
          <Link href="/" className="text-xl font-extrabold tracking-tight hover:opacity-90 transition-opacity">
            北メル
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  href="/mypage"
                  className="flex items-center gap-2 bg-white text-emerald-700 pl-2 pr-4 py-1.5 rounded-full font-bold text-sm hover:bg-emerald-50 transition-colors"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                      {(user.user_metadata?.nickname || user.email || "?")[0]}
                    </span>
                  )}
                  マイページ
                </Link>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="border border-white/70 px-4 py-2 rounded-full text-sm font-bold hover:bg-white/10 transition-colors"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="bg-white text-emerald-700 px-4 py-2 rounded-full font-bold text-sm hover:bg-emerald-50 transition-colors"
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="border border-white/70 px-4 py-2 rounded-full text-sm font-bold hover:bg-white/10 transition-colors"
                >
                  新規登録
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {showLogoutConfirm && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
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
