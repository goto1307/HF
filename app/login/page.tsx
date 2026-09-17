"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        router.push("/");
      }
    });
    return () => { cancelled = true; };
  }, [router]);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("メールとパスワードを入力してください");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        if (error.code === "email_not_confirmed") {
          alert("メールアドレスがまだ確認されていません。届いた確認メールのリンクを開いてください。");
        } else if (error.code === "over_request_rate_limit" || error.status === 429) {
          alert("試行回数が多すぎます。しばらく待ってから再度お試しください。");
        } else if (error.code === "invalid_credentials") {
          alert("メールアドレスかパスワードが違います");
        } else {
          alert(`ログインに失敗しました: ${error.message}`);
        }
        return;
      }
      router.push("/");
    } catch (err) {
      alert("ログイン中にエラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">ログイン</h2>
        <div className="flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="flex flex-col gap-4">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="北大メールアドレス"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
          <button
            onClick={() => router.push("/register")}
            className="w-full border border-orange-700 text-orange-700 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors"
          >
            新規登録はこちら
          </button>
          <button
            onClick={() => router.push("/reset")}
            className="text-center text-sm text-stone-500 hover:text-orange-700 transition-colors"
          >
            パスワードを忘れた方はこちら
          </button>
        </div>
      </main>
    </div>
  );
}
