"use client";

import { Bookmark, Flag, Heart, Info, MessageCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { REPORT_CATEGORIES } from "@/lib/catalog";
import { api, type Me } from "@/lib/me";
import { inputCls, Notice } from "../Page";
import { SponsoredBadge } from "../ui";

export type FeedItem = {
  id: string;
  kind: "education" | "post" | "poll" | "case";
  topic: string;
  title: string;
  body: string;
  author: { dentistId: string; name: string | null; photo: string | null; verified: boolean; followed: boolean } | null;
  sponsoredBy: string | null;
  publishedAt: number | null;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  poll: { options: { id: string; label: string; votes: number | null }[]; myVote: string | null; total: number | null } | null;
  reason: string;
  demo: boolean;
};

export function FeedCard({ item, me, onChange }: { item: FeedItem; me: Me | null | undefined; onChange: () => void }) {
  const [it, setIt] = useState(item);
  const [panel, setPanel] = useState<"" | "comments" | "report" | "why">("");
  const [comments, setComments] = useState<{ id: string; body: string; author: string; created_at: number }[] | null>(null);
  const [text, setText] = useState("");
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const signedIn = !!me;
  const need = () => setMsg({ kind: "error", text: "Sign in to do that." });

  const react = async (what: "like" | "save") => {
    if (!signedIn) return need();
    const r = await api<{ on: boolean }>(`/api/posts/${it.id}/react`, { method: "POST", body: { what } });
    setIt((x) => (what === "like" ? { ...x, liked: r.on, likes: x.likes + (r.on ? 1 : -1) } : { ...x, saved: r.on }));
  };
  const follow = async () => {
    if (!signedIn || !it.author) return need();
    const r = await api<{ following: boolean }>(`/api/follow/${it.author.dentistId}`, { method: "POST", body: {} });
    setIt((x) => ({ ...x, author: x.author && { ...x.author, followed: r.following } }));
    onChange();
  };
  const vote = async (optionId: string) => {
    if (!signedIn) return need();
    try {
      const poll = await api<NonNullable<FeedItem["poll"]>>(`/api/posts/${it.id}/vote`, { method: "POST", body: { optionId } });
      setIt((x) => ({ ...x, poll }));
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const openComments = async () => {
    setPanel(panel === "comments" ? "" : "comments");
    if (!comments) setComments((await api<{ items: NonNullable<typeof comments> }>(`/api/posts/${it.id}/comments`)).items);
  };
  const addComment = async () => {
    try {
      const r = await api<{ items: NonNullable<typeof comments> }>(`/api/posts/${it.id}/comments`, { method: "POST", body: { body: text } });
      setComments(r.items);
      setIt((x) => ({ ...x, comments: r.items.length }));
      setText("");
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const sendReport = async () => {
    try {
      await api("/api/reports", { method: "POST", body: { targetType: "post", targetId: it.id, category: cat, note: text } });
      setMsg({ kind: "success", text: "Thanks. Our moderators will review this." });
      setPanel("");
      setText("");
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  return (
    <article className="glass rounded-[24px] p-5 sm:p-6">
      <header className="flex flex-wrap items-center gap-2 text-[12px] text-ink-4">
        <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-3">{it.topic}</span>
        {it.kind === "case" && <span className="rounded-full border border-line px-2.5 py-0.5">Case (consented, de-identified)</span>}
        {it.sponsoredBy && <SponsoredBadge />}
        {it.demo && <span className="uppercase tracking-[0.16em]">Demo</span>}
        <button onClick={() => setPanel(panel === "why" ? "" : "why")} className="ml-auto flex items-center gap-1 hover:text-ink" aria-expanded={panel === "why"}>
          <Info className="size-3.5" strokeWidth={1.5} /> Why am I seeing this?
        </button>
      </header>
      {panel === "why" && (
        <p className="mt-2 rounded-xl border border-line px-3 py-2 text-[12px] text-ink-3">
          {it.reason}.{it.sponsoredBy ? ` Sponsored by ${it.sponsoredBy}; paid placement doesn't change the order of other posts.` : ""}{" "}
          <Link href="/explore#interests" className="underline">Edit your interests</Link>
        </p>
      )}

      <h3 className="mt-3 text-[18px] font-light leading-snug text-ink">{it.title}</h3>
      <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{it.body}</p>

      {it.poll && (
        <div className="mt-4 space-y-2" role="group" aria-label="Poll">
          {it.poll.options.map((o) => {
            const pct = it.poll!.total ? Math.round(((o.votes ?? 0) / it.poll!.total) * 100) : 0;
            return it.poll!.myVote ? (
              <div key={o.id} className="relative overflow-hidden rounded-xl border border-line px-3 py-2 text-[13px] text-ink-2">
                <div aria-hidden className="absolute inset-y-0 left-0 bg-[var(--accent-soft)]" style={{ width: `${pct}%` }} />
                <span className="relative flex justify-between">
                  <span>
                    {o.label}
                    {it.poll!.myVote === o.id && " (your vote)"}
                  </span>
                  <span>{pct}%</span>
                </span>
              </div>
            ) : (
              <button key={o.id} onClick={() => vote(o.id)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-[13px] text-ink-2 hover:border-line-strong">
                {o.label}
              </button>
            );
          })}
          {it.poll.total !== null && <p className="text-[11.5px] text-ink-4">{it.poll.total} votes · results shown after you vote</p>}
        </div>
      )}

      {it.author && (
        <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-3">
          <Link href={`/dentists/${it.author.dentistId}`} className="text-ink-2 hover:underline">
            {it.author.name}
          </Link>
          {it.author.verified && <span className="text-ink-4">· Verified dentist</span>}
          <button onClick={follow} aria-pressed={it.author.followed} className="ml-1 flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[12px] hover:text-ink">
            <UserPlus className="size-3" strokeWidth={1.5} /> {it.author.followed ? "Following" : "Follow"}
          </button>
        </div>
      )}

      <footer className="mt-4 flex items-center gap-1 border-t border-line pt-3">
        <Btn onClick={() => react("like")} pressed={it.liked} label={`Like (${it.likes})`}>
          <Heart className="size-4" strokeWidth={1.5} fill={it.liked ? "currentColor" : "none"} /> {it.likes}
        </Btn>
        <Btn onClick={openComments} pressed={panel === "comments"} label={`Comments (${it.comments})`}>
          <MessageCircle className="size-4" strokeWidth={1.5} /> {it.comments}
        </Btn>
        <Btn onClick={() => react("save")} pressed={it.saved} label={it.saved ? "Saved" : "Save"}>
          <Bookmark className="size-4" strokeWidth={1.5} fill={it.saved ? "currentColor" : "none"} />
        </Btn>
        <Btn onClick={() => (signedIn ? setPanel(panel === "report" ? "" : "report") : need())} pressed={panel === "report"} label="Report" className="ml-auto">
          <Flag className="size-4" strokeWidth={1.5} />
        </Btn>
      </footer>

      {panel === "comments" && (
        <div className="mt-3 space-y-2">
          {comments?.map((c) => (
            <p key={c.id} className="text-[13px] text-ink-2">
              <span className="text-ink">{c.author}</span> {c.body}
            </p>
          ))}
          {comments?.length === 0 && <p className="text-[12.5px] text-ink-4">No comments yet.</p>}
          {signedIn && (
            <div className="flex gap-2">
              <input aria-label="Write a comment" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment (no personal health details)" className={`${inputCls} h-10 text-[13px]`} />
              <button onClick={addComment} disabled={text.trim().length < 2} className="btn-primary h-10 shrink-0 px-4 text-[12.5px] disabled:opacity-50">
                Post
              </button>
            </div>
          )}
        </div>
      )}
      {panel === "report" && (
        <div className="mt-3 space-y-2">
          <select aria-label="Reason" value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`}>
            <option value="">Why are you reporting this?</option>
            {Object.entries(REPORT_CATEGORIES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <input aria-label="Details (optional)" value={text} onChange={(e) => setText(e.target.value)} placeholder="Details (optional)" className={`${inputCls} h-10 text-[13px]`} />
          <button onClick={sendReport} disabled={!cat} className="btn-primary h-9 px-4 text-[12.5px] disabled:opacity-50">
            Send report
          </button>
        </div>
      )}
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </article>
  );
}

function Btn({ children, onClick, pressed, label, className = "" }: { children: React.ReactNode; onClick: () => void; pressed?: boolean; label: string; className?: string }) {
  return (
    <button onClick={onClick} aria-pressed={pressed} aria-label={label} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] transition-colors ${pressed ? "text-ink" : "text-ink-3 hover:text-ink"} ${className}`}>
      {children}
    </button>
  );
}
