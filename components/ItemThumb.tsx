"use client";
// 一覧に出す商品の写真。小さい写真(サムネイル)があればそれを、なければ元の写真を出す(lib/thumb.ts)
import { thumbUrl } from "@/lib/thumb";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string };

export default function ItemThumb({ src, alt = "", onError, ...rest }: Props) {
  const thumb = thumbUrl(src);
  // サムネイルが読み込めなかったら、元の写真に差し替える
  const fallBackToOriginal = (img: HTMLImageElement) => {
    if (thumb !== src && img.getAttribute("src") !== src) img.setAttribute("src", src);
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      alt={alt}
      src={thumb}
      // ページの準備(読み込み直後の処理)が終わる前に読み込みに失敗していた場合も、ここで気づいて差し替える
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) fallBackToOriginal(img);
      }}
      onError={(e) => {
        fallBackToOriginal(e.currentTarget);
        onError?.(e);
      }}
    />
  );
}
