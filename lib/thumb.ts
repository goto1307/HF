// 商品写真の「一覧用の小さい写真(サムネイル)」まわり。
// 出品の写真は 1000px 四方・1枚 150〜560KB あり、一覧の小さい枠にもそのまま使っていて重かった。
// そこで、同じ写真を 480px に縮めたもの(1枚 30〜50KB ほど)を images バケットの thumbs/ に置き、
// 一覧ではそちらを出す。サムネイルがまだない写真(古い商品など)は、元の写真をそのまま出す
// (components/ItemThumb.tsx)。元の写真・商品のデータは何も変えない。
import { supabase } from "@/lib/supabase";

export const THUMB_SIZE = 480; // 一覧の枠(スマホで2列、パソコンで最大4〜5列)の2倍くらい
const THUMB_QUALITY = 0.8;
const THUMB_DIR = "thumbs/";
// 写真をブラウザ・配信サーバー(CDN)に覚えてもらう時間(1日)。
// ファイル名は毎回ちがう(lib/uploadPath.ts)ので長くしても表示は壊れないが、無料プランの Supabase は
// 写真を消しても配信サーバーの覚えた分をすぐには消せない。不適切な写真を運営が消したとき、
// 長く残らないように1日にしておく(以前は1時間。1年にすると最長1年残るおそれがある)
export const LONG_CACHE = "86400";

const PUBLIC_PREFIX = "/storage/v1/object/public/images/";

// images バケットの写真のURLか(利用者が書き換えた、よそのURLではないか)
export function isOwnImageUrl(url: string): boolean {
  return url.includes(PUBLIC_PREFIX) && imageNameFromUrl(url) !== null;
}

// 元の写真の公開URL → サムネイルの公開URL。images バケットの写真でなければ、そのまま返す
export function thumbUrl(url: string): string {
  const i = url.indexOf(PUBLIC_PREFIX);
  if (i < 0) return url;
  const name = url.slice(i + PUBLIC_PREFIX.length);
  if (name.startsWith(THUMB_DIR) || name.startsWith("avatars/")) return url;
  return url.slice(0, i + PUBLIC_PREFIX.length) + THUMB_DIR + name;
}

// 元の写真の公開URL → images バケットの中でのファイル名(thumbs/ を付ける前)。images の写真でなければ null
export function imageNameFromUrl(url: string): string | null {
  const i = url.indexOf(PUBLIC_PREFIX);
  if (i < 0) return null;
  const name = decodeURIComponent(url.slice(i + PUBLIC_PREFIX.length).split("?")[0]);
  if (!name || name.startsWith(THUMB_DIR) || name.startsWith("avatars/")) return null;
  return name;
}

// 写真を、長い辺が THUMB_SIZE になるよう縮めた JPEG にする(もともと小さければ大きくはしない)
export async function makeThumbBlob(src: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(src);
    const scale = Math.min(1, THUMB_SIZE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", THUMB_QUALITY));
  } catch {
    return null;
  }
}

// サムネイルを作って thumbs/ に置く。うまくいかなくても出品などは止めない(一覧で元の写真が出るだけ)。
// 戻り値: "made"(作った) / "exists"(もうあった) / "failed"(作れなかった)
export async function uploadThumb(name: string, src: Blob): Promise<"made" | "exists" | "failed"> {
  const blob = await makeThumbBlob(src);
  if (!blob) return "failed";
  const { error } = await supabase.storage
    .from("images")
    .upload(THUMB_DIR + name, blob, { contentType: "image/jpeg", cacheControl: LONG_CACHE });
  if (!error) return "made";
  // 同じ名前のファイルがすでにある(上書きはしない)
  if (/exist|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ""}`)) return "exists";
  return "failed";
}
