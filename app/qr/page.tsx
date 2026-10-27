"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import HokkumaMascot from "@/components/HokkumaMascot";
import { rememberSource, SOURCE_PATTERN } from "@/lib/visitSource";

// 記録したあとの移動先。外のサイトへは飛ばさないよう、決まったページだけにする。
// register は、学内アンケートに答えてくれた人など、登録前のアンケートを飛ばして
// 登録画面へ直接案内したいとき用(/qr?from=street&to=register)。
const DESTINATIONS: Record<string, string> = {
  register: "/register",
  demands: "/demands",
};

// ポスターのQRコードやインスタのリンクの飛び先。開かれた回数を記録してからトップへ移動する。
// ポスターは /qr(目印なし)、インスタは /qr?from=insta のように目印を付ける。
// &to=register などを付けると、トップではなくそのページへ移動する。
export default function QrLanding() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to") ?? "";
    const dest = Object.hasOwn(DESTINATIONS, to) ? DESTINATIONS[to] : "/";
    const goHome = () => router.replace(dest);
    const from = params.get("from")?.trim().toLowerCase();
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
