"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function Reset() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (!email) { alert("メールアドレスを入力してください"); return; }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/update-password` : undefined,
    });
    setLoading(false);
    if (error) { alert(`送信に失敗しました: ${error.message}`); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">パスワード再設定</h2>
        <div className="flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          {sent ? (
            <p className="text-sm text-stone-600 text-center py-4">
              パスワード再設定用のメールを送りました。メール内のリンクを開いて、新しいパスワードを設定してください。
            </p>
          ) : (
            <>
              <p className="text-sm text-stone-500 mb-2">登録したメールアドレスに再設定用のリンクを送ります。</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReset()}
                placeholder="北大メールアドレス"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm"
              />
              <button
                onClick={handleReset}
                disabled={loading}
                className="w-full bg-emerald-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-emerald-800 transition-colors shadow-sm"
              >
                {loading ? "送信中..." : "再設定メールを送る"}
              </button>
            </>
          )}
          <button
            onClick={() => router.push("/login")}
            className="text-center text-sm text-stone-500 hover:text-emerald-700 transition-colors"
          >
            ログインに戻る
          </button>
        </div>
      </main>
    </div>
  );
}
