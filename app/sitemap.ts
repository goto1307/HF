import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://hokuma-market.com";
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/about`, priority: 0.9 },
    { url: `${base}/join`, priority: 0.6 },
    { url: `${base}/login`, priority: 0.5 },
    { url: `${base}/terms`, priority: 0.3 },
    { url: `${base}/privacy`, priority: 0.3 },
  ];
}
