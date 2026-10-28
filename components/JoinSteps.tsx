"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { SIGNUP_FORM_URL } from "@/lib/signupForm";
import { isSurveyDone } from "@/lib/visitSource";

const noop = () => () => {};

// 新規登録の案内。ふだんは Google フォームのアンケートから登録してもらうが、
// 学内アンケートで同じ内容にもう答えてくれた人(lib/visitSource.ts の印)は、
// 二重に答えなくて済むよう、何も表示せずにそのまま登録画面へ移る。
export default function JoinSteps() {
  const router = useRouter();
  // サーバーでは印が分からないので null(まだ何も出さない)にして、案内が一瞬見えるのを防ぐ
  const surveyDone = useSyncExternalStore<boolean | null>(noop, isSurveyDone, () => null);

  useEffect(() => {
    if (surveyDone) router.replace("/register");
  }, [surveyDone, router]);

  if (surveyDone !== false) return null;

  return (
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
  );
}
