"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import {
  DEMAND_NOTE_MAX,
  DEMAND_TAG_MAX,
  DEMAND_TITLE_MAX,
  addDays,
  formatBudget,
  formatDeadline,
  jstToday,
} from "@/lib/demand";
import Header from "@/components/Header";
import { IconX } from "@/components/icons";

// 編集のとき、期限がこれより先なら「ずっと」として表示する
const FOREVER_THRESHOLD_DAYS = 330;

// 月・日の数字から、今日以降でいちばん近いその日付を YYYY-MM-DD で返す(無い日付なら null)
function dateFromMonthDay(month: string, day: string, today: string) {
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  let year = Number(today.slice(0, 4));
  for (let i = 0; i < 2; i++, year++) {
    const ymd = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const check = new Date(`${ymd}T00:00:00Z`);
    if (check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) continue; // 2/30 など無い日付
    if (ymd >= today) return ymd;
  }
  return null;
}

export type DemandFormValues = {
  title: string;
  budget: number;
  deadline: string;
  tags: string[];
  note: string | null;
};

// 欲しい！の登録・編集フォーム。onSave は失敗したときにエラー文を返す。
export default function DemandForm({
  heading,
  description,
  submitLabel,
  confirmMessage,
  initial,
  onSave,
}: {
  heading: string;
  description: string;
  submitLabel: string;
  confirmMessage: string;
  initial?: DemandFormValues;
  onSave: (values: DemandFormValues) => Promise<string | null>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [budget, setBudget] = useState(initial ? String(initial.budget) : "");
  // 期限は「ずっと(1年以内)」か、月・日の数字で指定する
  const [deadlineMode, setDeadlineMode] = useState<"forever" | "date">(
    initial && initial.deadline > addDays(jstToday(), FOREVER_THRESHOLD_DAYS) ? "forever" : "date",
  );
  const [month, setMonth] = useState(initial ? String(Number(initial.deadline.slice(5, 7))) : "");
  const [day, setDay] = useState(initial ? String(Number(initial.deadline.slice(8, 10))) : "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState(initial?.note ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = jstToday();
  const maxDeadline = addDays(today, 365);
  const deadline = deadlineMode === "forever" ? maxDeadline : dateFromMonthDay(month, day, today);

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#+/, "").slice(0, 20);
    if (!tag) return;
    if (tags.length >= DEMAND_TAG_MAX) { alert(`タグは${DEMAND_TAG_MAX}個までです`); return; }
    if (!tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  const handleReview = () => {
    if (!user) { alert("ログインしてください"); router.push("/login"); return; }
    if (!title.trim()) { alert("何が欲しいかを入力してください"); return; }
    if (budget === "") { alert("いくらまで出せるかを入力してください"); return; }
    const n = Number(budget);
    if (!Number.isInteger(n) || n < 0 || n > 50000) { alert("金額は0円〜50,000円の範囲で入力してください"); return; }
    if (!deadline) { alert("いつまでに欲しいかを、月と日の数字で入力してください"); return; }
    if (deadline < today || deadline > maxDeadline) { alert("期限は今日から1年以内の日付にしてください"); return; }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!deadline) return;
    setSaving(true);
    const error = await onSave({ title: title.trim(), budget: Number(budget), deadline, tags, note: note.trim() || null });
    setSaving(false);
    if (error) alert(error);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-md mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-orange-700 font-bold mb-6 flex items-center gap-1 hover:text-orange-800 transition-colors">
          <span aria-hidden>←</span> 戻る
        </button>
        <h2 className="text-2xl font-bold mb-1">{heading}</h2>
        <p className="text-xs text-stone-500 mb-6">{description}</p>

        <div className="flex flex-col gap-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
          <div>
            <label className="block text-sm font-bold mb-2">何が欲しい？ <span className="text-red-500">*</span></label>
            <input
              type="text"
              autoComplete="off"
              maxLength={DEMAND_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：線形代数の教科書"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm"
            />
            <p className="text-xs text-stone-400 text-right mt-1">{title.length}/{DEMAND_TITLE_MAX}</p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">いくらまで出せる？ <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-500">¥</span>
              <input
                type="number"
                min="0"
                max="50000"
                autoComplete="off"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace("-", ""))}
                placeholder="0"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="text-xs text-stone-400 mt-1">無料でゆずってほしい場合は 0 と入力してください</p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">いつまでに欲しい？ <span className="text-red-500">*</span></label>
            <div className="flex bg-stone-100 rounded-full p-1 mb-3" role="tablist">
              {([["date", "日付を指定"], ["forever", "ずっと（1年以内）"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={deadlineMode === mode}
                  onClick={() => setDeadlineMode(mode)}
                  className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors ${
                    deadlineMode === mode ? "bg-white text-orange-700 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {deadlineMode === "date" ? (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={month}
                  onChange={(e) => setMonth(e.target.value.replace(/\D/g, ""))}
                  placeholder="12"
                  aria-label="月"
                  className="w-16 border border-stone-200 rounded-xl px-3 py-3 outline-none focus:border-orange-600 transition-colors text-center"
                />
                <span>月</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={day}
                  onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))}
                  placeholder="25"
                  aria-label="日"
                  className="w-16 border border-stone-200 rounded-xl px-3 py-3 outline-none focus:border-orange-600 transition-colors text-center"
                />
                <span>日まで</span>
              </div>
            ) : (
              <p className="text-sm text-stone-600">期限を決めずに、1年間載せておきます。</p>
            )}
            <p className={`text-xs mt-2 ${deadline || deadlineMode === "forever" ? "text-stone-500" : "text-stone-400"}`}>
              {deadline
                ? `${deadline.replaceAll("-", "/")}まで（${formatDeadline(deadline).replace(/^.*（|）$/g, "")}）。この日を過ぎると表示されなくなります`
                : month && day
                  ? "その日付はありません"
                  : "今日以降の日付を入れてください。過ぎた日付は来年になります"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">タグ</label>
            <p className="text-xs text-stone-400 mb-2">入力してEnterで追加（{DEMAND_TAG_MAX}個まで）。出品された商品との一致に使われます</p>
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-orange-50 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    #{tag}
                    <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-orange-400 hover:text-orange-700" aria-label={`#${tag}を削除`}>
                      <IconX size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              autoComplete="off"
              maxLength={20}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
              }}
              onBlur={addTag}
              placeholder="例：教科書 (Enterで追加)"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-600 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">備考（任意）</label>
            <textarea
              maxLength={DEMAND_NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="版・サイズ・色・状態の希望など"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-orange-600 transition-colors text-sm h-24 resize-none"
            />
            <p className="text-xs text-stone-400 text-right mt-1">{note.length}/{DEMAND_NOTE_MAX}</p>
          </div>

          <button onClick={handleReview} className="w-full bg-orange-700 text-white py-4 rounded-full font-bold text-lg hover:bg-orange-800 transition-colors shadow-sm">
            {submitLabel}
          </button>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setShowConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold text-orange-700 mb-4 text-center">{confirmMessage}</p>
            <p className="text-lg font-extrabold text-stone-800 break-all mb-1">{title.trim()}</p>
            <p className="text-orange-700 font-extrabold">{formatBudget(Number(budget))}</p>
            <p className="text-xs text-stone-500 mb-2">{deadline && formatDeadline(deadline)}</p>
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>
            )}
            {note.trim() && <p className="text-sm text-stone-600 whitespace-pre-wrap break-all mb-2">{note.trim()}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                className="flex-1 border border-stone-300 text-stone-600 py-3 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                戻って編集する
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-orange-700 text-white py-3 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
              >
                {saving ? "保存中..." : "この内容で保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
