// 電気通信事業法の届出要否を検討中のため、個別の自由記述チャットを
// 停止し、待ち合わせ場所を定型文選択のみに制限するモード。
// 通常モードに戻す場合は、Vercelの環境変数
// NEXT_PUBLIC_TELECOM_SAFE_MODE を "false" にして再デプロイする。
export const TELECOM_SAFE_MODE = process.env.NEXT_PUBLIC_TELECOM_SAFE_MODE !== "false";
