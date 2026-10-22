// Supabase Storage は日本語や一部の記号(#, % など)を含むパスを受け付けないため、
// 元のファイル名は使わず、英数字だけの保存名を作る。画像はトリミング時に
// すべて JPEG に変換している(components/ImageCropper.tsx)。
export function makeImagePath(prefix = ""): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now()}_${random}.jpg`;
}
