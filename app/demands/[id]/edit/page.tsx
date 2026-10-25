"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import type { MyDemand } from "@/lib/demand";
import DemandForm, { type DemandFormValues } from "@/components/DemandForm";
import Header from "@/components/Header";
import { loginPath } from "@/lib/nav";

// 自分の欲しい！の編集。期限切れのものも、期限を延ばせば一覧に戻る。
export default function EditDemand() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const [demand, setDemand] = useState<MyDemand | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(loginPath()); return; }
    const load = async () => {
      const { data } = await supabase.rpc("my_demands");
      const found = ((data ?? []) as MyDemand[]).find((d) => d.id === id && d.is_owner);
      setDemand(found && found.status === "open" && !found.my_done ? found : null);
    };
    load();
  }, [authLoading, user, router, id]);

  const handleSave = async (values: DemandFormValues) => {
    const { error } = await supabase.rpc("update_my_demand", {
      p_demand_id: id,
      p_title: values.title,
      p_budget: values.budget,
      p_deadline: values.deadline,
      p_tags: values.tags,
      p_note: values.note,
    });
    if (error) return /期限|タグ|編集/.test(error.message) ? error.message : "保存に失敗しました";
    alert("欲しい！を保存しました！");
    router.push(`/demands?mine=1&id=${id}`);
    return null;
  };

  if (demand === undefined) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  if (demand === null) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-500">
          <p className="mb-4">この欲しい！は編集できません。</p>
          <Link href="/demands?mine=1" className="text-orange-700 font-bold underline">自分の欲しい！へ戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <DemandForm
      heading="欲しい！を編集する"
      description="期限を過ぎた欲しい！も、期限を延ばすとみんなの欲しい！に戻ります。"
      submitLabel="変更を保存"
      confirmMessage="この内容で保存します。よろしいですか？"
      initial={{ title: demand.title, budget: demand.budget, deadline: demand.deadline, tags: demand.tags, note: demand.note }}
      onSave={handleSave}
    />
  );
}
