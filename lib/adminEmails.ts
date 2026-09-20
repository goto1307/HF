export const ADMIN_EMAILS = ["debuchi.sora.b0@elms.hokudai.ac.jp", "goto.kanata.w1@elms.hokudai.ac.jp"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
