"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import HokkumaMascot from "@/components/HokkumaMascot";
import { rememberSource, SOURCE_PATTERN } from "@/lib/visitSource";

// ポスターのQRコードやインスタのリンクの飛び先。開かれた回数を記録してからトップへ移動する。
// ポスターは /qr(目印なし)、インスタは /qr?from=insta のように目印を付ける。
export default function QrLanding() {
  const router = useRouter();

  useEffect(() => {
    const goHome = () => router.replace("/");
    const from = new URLSearchParams(window.location.search).get("from")?.trim().toLowerCase();
    // 目印が付いているのに決まりに合わないときは、ポスターと混ざらないよう "other" として数える
    const source = from ? (SOURCE_PATTERN.test(from) ? from : "other") : null;
    // 登録したときに「どこから来た人か」を数えられるよう、目印を覚えておく(目印なしはポスター)
    rememberSource(source ?? "poster");
    supabase.from("qr_scan").insert(source ? { source } : {}).then(goHome, goHome);
  }, [router]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center">
      <HokkumaMascot size={72} className="mb-4 opacity-90" />
      <p className="text-stone-400 text-sm">読み込み中...</p>
    </div>
  );
}
