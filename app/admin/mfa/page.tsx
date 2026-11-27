"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { isAdminEmail } from "@/lib/adminEmails";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";
import { needsMfaCode } from "@/lib/mfa";
import Header from "@/components/Header";
import MfaCodeForm from "@/components/MfaCodeForm";

// 運営アカウントに、認証アプリ(Google Authenticator など)を登録する画面。
// 運営以外は登録できない(画面で止め、DB 側 migration PART BK でも止めている)。
type Enroll = { factorId: string; qr: string; secret: string };

export default function AdminMfaSetup() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"checking" | "enrolled" | "code" | "ready">("checking");
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (loading || !user || !isAdmin) return;
    let cancelled = false;
    (async () => {
      if (await needsMfaCode()) {
        if (!cancelled) setStatus("code");
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      setStatus((data?.totp?.length ?? 0) > 0 ? "enrolled" : "ready");
    })();
    return () => { cancelled = true; };
  }, [user, loading, isAdmin]);

  // QRコードを出す。前に途中でやめた(未確認の)登録が残っていれば、先に消す
  const startEnroll = async () => {
    setBusy(true);
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Google Authenticator",
      issuer: "HOKUMA",
    });
    setBusy(false);
    if (error || !data) {
      toast("登録を始められませんでした。もう一度お試しください");
      return;
    }
    setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const finishEnroll = async () => {
    if (!enroll || busy) return;
    if (!/^\d{6}$/.test(code)) { toast("6桁の数字を入力してください"); return; }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code });
    setBusy(false);
    if (error) {
      setCode("");
      toast("コードが違います。アプリに表示されている最新の6桁を入れてください");
      return;
    }
    setEnroll(null);
    setStatus("enrolled");
    toast("登録しました。次のログインから6桁を聞かれます");
  };

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6 text-center">運営の2段階認証</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col gap-4">{body}</div>
      </main>
    </div>
  );

  if (loading) return shell(<p className="text-center text-stone-400 text-sm">確認中...</p>);

  if (!user) {
    return shell(
      <Link href={loginPath("/admin/mfa")} className="text-center bg-orange-700 text-white py-3 rounded-full font-bold">
        ログインする
      </Link>
    );
  }

  if (!isAdmin) return shell(<p className="text-center text-stone-500 text-sm">このページは運営専用です。</p>);

  if (status === "checking") return shell(<p className="text-center text-stone-400 text-sm">確認中...</p>);

  if (status === "code") {
    return shell(
      <MfaCodeForm
        onVerified={() => setStatus("enrolled")}
        onGiveUp={async () => { await supabase.auth.signOut(); }}
      />
    );
  }

  if (status === "enrolled") {
    return shell(
      <>
        <p className="text-sm text-stone-700 leading-relaxed">
          このアカウントは登録済みです。ログインするときと管理画面を開くときに、認証アプリの6桁を聞かれます。
        </p>
        <p className="text-xs text-stone-500 leading-relaxed">
          スマホをなくした・機種変更で引き継げなかったときは、もう1人の運営に連絡し、Supabase の管理画面（Authentication → ユーザー）から登録を消してもらってから、ここで登録し直してください。
        </p>
      </>
    );
  }

  if (!enroll) {
    return shell(
      <>
        <ol className="text-sm text-stone-700 leading-relaxed list-decimal pl-5 flex flex-col gap-1">
          <li>スマホに「Google Authenticator」を入れる</li>
          <li>下のボタンでQRコードを出し、アプリの「＋」→「QRコードをスキャン」で読み取る</li>
          <li>アプリに出た「HOKUMA」の6桁を入力する</li>
        </ol>
        <p className="text-xs text-red-700">QRコードは合鍵と同じです。人に見せたり、写真に撮って送ったりしないでください。</p>
        <button
          onClick={startEnroll}
          disabled={busy}
          className="w-full bg-orange-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors"
        >
          {busy ? "準備中..." : "QRコードを出す"}
        </button>
      </>
    );
  }

  return shell(
    <form onSubmit={(e) => { e.preventDefault(); finishEnroll(); }} className="flex flex-col gap-4">
      {/* Supabase が返す QR コード(SVG のデータ URL) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enroll.qr} alt="認証アプリで読み取るQRコード" className="w-48 h-48 mx-auto" />
      <button type="button" onClick={() => setShowSecret((v) => !v)} className="text-xs text-stone-500 underline">
        {showSecret ? "隠す" : "QRコードが読めないときは、こちらのキーを手で入力"}
      </button>
      {showSecret && <p className="text-xs text-center font-mono break-all bg-stone-100 rounded-lg p-2">{enroll.secret}</p>}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="アプリに出た6桁"
        className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 text-center text-xl tracking-[0.4em]"
      />
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full bg-orange-700 text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors"
      >
        {busy ? "確認中..." : "登録する"}
      </button>
    </form>
  );
}
