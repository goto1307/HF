"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

const TERMS_TEXT = `北フリ 利用規約

本利用規約（以下「本規約」）は、北大生のためのフリマ「北フリ」（以下「本サービス」）の利用条件を定めるものです。利用者は、本規約に同意したうえで本サービスを利用するものとします。本サービスは北海道大学の学生が個人で運営する非公式サービスであり、北海道大学の公式サービスではありません。

第1条（利用資格・登録）
本サービスを利用できるのは、北海道大学に在籍し、大学が発行するメールアドレスを持つ方に限ります。
卒業・退学などにより在籍しなくなった場合、利用資格を失います。運営者は、その方のアカウントを削除できるものとします。
登録情報に偽りがあった場合、運営者は登録を取り消すことがあります。
アカウントは本人のみが利用でき、他人に譲渡することはできません。
未成年の方は、保護者の同意を得たうえで利用してください。

第2条（本サービスの役割）
本サービスは、利用者同士が物品を売買する場を提供するものです。運営者は売買契約の当事者ではありません。
売買契約は、出品者と購入者の間で直接成立します。
運営者が自ら出品する場合は、一利用者として取り扱います。
本サービスの利用は無料です。運営者は、出品・購入のいずれについても手数料を受け取りません。将来有料の機能を設ける場合は、事前に本サービス上で告知します。

第3条（出品）
出品者は、商品の写真・説明・状態・価格・受け渡し場所を正確に記載するものとします。傷や汚れ、欠品などがある場合は、必ず記載してください。
出品者は、自分が正当に所有し、売る権利を持つ物のみを出品できます。

第3条の2（投稿した写真・文章の取り扱い）
利用者が本サービスに投稿した写真・文章の著作権は、投稿した利用者に帰属します。
利用者は、運営者が本サービスの運営および宣伝（公式Instagram等での紹介を含む）のために、投稿された出品情報を無償で利用することを許諾するものとします。この場合、運営者はニックネーム等、個人が特定される情報を掲載しません。
利用者は、他人が著作権などの権利を持つ写真・文章を、無断で投稿してはなりません。

第4条（取引の流れ・支払い）
【新設】出品者が購入希望者を購入者として確定した時点で、出品者と購入者の間で売買契約が成立します。確定にあたって、購入者の別途の承諾操作は必要ありません。購入希望者は、購入者として確定される可能性があることを理解したうえで、購入の意思を示すものとします。
受け渡しの場所・日時と支払い方法は、個別チャットで当事者同士が決めるものとします。
運営者は代金を預からず、支払いには関与しません。
購入者は、受け渡しの際に商品の状態を確認してから代金を支払うものとします。
受け渡しは人目のある場所で行うなど、安全に十分配慮してください。

第5条（キャンセル・返品）
購入確定後、受け渡し前にキャンセルする場合は、事前に相手方に連絡し、協議のうえ行うものとします。
サイト上のキャンセル操作は、当事者のいずれか一方が行うことで、取引に反映されます。相手方の承諾操作は不要ですが、これは、相手方の同意なく一方的にキャンセルしてよいことを意味するものではありません。
正当な理由なく、または相手方に連絡せずに一方的にキャンセルした場合、運営者は、双方から事情を聴取のうえ、警告、キャンセル操作の制限、利用停止などの措置をとることがあります。
待ち合わせ場所に現れない、連絡が取れなくなるなど、実質的に取引を放棄したと認められる場合も、前項に準じて扱います。
運営者は、キャンセルに伴う損害（交通費、時間の損失など）を補償する義務を負いません。
受け渡しと支払いが完了した後の返品・返金は、原則として受け付けません。ただし、当事者同士が合意した場合はこの限りではありません。

第6条（禁止出品物）
次の物は出品できません。
法令で売買が禁止・制限されている物（医薬品、酒類、たばこ、危険物、刃物・エアガン類など）
チケット類（コンサート、スポーツ、交通機関など）
現金、金券、商品券
食品（手作り品を含む）
生き物（動物・植物を含む）
講義ノート、講義資料、過去問、試験の解答、レポート・課題の代行など、学業上の不正や権利侵害につながる物
偽ブランド品・海賊版など、著作権・商標権を侵害する物
盗品など、出品者に売る権利がない物
個人情報が含まれる書類・データ、アダルト関連商品
その他、運営者が不適切と判断した物

第7条（禁止行為）
虚偽の情報の登録・掲載
事前の連絡なく受け渡しに来ない行為（すっぽかし）
他の利用者への嫌がらせ、差別的な言動、つきまとい行為
取引目的以外で、他の利用者の個人情報を集める行為
本サービス内の画像を無断で転載・再利用する行為
事実と異なる評価や、嫌がらせ目的の評価・通報
本サービスの運営を妨げる行為、不正アクセス
法令または公序良俗に反する行為

第8条（通報への対応・利用停止等）【一部変更】
通報があった場合、運営者は状況確認のため、該当する出品情報やチャットの内容を確認し、必要に応じて当事者に事情を聞くことがあります。当事者は、運営者からの事情聴取に、誠実に協力するものとします。
利用者が本規約に違反した場合、運営者は事前の通知なく、出品の削除、利用停止、登録の抹消を行うことがあります。悪質と判断した場合は、1回の違反でも利用停止とすることがあります。

第9条（利用者間のトラブル）【変更】
取引に関するトラブルは、当事者同士で誠意をもって解決するものとします。
運営者は、当事者の一方または双方から申告があった場合、事実関係の確認のため、双方から事情を聴取することがあります。運営者は、聴取・確認の結果に基づき、警告、出品の削除、取引の取消し、利用停止などの措置をとることがありますが、当事者間の紛争を仲裁・裁定する義務や、損害を賠償する責任を負いません。

第9条の2（退会）
利用者は、お問い合わせ先に連絡することで、いつでも退会（アカウントの削除）を申し出ることができます。取引の途中であっても退会できますが、取引相手には事前に連絡してください。
退会の申し出があった場合、運営者は内容を確認したうえで、登録情報・出品情報などのデータを削除します。
前項にかかわらず、規約違反やトラブルの調査・対応に必要な情報は、必要な期間保持し、悪質な場合には必要な措置をとることがあります。

第10条（免責）
運営者は、出品物の品質・安全性・適法性、および取引が確実に行われることを保証しません。
運営者の軽過失によって利用者に損害が生じた場合、運営者の賠償責任は1万円を上限とします。
前項の上限は、運営者に故意または重大な過失がある場合には適用しません。

第11条（サービスの変更・停止）
運営者は、事前に告知したうえで、本サービスの内容を変更し、または提供を終了できるものとします。ただし、緊急の場合は事後の告知となることがあります。

第11条の2（キャンペーン）【新設】
運営者は、利用者向けにキャンペーンを実施することがあります。内容・応募条件・賞品は、各キャンペーンの応募規約に定めます。
キャンペーンに応募する利用者は、本規約と各キャンペーンの応募規約の両方に同意したものとみなします。両者が異なる場合、そのキャンペーンに関する事項は、応募規約を優先します。
不正な応募があった場合、運営者は、応募の無効、当選の取消し、利用停止などの措置をとることがあります。

第12条（規約の変更）
運営者は、必要に応じて本規約を変更できるものとします。変更する場合は、変更内容と効力が発生する日を、その日より前に本サービス上で告知します。

第13条（準拠法・管轄）【変更】
本規約は日本法に従うものとします。本サービスに関する紛争は、札幌地方裁判所または札幌簡易裁判所を第一審の管轄裁判所とします。

第14条（お問い合わせ）
北フリ運営
公式Instagram：@hokufuri.6816857（DM）
メール：hokufuri.official@gmail.com

制定日：2026年9月28日`;

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
