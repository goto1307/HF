"use client";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";
import FoxMascot from "@/components/FoxMascot";

const categories = ["すべて", "教科書", "自転車", "家電・家具", "衣類", "その他"];
const AREAS = ["すべて", "北11条エリア", "工学部棟エリア", "教養棟エリア", "サークル会館エリア", "北24条エリア", "北18条エリア"];
const CONDITIONS = ["新品", "中古"];
const SORTS = [
  { key: "new", label: "新着順" },
  { key: "cheap", label: "安い順" },
  { key: "expensive", label: "高い順" },
  { key: "like", label: "いいね順" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

type Item = {
  id: number;
  title: string;
  price: number;
  category: string;
  nickname: string;
  image_url: string | null;
  image_urls: string[] | null;
  sold: boolean;
  condition: string | null;
  area: string | null;
  available_from: string | null;
  available_until: string | null;
  hashtags: string[] | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  return `${day}日前`;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [selectedArea, setSelectedArea] = useState("すべて");
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const router = useRouter();
  const [heroDismissed, setHeroDismissed] = useState(false);

  useEffect(() => {
    setHeroDismissed(localStorage.getItem("heroDismissed") === "1");
  }, []);

  const dismissHero = () => {
    localStorage.setItem("heroDismissed", "1");
    setHeroDismissed(true);
  };

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from("item").select("*").order("created_at", { ascending: false });
      if (data) setItems(data);

      const { data: favData } = await supabase.from("favorite").select("item_id, user_id");
      if (favData) {
        const counts: Record<number, number> = {};
        const mine = new Set<number>();
        for (const f of favData) {
          counts[f.item_id] = (counts[f.item_id] || 0) + 1;
          if (user && f.user_id === user.id) mine.add(f.item_id);
        }
        setLikeCounts(counts);
        setLikedByMe(mine);
      }

      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const toggleLike = async (e: React.MouseEvent, itemId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { alert("いいねするにはログインしてください"); router.push("/login"); return; }

    if (likedByMe.has(itemId)) {
      const { error } = await supabase.from("favorite").delete().eq("item_id", itemId).eq("user_id", user.id);
      if (error) { alert(`いいねの取り消しに失敗しました: ${error.message}`); return; }
      setLikedByMe((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
      setLikeCounts((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] || 1) - 1) }));
    } else {
      const { error } = await supabase.from("favorite").insert({ item_id: itemId, user_id: user.id });
      if (error) { alert(`いいねに失敗しました: ${error.message}`); return; }
      setLikedByMe((prev) => new Set(prev).add(itemId));
      setLikeCounts((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    }
  };

  const toggleCondition = (c: string) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const filtered = items.filter((item) => {
    if (onlyAvailable && item.sold) return false;
    if (selectedCategory !== "すべて" && item.category !== selectedCategory) return false;
    if (selectedArea !== "すべて" && item.area !== selectedArea) return false;
    if (selectedConditions.size > 0 && item.condition && !selectedConditions.has(item.condition)) return false;
    if (minPrice && item.price < Number(minPrice)) return false;
    if (maxPrice && item.price > Number(maxPrice)) return false;
    if (query) {
      const q = query.toLowerCase().replace(/^#/, "");
      const titleMatch = item.title.toLowerCase().includes(q);
      const tagMatch = (item.hashtags || []).some((t) => t.toLowerCase().includes(q));
      if (!titleMatch && !tagMatch) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "cheap") return a.price - b.price;
    if (sort === "expensive") return b.price - a.price;
    if (sort === "like") return (likeCounts[b.id] || 0) - (likeCounts[a.id] || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {!user && !heroDismissed && (
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-700 via-[#d9531f] to-orange-600 text-white">
          <button
            onClick={dismissHero}
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors text-lg leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
          <div className="absolute -top-24 right-10 w-56 h-56 rounded-full bg-white/10" aria-hidden />
          <div className="absolute -bottom-20 left-[8%] w-36 h-36 rounded-full bg-white/10" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-9 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
            <div className="max-w-md">
              <span className="inline-block text-[11px] sm:text-xs font-extrabold bg-white/20 px-3 py-1 rounded-full mb-2.5">
                🦊 北大生限定のフリマ
              </span>
              <h1 className="text-lg sm:text-2xl font-extrabold leading-snug mb-2 text-balance">
                いらないが、誰かの「ちょうどいい」になる。
              </h1>
              <p className="text-xs sm:text-sm opacity-90 leading-relaxed mb-4">
                教科書、自転車、部屋のもの。キャンパスの中だけで、ちょうどいい売り買いを。
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Link href="/register" className="bg-white text-orange-700 px-5 py-2.5 rounded-full font-bold text-sm hover:bg-orange-50 transition-colors">
                  新規登録
                </Link>
                <Link href="/login" className="border border-white/70 px-5 py-2.5 rounded-full font-bold text-sm hover:bg-white/10 transition-colors">
                  ログイン
                </Link>
                <button onClick={dismissHero} className="text-sm font-bold underline opacity-80 hover:opacity-100 transition-opacity px-2">
                  登録しないで続ける
                </button>
              </div>
            </div>
            <FoxMascot size={92} className="shrink-0 drop-shadow-lg hidden sm:block" />
          </div>
        </div>
      )}

      {query && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <p className="text-sm text-stone-500">
            「{query}」の検索結果 <Link href="/" className="text-orange-700 font-bold ml-2">検索を解除</Link>
          </p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-2 flex-wrap mb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full border font-bold text-sm transition-colors ${
                selectedCategory === cat
                  ? "bg-orange-700 text-white border-orange-700"
                  : "bg-white text-orange-700 border-orange-200 hover:border-orange-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="hidden md:flex items-center gap-1.5 text-sm font-bold text-stone-600 border border-stone-200 rounded-full px-3 py-1.5 bg-white hover:border-orange-400 transition-colors"
        >
          {showFilters ? "✕ 絞り込みを閉じる" : "☰ 絞り込みを表示"}
        </button>
        <button
          onClick={() => setShowMobileFilters(true)}
          className="md:hidden flex items-center gap-1.5 text-sm font-bold text-stone-600 border border-stone-200 rounded-full px-3 py-1.5 bg-white hover:border-orange-400 transition-colors"
        >
          ☰ 絞り込み
        </button>
      </div>

      {showMobileFilters && (
        <div className="md:hidden fixed inset-0 z-40 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-200 shrink-0">
            <button onClick={() => setShowMobileFilters(false)} className="text-2xl leading-none text-stone-500" aria-label="閉じる">✕</button>
            <p className="font-bold">絞り込み</p>
            <button
              onClick={() => {
                setSelectedArea("すべて");
                setSelectedConditions(new Set());
                setMinPrice("");
                setMaxPrice("");
                setOnlyAvailable(false);
              }}
              className="text-orange-700 text-sm font-bold"
            >
              クリア
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            <div>
              <p className="font-bold text-sm mb-2">カテゴリ</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                      selectedCategory === cat ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-bold text-sm mb-2">エリア</p>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedArea(a)}
                    className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                      selectedArea === a ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-bold text-sm mb-2">販売状況</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setOnlyAvailable(false)}
                  className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                    !onlyAvailable ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200"
                  }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setOnlyAvailable(true)}
                  className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                    onlyAvailable ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200"
                  }`}
                >
                  販売中のみ
                </button>
              </div>
            </div>

            <div>
              <p className="font-bold text-sm mb-2">状態</p>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCondition(c)}
                    className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                      selectedConditions.has(c) ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-bold text-sm mb-2">価格</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="min"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-600"
                />
                <span className="text-stone-400">-</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="max"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-600"
                />
              </div>
            </div>

            <div>
              <p className="font-bold text-sm mb-2">並び順</p>
              <div className="flex flex-wrap gap-2">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                      sort === s.key ? "bg-orange-700 text-white border-orange-700" : "bg-white text-stone-600 border-stone-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 p-4 border-t border-stone-200">
            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full bg-orange-700 text-white py-3 rounded-full font-bold hover:bg-orange-800 transition-colors"
            >
              検索する（{sorted.length}件）
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row gap-6">
        {showFilters && (
        <aside className="hidden md:flex md:w-56 shrink-0 flex-col gap-6">
          <div>
            <p className="font-bold text-sm mb-2">カテゴリ</p>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat ? "bg-orange-700 text-white font-bold" : "text-stone-600 hover:bg-orange-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-sm mb-2">エリア</p>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-600 bg-white"
            >
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <p className="font-bold text-sm mb-2">価格</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="min"
                className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-600"
              />
              <span className="text-stone-400">-</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="max"
                className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-600"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="accent-orange-700 w-4 h-4"
              />
              販売中のみ表示
            </label>
          </div>

          <div>
            <p className="font-bold text-sm mb-2">状態</p>
            <div className="flex flex-col gap-1.5">
              {CONDITIONS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={selectedConditions.has(c)}
                    onChange={() => toggleCondition(c)}
                    className="accent-orange-700 w-4 h-4"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-sm mb-2">並び順</p>
            <div className="flex flex-col gap-1.5">
              {SORTS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="radio"
                    name="sort"
                    checked={sort === s.key}
                    onChange={() => setSort(s.key)}
                    className="accent-orange-700 w-4 h-4"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="w-full bg-orange-700 text-white py-2.5 rounded-full font-bold text-sm text-center">
            検索する（{sorted.length}件）
          </div>
        </aside>
        )}

        <main className="flex-1 pb-24">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
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
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <FoxMascot size={88} className="mb-3 opacity-90" />
              <p className="text-stone-400">条件に合う商品がありません</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sorted.map((item) => (
                <Link
                  href={`/items/${item.id}`}
                  key={item.id}
                  className="group relative border border-stone-200 rounded-2xl overflow-hidden bg-white hover:shadow-md hover:-translate-y-0.5 transition-all block"
                >
                  <div className="relative">
                    {(item.image_urls?.[0] ?? item.image_url) ? (
                      <img
                        src={item.image_urls?.[0] ?? item.image_url ?? undefined}
                        alt={item.title}
                        className={`w-full h-32 object-cover ${item.sold ? "opacity-50" : ""}`}
                      />
                    ) : (
                      <div className={`bg-orange-50 h-32 flex items-center justify-center text-orange-200 text-3xl ${item.sold ? "opacity-50" : ""}`}>
                        📦
                      </div>
                    )}
                    {item.sold && (
                      <div className="absolute top-2 -right-8 w-32 rotate-45 bg-red-600 text-white text-xs font-extrabold text-center py-0.5 shadow-md tracking-wider">
                        SOLD OUT
                      </div>
                    )}
                    {!item.sold && (
                      <button
                        onClick={(e) => toggleLike(e, item.id)}
                        className="absolute top-1.5 right-1.5 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-sm shadow hover:scale-110 transition-transform"
                      >
                        {likedByMe.has(item.id) ? "❤️" : "🤍"}
                      </button>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs text-orange-700 font-bold">{item.category}</p>
                      {item.condition && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">{item.condition}</span>
                      )}
                    </div>
                    <p className="font-bold mb-1 text-sm truncate text-blue-700 group-hover:text-blue-800">{item.title}</p>
                    <p className="text-orange-700 font-bold text-sm">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
                    {item.hashtags && item.hashtags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {item.hashtags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] text-orange-600 truncate">#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-stone-400 truncate">{item.area || ""}</p>
                      <p className="text-xs text-stone-400 shrink-0 ml-1">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>

      <Link
        href="/sell"
        className="fixed bottom-6 left-6 bg-orange-700 text-white px-6 py-4 rounded-full font-bold shadow-lg text-lg hover:bg-orange-800 hover:shadow-xl transition-all"
      >
        ＋ 出品する
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <HomeContent />
    </Suspense>
  );
}
