import Header from "@/components/Header";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-2">プライバシーポリシー</h2>
        <p className="text-sm text-stone-500 mb-8">
          北フリ（以下、「本サービス」といいます。）は、北海道大学の学生が個人で運営する非公式サービスです。大学が公式に運営するものではありません。本サービスが取得する情報の取り扱いについて、以下の通り定めます。
        </p>

        <div className="flex flex-col gap-6 bg-white rounded-2xl shadow-sm border border-stone-200 p-6 text-sm text-stone-700 leading-relaxed">
          <section>
            <h3 className="font-bold mb-2">第1条（取得する情報）</h3>
            <p>本サービスは、利用登録および利用にあたり、以下の情報を取得します。</p>
            <ul className="list-disc pl-5 mt-1 flex flex-col gap-0.5">
              <li>メールアドレス（北海道大学の学生であることの確認に使用します）</li>
              <li>ニックネーム、プロフィール画像</li>
              <li>出品する商品の情報（タイトル・価格・写真・説明文など）</li>
              <li>チャットのメッセージ内容</li>
              <li>待ち合わせ場所・日時などの取引情報</li>
              <li>いいね・通報・評価などの利用履歴</li>
              <li>ログイン状態を保つための認証情報</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold mb-2">第2条（利用目的）</h3>
            <p>取得した情報は、以下の目的のために利用します。</p>
            <ul className="list-disc pl-5 mt-1 flex flex-col gap-0.5">
              <li>本人が北海道大学の学生であることの確認</li>
              <li>ログイン状態の維持・本人認証</li>
              <li>出品・購入・チャット・評価など、本サービスの機能提供</li>
              <li>通知の送信</li>
              <li>通報があった場合の状況確認・対応</li>
              <li>不正利用や規約違反の防止</li>
              <li>個人を特定しない形で集計し、本サービスの改善に役立てるため</li>
              <li>キャンペーンの抽選、当選者へのご連絡（ご登録のメールアドレス宛）および賞品の送付</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold mb-2">第2条の2（他の利用者に公開される情報・運営者による確認）</h3>
            <p>
              ニックネーム、プロフィール画像、出品情報、評価は、他の利用者から見える状態で公開されます。メールアドレスは他の利用者に表示しません。チャットの内容は取引の当事者のみが閲覧できますが、通報があった場合など、状況確認に必要な範囲で運営者が確認することがあります。
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第3条（第三者への提供）</h3>
            <p className="mb-3">
              取得した情報は、法令に基づく場合を除き、本人の同意なく第三者に提供することはありません。将来、広告を掲載する場合も、広告主に提供するのは個人を特定できない集計情報のみとします。
            </p>
            <p className="mb-2">
              本サービスは、以下の外部サービスを利用しており、サービス運用に必要な範囲でデータの取り扱いを委託しています。
            </p>
            <ul className="list-disc pl-5 mt-1 flex flex-col gap-0.5 mb-3">
              <li>Supabase（会員認証・データの保存）：提供会社の所在国 シンガポール／データの保存場所 シンガポール</li>
              <li>Vercel（サイトの公開）：提供会社の所在国 米国</li>
            </ul>
            <p>
              シンガポールには個人情報保護法（PDPA）があります。米国には日本と同等の包括的な個人情報保護法はなく、州ごとの法律などにより保護されています。運営者はこれらを踏まえ、各社のセキュリティ対策を確認したうえで利用しています。
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第4条（安全管理）</h3>
            <p>
              取得した情報は、権限のない第三者がアクセスできないよう、アクセス制限などの技術的な対策を講じて管理します。管理画面を操作できるのは運営者2名のみです。万が一、個人情報の漏えいなどが発生した場合は、法令に従い、速やかに対応します。
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第5条（開示・訂正・削除等の請求）</h3>
            <p>
              ご自身の情報の開示・訂正・利用停止・削除等をご希望の場合は、第9条の連絡先までご連絡ください。登録した北大メールアドレス宛に確認のご連絡をしたうえで、合理的な期間内に対応します。なお、出品した商品（売却済みのものを除く）は、マイページからご自身で削除できます。
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第6条（ブラウザの保存領域について）</h3>
            <p>
              本サービスは、ログイン状態を維持するために、お使いのブラウザのローカルストレージに認証情報を保存します。これにより取得した情報を、広告配信などの目的で外部の事業者に提供することはありません。
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第7条（未成年者の利用について）</h3>
            <p>未成年の方が本サービスを利用する場合は、保護者の同意を得た上でご利用ください。</p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第8条（本ポリシーの変更）</h3>
            <p>
              本サービスは、必要と判断した場合、本ポリシーの内容を変更することがあります。変更する場合は、本サービス上でお知らせします。
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2">第9条（運営者・お問い合わせ窓口）</h3>
            <p className="mb-2">
              本サービスは、北海道大学に所属する学生個人が運営しています。大学が公式に運営・関与するサービスではありません。ご意見・ご質問、情報の開示等のご請求は、以下の連絡先までお願いします。
            </p>
            <p className="font-bold text-orange-700">連絡先：hokufuri.official@gmail.com</p>
            <p className="font-bold text-orange-700">公式Instagram：@hokufuri.6816857（DM）</p>
          </section>

          <p className="text-xs text-stone-400">制定日：2026年9月28日</p>
        </div>
      </main>
    </div>
  );
}
