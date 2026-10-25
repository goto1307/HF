import type { MetadataRoute } from "next";

// スマホのホーム画面に追加したときの名前・アイコン・色。
// アプリのように全画面(standalone)で開く。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HOKUMA | 北大生のためのフリマ",
    short_name: "HOKUMA",
    description: "北海道大学の学生同士で教科書や自転車などを気軽に売り買いできるフリマアプリ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#c2410c",
    lang: "ja",
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
