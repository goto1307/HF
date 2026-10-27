"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import DemandTutorial from "@/components/DemandTutorial";
import { IconSearch, IconX } from "@/components/icons";
import { loginPath } from "@/lib/nav";
import { toast } from "@/lib/toast";

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

// 自分の欲しい！(登録したもの・僕も！を押したもの)の、自分から見た状態
function myStatusLabel(d: MyDemand) {
  if (d.status !== "open") return STATUS_LABEL[d.status];
  if (d.my_done) return "自分は買えた！";
  if (!isActiveDemand(d)) return "期限切れ";
  return "受付中";
}

function DemandsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showMine = searchParams.get("mine") === "1";
  // 詳細ポップアップは URL の ?id= で開く(吹き出しや通知から直接開けるように)
  const detailId = Number(searchParams.get("id")) || null;

  const [demands, setDemands] = useState<Demand[]>([]);
  const [mine, setMine] = useState<MyDemand[]>([]);
  const [votes, setVotes] = useState<Record<number, DemandVote>>({});
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [busy, setBusy] = useState(false);
  const [votingId, setVotingId] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<Demand | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  // 一覧と僕も！の人数は未ログインでも読める(migration PART AI)。自分の欲しい！はログイン時のみ
  const load = useCallback(async (loggedIn: boolean) => {
    const [{ data: openData }, { data: mineData }, { data: voteData }] = await Promise.all([
      supabase
        .from("demand")
        .select(DEMAND_COLUMNS)
        .eq("status", "open")
        .gte("deadline", jstToday())
        .order("created_at", { ascending: false }),
      loggedIn ? supabase.rpc("my_demands") : Promise.resolve({ data: [] }),
      supabase.rpc("demand_vote_summary"),
    ]);
    setDemands((openData ?? []) as Demand[]);
    setMine((mineData ?? []) as MyDemand[]);
    setVotes(Object.fromEntries(((voteData ?? []) as DemandVote[]).map((v) => [v.demand_id, v])));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const run = async () => { await load(!!user); };
    run();
  }, [authLoading, user, load]);

  const mineById = useMemo(() => new Map(mine.map((d) => [d.id, d])), [mine]);
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
      if (sort === "wanted") return wantCount(votes[b.id]) - wantCount(votes[a.id]);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const detail: Demand | null = detailId ? mineById.get(detailId) ?? demands.find((d) => d.id === detailId) ?? null : null;
  const myDetail = detail ? mineById.get(detail.id) ?? null : null;

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

  // 未ログインで操作しようとしたらログインへ
  const requireLogin = () => {
    if (user) return false;
    if (confirm("この操作にはログインが必要です。ログインページへ移動しますか？")) router.push(loginPath());
    return true;
  };
  const loginOr = (href: string) => (user ? href : loginPath(href));

  const toggleVote = async (id: number) => {
    if (requireLogin()) return;
    setVotingId(id);
    const { error } = await supabase.rpc("toggle_demand_vote", { p_demand_id: id });
    if (error) { setVotingId(null); toast(`僕も！に失敗しました: ${error.message}`); return; }
    await load(true); // 自分の欲しい！にも出入りするので取り直す
    setVotingId(null);
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    if (!reportReason.trim()) { toast("通報理由を入力してください"); return; }
    setReporting(true);
    const { error } = await supabase.rpc("report_demand", { p_demand_id: reportTarget.id, p_reason: reportReason.trim() });
    setReporting(false);
    if (error) { toast(error.message.includes("1分に1回") ? error.message : `通報に失敗しました: ${error.message}`); return; }
    toast("通報しました。ご協力ありがとうございます。");
    setReportTarget(null);
    setReportReason("");
  };

  const closeDemand = async (d: MyDemand, status: "fulfilled" | "withdrawn") => {
    const others = d.wanters - 1;
    const message = status === "withdrawn"
      ? `「${d.title}」を取り下げますか？みんなの欲しい！には表示されなくなります。${others > 0 ? `僕も！を押した${others}人にもお知らせします。` : ""}`
      : others > 0
        ? `「${d.title}」を買えた！にしますか？まだ欲しい人が${others}人いるので、その人たちが買えるまで一覧には残ります。`
        : `「${d.title}」を買えた！にしますか？みんなの欲しい！には表示されなくなります。`;
    if (!confirm(message)) return;
    setBusy(true);
    const { error } = await supabase.rpc("close_my_demand", { p_demand_id: d.id, p_status: status });
    if (error) { setBusy(false); toast(`変更に失敗しました: ${error.message}`); return; }
    await load(true);
    setBusy(false);
  };

  const renderVoteButton = (id: number, large = false) => {
    const v = votes[id];
    const size = large ? "flex-1 text-sm py-2.5" : "flex-1 text-xs py-2";
    if (v?.my_done) {
      return (
        <span className={`font-bold rounded-full border text-center bg-stone-100 text-stone-500 border-stone-200 ${size}`}>買えた！</span>
      );
    }
    const voted = v?.voted ?? false;
    return (
      <button
        onClick={() => toggleVote(id)}
        disabled={votingId === id}
        aria-pressed={voted}
        className={`font-bold rounded-full border transition-colors disabled:opacity-50 ${size} ${
          voted ? "bg-orange-100 text-orange-800 border-orange-300" : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"
        }`}
      >
        {voted ? "僕も！済み" : "僕も！"}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 pt-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-xl font-extrabold text-stone-700">みんなの欲しい！</h2>
          <DemandTutorial />
        </div>
        <p className="text-xs sm:text-sm text-stone-500 mb-4">
          北大生が今欲しがっているもの。手元にあれば出品してみよう。出品すると、欲しい！を登録した人に知らせることができます。
        </p>
        {!authLoading && !user && (
          <p className="text-xs sm:text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 mb-4">
            <Link href={loginPath("/demands")} className="font-bold underline">ログイン</Link>
            すると、欲しい！の登録・僕も！・応える（出品）ができます。まだの人は
            <Link href="/join" className="font-bold underline">新規登録</Link>
            へ。
          </p>
        )}

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
              type="number" inputMode="numeric"
              min="0"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value.replace("-", ""))}
              placeholder="min"
              className="w-24 border border-stone-200 rounded-full px-3 py-2 text-sm outline-none focus:border-orange-600 bg-white"
            />
            <span className="text-stone-400">-</span>
            <input
              type="number" inputMode="numeric"
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
          {user && (
          <button
            onClick={() => setShowMine(!showMine)}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
              showMine ? "bg-orange-700 text-white border-orange-700" : "bg-white text-orange-700 border-orange-200 hover:bg-orange-100"
            }`}
          >
            {showMine ? "自分の欲しい！（僕も！・過去のものも表示中）" : "自分の欲しい！"}
          </button>
          )}
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
            <Link href={loginOr("/demands/new")} className="bg-orange-700 text-white px-6 py-3 rounded-full font-bold hover:bg-orange-800 transition-colors">
              ＋ 欲しい！を登録する
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((d) => {
              const active = isActiveDemand(d);
              const my = mineById.get(d.id);
              const own = my?.is_owner ?? false;
              const dimmed = showMine && my && (!active || my.my_done);
              return (
                <div
                  key={d.id}
                  className={`relative flex flex-col border border-stone-200 rounded-2xl bg-white p-3.5 shadow-sm ${dimmed ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 min-h-[18px]">
                    {own && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700">自分</span>}
                    {showMine && my && !own && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700">僕も！</span>
                    )}
                    {showMine && my && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">{myStatusLabel(my)}</span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-stone-800 break-all line-clamp-2 mb-1">{d.title}</p>
                  <p className="text-orange-700 font-extrabold text-base tracking-tight">{formatBudget(d.budget)}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">{formatDeadline(d.deadline)}</p>
                  {d.status === "open" && (
                    <p className="text-[11px] font-bold text-stone-500 mt-1">{wantCount(votes[d.id])}人が欲しい</p>
                  )}
                  <div className="mt-auto pt-3 flex flex-col gap-1.5">
                    {/* 詳細はいちばん押されるので、カードの幅いっぱいの大きいボタンにする */}
                    <button
                      onClick={() => openDetail(d.id)}
                      className="w-full text-sm font-bold text-stone-700 bg-stone-50 border border-stone-200 rounded-full py-2.5 hover:bg-stone-100 transition-colors"
                    >
                      詳細を見る
                    </button>
                    {active && !own && (
                      <div className="flex gap-1.5">
                        {renderVoteButton(d.id)}
                        <Link
                          href={loginOr(`/sell?demand=${d.id}`)}
                          className="flex-1 text-center text-xs font-bold text-white bg-orange-700 rounded-full py-2 hover:bg-orange-800 transition-colors"
                        >
                          応える
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Link
        href={loginOr("/demands/new")}
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
                <p className="text-xs font-bold text-orange-700 mb-1">
                  欲しい！{myDetail?.is_owner ? "（自分）" : myDetail ? "（僕も！）" : ""}
                </p>
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
                  {detail.status === "open" && (
                    <div className="flex gap-3">
                      <dt className="w-24 shrink-0 text-stone-500">欲しい人</dt>
                      <dd>{wantCount(votes[detail.id])}人</dd>
                    </div>
                  )}
                  {myDetail && (
                    <div className="flex gap-3">
                      <dt className="w-24 shrink-0 text-stone-500">状態</dt>
                      <dd>{myStatusLabel(myDetail)}</dd>
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

                {myDetail?.is_owner ? (
                  myDetail.status === "open" && !myDetail.my_done && (
                    <div className="flex flex-col gap-2 mt-5">
                      <Link
                        href={`/demands/${myDetail.id}/edit`}
                        className="text-center border border-orange-200 text-orange-700 py-2.5 rounded-full text-sm font-bold hover:bg-orange-100 transition-colors"
                      >
                        {isActiveDemand(myDetail) ? "編集する（期限の延長もここから）" : "期限を延ばして再開する"}
                      </Link>
                      <div className="flex gap-2">
                        <button
                          onClick={() => closeDemand(myDetail, "withdrawn")}
                          disabled={busy}
                          className="flex-1 border border-stone-300 text-stone-600 py-2.5 rounded-full text-sm font-bold bg-white hover:bg-stone-100 transition-colors disabled:opacity-50"
                        >
                          取り下げる
                        </button>
                        <button
                          onClick={() => closeDemand(myDetail, "fulfilled")}
                          disabled={busy}
                          className="flex-1 bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors disabled:opacity-50"
                        >
                          買えた！にする
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {isActiveDemand(detail) && (
                      <div className="flex gap-2 mt-5">
                        {renderVoteButton(detail.id, true)}
                        <Link
                          href={loginOr(`/sell?demand=${detail.id}`)}
                          className="flex-1 text-center bg-orange-700 text-white py-2.5 rounded-full text-sm font-bold hover:bg-orange-800 transition-colors"
                        >
                          この欲しい！に応える
                        </Link>
                      </div>
                    )}
                    {myDetail && myDetail.status === "open" && !myDetail.my_done && (
                      <button
                        onClick={() => closeDemand(myDetail, "fulfilled")}
                        disabled={busy}
                        className="w-full mt-2 border border-orange-200 text-orange-700 py-2.5 rounded-full text-sm font-bold hover:bg-orange-100 transition-colors disabled:opacity-50"
                      >
                        自分も買えた！にする
                      </button>
                    )}
                    {isActiveDemand(detail) && (
                      <button
                        onClick={() => { if (requireLogin()) return; setReportTarget(detail); setReportReason(""); }}
                        className="block mx-auto mt-4 text-xs text-stone-400 underline hover:text-red-500 transition-colors"
                      >
                        この欲しい！を通報する
                      </button>
                    )}
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
