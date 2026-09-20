"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { resizeImage, validateImageFile } from "@/lib/resizeImage";
import Header from "@/components/Header";

const categories = ["教科書", "自転車", "家電・家具", "衣類", "その他"];
const AREAS = ["北11条エリア", "工学部棟エリア", "教養棟エリア", "サークル会館エリア", "北24条エリア", "北18条エリア"];

export default function EditItem() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loadingItem, setLoadingItem] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [condition, setCondition] = useState("");
  const [area, setArea] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    const fetchItem = async () => {
      const { data, error } = await supabase.from("item").select("*").eq("id", params.id).single();
      if (error || !data) { setNotFound(true); setLoadingItem(false); return; }
      if (data.user_id !== user.id) { setNotFound(true); setLoadingItem(false); return; }
      if (data.sold) { alert("売却済みの商品は編集できません"); router.push("/mypage"); return; }

      setTitle(data.title);
      setPrice(data.price ? String(data.price) : "");
      setIsFree(data.price === 0);
      setCategory(data.category);
      setDetail(data.detail || "");
      setCondition(data.condition || "");
      setArea(data.area || "");
      setHashtags(data.hashtags || []);
      setExistingImages(data.image_urls?.length ? data.image_urls : data.image_url ? [data.image_url] : []);
      setLoadingItem(false);
    };
    fetchItem();
  }, [authLoading, user, params.id, router]);

  useEffect(() => {
    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalImageCount = existingImages.length + newImages.length;

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    if (!hashtags.includes(tag)) setHashtags([...hashtags, tag]);
    setHashtagInput("");
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (totalImageCount + files.length > 5) { alert("写真は最大5枚までです"); e.target.value = ""; return; }
    for (const file of files) {
      const error = validateImageFile(file);
      if (error) { alert(error); e.target.value = ""; return; }
    }
    setNewImages([...newImages, ...files]);
    setNewPreviews([...newPreviews, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(newPreviews[index]);
    setNewImages(newImages.filter((_, i) => i !== index));
    setNewPreviews(newPreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) { alert("タイトルを入力してください"); return; }
    if (!category) { alert("カテゴリを選択してください"); return; }
    if (!isFree && !price) { alert("価格を入力してください"); return; }
    if (!isFree && (!Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 50000)) { alert("価格は0円〜50,000円の範囲で入力してください"); return; }

    setSaving(true);

    const uploadedUrls: string[] = [];
    for (const file of newImages) {
      let uploadFile: File = file;
      try {
        uploadFile = await resizeImage(file);
      } catch (e) {
        console.error("resizeImage failed, uploading original file:", e);
      }
      const fileName = `${Date.now()}_${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage.from("images").upload(fileName, uploadFile);
      if (uploadError) {
        alert("画像のアップロードに失敗しました");
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
      uploadedUrls.push(urlData.publicUrl);
    }

    const imageUrls = [...existingImages, ...uploadedUrls];

    const { error } = await supabase
      .from("item")
      .update({
        title,
        price: isFree ? 0 : Number(price),
        category,
        detail,
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        condition: condition || null,
        area: area.trim() || null,
        available_from: null,
        available_until: null,
        hashtags: hashtags.length > 0 ? hashtags : null,
      })
      .eq("id", params.id)
      .eq("user_id", user.id);

    setSaving(false);

    if (error) { alert(`更新に失敗しました: ${error.message}`); return; }
    alert("更新しました！");
    router.push(`/items/${params.id}`);
  };

  if (authLoading || loadingItem) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">この商品は編集できません</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-md mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-orange-700 font-bold mb-6 flex items-center gap-1 hover:text-orange-800 transition-colors">
          <span aria-hidden>←</span> 戻る
        </button>
        <h2 className="text-2xl font-bold mb-6">出品を編集</h2>

        <div className="flex flex-col gap-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
          <div>
            <label className="block text-sm font-bold mb-2">写真（最大5枚）</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {existingImages.map((url, i) => (
                <div key={url} className="relative w-20 h-20">
                  <img src={url} className="w-20 h-20 object-cover rounded-lg" alt="" />
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center rounded-b-lg py-0.5">
                      メイン
                    </span>
                  )}
                  <button
                    onClick={() => removeExistingImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
              {newPreviews.map((preview, i) => (
                <div key={preview} className="relative w-20 h-20">
                  <img src={preview} className="w-20 h-20 object-cover rounded-lg" alt="" />
                  <button
                    onClick={() => removeNewImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
              {totalImageCount < 5 && (
                <label className="w-20 h-20 border-2 border-dashed border-orange-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-orange-100 transition-colors">
                  <span className="text-orange-400 text-2xl">＋</span>
                  <input type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">タイトル <span className="text-red-500">*</span></label>
            <input type="text" maxLength={45} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：微分積分学テキスト" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
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
            <label className="block text-sm font-bold mb-2">希望場所</label>
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
                <input type="number" min="0" max="50000" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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
            <textarea maxLength={150} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="状態・付属品・受け渡し場所など" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm h-28 resize-none" />
          </div>

          <button onClick={handleSubmit} disabled={saving} className="w-full bg-orange-700 text-white py-4 rounded-full font-bold text-lg disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm">
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </main>
    </div>
  );
}
