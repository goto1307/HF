"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

export default function UpdatePassword() {
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    if (password.length < 6) { alert("パスワードは6文字以上にしてください"); return; }
    if (password !== confirm) { alert("パスワードが一致しません"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { alert(`更新に失敗しました: ${error.message}`); return; }
    alert("パスワードを更新しました！");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">新しいパスワードを設定</h2>
        <div className="flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          {authLoading ? (
            <p className="text-sm text-stone-400 text-center py-4">確認中...</p>
          ) : !user ? (
            <p className="text-sm text-stone-600 text-center py-4">
              リンクが無効か期限切れです。もう一度パスワード再設定をお試しください。
            </p>
          ) : (
            <>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新しいパスワード（6文字以上）"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                placeholder="新しいパスワード（確認）"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm"
              />
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="w-full bg-orange-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm"
              >
                {loading ? "更新中..." : "パスワードを更新"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
