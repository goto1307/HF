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
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 104, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>HOKUMA</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#ffe4cc", marginTop: 18 }}>北大生専用のフリマ</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
