"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import FoxMascot from "@/components/FoxMascot";

export default function Logout() {
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoggingOut(false);
      alert("ログアウトに失敗しました。もう一度お試しください。");
      return;
    }
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center text-center">
        <FoxMascot size={72} className="mb-4 opacity-90" />
        <h1 className="text-lg font-extrabold mb-2 text-stone-700">ログアウトしますか？</h1>
        <p className="text-sm text-stone-500 mb-8">もう一度ログインするには、メールアドレスとパスワードが必要です。</p>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full bg-red-500 text-white py-3 rounded-full font-bold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
          >
            {loggingOut ? "ログアウト中..." : "ログアウトする"}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full border border-stone-300 text-stone-600 py-3 rounded-full font-bold text-sm bg-white hover:bg-stone-100 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </main>
    </div>
  );
}
