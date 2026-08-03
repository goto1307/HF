"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
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

    setUploadingAvatar(true);
    const fileName = `avatars/${user.id}_${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file);
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

  const handleDelete = async (id: number) => {
    if (!confirm("この商品を削除しますか？")) return;
    const { error } = await supabase.from("item").delete().eq("id", id);
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

        {nothingYet ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <p className="text-stone-400 mb-4">評価がありません。出品してみましょう！</p>
            <button onClick={() => router.push("/sell")} className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors shadow-sm">
              ＋ 出品する
            </button>
          </div>
        ) : (
          <>
            <section className="mb-10">
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
                          個別チャットを見る
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

            <section>
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
                          <button
                            onClick={() => router.push(`/items/${item.id}/chat`)}
                            className="w-full bg-orange-700 text-white py-1.5 rounded-full text-xs font-bold hover:bg-orange-800 transition-colors"
                          >
                            {item.sold ? "個別チャットを見る" : "問い合わせを見る"}
                          </button>
                          {!item.sold && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="w-full border border-red-300 text-red-500 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 transition-colors"
                            >
                              削除する
                            </button>
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
