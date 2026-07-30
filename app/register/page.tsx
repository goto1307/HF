"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isValidEmail = (email: string) => {
    return email.endsWith("@eis.hokudai.ac.jp") || email.endsWith("@hokudai.ac.jp") || email.endsWith("@elms.hokudai.ac.jp");
  };

  const handleRegister = async () => {
    if (!isValidEmail(email)) { alert("北大のメールアドレスを入力してください"); return; }
    if (!nickname.trim()) { alert("ニックネームを入力してください"); return; }
    if (password.length < 6) { alert("パスワードは6文字以上にしてください"); return; }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { nickname },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });
    setLoading(false);
    if (error) { alert(`登録に失敗しました: ${error.message}`); return; }
    alert("確認メールを送りました！メール内のリンクを開いて確認を完了してから、ログインしてください。");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">新規登録</h2>
        <div className="flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="北大メールアドレス" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm" />
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ニックネーム" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード（6文字以上）" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm" />
          <button onClick={handleRegister} disabled={loading} className="w-full bg-emerald-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-emerald-800 transition-colors shadow-sm">
            {loading ? "登録中..." : "登録する"}
          </button>
          <p className="text-center text-sm text-stone-500">
            すでにアカウントをお持ちの方は
            <span className="text-emerald-700 font-bold cursor-pointer hover:underline" onClick={() => router.push("/login")}> ログイン</span>
          </p>
        </div>
      </main>
    </div>
  );
}
