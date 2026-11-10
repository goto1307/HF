// 地図(MapLibre)が裏で使う作業用ファイル(ワーカー)を public/ にコピーする。
// Next.js のビルドはこのファイルを自動では拾わないため、npm install のたびにここでコピーし、
// components/ShopMap.tsx から setWorkerUrl("/maplibre-gl-worker.mjs") で場所を教える。
// コピーしたファイルは .gitignore で GitHub に上げない(バージョンが変わっても自動で合う)
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = join(root, "public/maplibre-gl-worker.mjs");

if (existsSync(from)) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log("maplibre-gl-worker.mjs を public/ にコピーしました");
} else {
  console.warn("maplibre-gl が見つからないため、ワーカーのコピーを飛ばしました");
}
