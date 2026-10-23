"use client";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DemandForm, { type DemandFormValues } from "@/components/DemandForm";

export default function NewDemand() {
  const router = useRouter();

  const handleSave = async (values: DemandFormValues) => {
    const { error } = await supabase.from("demand").insert(values);
    if (error) {
      // DB 側のチェック(件数・期限・タグ)のメッセージはそのまま見せる
      return /件まで|期限|タグ/.test(error.message) ? error.message : "登録に失敗しました";
    }
    alert("欲しい！を登録しました！");
    router.push("/demands");
    return null;
  };

  return (
    <DemandForm
      heading="欲しい！を登録する"
      description="みんなの欲しい！に載ります。登録した人の名前は表示されません。"
      submitLabel="欲しい！を登録"
      confirmMessage="この内容で登録します。よろしいですか？"
      onSave={handleSave}
    />
  );
}
