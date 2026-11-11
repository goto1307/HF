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

// 動かせる範囲: 北大の札幌キャンパスの真ん中(北13条西8丁目あたり)から、半径およそ3km。
// 1kmあたり 緯度 0.009度・経度 0.0123度(札幌の緯度で計算)
const CAMPUS = { lng: 141.3415, lat: 43.0760 };
const RADIUS_KM = 3;
const BOUNDS: [[number, number], [number, number]] = [
  [CAMPUS.lng - 0.0123 * RADIUS_KM, CAMPUS.lat - 0.009 * RADIUS_KM],
  [CAMPUS.lng + 0.0123 * RADIUS_KM, CAMPUS.lat + 0.009 * RADIUS_KM],
];

// 地図を見やすくするため、いらない情報を消す
// - 立体の建物(3D)を消す
// - お店や施設のアイコン(POI)は、駅だけ残して消す
// - 番地・山頂・空港の名前を消す
// - 地名・道路名は日本語だけにする(英語の読みを並べない)
// 地図の部品の名前は OpenMapTiles の決まり(https://openmaptiles.org/schema/)
type StyleLayer = { id: string; type: string; "source-layer"?: string; layout?: Record<string, unknown> };
function simplify(map: MlMap) {
  const layers = (map.getStyle().layers ?? []) as StyleLayer[];
  for (const layer of layers) {
    const src = layer["source-layer"];
    if (layer.type === "fill-extrusion" || src === "housenumber" || src === "mountain_peak" || src === "aerodrome_label") {
      map.removeLayer(layer.id);
      continue;
    }
    if (src === "poi") {
      map.setFilter(layer.id, ["in", ["get", "class"], ["literal", ["railway"]]]);
    }
    const textField = layer.layout?.["text-field"];
    // 道路番号の看板(ref)などは変えず、名前を出している文字だけを日本語にする
    if (layer.type === "symbol" && textField && JSON.stringify(textField).includes("name")) {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:ja"], ["get", "name"]]);
    }
  }
}

// ピンは、ひとまずシンプルな朱色の丸＋店名(あとでアイコンを決めたら差し替える)
function pinElement(label: string) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hokuma-pin";
  el.setAttribute("aria-label", `${label}（クーポン配布中）`);
  el.innerHTML = `
    <span class="hokuma-pin__dot" aria-hidden="true"></span>
    <span class="hokuma-pin__name"></span>`;
  el.querySelector(".hokuma-pin__name")!.textContent = label;
  return el;
}

export default function ShopMap({
  shops,
  selectedId,
  onSelect,
  bottomPadding,
  interactive = true,
  attributionClass = "right-1 bottom-1",
}: {
  shops: Shop[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  bottomPadding: number; // 下のシートに隠れる割合(0〜1。ピンがシートの上に見えるように地図をずらす)
  interactive?: boolean; // false: 動かせない小さな地図(クーポンの詳細ページの上に出す)
  attributionClass?: string; // 提供元の文字を置く場所(Tailwind の位置のクラス)
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
        minZoom: 12.5,
        maxZoom: 19,
        maxBounds: BOUNDS,
        // 提供元の表示は、下の文字(地図の右上)で出す。i ボタンだけだと分かりにくいため
        attributionControl: false,
        // 地図を回したり傾けたりはしない(迷わないように北を上で固定)
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      // 拡大・縮小などのボタンは出さない(指でつまんで拡大・縮小できる)
      if (interactive) map.touchZoomRotate.disableRotation();
      map.once("style.load", () => {
        try {
          simplify(map);
        } catch {
          // 地図の作りが変わって消せなかったときも、地図はそのまま使えるようにする
        }
      });
      // 地図の何もないところを押したら、お店の選択を外す
      map.on("click", () => onSelectRef.current(null));

      for (const s of shops) {
        const el = pinElement(s.name);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(s.id);
        });
        // 丸の真ん中がお店の位置に来るようにする(丸の高さ 22px の半分だけ上へ)
        const marker = new maplibregl.Marker({ element: el, anchor: "top", offset: [0, -11] }).setLngLat([s.lng, s.lat]).addTo(map);
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
      {/* 地図の提供元(無料で使う条件。消さないこと) */}
      <p className={`pointer-events-auto absolute z-[5] rounded bg-white/80 px-1.5 py-0.5 text-[9px] leading-tight text-stone-600 ${attributionClass}`}>
        <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="underline">OpenFreeMap</a>{" "}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="underline">© OpenMapTiles</a>{" "}
        Data from{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>
      </p>
      <style>{`
        .hokuma-pin { display: flex; flex-direction: column; align-items: center; cursor: pointer; background: none; border: 0; padding: 0; }
        .hokuma-pin:focus-visible { outline: 3px solid #BA421D; outline-offset: 4px; border-radius: 12px; }
        .hokuma-pin__dot {
          width: 22px; height: 22px; border-radius: 999px; background: #BA421D; border: 3px solid #fff;
          box-shadow: 0 0 0 1.5px #BA421D, 0 3px 8px rgba(27,36,58,.35); transition: transform 160ms ease;
        }
        .hokuma-pin__name {
          margin-top: 4px; font-size: 12px; font-weight: 800; color: #2F3E5C; white-space: nowrap;
          text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff;
        }
        .hokuma-pin.is-active .hokuma-pin__dot { transform: scale(1.3); }
        @media (prefers-reduced-motion: reduce) { .hokuma-pin__dot { transition: none; } }
      `}</style>
    </>
  );
}
