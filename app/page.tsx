"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

const categories = ["すべて", "教科書", "自転車", "家電・家具", "衣類", "貸します", "その他"];

type Item = {
  id: number;
  title: string;
  price: number;
  category: string;
  nickname: string;
  image_url: string | null;
  image_urls: string[] | null;
};

export default function Home() {
  const [selected, setSelected] = useState("すべて");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await supabase.from("item").select("*").order("created_at", { ascending: false });
      if (data) setItems(data);
      setLoading(false);
    };
    fetchItems();
  }, []);

  const filtered = selected === "すべて"
    ? items
    : items.filter((item) => item.category === selected);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelected(cat)}
              className={`px-4 py-2 rounded-full border font-bold text-sm transition-colors ${
                selected === cat
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pb-24">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-stone-200 rounded-2xl overflow-hidden bg-white animate-pulse">
                <div className="w-full h-32 bg-stone-100" />
                <div className="p-3 flex flex-col gap-2">
                  <div className="h-2 w-10 bg-stone-100 rounded" />
                  <div className="h-3 w-24 bg-stone-100 rounded" />
                  <div className="h-3 w-14 bg-stone-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-stone-400">まだ商品がありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <Link
                href={`/items/${item.id}`}
                key={item.id}
                className="group border border-stone-200 rounded-2xl overflow-hidden bg-white hover:shadow-md hover:-translate-y-0.5 transition-all block"
              >
                {(item.image_urls?.[0] ?? item.image_url) ? (
                  <img
                    src={item.image_urls?.[0] ?? item.image_url ?? undefined}
                    alt={item.title}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="bg-emerald-50 h-32 flex items-center justify-center text-emerald-200 text-3xl">
                    📦
                  </div>
                )}
                <div className="p-3">
                  <p className="text-xs text-emerald-700 font-bold mb-1">{item.category}</p>
                  <p className="font-bold mb-1 text-sm truncate group-hover:text-emerald-800">{item.title}</p>
                  <p className="text-emerald-700 font-bold text-sm">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
                  <p className="text-xs text-stone-400 mt-1 truncate">{item.nickname}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Link
        href="/sell"
        className="fixed bottom-6 left-6 bg-emerald-700 text-white px-6 py-4 rounded-full font-bold shadow-lg text-lg hover:bg-emerald-800 hover:shadow-xl transition-all"
      >
        ＋ 出品する
      </Link>
    </div>
  );
}
