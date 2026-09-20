export function validateImageFile(file: File, maxSizeMB = 10): string | null {
  if (!file.type.startsWith("image/")) {
    return "画像ファイルを選択してください";
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `画像は${maxSizeMB}MB以下のファイルを選択してください`;
  }
  return null;
}

export function resizeImage(file: File, maxDim = 1280, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = objectUrl;
  });
}
