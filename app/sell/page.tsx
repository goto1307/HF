"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { validateImageFile } from "@/lib/resizeImage";
import { makeImagePath } from "@/lib/uploadPath";
import { DEMAND_COLUMNS, DEMAND_MATCH_LIMIT, findMatchingDemands, formatBudget, formatDeadline, jstToday, type Demand, type MyDemand } from "@/lib/demand";
import Header from "@/components/Header";
import ImageCropper from "@/components/ImageCropper";
import { IconWarning, IconPackage, IconX } from "@/components/icons";

const categories = ["教科書", "自転車", "家電・家具", "衣類", "その他"];
const AREAS = ["北11条エリア", "工学部棟エリア", "教養棟エリア", "サークル会館エリア", "北24条エリア", "北18条エリア"];
const TITLE_MAX = 45;

// 出品の下書き(migration PART AG)。写真は保存しない。
type Draft = {
  id: number;
  title: string;
  price: number | null;
  is_free: boolean;
  category: string | null;
  condition: string | null;
  area: string | null;
  hashtags: string[];
  detail: string;
  demand_id: number | null;
  updated_at: string;
};
const DRAFT_COLUMNS = "id,title,price,is_free,category,condition,area,hashtags,detail,demand_id,updated_at";

function SellContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [condition, setCondition] = useState("");
  const [area, setArea] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // 出品後に「この欲しい！の中にありませんか？」と案内する候補
  const [offer, setOffer] = useState<{ itemId: number; candidates: Demand[] } | null>(null);
  const [offerSelected, setOfferSelected] = useState<Set<number>>(new Set());
  const [offering, setOffering] = useState(false);
  // 「この欲しい！に応える」から来たときの欲しい！と、読み込んだ下書き
  const [linkedDemand, setLinkedDemand] = useState<Demand | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const fetchDemand = async (id: number) => {
    const { data } = await supabase.from("demand").select(DEMAND_COLUMNS).eq("id", id).maybeSingle();
    return (data as Demand | null) ?? null;
  };

  // /sell?demand=ID で開かれたら、その欲しい！の商品名・金額・タグを入れておく
  const demandParam = Number(searchParams.get("demand")) || null;
  useEffect(() => {
    if (!user || !demandParam) return;
    const load = async () => {
      const d = await fetchDemand(demandParam);
      if (!d) return;
      setLinkedDemand(d);
      setTitle(d.title.slice(0, TITLE_MAX));
      if (d.budget === 0) { setIsFree(true); setPrice(""); } else { setIsFree(false); setPrice(String(d.budget)); }
      setHashtags(d.tags);
    };
    load();
  }, [user, demandParam]);

  const openDrafts = async () => {
    setShowDrafts(true);
    const { data, error } = await supabase.from("item_draft").select(DRAFT_COLUMNS).order("updated_at", { ascending: false });
    if (error) { alert("下書きの読み込みに失敗しました"); setShowDrafts(false); return; }
    setDrafts((data ?? []) as Draft[]);
  };

  const applyDraft = async (d: Draft) => {
    setTitle(d.title);
    setIsFree(d.is_free);
    setPrice(d.price === null ? "" : String(d.price));
    setCategory(d.category ?? "");
    setCondition(d.condition ?? "");
    setArea(d.area ?? "");
    setHashtags(d.hashtags);
    setDetail(d.detail);
    setDraftId(d.id);
    setShowDrafts(false);
    setLinkedDemand(d.demand_id ? await fetchDemand(d.demand_id) : null);
  };

  const deleteDraft = async (d: Draft) => {
    if (!confirm(`下書き「${d.title || "（タイトルなし）"}」を削除しますか？`)) return;
    const { error } = await supabase.from("item_draft").delete().eq("id", d.id);
    if (error) { alert("削除に失敗しました"); return; }
    setDrafts((prev) => (prev ?? []).filter((x) => x.id !== d.id));
    if (draftId === d.id) setDraftId(null);
  };

  const saveDraft = async () => {
    if (!user) { alert("ログインしてください"); router.push("/login"); return; }
    if (!isFree && price && (!Number.isInteger(Number(price)) || Number(price) < 0 || Number(price) > 50000)) {
      alert("価格は0円〜50,000円の範囲で入力してください");
      return;
    }
    const values = {
      title: title.slice(0, TITLE_MAX),
      price: isFree || !price ? null : Number(price),
      is_free: isFree,
      category: category || null,
      condition: condition || null,
      area: area.trim() || null,
      hashtags,
      detail,
      demand_id: linkedDemand?.id ?? null,
    };
    setSavingDraft(true);
    const { data, error } = draftId
      ? await supabase.from("item_draft").update({ ...values, updated_at: new Date().toISOString() }).eq("id", draftId).select("id").single()
      : await supabase.from("item_draft").insert(values).select("id").single();
    setSavingDraft(false);
    if (error || !data) {
      alert(error?.message.includes("件まで") ? error.message : "下書きの保存に失敗しました");
      return;
    }
    setDraftId(data.id);
    alert("下書きに保存しました。写真は下書きに保存されないので、出品するときに追加してください。");
  };

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
    if (images.length + cropQueue.length + files.length > 5) { alert("写真は最大5枚までです"); e.target.value = ""; return; }
    for (const file of files) {
      const error = validateImageFile(file);
      if (error) { alert(error); e.target.value = ""; return; }
    }
    setCropQueue([...cropQueue, ...files]);
    e.target.value = "";
  };

  const handleCropConfirm = (cropped: File) => {
    setImages((prev) => [...prev, cropped]);
    setPreviews((prev) => [...prev, URL.createObjectURL(cropped)]);
    setCropQueue((prev) => prev.slice(1));
  };

  const handleCropCancel = () => {
    setCropQueue((prev) => prev.slice(1));
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleReview = () => {
    if (!user) { alert("ログインしてください"); router.push("/login"); return; }
    if (!title.trim()) { alert("タイトルを入力してください"); return; }
    if (!category) { alert("カテゴリを選択してください"); return; }
    if (!isFree && !price) { alert("価格を入力してください"); return; }
    if (!isFree && (!Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 50000)) { alert("価格は0円〜50,000円の範囲で入力してください"); return; }
    if (!agreed) { alert("出品規約への同意が必要です"); return; }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!user) { alert("ログインしてください"); router.push("/login"); return; }
    setLoading(true);

    const imageUrls: string[] = [];

    for (const file of images) {
      const fileName = makeImagePath();
      const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file);
      if (uploadError) {
        alert("画像のアップロードに失敗しました");
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
      imageUrls.push(urlData.publicUrl);
    }

    const { data: inserted, error } = await supabase.from("item").insert({
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
      hashtags: hashtags.length > 0 ? hashtags : null,
    }).select("id").single();

    if (error || !inserted) { setLoading(false); alert("出品に失敗しました"); return; }

    // 出品できた下書きは消す(失敗しても出品自体には影響しないので結果は見ない)
    if (draftId) await supabase.from("item_draft").delete().eq("id", draftId);

    const candidates = await findDemandsForItem();
    setLoading(false);
    if (candidates.length === 0) {
      alert("出品しました！");
      router.push("/");
      return;
    }
    setShowConfirm(false);
    // 応えた欲しい！は最初から選んでおく
    setOfferSelected(new Set(linkedDemand && candidates.some((d) => d.id === linkedDemand.id) ? [linkedDemand.id] : []));
    setOffer({ itemId: inserted.id, candidates });
  };

  // 出品した商品に合いそうな、他の人の受付中の欲しい！を探す
  const findDemandsForItem = async () => {
    const [{ data: openData }, { data: mineData }] = await Promise.all([
      supabase.from("demand").select(DEMAND_COLUMNS).eq("status", "open").gte("deadline", jstToday()),
      supabase.rpc("my_demands"),
    ]);
    const mineIds = new Set(((mineData ?? []) as MyDemand[]).filter((d) => d.is_owner).map((d) => d.id));
    const others = ((openData ?? []) as Demand[]).filter((d) => !mineIds.has(d.id));
    const matched = findMatchingDemands(others, { title, hashtags });
    // 応えた欲しい！は、一致判定に関係なく候補の先頭に入れる(まだ受付中なら)
    const linked = linkedDemand && others.find((d) => d.id === linkedDemand.id);
    if (!linked) return matched;
    return [linked, ...matched.filter((d) => d.id !== linked.id)].slice(0, DEMAND_MATCH_LIMIT);
  };

  const finishOffer = async (send: boolean) => {
    if (!offer) return;
    if (send && offerSelected.size > 0) {
      setOffering(true);
      const { data, error } = await supabase.rpc("offer_item_to_demands", {
        p_item_id: offer.itemId,
        p_demand_ids: [...offerSelected],
      });
      setOffering(false);
      if (error) { alert(`通知の送信に失敗しました: ${error.message}`); return; }
      alert(`出品しました！欲しい！を登録した${data ?? 0}人に知らせました。`);
    } else {
      alert("出品しました！");
    }
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-md mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-orange-700 font-bold mb-6 flex items-center gap-1 hover:text-orange-800 transition-colors">
          <span aria-hidden>←</span> 戻る
        </button>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">出品する</h2>
          <button
            onClick={openDrafts}
            className="shrink-0 text-sm font-bold text-orange-700 border border-orange-200 bg-white rounded-full px-4 py-2 hover:bg-orange-100 transition-colors"
          >
            下書きから選ぶ
          </button>
        </div>
        {draftId && <p className="text-xs text-stone-500 mb-2">下書きを編集中です。出品すると下書きは削除されます。</p>}
        {linkedDemand && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm">
            <p className="font-bold text-orange-800">欲しい！「{linkedDemand.title}」に応える出品です</p>
            <p className="text-xs text-stone-600 mt-0.5">
              {formatBudget(linkedDemand.budget)}・{formatDeadline(linkedDemand.deadline)}。出品すると、この欲しい！を登録した人に知らせられます。写真がまだなら「下書きに保存」しておけます。
            </p>
          </div>
        )}

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
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                  >
                    <IconX size={11} />
                  </button>
                </div>
              ))}
              {previews.length < 5 && (
                <label className="w-20 h-20 border-2 border-dashed border-orange-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-orange-100 transition-colors">
                  <span className="text-orange-400 text-2xl">＋</span>
                  <input type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">タイトル <span className="text-red-500">*</span></label>
            <input type="text" autoComplete="off" maxLength={45} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：微分積分学テキスト" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm" />
            <p className="text-xs text-stone-400 text-right mt-1">{title.length}/45</p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">カテゴリ <span className="text-red-500">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm bg-white">
              <option value="">選択してください</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            {category === "自転車" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
                <IconWarning size={14} className="shrink-0" />
                自転車の譲渡には防犯登録の名義変更が必要です。お忘れなく。
              </p>
            )}
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
              autoComplete="off"
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
                <input type="number" min="0" max="50000" autoComplete="off" value={price} onChange={(e) => setPrice(e.target.value.replace("-", ""))} placeholder="0" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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
                    <button type="button" onClick={() => removeHashtag(tag)} className="text-orange-400 hover:text-orange-700"><IconX size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              autoComplete="off"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addHashtag(); }
              }}
              placeholder="例：教科書 (Enterで追加)"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-600 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">商品の説明</label>
            <textarea maxLength={150} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="状態・付属品・受け渡し場所など" className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm h-28 resize-none" />
            <p className="text-xs text-stone-400 text-right mt-1">{detail.length}/150</p>
          </div>

          <div className="border border-stone-200 rounded-xl p-4 bg-stone-50">
            <p className="font-bold text-sm mb-2">出品する前に</p>
            <ul className="text-xs text-stone-600 flex flex-col gap-1 mb-3 list-disc pl-5">
              <li>商品の写真・説明・価格に誤りがなく、傷・汚れ・欠品なども正確に書きました</li>
              <li>家電は動作確認の有無を、教科書・ノートは書き込みの有無を書きました</li>
              <li>禁止されている物（チケット、食品、生き物、過去問・試験の解答、配布資料のコピー、酒・たばこ・医薬品など）ではありません</li>
              <li>自分が持ち主で、売る権利があります</li>
              <li>取引は購入者と直接行い、運営は支払いや受け渡しに関与しないことを理解しました</li>
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="accent-orange-700 w-4 h-4"
              />
              <span>
                上記と
                <Link href="/terms" target="_blank" onClick={(e) => e.stopPropagation()} className="text-orange-700 underline">利用規約</Link>
                に同意して出品する
              </span>
            </label>
          </div>

          <button onClick={handleReview} disabled={!agreed} className="w-full bg-orange-700 text-white py-4 rounded-full font-bold text-lg disabled:opacity-50 hover:bg-orange-800 transition-colors shadow-sm">
            出品する
          </button>
          <button
            onClick={saveDraft}
            disabled={savingDraft}
            className="w-full -mt-2 border border-orange-200 text-orange-700 py-3 rounded-full font-bold text-sm bg-white disabled:opacity-50 hover:bg-orange-100 transition-colors"
          >
            {savingDraft ? "保存中..." : draftId ? "下書きを上書き保存" : "下書きに保存"}
          </button>
        </div>
      </main>

      {showDrafts && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowDrafts(false)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold">下書きから選ぶ</p>
              <button onClick={() => setShowDrafts(false)} className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="閉じる">
                <IconX size={20} />
              </button>
            </div>
            {drafts === null ? (
              <p className="text-center text-stone-400 text-sm py-8">読み込み中...</p>
            ) : drafts.length === 0 ? (
              <p className="text-center text-stone-400 text-sm py-8">下書きはありません</p>
            ) : (
              <div className="flex flex-col gap-2">
                {drafts.map((d) => (
                  <div key={d.id} className={`flex items-center gap-2 border rounded-xl p-3 ${draftId === d.id ? "border-orange-400 bg-orange-50" : "border-stone-200"}`}>
                    <button onClick={() => applyDraft(d)} className="flex-1 min-w-0 text-left">
                      <span className="block font-bold text-sm truncate">{d.title || "（タイトルなし）"}</span>
                      <span className="block text-xs text-stone-500">
                        {d.is_free ? "無料" : d.price !== null ? `¥${d.price.toLocaleString()}` : "価格未入力"}
                        {d.demand_id && "・欲しい！に応える出品"}
                        ・{new Date(d.updated_at).toLocaleDateString("ja-JP")}に保存
                      </span>
                    </button>
                    <button
                      onClick={() => deleteDraft(d)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-red-500 transition-colors"
                      aria-label="下書きを削除"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-stone-400 mt-3">下書きは10件まで保存できます。写真は保存されません。</p>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {previews[0] ? (
              <img src={previews[0]} alt="" className="w-full h-56 object-cover" />
            ) : (
              <div className="bg-orange-50 h-40 flex items-center justify-center text-orange-200"><IconPackage size={40} /></div>
            )}
            <div className="p-6">
              <p className="text-xs font-bold text-orange-700 mb-4 text-center">この内容で出品します。よろしいですか？</p>

              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-orange-700 font-bold">{category}</p>
                {condition && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">{condition}</span>}
              </div>
              <p className="text-lg font-bold text-blue-700 mb-1">{title}</p>
              <p className="text-2xl text-orange-700 font-bold mb-2">{isFree ? "無料" : `¥${Number(price || 0).toLocaleString()}`}</p>
              {area && <p className="text-sm text-stone-500 mb-1">希望場所：{area}</p>}
              {hashtags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2 mb-2">
                  {hashtags.map((tag) => (
                    <span key={tag} className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}
              {detail && <p className="text-sm text-stone-600 whitespace-pre-wrap mt-2 mb-2">{detail}</p>}

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  className="flex-1 border border-stone-300 text-stone-600 py-3 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
                >
                  戻って編集する
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-orange-700 text-white py-3 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "出品中..." : "この内容で出品する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {offer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[85vh] overflow-y-auto p-6">
            <p className="font-bold text-center mb-1">出品しました！</p>
            <p className="text-sm text-stone-600 text-center mb-4">
              この商品は、これらの欲しい！の中にありませんか？選んだ欲しい！を投稿した人に通知を送ります。あなたの出品が早く買われるかもしれません。
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {offer.candidates.map((d) => (
                <label key={d.id} className="flex items-start gap-3 border border-stone-200 rounded-xl p-3 cursor-pointer hover:bg-orange-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={offerSelected.has(d.id)}
                    onChange={() => setOfferSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                      return next;
                    })}
                    className="accent-orange-700 w-4 h-4 mt-0.5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-sm break-all">{d.title}</span>
                    <span className="block text-xs text-stone-500">{formatBudget(d.budget)}・{formatDeadline(d.deadline)}</span>
                    {d.tags.length > 0 && (
                      <span className="block text-[11px] text-orange-600 truncate">{d.tags.map((t) => `#${t}`).join(" ")}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => finishOffer(false)}
                disabled={offering}
                className="flex-1 border border-stone-300 text-stone-600 py-3 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                送らない
              </button>
              <button
                onClick={() => finishOffer(true)}
                disabled={offering || offerSelected.size === 0}
                className="flex-1 bg-orange-700 text-white py-3 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
              >
                {offering ? "送信中..." : `通知を送る（${offerSelected.size}件）`}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropQueue[0] && (
        <ImageCropper
          file={cropQueue[0]}
          title={`写真を調整（${images.length + 1}枚目）`}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

export default function Sell() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <SellContent />
    </Suspense>
  );
}
