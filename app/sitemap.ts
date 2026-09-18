import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://kitafuri.vercel.app";
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/about`, priority: 0.9 },
    { url: `${base}/register`, priority: 0.6 },
    { url: `${base}/login`, priority: 0.5 },
    { url: `${base}/privacy`, priority: 0.3 },
  ];
}
