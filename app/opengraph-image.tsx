import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// LINE や X などでリンクを送ったときに出る画像(OGP画像)。
// 以前は古いキャラクターの絵をここで描いていたので、ホックマのアイコン(app/icon.png)に差し替えた。
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "HOKUMA | 北大生のためのフリマ";

export default async function Image() {
  // ファビコンと同じ、枠あり版のホックマのアイコンを読み込む
  const icon = await readFile(join(process.cwd(), "app/icon.png"), "base64");
  const iconSrc = `data:image/png;base64,${icon}`;

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
        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          {/* アイコンは四角い画像なので、丸く切り抜いて四隅の白を見せないようにする */}
          <img src={iconSrc} width={320} height={320} alt="" style={{ borderRadius: 160 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 104, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>HOKUMA</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#ffe4cc", marginTop: 20 }}>北大生のためのフリマ</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
