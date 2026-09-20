"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import StarRating from "@/components/StarRating";

type Item = {
  id: number;
  title: string;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  sold: boolean;
  nickname: string;
};

type Profile = {
  bio: string | null;
  gender: string | null;
  age: number | null;
};

export default function SellerProfile() {
  const params = useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratingStats, setRatingStats] = useState<{ avg: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: itemData } = await supabase
        .from("item")
        .select("id,title,price,image_url,image_urls,sold,nickname")
        .eq("user_id", params.id)
        .order("created_at", { ascending: false });
      if (itemData) setItems(itemData);

      const { data: reviewData } = await supabase.from("review").select("rating").eq("seller_id", params.id);
      if (reviewData && reviewData.length > 0) {
        const total = reviewData.reduce((sum, r) => sum + r.rating, 0);
        setRatingStats({ avg: total / reviewData.length, count: reviewData.length });
      } else {
        setRatingStats({ avg: 0, count: 0 });
      }

      // profile テーブルは未作成の場合がある(移行未適用)ため、失敗しても無視する
      const { data: profileData } = await supabase.from("profile").select("bio,gender,age").eq("user_id", params.id).maybeSingle();
      if (profileData) setProfile(profileData);

      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const nickname = items[0]?.nickname || "ユーザー";
  const soldCount = items.filter((i) => i.sold).length;
  const activeItems = items.filter((i) => !i.sold);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-orange-700 text-white flex items-center justify-center text-2xl font-bold shrink-0">
              {nickname[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold">{nickname}</h2>
              {ratingStats && ratingStats.count > 0 ? (
                <div className="flex items-center gap-1.5">
                  <StarRating value={Math.round(ratingStats.avg)} size={14} />
                  <p className="text-sm text-orange-700 font-bold">{ratingStats.avg.toFixed(1)}（{ratingStats.count}件）</p>
                </div>
              ) : (
                <p className="text-sm text-stone-400">評価はまだありません</p>
              )}
            </div>
          </div>

          <div className="flex gap-4 text-sm text-stone-600 mb-4">
            <p>取引成立数：<span className="font-bold text-stone-800">{soldCount}件</span></p>
            {profile?.gender && <p>性別：<span className="font-bold text-stone-800">{profile.gender}</span></p>}
            {profile?.age != null && <p>年齢：<span className="font-bold text-stone-800">{profile.age}歳</span></p>}
          </div>

          {profile?.bio && (
            <p className="text-sm text-stone-700 bg-stone-50 rounded-xl p-3 whitespace-pre-wrap">{profile.bio}</p>
          )}
        </div>

        <h3 className="font-bold mb-3">出品中の商品（{activeItems.length}件）</h3>
        {activeItems.length === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">
            現在出品中の商品はありません
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {activeItems.map((item) => (
              <Link href={`/items/${item.id}`} key={item.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow block">
                {(item.image_urls?.[0] ?? item.image_url) ? (
                  <img src={item.image_urls?.[0] ?? item.image_url ?? undefined} alt={item.title} className="w-full h-32 object-cover" />
                ) : (
                  <div className="bg-orange-50 h-32 flex items-center justify-center text-orange-200 text-3xl">📦</div>
                )}
                <div className="p-3">
                  <p className="font-bold mb-1 text-sm truncate">{item.title}</p>
                  <p className="text-orange-700 font-bold text-sm">{item.price === 0 ? "無料" : `¥${item.price.toLocaleString()}`}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
