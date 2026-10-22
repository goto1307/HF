"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import HokkumaMascot from "@/components/HokkumaMascot";

// ポスターのQRコードの飛び先。読み込まれた回数を記録してからトップへ移動する。
export default function QrLanding() {
  const router = useRouter();

  useEffect(() => {
    const goHome = () => router.replace("/");
    supabase.from("qr_scan").insert({}).then(goHome, goHome);
  }, [router]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center">
      <HokkumaMascot size={72} className="mb-4 opacity-90" />
      <p className="text-stone-400 text-sm">読み込み中...</p>
    </div>
  );
}
