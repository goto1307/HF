import type { Metadata } from "next";
import Header from "@/components/Header";
import JoinSteps from "@/components/JoinSteps";

export const metadata: Metadata = {
  title: "新規登録 | HOKUMA",
};

export default function Join() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">新規登録</h2>
        <JoinSteps />
      </main>
    </div>
  );
}
