"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

// 欲しいもの登録。キーワードとジャンルが一致する出品があると、DB 側
// (migration PART Z の notify_wish_match)からアプリ内通知が届く。
// 上限は DB の wish_limit() と合わせること。
const WISH_LIMIT = 3;
const CATEGORIES = ["教科書", "自転車", "家電・家具", "衣類", "その他"];

type Wish = {
  id: number;
  keyword: string;
  category: string | null;
};

export default function WishList() {
  const { user } = useAuth();
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("wish").select("id,keyword,category").order("created_at");
      if (data) setWishes(data);
    };
    load();
  }, [user]);

  const isFull = wishes.length >= WISH_LIMIT;

  const handleAdd = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) { alert("キーワードを入力してください"); return; }
    if (isFull) { alert(`欲しいものは${WISH_LIMIT}件まで登録できます`); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("wish")
      .insert({ keyword: trimmed, category: category || null })
      .select("id,keyword,category")
      .single();
    setSaving(false);
    if (error) {
      alert(error.message?.includes("件まで") ? error.message : "登録に失敗しました");
      return;
    }
    setWishes((prev) => [...prev, data as Wish]);
    setKeyword("");
    setCategory("");
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    const { error } = await supabase.from("wish").delete().eq("id", id);
    setDeletingId(null);
    if (error) { alert("削除に失敗しました"); return; }
    setWishes((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <section className="mb-8 bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <h3 className="font-bold mb-1">
        欲しいもの<span className="text-sm font-normal text-stone-400 ml-1">（{wishes.length}/{WISH_LIMIT}）</span>
      </h3>
      <p className="text-xs text-stone-500 mb-3">
        キーワードとジャンルが一致する商品が出品されたら、通知でお知らせします。キーワードは、商品のタイトルかハッシュタグに含まれていれば一致します。
      </p>

      {wishes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {wishes.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-800 text-sm font-bold pl-3 pr-1.5 py-1 rounded-full">
              {w.keyword}
              <span className="text-[11px] font-normal text-orange-600">{w.category ?? "ジャンル指定なし"}</span>
              <button
                onClick={() => handleDelete(w.id)}
                disabled={deletingId === w.id}
                className="w-5 h-5 flex items-center justify-center rounded-full text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                aria-label={`「${w.keyword}」を削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {isFull ? (
        <p className="text-xs text-stone-400">登録できるのは{WISH_LIMIT}件までです。新しく登録するには、どれかを削除してください。</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            maxLength={30}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="例：線形代数、自転車"
            className="flex-1 min-w-0 border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-600 transition-colors"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:border-orange-600 transition-colors"
          >
            <option value="">ジャンル指定なし</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={saving || !keyword.trim()}
            className="shrink-0 bg-orange-700 text-white px-5 py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors"
          >
            {saving ? "登録中..." : "登録"}
          </button>
        </div>
      )}
    </section>
  );
}
