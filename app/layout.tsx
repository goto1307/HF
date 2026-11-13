import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";
import NavTracker from "@/components/NavTracker";
import LastSectionRestore from "@/components/LastSectionRestore";
import Toaster from "@/components/Toaster";
import { SITE_URL } from "@/lib/siteUrl";

const mplusRounded = M_PLUS_Rounded_1c({
  variable: "--font-mplus-rounded",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  // 日本語のフォントは細かい部品(数百個)に分かれている。全部を先に読み込むと初回に約3MBになり、
  // 商品や写真の読み込みが遅れていたため、画面に出る文字の部品だけを読み込むようにする
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "HOKUMA | 北大生のためのフリマ",
  description: "北海道大学の学生同士で教科書や自転車などを気軽に売り買いできるフリマアプリ",
  // iPhone でホーム画面に追加したとき、アプリのように全画面で開く
  appleWebApp: {
    capable: true,
    title: "HOKUMA",
    statusBarStyle: "default",
  },
};

// スマホのブラウザのバーや、ホーム画面から開いたときの上部の色(ヘッダーと同じオレンジ)
export const viewport: Viewport = {
  themeColor: "#c2410c",
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
        <NavTracker />
        <Toaster />
        <AuthProvider>
          <LastSectionRestore />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
