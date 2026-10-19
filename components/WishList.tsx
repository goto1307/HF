"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const categories = ["教科書", "自転車", "家電・家具", "衣類", "その他"];

export default function WishList({ userId }: { userId: string }) {
  const [wished, setWished] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const fetchWishes = async () => {
      const { data } = await supabase.from("wish").select("category").eq("user_id", userId);
      setWished(new Set((data ?? []).map((w) => w.category)));
      setLoading(false);
    };
    fetchWishes();
  }, [userId]);

  const toggle = async (category: string) => {
    setBusy(category);
    if (wished.has(category)) {
      const { error } = await supabase.from("wish").delete().eq("user_id", userId).eq("category", category);
      if (error) { alert("解除に失敗しました。時間をおいてもう一度お試しください。"); setBusy(null); return; }
      setWished((prev) => { const next = new Set(prev); next.delete(category); return next; });
    } else {
      const { error } = await supabase.from("wish").insert({ user_id: userId, category });
      if (error) { alert("登録に失敗しました。時間をおいてもう一度お試しください。"); setBusy(null); return; }
      setWished((prev) => new Set(prev).add(category));
    }
    setBusy(null);
  };

  return (
    <section className="mb-8 bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <h3 className="font-bold mb-1">ほしい物リスト</h3>
      <p className="text-xs text-stone-500 mb-3">
        選んだカテゴリで新しく出品されると、通知でお知らせします。登録した内容は、ほかの利用者には表示されません。
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const on = wished.has(c);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              disabled={loading || busy !== null}
              aria-pressed={on}
              className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors disabled:opacity-50 ${
                on ? "bg-orange-700 border-orange-700 text-white hover:bg-orange-800" : "bg-white border-orange-200 text-orange-700 hover:bg-orange-50"
              }`}
            >
              {on ? `✓ ${c}` : c}
            </button>
          );
        })}
      </div>
    </section>
  );
}
