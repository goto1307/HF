import { redirect } from "next/navigation";

// 以前は登録の前に Google フォームのアンケートを案内していたが、登録の手間を減らすためにやめた。
// ポスターや各ページの「新規登録」は /join を指しているので、このページはそのまま登録画面へ移す。
export default function Join() {
  redirect("/register");
}
