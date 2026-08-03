"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

const categories = ["教科書", "自転車", "家電・家具", "衣類", "貸します", "その他"];
const AREAS = ["北8条エリア", "北18条エリア", "北24条エリア", "エルムの森周辺", "工学部周辺", "農学部周辺"];

export default function Sell() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [condition, setCondition] = useState("");
  const [area, setArea] = useState("");
  const [showDateRange, setShowDateRange] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    if (!hashtags.includes(tag)) setHashtags([...hashtags, tag]);
    setHashtagInput("");
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) { alert("写真は最大5枚までです"); return; }
    setImages([...images, ...files]);
    setPreviews([...previews, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) { alert("ログインしてください"); router.push("/login"); return; }
    if (!title.trim()) { alert("タイトルを入力してください"); return; }
    if (!category) { alert("カテゴリを選択してください"); return; }
    if (!isFree && !price) { alert("価格を入力してください"); return; }

    setLoading(true);

    const imageUrls: string[] = [];

    for (const file of images) {
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file);
      if (uploadError) {
        alert("画像のアップロードに失敗しました");
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
      imageUrls.push(urlData.publicUrl);
    }

    const { error } = await supabase.from("item").insert({
      title,
      price: isFree ? 0 : Number(price),
      category,
      detail,
      nickname: user.user_metadata?.nickname || "匿名ユーザー",
      user_id: user.id,
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
      condition: condition || null,
      area: area.trim() || null,
      available_from: showDateRange && availableFrom ? availableFrom : null,
      available_until: showDateRange && availableUntil ? availableUntil : null,
      hashtags: hashtags.length > 0 ? hashtags : null,
    });

    setLoading(false);

    if (error) { alert("出品に失敗しました"); return; }
    alert("出品しました！");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-md mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-orange-700 font-bold mb-6 flex items-center gap-1 hover:text-orange-800 transition-colors">
          <span aria-hidden>←</span> 戻る
        </button>
        <h2 className="text-2xl font-bold mb-6">出品する</h2>

        <div className="flex flex-col gap-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
          <div>
            <label className="block text-sm font-bold mb-2">写真（最大5枚）</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {previews.map((preview, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img src={preview} className="w-20 h-20 object-cover rounded-lg" alt="" />
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center rounded-b-lg py-0.5">
                      メイン
                    </span>
                  )}
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
              {previews.length < 5 && (
                <label className="w-20 h-20 border-2 border-dashed border-orange-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-orange-50 transition-colors">
                  <span className="text-orange-400 text-2xl">＋</span>
                  <input type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">タイトル <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：微分積分学テキスト" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">カテゴリ <span className="text-red-500">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm bg-white">
              <option value="">選択してください</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">状態</label>
            <div className="flex gap-2">
              {["新品", "中古"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(condition === c ? "" : c)}
                  className={`flex-1 py-2.5 rounded-full text-sm font-bold border transition-colors ${
                    condition === c ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-700 border-orange-200 hover:border-orange-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">大まかな場所</label>
            <p className="text-xs text-stone-400 mb-2">住所ではなく、大まかなエリアを選んでください</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArea(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    area === a ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-700 border-orange-200 hover:border-orange-400"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="その他、大まかな場所を入力（住所は書かないでください）"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-600 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">価格 <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3 mb-2">
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} id="free" className="accent-orange-700 w-4 h-4" />
              <label htmlFor="free" className="text-sm">無料で譲る</label>
            </div>
            {!isFree && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-500">¥</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={showDateRange}
                onChange={(e) => setShowDateRange(e.target.checked)}
                id="dateRange"
                className="accent-orange-700 w-4 h-4"
              />
              <label htmlFor="dateRange" className="text-sm font-bold">期間を設定する（貸し出しなど）</label>
            </div>
            {showDateRange && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-600 transition-colors text-sm"
                />
                <span className="text-stone-400 text-sm">〜</span>
                <input
                  type="date"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-600 transition-colors text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">ハッシュタグ</label>
            <p className="text-xs text-stone-400 mb-2">入力してEnterで追加。検索に使われます</p>
            {hashtags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {hashtags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-orange-50 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    #{tag}
                    <button type="button" onClick={() => removeHashtag(tag)} className="text-orange-400 hover:text-orange-700">×</button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addHashtag(); }
              }}
              placeholder="例：教科書 (Enterで追加)"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-600 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">商品の説明</label>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="状態・付属品・受け渡し場所など" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm h-28 resize-none" />
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full bg-orange-700 text-white py-4 rounded-full font-bold text-lg disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm">
            {loading ? "出品中..." : "出品する"}
          </button>
        </div>
      </main>
    </div>
  );
}
