import type { Metadata } from "next";
import Header from "@/components/Header";
import NotFoundView from "@/components/NotFoundView";

export const metadata: Metadata = {
  title: "ページが見つかりません | HOKUMA",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <NotFoundView />
    </div>
  );
}
