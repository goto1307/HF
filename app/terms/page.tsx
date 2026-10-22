import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { TERMS_TEXT } from "@/lib/terms";

export const metadata: Metadata = {
  title: "利用規約 | HOKUMA",
};

export default function Terms() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">利用規約</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
          {TERMS_TEXT}
        </div>
        <p className="text-sm text-stone-500 mt-6">
          個人情報の取り扱いについては
          <Link href="/privacy" className="text-orange-700 underline">プライバシーポリシー</Link>
          をご覧ください。
        </p>
      </main>
    </div>
  );
}
