// 運営だけの2段階認証(Google Authenticator などの6桁)まわりの共通処理。
// 一般の利用者は認証アプリを登録できない(DB側 migration PART BK で運営以外の登録を止めている)ので、
// ここで「6桁が必要」と判定されるのは、登録を済ませた運営だけになる。
import { supabase } from "@/lib/supabase";

// 今のログインで、まだ6桁を入れる必要があるか
// (認証アプリを登録済みなのに、パスワードだけでログインしている状態)
export async function needsMfaCode(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

// 6桁を確かめる。成功すれば、このログインは aal2(6桁済み)になる
export async function verifyMfaCode(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return { ok: false, message: "6桁の数字を入力してください" };

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factorId = factors?.totp?.[0]?.id;
  if (listError || !factorId) return { ok: false, message: "認証アプリの登録が見つかりません" };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: trimmed });
  if (error) {
    if (error.status === 429) return { ok: false, message: "試行回数が多すぎます。しばらく待ってからお試しください" };
    return { ok: false, message: "コードが違います。アプリに表示されている最新の6桁を入れてください" };
  }
  return { ok: true };
}
