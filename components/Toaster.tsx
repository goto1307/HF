"use client";
import { useSyncExternalStore } from "react";
import { dismissToast, getServerToasts, getToasts, subscribeToasts } from "@/lib/toast";
import { IconX } from "@/components/icons";

// lib/toast.ts の toast() で出したお知らせを、画面の上の方に重ねて表示する
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-3 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`toast-in pointer-events-auto w-full max-w-sm flex items-start gap-2 rounded-2xl border px-4 py-3 shadow-lg text-sm font-bold whitespace-pre-line break-words ${
            t.kind === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-orange-50 border-orange-200 text-orange-800"
          }`}
        >
          <p className="flex-1">{t.message}</p>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="閉じる"
          >
            <IconX size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
