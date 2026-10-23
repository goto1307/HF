"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatBudget, formatDeadline, isActiveDemand, type MyDemand } from "@/lib/demand";

// 購入した直後に「今買った商品は、過去の欲しい！の中にありましたか？」と聞く。
// 選んだ欲しい！は「買えた！」になり、出品者にありがとうの通知が届く。
// 何個も欲しい場合などは、選ばずに閉じてもよい。
export default function DemandFulfillModal({
  itemId,
  demands,
  onDone,
}: {
  itemId: number;
  demands: MyDemand[];
  onDone: () => void;
}) {
  // 出品者から「この欲しい！に合いそう」と知らされていたものは最初から選んでおく
  const [selected, setSelected] = useState<Set<number>>(new Set(demands.filter((d) => d.offered).map((d) => d.id)));
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFulfill = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("fulfill_my_demands", { p_item_id: itemId, p_demand_ids: [...selected] });
    setSaving(false);
    if (error) { alert(`変更に失敗しました: ${error.message}`); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[85vh] overflow-y-auto p-6">
        <p className="font-bold text-center mb-1">購入しました！</p>
        <p className="text-sm text-stone-600 text-center mb-4">
          あなたが今買った商品は、過去の欲しい！の中にあったものですか？選ぶと「買えた！」になり、みんなの欲しい！に表示されなくなります。
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {demands.map((d) => (
            <label key={d.id} className="flex items-start gap-3 border border-stone-200 rounded-xl p-3 cursor-pointer hover:bg-orange-50 transition-colors">
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
                className="accent-orange-700 w-4 h-4 mt-0.5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-bold text-sm break-all">
                  {d.title}
                  {d.offered && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 align-middle">出品者から通知あり</span>}
                </span>
                <span className="block text-xs text-stone-500">
                  {formatBudget(d.budget)}・{isActiveDemand(d) ? formatDeadline(d.deadline) : "期限切れ"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDone}
            disabled={saving}
            className="flex-1 border border-stone-300 text-stone-600 py-3 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            どれでもない
          </button>
          <button
            onClick={handleFulfill}
            disabled={saving || selected.size === 0}
            className="flex-1 bg-orange-700 text-white py-3 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : `買えた！にする（${selected.size}件）`}
          </button>
        </div>
      </div>
    </div>
  );
}
