"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { countInternalNavigation } from "@/lib/nav";

// ページが切り替わったことを数える(最初に開いたページは数えない)。
// 「戻る」ボタンが、サイトの外に出てしまわないかの判断に使う。
export default function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    countInternalNavigation();
  }, [pathname]);
  return null;
}
