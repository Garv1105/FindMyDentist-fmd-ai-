"use client";

import { ArrowLeft, BadgeCheck, Bookmark, BookmarkCheck, Flag, Heart, Info, Link2, MessageCircle, Share2, ShieldCheck, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { SponsoredBadge } from "@/components/ui";
import { when } from "@/lib/format";
import { initials } from "@/lib/fmd";
import { useMe } from "@/lib/me";
import {
  addComment,
  comments as listComments,
  deleteComment,
  feed,
  getPost,
  report,
  REPORT_REASONS,
  toggleFollow,
  toggleLike,
  vote,
  type Comment,
  type FeedItem,
  type ReportReason,
  type Tab,
} from "@/sample/content";
import { toggleSaved } from "@/sample/saved";
import { track } from "@/lib/analytics";

const TABS: [Tab, string][] = [
  ["for_you", "For you"],
  ["following", "Following"],
  ["learn", "Learn"],
  ["reels", "Reels"],
];

/** Captions for a video, from text, as a data URL the <track> can load. */
const captionsUrl = (vtt: string | undefined) => (vtt ? `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}` : null);

/* ---------------- /explore ---------------- */

export function ExplorePage() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find(([t]) => t === params.get("tab"))?.[0] ?? "for_you") as Tab;
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const userId = me === undefined ? undefined : (me?.id ?? null);
  const load = useCallback(() => {
    if (userId !== undefined) feed(userId, tab).then(setItems);
  }, [userId, tab]);
  useEffect(load, [load]);
  const canPost = me?.dentist_profile?.verification_status === "verified";

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
            Explore <Tag tone="muted">Demo</Tag>
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-3">Dental know-how from dentists on FMD. Education, not a diagnosis.</p>
        </div>
        {me?.dentist_profile && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/explore/mine" variant="secondary" size="sm">
              Your posts
            </ButtonLink>
            {canPost && (
              <ButtonLink href="/explore/new" size="sm">
                Create a post
              </ButtonLink>
            )}
          </div>
        )}
      </div>
      <div role="tablist" aria-label="Feed" className="flex w-fit flex-wrap gap-1 rounded-full border border-line bg-[var(--surface-glass)] p-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => router.replace(t === "for_you" ? "/explore" : `/explore?tab=${t}`, { scroll: false })}
            className={`h-9 rounded-full px-4 text-[13.5px] font-medium ${tab === t ? "bg-[var(--accent-soft)] text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!items ? (
        <div className="app-panel h-64 animate-pulse" aria-busy />
      ) : items.length === 0 ? (
        <Panel className="grid justify-items-start gap-2 p-6">
          <p className="text-[15px] text-ink">{tab === "following" ? "You don't follow anyone yet." : "Nothing here yet."}</p>
          {tab === "following" && <p className="text-[14px] text-ink-3">Follow dentists from their posts to see what they share here.</p>}
        </Panel>
      ) : (
        <ul className="grid gap-5">
          {items.map((p) => (
            <li key={p.id}>
              <PostCard p={p} userId={me?.id ?? null} onChange={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- a post ---------------- */

export function PostCard({ p, userId, onChange, full = false }: { p: FeedItem; userId: string | null; onChange: () => void; full?: boolean }) {
  const router = useRouter();
  const [why, setWhy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const captions = captionsUrl(p.media?.captions);
  const act = async (fn: () => Promise<unknown>) => {
    if (!userId) return router.push(`/login?next=${encodeURIComponent(full ? `/explore/${p.id}` : "/explore")}`);
    setNote(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const share = async () => {
    const url = `${location.origin}/explore/${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied.");
      }
    } catch {
      // closed the share sheet: nothing to do
    }
  };
  const total = p.votes?.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <article className={`app-panel grid gap-3.5 p-5 ${p.sponsored_by ? "border-dashed !border-line-strong" : ""}`}>
      <header className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[13px] font-semibold text-ink ring-1 ring-line">{initials(p.author.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-medium text-ink">
            {p.author.kind === "dentist" && !p.author.name.startsWith("You") ? (
              <Link href={`/dentists/${p.author.id}`} className="hover:underline">
                {p.author.name}
              </Link>
            ) : (
              p.author.name
            )}
            {p.author.verified && <BadgeCheck className="size-4 text-ink-2" strokeWidth={1.75} aria-label={p.author.kind === "fmd" ? "FMD" : "Verified dentist"} />}
          </p>
          <p className="text-[12.5px] text-ink-3">
            {[p.author.specialty, p.topic, when(Date.parse(p.published_at))].filter(Boolean).join(" · ")}
          </p>
        </div>
        {p.author.kind === "dentist" && !p.author.name.startsWith("You") && (
          <Button variant="secondary" size="sm" aria-pressed={p.following} onClick={() => act(() => toggleFollow(userId, p.author.id))}>
            {p.following ? "Following" : "Follow"}
          </Button>
        )}
      </header>
      <div className="flex flex-wrap gap-1.5">
        {p.sponsored_by && <SponsoredBadge />}
        {p.is_case && (
          <Tag tone="muted">
            <ShieldCheck className="mr-1 inline size-3.5" strokeWidth={1.75} />
            Patient case · shared with consent
          </Tag>
        )}
        <Tag tone="muted">Demo</Tag>
      </div>

      {full ? <h1 className="text-[20px] font-medium text-ink">{p.title}</h1> : (
        <h2 className="text-[17px] font-medium text-ink">
          <Link href={`/explore/${p.id}`} className="hover:underline">
            {p.title}
          </Link>
        </h2>
      )}

      {p.media && p.kind === "image" && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[var(--surface-glass)]">
          <Image src={p.media.src} alt={p.media.alt} fill sizes="(min-width: 768px) 680px, 100vw" className="object-contain" />
        </div>
      )}
      {p.media && p.kind === "video" && (
        <video controls preload="metadata" playsInline className="aspect-video w-full rounded-2xl bg-black" aria-label={p.media.alt}>
          <source src={p.media.src} type="video/mp4" />
          {captions && <track kind="captions" srcLang="en" label="English" src={captions} default />}
        </video>
      )}

      <p className={`whitespace-pre-line text-[15px] leading-relaxed text-ink-2 ${full ? "" : "line-clamp-4"}`}>{p.body}</p>
      {p.source && (
        <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
          <Link2 className="size-3.5" strokeWidth={1.75} /> From {p.source.platform}, by {p.source.credit}:{" "}
          <a href={p.source.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            view the original
          </a>
        </p>
      )}

      {p.poll && (
        <div role="group" aria-label="Poll answers" className="grid gap-2">
          {p.poll.map((o, i) =>
            p.votes ? (
              <div key={o} className="relative overflow-hidden rounded-xl border border-line px-3.5 py-2.5 text-[14px]">
                <span aria-hidden className="absolute inset-y-0 left-0 bg-[var(--accent-soft)]" style={{ width: `${Math.round((p.votes[i] / total) * 100)}%` }} />
                <span className="relative flex justify-between gap-2 text-ink">
                  <span>
                    {o}
                    {p.myVote === i && " · your answer"}
                  </span>
                  <span>{Math.round((p.votes[i] / total) * 100)}%</span>
                </span>
              </div>
            ) : (
              <button key={o} type="button" onClick={() => act(() => vote(userId, p.id, i))} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-[14px] text-ink hover:border-[var(--accent)]">
                {o}
              </button>
            ),
          )}
          {p.votes && <p className="text-[12.5px] text-ink-3">{total} answers. A poll, not medical advice.</p>}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-1 border-t border-line pt-3 text-[13.5px] text-ink-2">
        <button type="button" aria-pressed={p.liked} onClick={() => (p.liked || track("post_liked", { kind: p.kind }), act(() => toggleLike(userId, p.id)))} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 hover:bg-[var(--surface-glass)]">
          <Heart className={`size-4 ${p.liked ? "fill-current text-[var(--tone-bad)]" : ""}`} strokeWidth={1.75} /> {p.likes}
          <span className="sr-only">{p.liked ? "Unlike" : "Like"}</span>
        </button>
        <Link href={`/explore/${p.id}#comments`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 hover:bg-[var(--surface-glass)]">
          <MessageCircle className="size-4" strokeWidth={1.75} /> {p.comments}
          <span className="sr-only">comments</span>
        </Link>
        <button type="button" aria-pressed={p.saved} onClick={() => act(() => toggleSaved(userId!, "post", p.id))} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 hover:bg-[var(--surface-glass)]">
          {p.saved ? <BookmarkCheck className="size-4" strokeWidth={1.75} /> : <Bookmark className="size-4" strokeWidth={1.75} />}
          {p.saved ? "Saved" : "Save"}
        </button>
        <button type="button" onClick={share} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 hover:bg-[var(--surface-glass)]">
          <Share2 className="size-4" strokeWidth={1.75} /> Share
        </button>
        <button type="button" aria-expanded={why} onClick={() => setWhy((w) => !w)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-ink-3 hover:text-ink">
          <Info className="size-4" strokeWidth={1.75} /> Why am I seeing this?
        </button>
      </footer>
      {why && p.reason && (
        <p className="rounded-xl bg-[var(--surface-glass)] px-3.5 py-2.5 text-[13.5px] text-ink-2">
          {p.reason}{" "}
          {!p.sponsored_by && userId && (
            <Link href="/account/personalisation" className="font-medium text-ink underline underline-offset-4">
              Change what you see
            </Link>
          )}
        </p>
      )}
      {note && <p role="status" className="text-[13px] text-ink-2">{note}</p>}
    </article>
  );
}

/* ---------------- /explore/[postId] ---------------- */

export function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const me = useMe();
  const [p, setP] = useState<FeedItem | null | undefined>(undefined);
  const [list, setList] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const userId = me === undefined ? undefined : (me?.id ?? null);
  const load = useCallback(() => {
    if (userId === undefined) return;
    getPost(userId, postId).then(setP);
    listComments(userId, postId).then(setList);
  }, [userId, postId]);
  useEffect(load, [load]);
  if (p === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (p === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">This post isn&apos;t available</h1>
        <ButtonLink href="/explore" variant="secondary">
          Explore
        </ButtonLink>
      </Panel>
    );
  const post = async () => {
    setErr(null);
    try {
      await addComment(userId ?? null, me?.full_name ?? "", p.id, text);
      setText("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <Link href="/explore" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Explore
      </Link>
      <PostCard p={p} userId={me?.id ?? null} onChange={load} full />
      <Panel as="section" className="grid gap-4 p-5" >
        <h2 id="comments" className="scroll-mt-28 text-[16px] font-medium text-ink">
          Comments ({list.length})
        </h2>
        {list.length === 0 && <p className="text-[14px] text-ink-3">No comments yet.</p>}
        <ul className="grid gap-3">
          {list.map((c) => (
            <li key={c.id} className="grid gap-0.5">
              <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <span className="font-medium text-ink">{c.mine ? "You" : c.author}</span>
                <span className="text-ink-3">{when(Date.parse(c.at))}</span>
                {c.mine && (
                  <button type="button" onClick={() => deleteComment(me?.id ?? null, c.id).then(load)} className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
                    <Trash2 className="size-3.5" strokeWidth={1.75} /> Delete
                  </button>
                )}
              </p>
              <p className="text-[14.5px] text-ink-2">{c.body}</p>
            </li>
          ))}
        </ul>
        {me ? (
          <div className="grid gap-2">
            {err && <Notice kind="error">{err}</Notice>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Add a comment. Please don't share personal health details." aria-label="Your comment" className={`${fieldCls} h-20 resize-y py-2.5`} />
            <div>
              <Button size="sm" onClick={post}>
                Post comment
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-ink-3">
            <Link href={`/login?next=${encodeURIComponent(`/explore/${p.id}`)}`} className="font-medium text-ink underline underline-offset-4">
              Log in
            </Link>{" "}
            to comment.
          </p>
        )}
      </Panel>
      <div>
        {reported ? (
          <p className="text-[13.5px] text-ink-2">Thanks, FMD&apos;s team will review this post.</p>
        ) : (
          <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-3 hover:text-ink">
            <Flag className="size-4" strokeWidth={1.75} /> Report this post
          </button>
        )}
      </div>
      {reporting && <ReportSheet userId={me?.id ?? null} postId={p.id} onClose={() => setReporting(false)} onDone={() => (setReporting(false), setReported(true))} />}
    </div>
  );
}

function ReportSheet({ userId, postId, onClose, onDone }: { userId: string | null; postId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    try {
      await report(userId, postId, reason, note);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Sheet title="Report this post" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[14px] text-ink-2">What&apos;s wrong with it?</legend>
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([k, v]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-[14.5px] text-ink hover:bg-[var(--surface-glass)]">
              <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} className="size-4 accent-[var(--accent)]" />
              {v}
            </label>
          ))}
        </fieldset>
        <Field label={reason === "other" ? "Tell us what's wrong" : "Anything to add? (optional)"}>
          <textarea className={`${fieldCls} h-20 resize-y py-2.5`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send}>Send report</Button>
        </div>
      </div>
    </Sheet>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel as="section" className="grid gap-3 p-5 sm:p-6">
      <h2 className="text-[16px] font-medium text-ink">{title}</h2>
      {children}
    </Panel>
  );
}
