"use client";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import type { Shop } from "@/lib/shops";

// 指で動かせる地図(MapLibre GL ＋ OpenFreeMap の無料の地図。APIキー・料金なし)。
// 提携店の場所に「クーポン配布中！」のピンを立て、押すと onSelect でお店を知らせる。
// 地図の画像は利用者のブラウザが OpenFreeMap から直接読み込む(HOKUMA のサーバーは通らない)

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// 最初に映す場所: 北大の札幌キャンパスの東側(北18条駅〜北12条駅のあたり)
const START = { lng: 141.3445, lat: 43.0775, zoom: 15.2 };

function pinElement(label: string) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hokuma-pin";
  el.setAttribute("aria-label", `${label}（クーポン配布中）`);
  el.innerHTML = `
    <span class="hokuma-pin__label">クーポン配布中！</span>
    <span class="hokuma-pin__dot" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12h16a8 6.5 0 0 1-16 0z" fill="#fff" stroke="none"/>
        <path d="M9 20h6"/>
        <path d="M9 9c-1-1.5 1-2 0-3.5M15 9c-1-1.5 1-2 0-3.5"/>
      </svg>
    </span>
    <span class="hokuma-pin__name">${label}</span>`;
  return el;
}

export default function ShopMap({
  shops,
  selectedId,
  onSelect,
  bottomPadding,
  interactive = true,
}: {
  shops: Shop[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  bottomPadding: number; // 下のシートに隠れる割合(0〜1。ピンがシートの上に見えるように地図をずらす)
  interactive?: boolean; // false: 動かせない小さな地図(クーポンの詳細ページの上に出す)
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<string, { marker: MlMarker; el: HTMLElement }>>(new Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // 地図を作る(最初の1回だけ)
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !boxRef.current) return;
      // ワーカーは public/ にコピーしたものを使う(scripts/copy-maplibre-worker.mjs)
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
      const map = new maplibregl.Map({
        container: boxRef.current,
        style: STYLE_URL,
        // 動かせない地図は、最初からお店を真ん中に映す
        center: !interactive && shops[0] ? [shops[0].lng, shops[0].lat] : [START.lng, START.lat],
        zoom: interactive ? START.zoom : 16,
        interactive,
        minZoom: 11,
        maxZoom: 19,
        attributionControl: { compact: true },
        // 地図を回したり傾けたりはしない(迷わないように北を上で固定)
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      if (interactive) {
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(
          new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
          "bottom-right",
        );
      }
      // 地図の何もないところを押したら、お店の選択を外す
      map.on("click", () => onSelectRef.current(null));

      for (const s of shops) {
        const el = pinElement(s.name);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(s.id);
        });
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([s.lng, s.lat]).addTo(map);
        markers.set(s.id, { marker, el });
      }
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // お店の一覧は最初の1回で決まる(増えたらページを開き直せばよい)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 選んだお店を目立たせ、シートの上に見えるように地図を動かす
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => el.classList.toggle("is-active", id === selectedId));
    const map = mapRef.current;
    const shop = shops.find((s) => s.id === selectedId);
    if (!map || !shop || !interactive) return;
    const h = map.getContainer().clientHeight;
    map.easeTo({
      center: [shop.lng, shop.lat],
      zoom: Math.max(map.getZoom(), 16),
      // 上の浮かんだボタンと、下のシートの間にピンが来るようにする
      padding: { top: 70, bottom: Math.round(h * bottomPadding), left: 0, right: 0 },
      duration: 500,
    });
  }, [selectedId, shops, bottomPadding, interactive]);

  return (
    <>
      {/* MapLibre が中の div に position: relative を付けるので、外側の div で大きさを決める */}
      <div className="absolute inset-0">
        <div ref={boxRef} className="h-full w-full" role="region" aria-label="北大まわりのクーポンが使えるお店の地図" />
      </div>
      <style>{`
        .hokuma-pin { display: flex; flex-direction: column; align-items: center; cursor: pointer; background: none; border: 0; padding: 0; }
        .hokuma-pin:focus-visible { outline: 3px solid #F2C14E; outline-offset: 4px; border-radius: 12px; }
        .hokuma-pin__label {
          background: #F2C14E; color: #1B243A; font-weight: 800; font-size: 12px; line-height: 1;
          padding: 7px 10px; border-radius: 999px; border: 2px solid #1B243A; white-space: nowrap;
          box-shadow: 0 2px 0 #1B243A; margin-bottom: 4px;
        }
        .hokuma-pin__dot {
          width: 36px; height: 36px; border-radius: 999px; background: #BA421D; border: 2.5px solid #1B243A;
          display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(27,36,58,.35);
          transition: transform 160ms ease;
        }
        .hokuma-pin__name {
          margin-top: 3px; font-size: 11px; font-weight: 800; color: #1B243A; white-space: nowrap;
          text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff;
        }
        .hokuma-pin.is-active .hokuma-pin__dot { transform: scale(1.18); }
        .hokuma-pin.is-active .hokuma-pin__label { background: #fff; }
        @media (prefers-reduced-motion: reduce) { .hokuma-pin__dot { transition: none; } }
      `}</style>
    </>
  );
}
