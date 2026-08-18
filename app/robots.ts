import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/mypage", "/admin", "/items/*/chat"],
      },
    ],
    sitemap: "https://kitafuri.vercel.app/sitemap.xml",
  };
}
