"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

const TERMS_TEXT = `本利用規約（以下、「本規約」といいます。）は、北大生のためのフリマ「北フリ」（以下、「本サービス」といいます。）の利用条件を定めるものです。ユーザーの皆様には、本規約に従って本サービスをご利用いただきます。

第1条（適用）
本規約は、ユーザーと本サービス運営者との間の本サービスの利用に関わる一切の関係に適用されるものとします。

本サービスに関して、本規約のほか、各種のルール・ガイドライン等の規定を定める場合があります。これらも本規約の一部を構成するものとします。

第2条（利用資格）
本サービスは、北海道大学の学生および関係者を対象とした取引プラットフォームです。ユーザーは、正当な身分情報および連絡先をもって登録を行うものとします。

第3条（禁止事項）
ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。

・法令または公序良俗に違反する行為
・犯罪行為に関連する行為
・本サービス内の画像を無断転載・再利用する行為
・不正アクセス、他のユーザーの個人情報の収集・蓄積を行う行為
・以下の対象物品を出品・取引する行為
　法律・規制物品: 医薬品、たばこ、酒類（無許可）、危険物、刃物・エアガン類など
　権利侵害品: 偽ブランド品、海賊版、著作権・商標権を侵害するもの
　金融・情報系: 現金、金券、商品券、個人情報が含まれる書類・データ
　その他: アダルト関連商品、過去の試験問題・課題等の過度な売買、対面取引において安全が確保できない物品
・その他、運営者が不適切と判断する行為

第4条（取引および対面受け渡し）
本サービスを通じた商品の売買・譲渡契約は、出品者と購入者（受け取り手）の間で直接成立するものとします。

キャンパス内や指定エリアでの対面受け渡しを行う際、ユーザーは周囲の安全および防犯に十分配慮し、自己の責任において取引を行ってください。

約束のキャンセル（ドタキャン）や連絡不通、受け渡し時の金銭・商品トラブルについては、当事者間で誠意をもって解決するものとします。

第5条（免責事項）
本サービスは、ユーザー間の取引の場を提供するものであり、売買契約の当事者とはなりません。商品の不備、事故、紛失、盗難、未払い等のトラブルについて、運営者は一切の責任を負いません。

本サービスからリンクされている外部サイトや、本サービス内でやり取りされる情報の内容について、運営者はその正確性や安全性を保証しません。

第6条（規約の変更・サービス変更）
運営者は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更、または本サービスの提供を停止・終了することができるものとします。

第7条（準拠法・裁判管轄）
本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合、運営者の所在地を管轄する裁判所を専属的合意管轄とします。`;

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
    if (!isValidEmail(email)) { alert("北大のメールアドレスを入力してください"); return; }
    if (!nickname.trim()) { alert("ニックネームを入力してください"); return; }
    if (!isValidPassword(password)) { alert("パスワードは8文字以上で、数字・アルファベットの大文字・小文字をすべて含めてください"); return; }
    if (!agreed) { alert("利用規約への同意が必要です"); return; }
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
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード（8文字以上・大小英字＋数字）" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
          <p className="text-xs text-stone-400 -mt-3">8文字以上、数字・アルファベットの大文字・小文字をすべて含めてください</p>

          <div>
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
            利用規約に同意する
          </label>
          <Link href="/privacy" className="text-center text-xs text-stone-400 hover:text-orange-700 underline transition-colors -mt-2">
            プライバシーポリシーはこちら
          </Link>

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
