import { NextResponse } from "next/server";

// メンテナンスモード。解除するときは環境変数 MAINTENANCE_MODE=false を設定して再デプロイする
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE !== "false";

const MAINTENANCE_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>メンテナンス中 | 北フリ</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafaf9;color:#44403c;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;">
<main style="max-width:480px;padding:32px 16px;text-align:center;">
<h1 style="font-size:1.5rem;margin:0 0 16px;color:#c2410c;">ただいまメンテナンス中です</h1>
<p style="line-height:1.8;margin:0 0 8px;">北フリは現在メンテナンスのため、一時的にサービスを停止しています。</p>
<p style="line-height:1.8;margin:0 0 8px;font-weight:bold;">メンテナンス期間中は、商品の購入・出品ができません。</p>
<p style="line-height:1.8;margin:0;">ご利用の皆さまには大変ご迷惑をおかけし、誠に申し訳ございません。再開まで今しばらくお待ちください。</p>
</main>
</body>
</html>`;

export function proxy() {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "86400",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
