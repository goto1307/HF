export function validateImageFile(file: File, maxSizeMB = 10): string | null {
  if (!file.type.startsWith("image/")) {
    return "画像ファイルを選択してください";
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `画像は${maxSizeMB}MB以下のファイルを選択してください`;
  }
  return null;
}

function resizeViaCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxDim: number, quality: number, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("canvas context取得に失敗しました")); return; }
    ctx.drawImage(source, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("画像の書き出しに失敗しました")); return; }
        resolve(new File([blob], fileName.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality
    );
  });
}

function resizeViaImageElement(file: File, maxDim: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resizeViaCanvas(img, img.naturalWidth, img.naturalHeight, maxDim, quality, file.name).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像の読み込みに失敗しました"));
    };
    img.src = objectUrl;
  });
}

export async function resizeImage(file: File, maxDim = 1280, quality = 0.85): Promise<File> {
  // createImageBitmap は EXIF の向き情報も正しく扱え、<img>要素より
  // 幅広い画像形式(HEIC/HEIFを含む場合がある)に対応しているブラウザが多い。
  // 使えない/失敗する場合は従来の<img>+canvas方式にフォールバックする。
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const result = await resizeViaCanvas(bitmap, bitmap.width, bitmap.height, maxDim, quality, file.name);
      bitmap.close();
      return result;
    } catch {
      // フォールバックへ
    }
  }
  return resizeViaImageElement(file, maxDim, quality);
}
