"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Header from "@/components/Header";

const ADMIN_EMAILS = ["debuchi.sora.b0@elms.hokudai.ac.jp", "goto.kanata.w1@elms.hokudai.ac.jp"];

type Message = {
  id: number;
  buyer_id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
};

type Item = {
  id: number;
  title: string;
  user_id: string;
  nickname: string;
};

export default function AdminItemChats() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!user && !!user.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) return;

    const fetchData = async () => {
      const { data: itemData } = await supabase
        .from("item")
        .select("id,title,user_id,nickname")
        .eq("id", params.itemId)
        .single();
      if (itemData) setItem(itemData);

      const { data: messageData } = await supabase
        .from("message")
        .select("id, buyer_id, user_id, nickname, content, created_at")
        .eq("item_id", params.itemId)
        .order("buyer_id", { ascending: true })
        .order("created_at", { ascending: true });
      if (messageData) setMessages(messageData);
      setLoading(false);
    };
    fetchData();
  }, [authLoading, user, isAdmin, router, params.itemId]);

  if (authLoading || (loading && isAdmin)) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="p-8 text-center text-stone-400">このページを見る権限がありません</div>
      </div>
    );
  }

  const threads = new Map<string, Message[]>();
  for (const m of messages) {
    const list = threads.get(m.buyer_id) ?? [];
    list.push(m);
    threads.set(m.buyer_id, list);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/admin/reports" className="text-sm font-bold text-stone-500 hover:underline">← 通報一覧へ戻る</Link>
        <h2 className="text-2xl font-bold mt-2 mb-1">{item?.title || `商品ID: ${params.itemId}`}</h2>
        <p className="text-sm text-stone-500 mb-6">
          出品者：<Link href={`/users/${item?.user_id}`} className="text-orange-700 hover:underline">{item?.nickname}</Link>
        </p>

        {threads.size === 0 ? (
          <p className="text-center text-stone-400 bg-white rounded-2xl border border-stone-200 shadow-sm py-16">メッセージはありません</p>
        ) : (
          <div className="flex flex-col gap-6">
            {[...threads.entries()].map(([buyerId, msgs]) => (
              <div key={buyerId} className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
                <p className="text-xs font-bold text-stone-500 bg-stone-50 px-4 py-2 border-b border-stone-100">
                  相手：<Link href={`/users/${buyerId}`} className="text-orange-700 hover:underline">{buyerId}</Link>
                </p>
                <div className="flex flex-col gap-3 p-4">
                  {msgs.map((m) => (
                    <div key={m.id} className={`max-w-[80%] ${m.user_id === item?.user_id ? "self-end text-right" : "self-start"}`}>
                      <p className="text-[11px] text-stone-400 mb-0.5">{m.nickname}・{new Date(m.created_at).toLocaleString()}</p>
                      <p className={`inline-block px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${m.user_id === item?.user_id ? "bg-orange-100" : "bg-stone-100"}`}>
                        {m.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
