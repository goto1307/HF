import type { Metadata } from "next";
import Header from "@/components/Header";
import { SIGNUP_FORM_URL } from "@/lib/signupForm";

export const metadata: Metadata = {
  title: "新規登録 | HOKUMA",
};

export default function Join() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">新規登録</h2>
        <div className="flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <p className="text-sm text-stone-700 leading-relaxed">
            HOKUMAの登録には、Googleフォームのかんたんなアンケート（1分）への回答が必要です。
          </p>
          <p className="text-sm text-stone-700 leading-relaxed">
            回答が終わると、最後に<span className="font-bold">登録用のリンク</span>が表示されます。そこから登録に進んでください。
          </p>
          <p className="text-xs text-stone-400 leading-relaxed">
            アンケートは匿名です（学部・年齢などを伺います）。回答はサービスの改善のためだけに使います。
          </p>
          <a
            href={SIGNUP_FORM_URL}
            className="w-full text-center bg-orange-700 text-white py-3 rounded-full font-bold hover:bg-orange-800 transition-colors shadow-sm"
          >
            アンケートに答える（1分）
          </a>
        </div>
      </main>
    </div>
  );
}
