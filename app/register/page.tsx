"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import PasswordInput from "@/components/PasswordInput";
import { isReservedNickname } from "@/lib/nickname";
import { TERMS_TEXT } from "@/lib/terms";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  const isValidEmail = (email: string) => {
    return email.endsWith("@eis.hokudai.ac.jp") || email.endsWith("@hokudai.ac.jp") || email.endsWith("@elms.hokudai.ac.jp");
  };

  const isValidPassword = (password: string) => {
    return password.length >= 8 && /[0-9]/.test(password) && /[a-z]/.test(password) && /[A-Z]/.test(password);
  };

  const handleRegister = async () => {
    // 前後のスペース・大文字・全角の英数字(＠など)を直してからチェック・登録する
    const normalizedEmail = email.normalize("NFKC").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) { alert("北大のメールアドレスを入力してください"); return; }
    if (!nickname.trim()) { alert("ニックネームを入力してください"); return; }
    if (isReservedNickname(nickname)) { alert("このニックネームは使用できません（「運営」「公式」などを含む名前は使えません）"); return; }
    if (!isValidPassword(password)) { alert("パスワードは8文字以上で、数字・アルファベットの大文字・小文字をすべて含めてください"); return; }
    if (!agreed) { alert("利用規約への同意が必要です"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { nickname },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });
    setLoading(false);
    if (error) {
      if (error.code === "over_request_rate_limit" || error.status === 429) {
        alert("試行回数が多すぎます。しばらく待ってから再度お試しください。");
      } else {
        alert("登録に失敗しました。入力内容をご確認のうえ、もう一度お試しください。");
      }
      return;
    }
    alert("確認メールを送りました！メール内のリンクを開いて確認を完了してから、ログインしてください。");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">新規登録</h2>
        <div className="flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="北大メールアドレス" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
          <input type="text" maxLength={30} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ニックネーム" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
          <PasswordInput autoComplete="new-password" value={password} onChange={setPassword} placeholder="パスワード（8文字以上・大小英字＋数字）" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
          <p className="text-xs text-stone-400 -mt-3">8文字以上、数字・アルファベットの大文字・小文字をすべて含めてください</p>

          <div id="terms">
            <label className="block text-sm font-bold mb-2">利用規約</label>
            <div className="h-40 overflow-y-auto border border-stone-200 rounded-xl p-3 text-xs text-stone-600 whitespace-pre-wrap bg-stone-50">
              {TERMS_TEXT}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="accent-orange-700 w-4 h-4"
            />
            <span>
              私は18歳以上の北大生で、
              <Link href="/terms" target="_blank" onClick={(e) => e.stopPropagation()} className="text-orange-700 underline">利用規約</Link>
              と
              <Link href="/privacy" target="_blank" onClick={(e) => e.stopPropagation()} className="text-orange-700 underline">プライバシーポリシー</Link>
              に同意します
            </span>
          </label>

          <button onClick={handleRegister} disabled={loading || !agreed} className="w-full bg-orange-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm">
            {loading ? "登録中..." : "登録する"}
          </button>
          <p className="text-center text-sm text-stone-500">
            すでにアカウントをお持ちの方は
            <span className="text-orange-700 font-bold cursor-pointer hover:underline" onClick={() => router.push("/login")}> ログイン</span>
          </p>
        </div>
      </main>
    </div>
  );
}
