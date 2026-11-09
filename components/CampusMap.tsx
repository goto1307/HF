"use client";
import type { CouponPlace } from "@/lib/couponPlaces";

// 北大と、クーポンのお店の位置関係を描いたイラストの地図。
// ホックマと同じ「紺の丸い線」と、HOKUMA の色(朱・ネイビー・黄)で描く。本物の縮尺ではない。
// 上が北。左が北大の札幌キャンパス、真ん中の太い道が北大前通り(西5丁目)、右が地下鉄南北線。

const SNOW = "#EEF2F5";
const CAMPUS = "#D3E3CC";
const TREE = "#B5CFA9";
const LINE = "#1B243A";
const NAVY = "#2F3E5C";
const SHU = "#BA421D";
const YELLOW = "#F2C14E";
const SUBWAY = "#2E8B57";

type Pin = { id: string; label: string; place: CouponPlace };

// 木の位置(キャンパスの雰囲気を出すため。並びに意味はない)
const TREES: [number, number, number][] = [
  [24, 40, 9], [44, 30, 7], [150, 34, 8], [170, 52, 6], [30, 150, 8], [52, 168, 6],
  [160, 150, 9], [140, 300, 8], [166, 318, 6], [26, 300, 7], [40, 390, 9], [62, 404, 6],
  [150, 400, 8], [118, 252, 6], [70, 84, 6],
];

export default function CampusMap({
  pins,
  selected,
  onSelect,
}: {
  pins: Pin[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <svg
      viewBox="0 0 360 440"
      className="block w-full h-auto select-none"
      role="img"
      aria-label="北海道大学と、クーポンが使えるお店の位置関係の地図"
    >
      <rect width="360" height="440" fill={SNOW} />

      {/* 細い道(碁盤の目) */}
      <g stroke="#FFFFFF" strokeWidth="6">
        {[118, 164, 260, 306, 400].map((y) => <line key={y} x1="200" y1={y} x2="360" y2={y} />)}
        <line x1="336" y1="0" x2="336" y2="440" />
      </g>

      {/* 北大 札幌キャンパス */}
      <rect x="-12" y="-12" width="200" height="464" rx="26" fill={CAMPUS} stroke={LINE} strokeWidth="2.2" />
      {TREES.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={TREE} />)}
      {/* 建物(形はイメージ) */}
      <g fill="#F8FAFB" stroke={LINE} strokeWidth="1.6">
        <rect x="96" y="54" width="54" height="30" rx="6" />
        <rect x="34" y="214" width="48" height="58" rx="6" />
        <rect x="112" y="186" width="52" height="34" rx="6" />
        <rect x="88" y="330" width="58" height="34" rx="6" />
      </g>
      <text x="92" y="128" textAnchor="middle" fill={LINE} fontSize="19" fontWeight="800">北海道大学</text>
      <text x="92" y="148" textAnchor="middle" fill={NAVY} fontSize="11" fontWeight="700">札幌キャンパス</text>

      {/* 大きい道: 北18条・北15条・北12条 と 北大前通り */}
      <g stroke={LINE} strokeWidth="2" fill="#FFFFFF">
        <rect x="188" y="62" width="180" height="16" />
        <rect x="188" y="206" width="180" height="16" />
        <rect x="188" y="350" width="180" height="16" />
        <rect x="190" y="-4" width="18" height="448" />
      </g>
      <text transform="translate(203 300) rotate(-90)" textAnchor="middle" fill={NAVY} fontSize="10" fontWeight="700">北大前通り</text>

      {/* 地下鉄南北線 */}
      <line x1="290" y1="0" x2="290" y2="440" stroke={SUBWAY} strokeWidth="5" strokeDasharray="10 7" strokeLinecap="round" opacity="0.85" />
      {[{ y: 70, name: "北18条駅" }, { y: 358, name: "北12条駅" }].map((s) => (
        <g key={s.name}>
          <rect x="272" y={s.y - 11} width="36" height="22" rx="11" fill="#FFFFFF" stroke={SUBWAY} strokeWidth="3" />
          <text x="290" y={s.y + 4} textAnchor="middle" fill={SUBWAY} fontSize="10" fontWeight="800">M</text>
          <text x="314" y={s.y - 16} fill={LINE} fontSize="11" fontWeight="800">{s.name}</text>
        </g>
      ))}

      {/* 条の名前 */}
      <g fill={NAVY} fontSize="10" fontWeight="700">
        <text x="352" y="96" textAnchor="end">北18条</text>
        <text x="352" y="240" textAnchor="end">北15条</text>
        <text x="352" y="384" textAnchor="end">北12条</text>
      </g>

      {/* 方角 */}
      <g transform="translate(26 40)">
        <circle r="13" fill="#FFFFFF" stroke={LINE} strokeWidth="1.8" />
        <path d="M0 -8 L5 4 L0 1 L-5 4 Z" fill={SHU} />
        <text y="-17" textAnchor="middle" fill={LINE} fontSize="9" fontWeight="800">北</text>
      </g>

      {/* お店のピン */}
      {pins.map((p) => {
        const active = p.id === selected;
        const { x, y } = p.place;
        return (
          <g
            key={p.id}
            role="button"
            tabIndex={0}
            aria-label={`${p.label}（${p.place.access}）`}
            aria-pressed={active}
            onClick={() => onSelect(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } }}
            className="cursor-pointer outline-none [&:focus-visible>circle.ring]:opacity-100"
          >
            {/* 北18条駅からの歩く道(選んでいるお店だけ) */}
            {active && (
              <path
                d={`M278 82 L278 ${y} L${x + 14} ${y}`}
                fill="none"
                stroke={SHU}
                strokeWidth="3"
                strokeDasharray="1 7"
                strokeLinecap="round"
              />
            )}
            {active && (
              <g transform={`translate(296 ${Math.round((82 + y) / 2)})`}>
                <rect x="0" y="-11" width="52" height="20" rx="10" fill="#FFFFFF" stroke={SHU} strokeWidth="1.6" />
                <text x="26" y="3" textAnchor="middle" fill={SHU} fontSize="10" fontWeight="800">徒歩5分</text>
              </g>
            )}
            <circle className="ring" cx={x} cy={y} r="22" fill="none" stroke={YELLOW} strokeWidth="3" opacity="0" />
            {active && <circle className="pin-pulse" cx={x} cy={y} r="16" fill={SHU} opacity="0.35" />}
            <ellipse cx={x} cy={y + 17} rx="10" ry="3" fill={LINE} opacity="0.18" />
            <circle cx={x} cy={y} r="15" fill={SHU} stroke={LINE} strokeWidth="2.2" />
            {/* 丼のマーク */}
            <path d={`M${x - 8} ${y - 1}h16a8 6.5 0 0 1 -16 0z`} fill="#FFFFFF" />
            <path d={`M${x - 4} ${y + 7}h8`} stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <path d={`M${x - 3} ${y - 4}c-1.4-2 1.4-2.6 0-4.6M${x + 3} ${y - 4}c-1.4-2 1.4-2.6 0-4.6`} stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" fill="none" />

            {/* 吹き出し: 空きコマクーポン */}
            <g transform={`translate(${x - 82} ${y - 66})`}>
              <rect width="122" height="40" rx="12" fill={active ? YELLOW : "#FFFFFF"} stroke={LINE} strokeWidth="2" />
              <path d="M78 39 L88 50 L92 39" fill={active ? YELLOW : "#FFFFFF"} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
              <rect x="77" y="36" width="16" height="5" fill={active ? YELLOW : "#FFFFFF"} />
              <text x="61" y="17" textAnchor="middle" fill={LINE} fontSize="12" fontWeight="800">{p.label}</text>
              <text x="61" y="32" textAnchor="middle" fill={SHU} fontSize="10.5" fontWeight="800">空きコマクーポン</text>
            </g>
          </g>
        );
      })}

      <style>{`
        .pin-pulse { transform-box: fill-box; transform-origin: center; animation: pin-pulse 1.8s ease-out 0.3s 2 both; }
        @keyframes pin-pulse { from { transform: scale(0.8); opacity: .45; } to { transform: scale(2.4); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .pin-pulse { animation: none; opacity: 0; } }
      `}</style>
    </svg>
  );
}
