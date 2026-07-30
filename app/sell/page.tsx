"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

const categories = ["教科書", "自転車", "家電・家具", "衣類", "貸します", "その他"];

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
        <button onClick={() => router.back()} className="text-emerald-700 font-bold mb-6 flex items-center gap-1 hover:text-emerald-800 transition-colors">
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
                <label className="w-20 h-20 border-2 border-dashed border-emerald-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-emerald-50 transition-colors">
                  <span className="text-emerald-400 text-2xl">＋</span>
                  <input type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">タイトル <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：微分積分学テキスト" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm" />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">カテゴリ <span className="text-red-500">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm bg-white">
              <option value="">選択してください</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">価格 <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3 mb-2">
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} id="free" className="accent-emerald-700 w-4 h-4" />
              <label htmlFor="free" className="text-sm">無料で譲る</label>
            </div>
            {!isFree && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-500">¥</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">商品の説明</label>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="状態・付属品・受け渡し場所など" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-600 transition-colors text-sm h-28 resize-none" />
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full bg-emerald-700 text-white py-4 rounded-full font-bold text-lg disabled:opacity-50 hover:bg-emerald-800 transition-colors shadow-sm">
            {loading ? "出品中..." : "出品する"}
          </button>
        </div>
      </main>
    </div>
  );
}
