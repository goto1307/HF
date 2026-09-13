"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";
import FoxMascot from "@/components/FoxMascot";
import StarRating from "@/components/StarRating";

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
  rating: number;
  comment: string | null;
  created_at: string;
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
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
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

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("item").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) { alert("削除に失敗しました"); return; }
    setItems(items.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
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
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="text-orange-700 font-bold flex items-center gap-1 hover:text-orange-800 transition-colors">
            <span aria-hidden>←</span> 戻る
          </button>
          <div className="flex items-center gap-3 text-xs font-bold text-stone-500">
            <a href="#selling" className="hover:text-orange-700 transition-colors">出品中の商品へ</a>
            <a href="#sold" className="hover:text-orange-700 transition-colors">売れた商品へ</a>
          </div>
        </div>
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
            <FoxMascot size={88} className="mx-auto mb-3 opacity-90" />
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
                        <p className="font-bold mb-1 text-sm truncate text-blue-700">{item.title}</p>
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
                  <div className="flex items-center gap-2 mb-4">
                    <StarRating value={Math.round(avgRating)} size={18} />
                    <p className="text-sm text-stone-600">
                      {avgRating.toFixed(1)}（{reviews.length}件）
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {reviews.map((review) => (
                      <div key={review.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-1.5">
                          <StarRating value={review.rating} size={14} />
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

            <section id="selling">
              <h3 className="font-bold mb-4">出品中の商品（{items.filter((item) => !item.sold).length}件）</h3>
              {items.filter((item) => !item.sold).length === 0 ? (
                <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">
                  現在出品中の商品はありません
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {items.filter((item) => !item.sold).map((item) => (
                    <div key={item.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <Link href={`/items/${item.id}`} className="relative block">
                        {(item.image_urls?.[0] ?? item.image_url) ? (
                          <img src={item.image_urls?.[0] ?? item.image_url ?? undefined} alt={item.title} className="w-full h-32 object-cover" />
                        ) : (
                          <div className="bg-orange-50 h-32 flex items-center justify-center text-orange-200 text-3xl">📦</div>
                        )}
                      </Link>
                      <div className="p-3">
                        <p className="text-xs text-orange-700 font-bold mb-1">{item.category}</p>
                        <p className="font-bold mb-1 text-sm truncate text-blue-700">{item.title}</p>
                        <p className="text-orange-700 font-bold text-sm mb-2">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => router.push(`/items/${item.id}/chat`)}
                            className="w-full bg-orange-700 text-white py-1.5 rounded-full text-xs font-bold hover:bg-orange-800 transition-colors"
                          >
                            問い合わせを見る
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="w-full border border-red-300 text-red-500 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 transition-colors"
                          >
                            削除する
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section id="sold" className="mt-10">
              <h3 className="font-bold mb-4">売れた商品（{items.filter((item) => item.sold).length}件）</h3>
              {items.filter((item) => item.sold).length === 0 ? (
                <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">
                  まだ売れた商品がありません
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {items.filter((item) => item.sold).map((item) => (
                    <div key={item.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <Link href={`/items/${item.id}`} className="relative block">
                        {(item.image_urls?.[0] ?? item.image_url) ? (
                          <img src={item.image_urls?.[0] ?? item.image_url ?? undefined} alt={item.title} className="w-full h-32 object-cover opacity-50" />
                        ) : (
                          <div className="bg-orange-50 h-32 flex items-center justify-center text-orange-200 text-3xl opacity-50">📦</div>
                        )}
                        <div className="absolute top-2 -right-8 w-32 rotate-45 bg-red-600 text-white text-xs font-extrabold text-center py-0.5 shadow-md tracking-wider">
                          SOLD OUT
                        </div>
                      </Link>
                      <div className="p-3">
                        <p className="text-xs text-orange-700 font-bold mb-1">{item.category}</p>
                        <p className="font-bold mb-1 text-sm truncate text-blue-700">{item.title}</p>
                        <p className="text-orange-700 font-bold text-sm mb-2">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
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
          </>
        )}
      </main>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-sm mb-1 text-center">この商品を削除しますか？</p>
            <p className="text-center text-blue-700 font-bold text-sm mb-4 truncate">{deleteTarget.title}</p>
            <p className="text-xs text-stone-400 text-center mb-4">削除すると元に戻せません。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
