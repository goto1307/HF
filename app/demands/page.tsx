"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import {
  DEMAND_COLUMNS,
  formatBudget,
  formatDeadline,
  isActiveDemand,
  jstToday,
  wantCount,
  type Demand,
  type DemandVote,
  type MyDemand,
} from "@/lib/demand";
import Header from "@/components/Header";
import HokkumaMascot from "@/components/HokkumaMascot";
import { IconSearch, IconX } from "@/components/icons";

const SORTS = [
  { key: "new", label: "新着順" },
  { key: "wanted", label: "欲しい人が多い順" },
  { key: "deadline", label: "期限が近い順" },
  { key: "budget", label: "金額が高い順" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const STATUS_LABEL: Record<Demand["status"], string> = {
  open: "受付中",
  fulfilled: "買えた！",
  withdrawn: "取り下げ",
  removed: "運営により削除",
};

function DemandsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showMine = searchParams.get("mine") === "1";
  const openId = Number(searchParams.get("id")) || null;

  const [demands, setDemands] = useState<Demand[]>([]);
  const [mine, setMine] = useState<MyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [closing, setClosing] = useState(false);
  const [votes, setVotes] = useState<Record<number, DemandVote>>({});
  const [votingId, setVotingId] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<Demand | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  // 詳細ポップアップは URL の ?id= で開く(吹き出しから直接開けるように)
  const detailId = openId;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: openData }, { data: mineData }, { data: voteData }] = await Promise.all([
        supabase
          .from("demand")
          .select(DEMAND_COLUMNS)
          .eq("status", "open")
          .gte("deadline", jstToday())
          .order("created_at", { ascending: false }),
        supabase.rpc("my_demands"),
        supabase.rpc("demand_vote_summary"),
      ]);
      setDemands((openData ?? []) as Demand[]);
      setMine((mineData ?? []) as MyDemand[]);
      setVotes(Object.fromEntries(((voteData ?? []) as DemandVote[]).map((v) => [v.demand_id, v])));
      setLoading(false);
    };
    load();
  }, [user]);

  const mineIds = useMemo(() => new Set(mine.map((d) => d.id)), [mine]);
  const source: Demand[] = showMine ? mine : demands;

  // よく使われているタグ(絞り込みの候補)
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of source) for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [source]);

  const visible = source
    .filter((d) => {
      if (selectedTag && !d.tags.includes(selectedTag)) return false;
      if (minBudget && d.budget < Number(minBudget)) return false;
      if (maxBudget && d.budget > Number(maxBudget)) return false;
      const q = keyword.trim().toLowerCase().replace(/^#/, "");
      if (q) {
        const titleMatch = d.title.toLowerCase().includes(q);
        const tagMatch = d.tags.some((t) => t.toLowerCase().includes(q));
        if (!titleMatch && !tagMatch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "deadline") return a.deadline.localeCompare(b.deadline);
      if (sort === "budget") return b.budget - a.budget;
      if (sort === "wanted") return (votes[b.id]?.votes ?? 0) - (votes[a.id]?.votes ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const detail = detailId ? mine.find((d) => d.id === detailId) ?? demands.find((d) => d.id === detailId) ?? null : null;
  const detailIsMine = !!detail && mineIds.has(detail.id);

  const openDetail = (id: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("id", String(id)); else params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `/demands?${qs}` : "/demands", { scroll: false });
  };

  const setShowMine = (value: boolean) => {
    router.replace(value ? "/demands?mine=1" : "/demands", { scroll: false });
    setSelectedTag(null);
  };

  const toggleVote = async (id: number) => {
    setVotingId(id);
    const { data, error } = await supabase.rpc("toggle_demand_vote", { p_demand_id: id });
    setVotingId(null);
    if (error) { alert(`僕も！に失敗しました: ${error.message}`); return; }
    const row = (data as { votes: number; voted: boolean }[] | null)?.[0];
    if (row) setVotes((prev) => ({ ...prev, [id]: { demand_id: id, ...row } }));
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    if (!reportReason.trim()) { alert("通報理由を入力してください"); return; }
    setReporting(true);
    const { error } = await supabase.rpc("report_demand", { p_demand_id: reportTarget.id, p_reason: reportReason.trim() });
    setReporting(false);
    if (error) { alert(error.message.includes("1分に1回") ? error.message : `通報に失敗しました: ${error.message}`); return; }
    alert("通報しました。ご協力ありがとうございます。");
    setReportTarget(null);
    setReportReason("");
  };

  const closeDemand = async (status: "fulfilled" | "withdrawn") => {
    if (!detail) return;
    const message = status === "fulfilled"
      ? `「${detail.title}」を買えた！にしますか？みんなの欲しい！には表示されなくなります。`
      : `「${detail.title}」を取り下げますか？みんなの欲しい！には表示されなくなります。`;
    if (!confirm(message)) return;
    setClosing(true);
    const { error } = await supabase.rpc("close_my_demand", { p_demand_id: detail.id, p_status: status });
    setClosing(false);
    if (error) { alert(`変更に失敗しました: ${error.message}`); return; }
    setMine((prev) => prev.map((d) => (d.id === detail.id ? { ...d, status } : d)));
    setDemands((prev) => prev.filter((d) => d.id !== detail.id));
    openDetail(null);
  };

  const renderVoteButton = (id: number, large = false) => {
    const voted = votes[id]?.voted ?? false;
    return (
      <button
        onClick={() => toggleVote(id)}
        disabled={votingId === id}
        aria-pressed={voted}
        className={`font-bold rounded-full border transition-colors disabled:opacity-50 ${
          large ? "flex-1 text-sm py-2.5" : "text-xs px-3 py-1"
        } ${voted ? "bg-orange-100 text-orange-800 border-orange-300" : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"}`}
      >
        {voted ? "僕も！済み" : "僕も！"}
      </button>
    );
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <HokkumaMascot size={88} className="mx-auto mb-3" />
          <p className="text-stone-500 mb-4">みんなの欲しい！は、ログインすると見られます。</p>
          <Link href="/login" className="inline-block bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors">
            ログイン
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 pt-5">
        <h2 className="text-xl font-extrabold text-stone-700 mb-1">みんなの欲しい！</h2>
        <p className="text-xs sm:text-sm text-stone-500 mb-4">
          北大生が今欲しがっているもの。手元にあれば出品してみよう。出品すると、欲しい！を登録した人に知らせることができます。
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex-1 flex items-center bg-white border border-stone-200 rounded-full px-4 py-2 focus-within:border-orange-600 transition-colors">
            <IconSearch size={16} className="text-stone-400 mr-2 shrink-0" />
            <input
              type="text"
              maxLength={100}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="商品名・タグで検索"
              className="flex-1 min-w-0 outline-none text-sm text-stone-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-500 text-sm">¥</span>
            <input
              type="number"
              min="0"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value.replace("-", ""))}
              placeholder="min"
              className="w-24 border border-stone-200 rounded-full px-3 py-2 text-sm outline-none focus:border-orange-600 bg-white"
            />
            <span className="text-stone-400">-</span>
            <input
              type="number"
              min="0"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value.replace("-", ""))}
              placeholder="max"
              className="w-24 border border-stone-200 rounded-full px-3 py-2 text-sm outline-none focus:border-orange-600 bg-white"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-stone-200 rounded-full px-3 py-2 text-sm outline-none bg-white focus:border-orange-600"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-2">
          <button
            onClick={() => setShowMine(!showMine)}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
              showMine ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-700 border-orange-200 hover:bg-orange-100"
            }`}
          >
            {showMine ? "自分の欲しい！（過去のものも表示中）" : "自分の欲しい！"}
          </button>
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                selectedTag === tag ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-600 border-orange-100 hover:bg-orange-50"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-4 pb-40">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 border border-stone-200 rounded-2xl bg-white animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <HokkumaMascot size={88} className="mb-3 opacity-90" />
            <p className="text-stone-400 mb-4">{showMine ? "まだ欲しい！を登録していません" : "条件に合う欲しい！がありません"}</p>
            <Link href="/demands/new" className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors">
              ＋ 欲しい！を登録する
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((d) => {
              const active = isActiveDemand(d);
              return (
                <div
                  key={d.id}
                  className={`relative flex flex-col border rounded-2xl bg-white p-3.5 shadow-sm ${active ? "border-stone-200" : "border-stone-200 opacity-60"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 min-h-[18px]">
                    {mineIds.has(d.id) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700">自分</span>
                    )}
                    {showMine && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                        {d.status === "open" && !active ? "期限切れ" : STATUS_LABEL[d.status]}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-stone-800 break-all line-clamp-2 mb-1">{d.title}</p>
                  <p className="text-orange-700 font-extrabold text-base tracking-tight">{formatBudget(d.budget)}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">{formatDeadline(d.deadline)}</p>
                  <p className="text-[11px] font-bold text-stone-500 mt-1">{wantCount(votes[d.id]?.votes ?? 0)}人が欲しい</p>
                  <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => openDetail(d.id)}
                      className="text-xs font-bold text-stone-600 border border-stone-200 rounded-full px-3 py-1 hover:bg-stone-100 transition-colors"
                    >
                      詳細
                    </button>
                    {active && !mineIds.has(d.id) && (
                      <>
                        {renderVoteButton(d.id)}
                        <Link
                          href={`/sell?demand=${d.id}`}
                          className="text-xs font-bold text-white bg-orange-700 rounded-full px-3 py-1 hover:bg-orange-800 transition-colors"
                        >
                          応える
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Link
        href="/demands/new"
        className="fixed bottom-6 left-6 z-10 bg-gradient-to-br from-orange-600 to-orange-700 text-white px-6 py-4 rounded-full font-bold shadow-xl ring-1 ring-white/20 text-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all"
      >
        ＋ 欲しい！
      </Link>

      {detailId && !loading && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => openDetail(null)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end -mt-2 -mr-2">
              <button onClick={() => openDetail(null)} className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="閉じる">
                <IconX size={20} />
              </button>
            </div>
            {!detail ? (
              <p className="text-center text-stone-500 text-sm py-6">この欲しい！は期限が切れたか、受付が終わりました。</p>
            ) : (
              <>
                <p className="text-xs font-bold text-orange-700 mb-1">欲しい！{detailIsMine && "（自分）"}</p>
                <p className="text-lg font-extrabold text-stone-800 break-all mb-2">{detail.title}</p>
                <dl className="text-sm flex flex-col gap-2 mb-3">
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-stone-500">出せる金額</dt>
                    <dd className="font-bold text-orange-700">{formatBudget(detail.budget)}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-stone-500">いつまでに</dt>
                    <dd>{formatDeadline(detail.deadline)}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-stone-500">欲しい人</dt>
                    <dd>{wantCount(votes[detail.id]?.votes ?? 0)}人</dd>
                  </div>
                  {detailIsMine && (
                    <div className="flex gap-3">
                      <dt className="w-24 shrink-0 text-stone-500">状態</dt>
                      <dd>{detail.status === "open" && !isActiveDemand(detail) ? "期限切れ" : STATUS_LABEL[detail.status]}</dd>
                    </div>
                  )}
                </dl>
                {detail.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {detail.tags.map((tag) => (
                      <span key={tag} className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm text-stone-600 whitespace-pre-wrap break-all">
                  {detail.note || <span className="text-stone-400">備考はありません</span>}
                </div>

                {detailIsMine ? (
                  isActiveDemand(detail) && (
                    <div className="flex gap-2 mt-5">
                      <button
                        onClick={() => closeDemand("withdrawn")}
                        disabled={closing}
                        className="flex-1 border border-stone-300 text-stone-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
                      >
                        取り下げる
                      </button>
                      <button
                        onClick={() => closeDemand("fulfilled")}
                        disabled={closing}
                        className="flex-1 bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
                      >
                        買えた！にする
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <div className="flex gap-2 mt-5">
                      {renderVoteButton(detail.id, true)}
                      <Link
                        href={`/sell?demand=${detail.id}`}
                        className="flex-1 text-center bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors"
                      >
                        この欲しい！に応える
                      </Link>
                    </div>
                    <button
                      onClick={() => { setReportTarget(detail); setReportReason(""); }}
                      className="block mx-auto mt-4 text-xs text-stone-400 underline hover:text-red-500 transition-colors"
                    >
                      この欲しい！を通報する
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {reportTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !reporting && setReportTarget(null)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm mb-1 text-center">この欲しい！を通報しますか？</p>
            <p className="text-center text-stone-500 text-sm mb-4 truncate">「{reportTarget.title}」</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              maxLength={500}
              placeholder="通報理由を入力してください"
              className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm mb-4 outline-none h-20 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportTarget(null)}
                disabled={reporting}
                className="flex-1 border border-stone-300 text-stone-600 py-2 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleReport}
                disabled={reporting}
                className="flex-1 bg-red-500 text-white py-2 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {reporting ? "送信中..." : "通報する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemandsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <DemandsContent />
    </Suspense>
  );
}
