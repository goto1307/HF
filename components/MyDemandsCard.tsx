"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { formatBudget, formatDeadline, isActiveDemand, type MyDemand } from "@/lib/demand";

// マイページに出す、自分の欲しい！のまとめ。一覧・変更は /demands?mine=1 で行う。
export default function MyDemandsCard() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<MyDemand[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.rpc("my_demands");
      setDemands((data ?? []) as MyDemand[]);
    };
    load();
  }, [user]);

  // 自分が登録したもので、まだ買えていない受付中のもの
  const active = (demands ?? []).filter((d) => d.is_owner && !d.my_done && isActiveDemand(d));
  const fulfilledCount = (demands ?? []).filter((d) => d.my_done).length;

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <h3 className="font-bold mb-1">
        自分の欲しい！<span className="text-sm font-normal text-stone-400 ml-1">（受付中 {active.length}件・買えた！ {fulfilledCount}件）</span>
      </h3>
      <p className="text-xs text-stone-500 mb-3">
        欲しいものを登録すると、みんなの欲しい！に載ります。合いそうな商品が出品されると、出品者から通知が届きます。
      </p>

      {demands === null ? (
        <p className="text-xs text-stone-400">読み込み中...</p>
      ) : active.length === 0 ? (
        <p className="text-xs text-stone-400 mb-3">受付中の欲しい！はありません。</p>
      ) : (
        <ul className="flex flex-col gap-1.5 mb-3">
          {active.slice(0, 3).map((d) => (
            <li key={d.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-bold truncate">{d.title}</span>
              <span className="shrink-0 text-xs text-stone-500">
                {formatBudget(d.budget)}・{formatDeadline(d.deadline)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/demands/new" className="bg-orange-700 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors">
          ＋ 欲しい！
        </Link>
        <Link href="/demands?mine=1" className="border border-orange-200 text-orange-700 px-4 py-2 rounded-full text-sm font-bold hover:bg-orange-100 transition-colors">
          自分の欲しい！をすべて見る
        </Link>
      </div>
    </section>
  );
}
