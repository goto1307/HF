"use client";
import { useState } from "react";
import { verifyMfaCode } from "@/lib/mfa";
import { toast } from "@/lib/toast";

// 運営だけに出す「認証アプリの6桁」の入力欄(ログイン画面と管理画面で使う)
// 5回まちがえたら onGiveUp(ログアウトなど)を呼ぶ
type Props = {
  onVerified: () => void;
  onGiveUp: () => void;
  giveUpLabel?: string;
};

const MAX_TRIES = 5;

export default function MfaCodeForm({ onVerified, onGiveUp, giveUpLabel = "やめる（ログアウト）" }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [tries, setTries] = useState(0);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    const result = await verifyMfaCode(code);
    setLoading(false);
    if (result.ok) {
      onVerified();
      return;
    }
    const next = tries + 1;
    setTries(next);
    setCode("");
    if (next >= MAX_TRIES) {
      toast("まちがいが続いたため、ログアウトしました");
      onGiveUp();
      return;
    }
    toast(result.message);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
      <p className="text-sm text-stone-600 leading-relaxed">
        運営アカウントです。スマホの認証アプリ（Google Authenticator）に表示されている「HOKUMA」の6桁を入力してください。
      </p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="6桁の数字"
        autoFocus
        className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-center text-xl tracking-[0.4em]"
      />
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-orange-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm"
      >
        {loading ? "確認中..." : "確認する"}
      </button>
      <button
        type="button"
        onClick={onGiveUp}
        className="text-center text-sm text-stone-500 hover:text-orange-700 transition-colors"
      >
        {giveUpLabel}
      </button>
    </form>
  );
}
