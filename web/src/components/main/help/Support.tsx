"use client";

import { ArrowLeft, Bell, CalendarDays, CreditCard, Megaphone, MessageSquareText, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink, IconButton, Panel, Tag, type Tone } from "@/components/app/kit";
import { Field, fieldCls } from "@/components/app/Sheet";
import { useDismiss } from "@/components/clinic/dismiss";
import { Notice } from "@/components/Page";
import { when } from "@/lib/format";
import { useMe, useRequireMe } from "@/lib/me";
import { ARTICLES, getTicket, listTickets, raiseTicket, reopenTicket, replyTicket, searchArticles, TICKET_STATUS, TOPICS, type Ticket, type Topic } from "@/sample/help";
import { listNotifications, markRead, type Kind, type Notification } from "@/sample/notifications";

const ICON: Record<Kind, typeof Bell> = { booking: CalendarDays, reminder: CalendarDays, edge: Sparkles, payment: CreditCard, security: ShieldCheck, post: Megaphone };
/** a few demo events happen on a timer, so the bell checks again now and then */
const REFRESH_MS = 10_000;
const CHANGED = "fmd:notifications";

function useNotifications() {
  const me = useMe();
  const [list, setList] = useState<Notification[] | null>(null);
  const userId = me?.id;
  const signedUp = me?.created_at;
  const load = useCallback(() => {
    if (userId && signedUp) listNotifications(userId, signedUp).then(setList);
  }, [userId, signedUp]);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    window.addEventListener(CHANGED, load); // the bell and the page stay in step
    return () => (clearInterval(t), window.removeEventListener(CHANGED, load));
  }, [load]);
  const read = async (ids: string[]) => {
    if (userId) await markRead(userId, ids);
    window.dispatchEvent(new Event(CHANGED));
  };
  return { me, list, read };
}

function Item({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const Icon = ICON[n.kind];
  return (
    <Link href={n.href} onClick={onOpen} className={`flex gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-glass)] ${n.read ? "" : "bg-[var(--accent-soft)]"}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-2" strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
          {n.title}
          {!n.read && <span className="sr-only">(unread)</span>}
        </span>
        <span className="block text-[13px] text-ink-2">{n.body}</span>
        <span className="block text-[12px] text-ink-3">{when(Date.parse(n.at))}</span>
      </span>
    </Link>
  );
}

/** The bell in the app shell: unread count and the latest few. */
export function NotificationsBell() {
  const { me, list, read } = useNotifications();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box, btn);
  if (!me || !list) return null;
  const unread = list.filter((n) => !n.read).length;
  return (
    <div className="relative">
      <IconButton ref={btn} label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="size-[18px]" strokeWidth={1.5} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-[var(--button-primary-fg)]">{unread > 9 ? "9+" : unread}</span>}
      </IconButton>
      {open && (
        <div ref={box} className="app-panel app-solid absolute right-0 top-[calc(100%+8px)] z-50 grid w-[340px] max-w-[calc(100vw-24px)] gap-1 p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-[14.5px] font-medium text-ink">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => read(list.map((n) => n.id))} className="text-[12.5px] text-ink-3 hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          {list.slice(0, 5).map((n) => (
            <Item key={n.id} n={n} onOpen={() => (read([n.id]), close())} />
          ))}
          <Link href="/notifications" onClick={close} className="px-3 py-2 text-[13.5px] font-medium text-ink hover:underline">
            See all
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------------- /notifications ---------------- */

export function NotificationsPage() {
  useRequireMe();
  const { list, read } = useNotifications();
  if (!list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const unread = list.filter((n) => !n.read).length;
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
          Notifications <Tag tone="muted">Demo</Tag>
        </h1>
        {unread > 0 && (
          <Button variant="secondary" size="sm" onClick={() => read(list.map((n) => n.id))}>
            Mark all read
          </Button>
        )}
      </div>
      <Panel className="grid gap-1 p-2">
        {list.length ? list.map((n) => <Item key={n.id} n={n} onOpen={() => read([n.id])} />) : <p className="p-4 text-[14.5px] text-ink-3">Nothing yet.</p>}
      </Panel>
      <p className="text-[13px] text-ink-3">
        Choose how these reach you (SMS, WhatsApp, email or app) in{" "}
        <Link href="/account/privacy" className="font-medium text-ink underline underline-offset-4">
          Privacy and data
        </Link>
        . Notifications never include health details.
      </p>
    </div>
  );
}

/* ---------------- /help ---------------- */

export function HelpPage() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const topic = params.get("topic") ?? "";
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const results = searchArticles(q, topic || undefined);
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(p.size ? `/help?${p}` : "/help", { scroll: false });
  };
  const submit = (e: FormEvent) => (e.preventDefault(), set("q", text.trim()));
  return (
    <div className="mx-auto grid w-full max-w-[860px] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[24px] font-medium text-ink">Help</h1>
        {me && (
          <ButtonLink href="/help/tickets" variant="secondary" size="sm">
            Your questions to support
          </ButtonLink>
        )}
      </div>
      <form onSubmit={submit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
        <input className={`${fieldCls} pl-10`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search help, e.g. refund, share records" aria-label="Search help" />
      </form>
      <div role="group" aria-label="Topics" className="flex flex-wrap gap-2">
        {[["", "All topics"], ...Object.entries(TOPICS)].map(([k, v]) => (
          <button key={k} type="button" aria-pressed={topic === k} onClick={() => set("topic", k)} className={`rounded-full border px-3.5 py-1.5 text-[13.5px] ${topic === k ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:text-ink"}`}>
            {v}
          </button>
        ))}
      </div>
      {results.length ? (
        <ul className="grid gap-2">
          {results.map((a) => (
            <li key={a.slug}>
              <Link href={`/help/${a.slug}`} className="app-panel grid gap-0.5 p-4 hover:border-line-strong">
                <span className="text-[15px] font-medium text-ink">{a.title}</span>
                <span className="text-[13px] text-ink-3">{TOPICS[a.topic]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Panel className="p-5 text-[14.5px] text-ink-2">No articles match. Try other words, or ask us below.</Panel>
      )}
      <Panel className="flex flex-wrap items-center gap-3 p-5">
        <MessageSquareText className="size-5 text-ink-3" strokeWidth={1.5} />
        <p className="flex-1 text-[14.5px] text-ink-2">Can&apos;t find an answer? Write to FMD support. We reply on working days.</p>
        <ButtonLink href={`/help/contact${topic ? `?topic=${topic}` : ""}`}>Contact support</ButtonLink>
      </Panel>
    </div>
  );
}

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">That article doesn&apos;t exist</h1>
        <ButtonLink href="/help" variant="secondary">
          Help
        </ButtonLink>
      </Panel>
    );
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <Link href={`/help?topic=${a.topic}`} className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> {TOPICS[a.topic]}
      </Link>
      <h1 className="text-[22px] font-medium text-ink">{a.title}</h1>
      <Panel className="grid gap-3 p-5 sm:p-6">
        {a.body.map((p) => (
          <p key={p} className="text-[15px] leading-relaxed text-ink-2">
            {p}
          </p>
        ))}
      </Panel>
      <p className="text-[14px] text-ink-2">
        Still stuck?{" "}
        <Link href={`/help/contact?topic=${a.topic}&about=${a.slug}`} className="font-medium text-ink underline underline-offset-4">
          Contact support
        </Link>
      </p>
    </div>
  );
}

/* ---------------- /help/contact ---------------- */

export function ContactPage() {
  const me = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const about = params.get("about");
  const [f, setF] = useState({ topic: (params.get("topic") as Topic | null) ?? "", subject: "", body: "" });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!me) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const t = await raiseTicket(me.id, { ...f, context: about, attachment: file && { name: file.name, type: file.type, size: file.size } });
      router.push(`/help/tickets/${t.id}`);
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <Link href="/help" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Help
      </Link>
      <h1 className="text-[24px] font-medium text-ink">Contact support</h1>
      <Notice kind="info">Please don&apos;t include health details or other people&apos;s information. Support doesn&apos;t need them to help you.</Notice>
      <Panel className="p-5 sm:p-6">
        <form onSubmit={send} className="grid gap-4">
          {err && <Notice kind="error">{err}</Notice>}
          {about && <p className="text-[13.5px] text-ink-3">About: {about}</p>}
          <Field label="What's it about?">
            <select className={fieldCls} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value as Topic })}>
              <option value="">Choose a topic</option>
              {Object.entries(TOPICS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Short title">
            <input className={fieldCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={100} />
          </Field>
          <Field label="What happened?" hint="What you were doing, what you expected, and what you saw instead.">
            <textarea className={`${fieldCls} h-32 resize-y py-2.5`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={2000} />
          </Field>
          <div className="grid gap-1.5">
            <label className="w-fit cursor-pointer rounded-full border border-line px-4 py-2 text-[13.5px] font-semibold text-ink hover:border-line-strong has-[input:focus-visible]:border-[var(--accent)]">
              {file ? `Screenshot: ${file.name}` : "Add a screenshot (optional)"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <p className="text-[12.5px] text-ink-3">Cover names, phone numbers and health details before you attach it.</p>
          </div>
          <div>
            <Button type="submit">Send to support</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

/* ---------------- /help/tickets ---------------- */

const TONE: Record<Ticket["status"], Tone> = { open: "accent", in_progress: "accent", resolved: "ok", reopened: "warn" };

export function TicketsPage() {
  const me = useRequireMe();
  const [list, setList] = useState<Ticket[] | null>(null);
  const userId = me?.id;
  useEffect(() => {
    if (userId) listTickets(userId).then(setList);
  }, [userId]);
  if (!me || !list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <Link href="/help" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Help
      </Link>
      <h1 className="text-[24px] font-medium text-ink">Your questions to support</h1>
      {list.length === 0 ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <p className="text-[15px] text-ink-2">You haven&apos;t contacted support yet.</p>
          <ButtonLink href="/help/contact">Contact support</ButtonLink>
        </Panel>
      ) : (
        <ul className="grid gap-3">
          {list.map((t) => (
            <li key={t.id}>
              <Link href={`/help/tickets/${t.id}`} className="app-panel flex flex-wrap items-center gap-3 p-5 hover:border-line-strong">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">{t.subject}</span>
                  <span className="block text-[13px] text-ink-3">
                    {t.id} · {TOPICS[t.topic]} · {when(Date.parse(t.created_at))}
                  </span>
                </span>
                <Tag tone={TONE[t.status]}>{TICKET_STATUS[t.status]}</Tag>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const me = useRequireMe();
  const [t, setT] = useState<Ticket | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const userId = me?.id;
  const load = useCallback(() => {
    if (userId) getTicket(userId, id).then(setT);
  }, [userId, id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000); // demo support replies within seconds
    return () => clearInterval(timer);
  }, [load]);
  if (!me || t === undefined) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  if (t === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that question</h1>
        <ButtonLink href="/help/tickets" variant="secondary">
          Your questions
        </ButtonLink>
      </Panel>
    );
  const resolved = t.status === "resolved";
  const send = async () => {
    setErr(null);
    try {
      setT(resolved ? await reopenTicket(me.id, t.id, text) : await replyTicket(me.id, t.id, text));
      setText("");
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <Link href="/help/tickets" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Your questions
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">{t.subject}</h1>
          <p className="text-[13px] text-ink-3">
            {t.id} · {TOPICS[t.topic]}
            {t.context && ` · about ${t.context}`}
            {t.attachment && ` · screenshot ${t.attachment}`}
          </p>
        </div>
        <Tag tone={TONE[t.status]}>{TICKET_STATUS[t.status]}</Tag>
      </div>
      <Panel className="grid gap-3 p-5 sm:p-6">
        <ol className="grid gap-3">
          {t.messages.map((m, i) => (
            <li key={i} className={`grid max-w-[85%] gap-0.5 ${m.from === "you" ? "ml-auto justify-items-end" : ""}`}>
              <p className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-[14.5px] text-ink ${m.from === "you" ? "bg-[var(--accent-soft)]" : "border border-line"}`}>{m.text}</p>
              <p className="text-[12px] text-ink-3">
                {m.from === "you" ? "You" : "FMD support"} · {when(Date.parse(m.at))}
              </p>
            </li>
          ))}
        </ol>
        {err && <Notice kind="error">{err}</Notice>}
        <div className="grid gap-2">
          <textarea className={`${fieldCls} h-20 resize-y py-2.5`} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label={resolved ? "What's still wrong?" : "Your reply"} placeholder={resolved ? "Still not sorted? Tell us what you see" : "Write a reply"} />
          <div>
            <Button size="sm" onClick={send}>
              {resolved ? "Reopen" : "Send"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
