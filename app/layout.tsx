import type { Metadata } from "next";
import Link from "next/link";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";

const mplusRounded = M_PLUS_Rounded_1c({
  variable: "--font-mplus-rounded",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "北フリ | 北大生のためのフリマ",
  description: "北海道大学の学生同士で教科書や自転車などを気軽に売り買いできるフリマアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${mplusRounded.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <footer className="text-center text-xs text-stone-400 py-6 px-4 border-t border-stone-200 bg-stone-50">
          <p>北フリは北海道大学非公認の、学生個人が運営する非公式サービスです。北海道大学とは関係ありません。</p>
          <Link href="/privacy" className="text-stone-500 hover:text-orange-700 underline transition-colors">
            プライバシーポリシー
          </Link>
        </footer>
      </body>
    </html>
  );
}
