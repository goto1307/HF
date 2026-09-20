export function validateImageFile(file: File, maxSizeMB = 10): string | null {
  if (!file.type.startsWith("image/")) {
    return "画像ファイルを選択してください";
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `画像は${maxSizeMB}MB以下のファイルを選択してください`;
  }
  return null;
}
