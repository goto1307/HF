"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { IconSearch } from "@/components/icons";

const CROP_SIZE = 280;
const OUTPUT_SIZE = 1000;
const MAX_ZOOM = 3;

type Props = {
  file: File;
  onConfirm: (file: File) => void;
  onCancel: () => void;
  title?: string;
  round?: boolean;
};

export default function ImageCropper({ file, onConfirm, onCancel, title, round }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setNaturalSize(null);
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = naturalSize ? Math.max(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h) : 1;
  // 写真全体が枠に収まる倍率。商品写真は、ここまで縮めて全体を入れられる（余白は白で埋める）。
  // 丸いプロフィール写真は余白が出ると不自然なので、今までどおり枠いっぱいまで。
  const minZoom = naturalSize && !round
    ? Math.min(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h) / baseScale
    : 1;
  const scale = baseScale * zoom;
  const displayW = naturalSize ? naturalSize.w * scale : 0;
  const displayH = naturalSize ? naturalSize.h * scale : 0;

  const clampPos = useCallback((x: number, y: number, dw: number, dh: number) => {
    // 写真が枠より大きいときは枠からはみ出す範囲で、小さいときは枠の中で動かせる
    const minX = Math.min(0, CROP_SIZE - dw);
    const maxX = Math.max(0, CROP_SIZE - dw);
    const minY = Math.min(0, CROP_SIZE - dh);
    const maxY = Math.max(0, CROP_SIZE - dh);
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }, []);

  const handleImgLoad = () => {
    const el = imgElRef.current;
    if (!el) return;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    const s = Math.max(CROP_SIZE / w, CROP_SIZE / h);
    const dw = w * s;
    const dh = h * s;
    setPos({ x: (CROP_SIZE - dw) / 2, y: (CROP_SIZE - dh) / 2 });
    setNaturalSize({ w, h });
    setZoom(1);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!naturalSize) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clampPos(dragRef.current.posX + dx, dragRef.current.posY + dy, displayW, displayH));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleZoomChange = (newZoom: number) => {
    if (!naturalSize) return;
    const newScale = baseScale * newZoom;
    const dw = naturalSize.w * newScale;
    const dh = naturalSize.h * newScale;
    const cx = pos.x + displayW / 2;
    const cy = pos.y + displayH / 2;
    setZoom(newZoom);
    setPos(clampPos(cx - dw / 2, cy - dh / 2, dw, dh));
  };

  const handleConfirm = () => {
    if (!naturalSize || !imgElRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) { onCancel(); return; }
    // 縮めたときの余白は白にする
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const k = OUTPUT_SIZE / CROP_SIZE;
    ctx.drawImage(imgElRef.current, pos.x * k, pos.y * k, displayW * k, displayH * k);
    canvas.toBlob(
      (blob) => {
        if (!blob) { onCancel(); return; }
        onConfirm(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5">
        <p className="font-bold text-sm mb-3 text-center">{title || "画像を調整"}</p>
        <div
          className={`relative mx-auto overflow-hidden ${round ? "bg-stone-100" : "bg-white border border-stone-200"} touch-none select-none ${round ? "rounded-full" : "rounded-xl"}`}
          style={{ width: CROP_SIZE, height: CROP_SIZE, cursor: naturalSize ? "grab" : "default" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imgUrl && (
            <img
              ref={imgElRef}
              src={imgUrl}
              onLoad={handleImgLoad}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: displayW || undefined,
                height: displayH || undefined,
                maxWidth: "none",
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <IconSearch size={14} className="text-stone-400 shrink-0" />
          <input
            type="range"
            min={minZoom}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="flex-1 accent-orange-700"
            disabled={!naturalSize}
          />
        </div>
        <p className="text-xs text-stone-400 text-center mt-2">{round ? "ドラッグで位置調整、スライダーで拡大縮小できます" : "ドラッグで位置調整、スライダーを左にすると写真全体が入ります"}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 border border-stone-300 text-stone-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors">
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!naturalSize}
            className="flex-1 bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
          >
            この内容で使う
          </button>
        </div>
      </div>
    </div>
  );
}
