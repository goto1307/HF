import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(155deg, #c2410c 0%, #9a3412 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <svg width="280" height="280" viewBox="0 0 200 200">
            <ellipse cx="100" cy="150" rx="52" ry="34" fill="#e98a4a" />
            <ellipse cx="100" cy="158" rx="30" ry="20" fill="#fdf3e4" />
            <path d="M60 96 C40 96 30 130 55 148 C60 130 70 118 84 112 Z" fill="#e98a4a" />
            <path d="M140 96 C160 96 170 130 145 148 C140 130 130 118 116 112 Z" fill="#e98a4a" />
            <circle cx="100" cy="96" r="52" fill="#ee9c5c" />
            <path d="M52 60 L70 92 L40 84 Z" fill="#ee9c5c" />
            <path d="M148 60 L130 92 L160 84 Z" fill="#ee9c5c" />
            <path d="M56 66 L67 86 L46 81 Z" fill="#26221c" />
            <path d="M144 66 L133 86 L154 81 Z" fill="#26221c" />
            <path d="M100 74 C72 74 62 92 66 112 C78 122 122 122 134 112 C138 92 128 74 100 74 Z" fill="#fdf3e4" />
            <circle cx="82" cy="98" r="5.5" fill="#26221c" />
            <circle cx="118" cy="98" r="5.5" fill="#26221c" />
            <circle cx="80.5" cy="96" r="1.6" fill="#fff" />
            <circle cx="116.5" cy="96" r="1.6" fill="#fff" />
            <path d="M94 110 Q100 116 106 110" stroke="#26221c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <ellipse cx="100" cy="104" rx="5" ry="3.6" fill="#c65a2c" />
            <rect x="82" y="150" width="36" height="12" rx="6" fill="#d9531f" />
            <circle cx="100" cy="156" r="3.4" fill="#fdf3e4" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 104, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>北フリ</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#ffe4cc", marginTop: 18 }}>北大生専用のフリマ</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
