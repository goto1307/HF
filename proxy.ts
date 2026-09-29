import { NextResponse } from "next/server";

// サービス終了のお知らせ。全ページでこの画面を返す
const SERVICE_ENDED_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>サービス終了のお知らせ | 北フリ</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafaf9;color:#44403c;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;">
<main style="max-width:480px;padding:32px 16px;text-align:center;">
<h1 style="font-size:1.5rem;margin:0 0 16px;color:#c2410c;">サービス終了のお知らせ</h1>
<p style="line-height:1.8;margin:0 0 8px;">北フリは、2026年9月29日をもちましてサービスを終了いたしました。</p>
<p style="line-height:1.8;margin:0 0 8px;">ご登録いただいた皆さまには、ご登録のメールアドレス宛てに個別にご連絡いたします。</p>
<p style="line-height:1.8;margin:0 0 8px;">会員登録キャンペーン（Amazonギフト券の抽選）にご応募いただいた方には、キャンペーンの賞品について、あわせて個別にご案内いたします。</p>
<p style="line-height:1.8;margin:0 0 16px;">ご期待いただいていたなか、このような結果となり、誠に申し訳ございません。これまでご利用いただき、ありがとうございました。</p>
<p style="line-height:1.8;margin:0;font-size:0.875rem;color:#78716c;">お問い合わせ：hokufuri.official@gmail.com</p>
</main>
</body>
</html>`;

export function proxy() {
  return new NextResponse(SERVICE_ENDED_HTML, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
