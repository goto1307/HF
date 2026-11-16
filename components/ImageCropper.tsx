"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const OUTPUT_SIZE = 1000;
const MAX_ZOOM = 4;

// 調整する枠の大きさ（画面の幅に合わせて、最大420px）
function getCropSize() {
  if (typeof window === "undefined") return 320;
  return Math.max(240, Math.min(window.innerWidth - 56, 420));
}

type Props = {
  file: File;
  onConfirm: (file: File) => void;
  onCancel: () => void;
  title?: string;
  round?: boolean;
};

type Pt = { x: number; y: number };

export default function ImageCropper({ file, onConfirm, onCancel, title, round }: Props) {
  const [cropSize] = useState(getCropSize);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // 画面に触れている指（ポインター）の位置
  const pointersRef = useRef<Map<number, Pt>>(new Map());
  // 1本指で動かし始めたとき / 2本指でつまみ始めたときの状態
  const gestureRef = useRef<
    | { kind: "drag"; start: Pt; pos: Pt }
    | { kind: "pinch"; dist: number; mid: Pt; zoom: number; pos: Pt }
    | null
  >(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setNaturalSize(null);
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // zoom = 1 のとき、写真が枠いっぱいに広がる
  const baseScale = naturalSize ? Math.max(cropSize / naturalSize.w, cropSize / naturalSize.h) : 1;
  // 写真全体が枠に収まる倍率。商品写真は、ここまで縮めて全体を入れられる（余白は白で埋める）。
  // 丸いプロフィール写真は余白が出ると不自然なので、枠いっぱいまで。
  const minZoom = naturalSize && !round
    ? Math.min(cropSize / naturalSize.w, cropSize / naturalSize.h) / baseScale
    : 1;
  const scale = baseScale * zoom;
  const displayW = naturalSize ? naturalSize.w * scale : 0;
  const displayH = naturalSize ? naturalSize.h * scale : 0;

  // 写真が枠より大きいときは枠からはみ出す範囲で、小さいときは枠の中で動かせる
  const clampPos = useCallback((x: number, y: number, dw: number, dh: number) => {
    const minX = Math.min(0, cropSize - dw);
    const maxX = Math.max(0, cropSize - dw);
    const minY = Math.min(0, cropSize - dh);
    const maxY = Math.max(0, cropSize - dh);
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }, [cropSize]);

  const handleImgLoad = () => {
    const el = imgElRef.current;
    if (!el) return;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    const s = Math.max(cropSize / w, cropSize / h);
    setPos({ x: (cropSize - w * s) / 2, y: (cropSize - h * s) / 2 });
    setNaturalSize({ w, h });
    setZoom(1);
  };

  // 枠の中の座標に直す
  const toLocal = (clientX: number, clientY: number): Pt => {
    const r = boxRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };

  // anchorFrom の下にあった写真の点が anchorTo に来るようにして、倍率を変える
  const zoomAround = (fromZoom: number, fromPos: Pt, anchorFrom: Pt, anchorTo: Pt, toZoom: number) => {
    if (!naturalSize) return;
    const z = Math.min(MAX_ZOOM, Math.max(minZoom, toZoom));
    const fromScale = baseScale * fromZoom;
    const toScale = baseScale * z;
    const u = (anchorFrom.x - fromPos.x) / fromScale;
    const v = (anchorFrom.y - fromPos.y) / fromScale;
    setZoom(z);
    setPos(clampPos(anchorTo.x - u * toScale, anchorTo.y - v * toScale, naturalSize.w * toScale, naturalSize.h * toScale));
  };

  // 今触れている指から、ジェスチャーを始め直す
  const startGesture = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      gestureRef.current = {
        kind: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom,
        pos,
      };
    } else if (pts.length === 1) {
      gestureRef.current = { kind: "drag", start: pts[0], pos };
    } else {
      gestureRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!naturalSize) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, toLocal(e.clientX, e.clientY));
    startGesture();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId) || !naturalSize) return;
    pointersRef.current.set(e.pointerId, toLocal(e.clientX, e.clientY));
    const g = gestureRef.current;
    if (!g) return;
    const pts = [...pointersRef.current.values()];
    if (g.kind === "pinch" && pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAround(g.zoom, g.pos, g.mid, mid, g.zoom * (dist / g.dist));
    } else if (g.kind === "drag" && pts.length === 1) {
      const p = pts[0];
      setPos(clampPos(g.pos.x + p.x - g.start.x, g.pos.y + p.y - g.start.y, displayW, displayH));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    startGesture();
  };

  // パソコンでは、マウスのホイールで拡大・縮小
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      zoomAround(zoom, pos, p, p, zoom * Math.exp(-e.deltaY * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

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
    const k = OUTPUT_SIZE / cropSize;
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-lg w-full p-4" style={{ maxWidth: cropSize + 32 }}>
        <p className="font-bold text-sm mb-3 text-center">{title || "画像を調整"}</p>
        <div
          ref={boxRef}
          className={`relative mx-auto overflow-hidden ${round ? "bg-stone-100" : "bg-white border border-stone-200"} touch-none select-none ${round ? "rounded-full" : "rounded-xl"}`}
          style={{ width: cropSize, height: cropSize, cursor: naturalSize ? "grab" : "default" }}
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
                pointerEvents: "none",
              }}
            />
          )}
        </div>
        <p className="text-xs text-stone-500 text-center mt-3 leading-relaxed">
          指でずらして位置を調整、2本指でつまんで拡大・縮小できます
          {!round && <><br />小さくすると写真全体が入ります</>}
        </p>
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
