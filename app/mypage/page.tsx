"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { resizeImage, validateImageFile } from "@/lib/resizeImage";
import Header from "@/components/Header";

type Item = {
  id: number;
  title: string;
  price: number;
  category: string;
  nickname: string;
  image_url: string | null;
  image_urls: string[] | null;
  sold: boolean;
};

type Review = {
  id: number;
  reviewer_nickname: string;
  rating: "good" | "normal" | "bad";
  comment: string | null;
  created_at: string;
};

const RATING_LABELS: Record<string, string> = { good: "良い", normal: "普通", bad: "悪い" };
const RATING_COLORS: Record<string, string> = {
  good: "bg-orange-50 text-orange-700",
  normal: "bg-stone-100 text-stone-600",
  bad: "bg-red-50 text-red-600",
};

export default function MyPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [profileAvailable, setProfileAvailable] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      const { data: myItems } = await supabase
        .from("item")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (myItems) setItems(myItems);

      const { data: myReviews } = await supabase
        .from("review")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      if (myReviews) setReviews(myReviews);

      const { data: purchaseMsgs } = await supabase
        .from("message")
        .select("item_id, created_at")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      if (purchaseMsgs) {
        const orderedIds: number[] = [];
        const seen = new Set<number>();
        for (const m of purchaseMsgs) {
          if (!seen.has(m.item_id)) { seen.add(m.item_id); orderedIds.push(m.item_id); }
        }
        if (orderedIds.length > 0) {
          const { data: purchasedItems } = await supabase.from("item").select("*").in("id", orderedIds);
          if (purchasedItems) {
            const byId = new Map(purchasedItems.map((it) => [it.id, it]));
            setPurchases(orderedIds.map((id) => byId.get(id)).filter((it): it is Item => !!it));
          }
        }
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profile")
        .select("bio,gender,age")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileError) {
        setProfileAvailable(false);
      } else if (profileData) {
        setBio(profileData.bio || "");
        setGender(profileData.gender || "");
        setAge(profileData.age != null ? String(profileData.age) : "");
      }

      setDataLoading(false);
    };
    fetchData();
  }, [authLoading, user, router]);

  const loading = authLoading || dataLoading;
  const goodCount = reviews.filter((r) => r.rating === "good").length;
  const normalCount = reviews.filter((r) => r.rating === "normal").length;
  const badCount = reviews.filter((r) => r.rating === "bad").length;
  const nothingYet = !loading && items.length === 0 && reviews.length === 0 && purchases.length === 0;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    const validationError = validateImageFile(file);
    if (validationError) { alert(validationError); return; }

    setUploadingAvatar(true);
    let uploadFile: File = file;
    try {
      uploadFile = await resizeImage(file, 512);
    } catch {
      // リサイズに失敗しても元ファイルでアップロードを続行する
    }
    const fileName = `avatars/${user.id}_${Date.now()}_${uploadFile.name}`;
    const { error: uploadError } = await supabase.storage.from("images").upload(fileName, uploadFile);
    if (uploadError) {
      alert("アイコンのアップロードに失敗しました");
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: urlData.publicUrl },
    });
    setUploadingAvatar(false);
    if (updateError) { alert("アイコンの更新に失敗しました"); return; }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (age && (!Number.isFinite(Number(age)) || Number(age) < 0 || Number(age) > 120)) {
      alert("年齢には0〜120の数値を入力してください");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.from("profile").upsert({
      user_id: user.id,
      bio: bio.trim() || null,
      gender: gender || null,
      age: age ? Number(age) : null,
      updated_at: new Date().toISOString(),
    });
    setSavingProfile(false);
    if (error) {
      setProfileAvailable(false);
      alert("プロフィールの保存に失敗しました。この機能は準備中の可能性があります。");
      return;
    }
    alert("プロフィールを保存しました");
  };

  const handleDelete = async (id: number) => {
    if (!user) return;
    if (!confirm("この商品を削除しますか？")) return;
    const { error } = await supabase.from("item").delete().eq("id", id).eq("user_id", user.id);
    if (error) { alert("削除に失敗しました"); return; }
    setItems(items.filter((item) => item.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="relative shrink-0">
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="アイコン"
                className="w-16 h-16 rounded-full object-cover border border-stone-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-orange-700 text-white flex items-center justify-center text-xl font-bold">
                {(user?.user_metadata?.nickname || user?.email || "?")[0]}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-stone-300 shadow-sm flex items-center justify-center text-xs cursor-pointer hover:bg-stone-50 transition-colors">
              {uploadingAvatar ? "…" : "✎"}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            </label>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">マイページ</h2>
            <p className="text-sm text-stone-500">{user?.user_metadata?.nickname || user?.email}</p>
          </div>
        </div>

        <section className="mb-10 bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h3 className="font-bold mb-3">プロフィール</h3>
          {!profileAvailable && (
            <p className="text-xs text-stone-400 mb-3">この機能は現在準備中です。保存できない場合があります。</p>
          )}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">一言メッセージ</label>
              <textarea
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="よろしくお願いします！など"
                className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none h-20 resize-none focus:border-orange-600 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-stone-500 mb-1">性別（任意）</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:border-orange-600 transition-colors">
                  <option value="">未設定</option>
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-stone-500 mb-1">年齢（任意）</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="未設定"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="self-start bg-orange-700 text-white px-5 py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-orange-800 transition-colors"
            >
              {savingProfile ? "保存中..." : "プロフィールを保存"}
            </button>
          </div>
        </section>

        {nothingYet ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <p className="text-stone-400 mb-4">評価がありません。出品してみましょう！</p>
            <button onClick={() => router.push("/sell")} className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors shadow-sm">
              ＋ 出品する
            </button>
          </div>
        ) : (
          <>
            <section id="purchases" className="mb-10 scroll-mt-28">
              <h3 className="font-bold mb-4">購入した商品（{purchases.length}件）</h3>
              {purchases.length === 0 ? (
                <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">
                  まだ購入した商品がありません
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {purchases.map((item) => (
                    <div key={item.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <Link href={`/items/${item.id}`}>
                        {(item.image_urls?.[0] ?? item.image_url) ? (
                          <img src={item.image_urls?.[0] ?? item.image_url ?? undefined} alt={item.title} className="w-full h-32 object-cover" />
                        ) : (
                          <div className="bg-orange-50 h-32 flex items-center justify-center text-orange-200 text-3xl">📦</div>
                        )}
                      </Link>
                      <div className="p-3">
                        <p className="text-xs text-orange-700 font-bold mb-1">{item.category}</p>
                        <p className="font-bold mb-1 text-sm truncate">{item.title}</p>
                        <p className="text-orange-700 font-bold text-sm mb-2">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
                        <p className="text-xs text-stone-400 truncate mb-2">出品者：{item.nickname}</p>
                        <button
                          onClick={() => router.push(`/items/${item.id}/chat`)}
                          className="w-full bg-orange-700 text-white py-1.5 rounded-full text-xs font-bold hover:bg-orange-800 transition-colors"
                        >
                          取引ページを見る
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-10">
              <h3 className="font-bold mb-3">評価（{reviews.length}件）</h3>
              {reviews.length === 0 ? (
                <p className="text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm px-4 py-6 text-center text-sm">
                  まだ評価がありません
                </p>
              ) : (
                <div>
                  <p className="text-sm text-stone-600 mb-4">
                    良い {goodCount}・普通 {normalCount}・悪い {badCount}
                  </p>
                  <div className="flex flex-col gap-3">
                    {reviews.map((review) => (
                      <div key={review.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${RATING_COLORS[review.rating]}`}>
                            {RATING_LABELS[review.rating]}
                          </span>
                          <span className="text-xs text-stone-400">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-stone-500 mb-1">{review.reviewer_nickname}</p>
                        {review.comment && <p className="text-sm text-stone-700">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section id="items" className="scroll-mt-28">
              <h3 className="font-bold mb-4">出品した商品（{items.length}件）</h3>
              {items.length === 0 ? (
                <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">
                  まだ出品した商品がありません
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div key={item.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <Link href={`/items/${item.id}`} className="relative block">
                        {(item.image_urls?.[0] ?? item.image_url) ? (
                          <img src={item.image_urls?.[0] ?? item.image_url ?? undefined} alt={item.title} className={`w-full h-32 object-cover ${item.sold ? "opacity-50" : ""}`} />
                        ) : (
                          <div className={`bg-orange-50 h-32 flex items-center justify-center text-orange-200 text-3xl ${item.sold ? "opacity-50" : ""}`}>📦</div>
                        )}
                        {item.sold && (
                          <div className="absolute top-2 -right-8 w-32 rotate-45 bg-red-600 text-white text-xs font-extrabold text-center py-0.5 shadow-md tracking-wider">
                            SOLD OUT
                          </div>
                        )}
                      </Link>
                      <div className="p-3">
                        <p className="text-xs text-orange-700 font-bold mb-1">{item.category}</p>
                        <p className="font-bold mb-1 text-sm truncate">{item.title}</p>
                        <p className="text-orange-700 font-bold text-sm mb-2">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
                        <div className="flex flex-col gap-1.5">
                          {item.sold && (
                            <button
                              onClick={() => router.push(`/items/${item.id}/chat`)}
                              className="w-full bg-orange-700 text-white py-1.5 rounded-full text-xs font-bold hover:bg-orange-800 transition-colors"
                            >
                              取引ページを見る
                            </button>
                          )}
                          {!item.sold && (
                            <>
                              <button
                                onClick={() => router.push(`/items/${item.id}/edit`)}
                                className="w-full border border-orange-300 text-orange-700 py-1.5 rounded-full text-xs font-bold hover:bg-orange-50 transition-colors"
                              >
                                編集する
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="w-full border border-red-300 text-red-500 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 transition-colors"
                              >
                                削除する
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
