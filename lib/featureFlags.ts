// 電気通信事業法の届出要否の件は解決済みのため、デフォルトは通常モード
// (個別チャットの自由記述が使える)。
// 再び個別の自由記述チャットを停止し、待ち合わせ場所を定型文選択のみに
// 制限したい場合は、Vercelの環境変数 NEXT_PUBLIC_TELECOM_SAFE_MODE を
// "true" にして再デプロイする(その場合、migrationファイルのPART Qに
// ある有効化SQLもあわせて実行すること)。
export const TELECOM_SAFE_MODE = process.env.NEXT_PUBLIC_TELECOM_SAFE_MODE === "true";
