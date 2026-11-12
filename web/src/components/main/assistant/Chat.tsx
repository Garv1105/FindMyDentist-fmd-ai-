"use client";

import {
  AlertTriangle,
  BellRing,
  CalendarCheck,
  Calculator,
  FileClock,
  History,
  IndianRupee,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
  Smile,
  Snowflake,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink, IconButton, Tag } from "@/components/app/kit";
import { Sheet } from "@/components/app/Sheet";
import Contain from "@/components/Contain";
import type { Mood } from "@/components/hero/AssistantMascot";
import { Notice } from "@/components/Page";
import { when } from "@/lib/format";
import { useMe } from "@/lib/me";
import { usePhone } from "@/lib/phone";
import { stillImg } from "@/lib/stills";
import {
  checkAttachment,
  deleteAllConversations,
  deleteConversation,
  LANGUAGES,
  listConversations,
  rate,
  send,
  type Attachment,
  type Conversation,
  type Lang,
  type Message,
} from "@/sample/assistant";
import { getConsents } from "@/sample/privacy";
import { track } from "@/lib/analytics";

// the homepage's FMD AI mascot (WebGL, so never on the server); phones play its pre-rendered loop instead
const AssistantMascot = dynamic(() => import("@/components/hero/AssistantMascot"), { ssr: false });

/** Starting points: what people most often come to ask, each opening a question in their own words. */
const STARTERS: { Icon: LucideIcon; topic: string; question: string }[] = [
  { Icon: Snowflake, topic: "Pain & sensitivity", question: "My tooth hurts when I drink something cold" },
  { Icon: Smile, topic: "Braces & aligners", question: "Braces or clear aligners: what's the difference?" },
  { Icon: CalendarCheck, topic: "Your first visit", question: "How do I prepare for my first dental visit?" },
  { Icon: IndianRupee, topic: "Costs & insurance", question: "How much might a root canal cost?" },
];

export const TOOLS: [href: string, label: string][] = [
  ["/assistant/tools/budget", "Treatment budget"],
  ["/assistant/tools/insurance", "Insurance explainer"],
  ["/assistant/tools/reminders", "Reminders"],
  ["/assistant/tools/history", "My dental history"],
];
const TOOL_ICONS: Record<string, LucideIcon> = {
  "/assistant/tools/budget": Calculator,
  "/assistant/tools/insurance": ShieldCheck,
  "/assistant/tools/reminders": BellRing,
  "/assistant/tools/history": FileClock,
};

/* the browser's own speech recognition (no FMD server involved); typed here because TypeScript's DOM types lack it */
type Recognition = {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const speechApi = () => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const GUIDE_STILL = "/models/stills/guide.webp?v=3";
const GUIDE_LOOP = "/models/loops/guide.webp?v=1";

/** FMD AI's mascot, reacting to the chat: listening while you type or speak, thinking while it answers, explaining as
 *  the answer lands. The homepage's 3D model on desktop; its pre-rendered loop on phones (no WebGL there). */
function Mascot({ mood, className }: { mood: Mood; className: string }) {
  const phone = usePhone();
  const still = (
    // eslint-disable-next-line @next/next/no-img-element -- versioned still, cached forever
    <img {...stillImg(GUIDE_STILL)} alt="" decoding="async" className="absolute inset-0 size-full object-contain object-bottom" />
  );
  return (
    <div aria-hidden className={`relative ${className}`}>
      {phone ? (
        // eslint-disable-next-line @next/next/no-img-element -- an animated WebP, already sized
        <img src={GUIDE_LOOP} alt="" decoding="async" className="absolute inset-0 size-full object-contain object-bottom" />
      ) : (
        <>
          {still}
          <Contain fallback={still}>
            <AssistantMascot mood={mood} active />
          </Contain>
        </>
      )}
    </div>
  );
}

/** /assistant: FMD AI with history, files, voice and languages. Works signed out; keeps nothing unless allowed to. */
export function AssistantPage() {
  const me = useMe();
  const [lang, setLang] = useState<Lang>("en");
  const [list, setList] = useState<Conversation[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [historyOn, setHistoryOn] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const userId = me?.id ?? null;

  const loadList = useCallback(() => {
    if (!userId) return;
    listConversations(userId).then(setList);
    getConsents(userId, new Date().toISOString()).then((c) => setHistoryOn(c.some((x) => x.purpose === "ai_history" && x.granted)));
  }, [userId]);
  useEffect(loadList, [loadList]);
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
  }, [conv?.messages.length]);
  useEffect(() => () => rec.current?.stop(), []);
  useEffect(() => {
    if (!explaining) return;
    const t = setTimeout(() => setExplaining(false), 4500);
    return () => clearTimeout(t);
  }, [explaining]);

  const mood: Mood = busy ? "thinking" : listening || text.trim() ? "listening" : explaining ? "explaining" : "idle";

  const ask = async (q: string) => {
    setErr(null);
    setBusy(true);
    try {
      const atts: Attachment[] = files.map((f) => ({ name: f.name, type: f.type, size: f.size }));
      const r = await send(userId, conv, q, lang, atts);
      track("ai_message_sent", { language: lang, has_attachment: atts.length > 0 });
      setConv(r.conversation);
      setText("");
      setFiles([]);
      setExplaining(true);
      loadList();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) ask(text);
  };
  const attach = (picked: FileList | null) => {
    const all = [...files, ...(picked ?? [])].slice(0, 3);
    const bad = all.map(checkAttachment).find(Boolean);
    setErr(bad ?? null);
    setFiles(all.filter((f) => !checkAttachment(f)));
  };
  const voice = () => {
    if (listening) return rec.current?.stop();
    const Api = speechApi();
    if (!Api) return setErr("Voice input isn't available in this browser. Type your question instead.");
    const r = new Api();
    r.lang = LANGUAGES.find((l) => l.code === lang)!.speech;
    r.interimResults = false;
    r.onresult = (e) => setText((t) => `${t ? `${t} ` : ""}${Array.from(e.results, (x) => x[0].transcript).join(" ")}`);
    r.onerror = (e) => setErr(e.error === "not-allowed" ? "Allow the microphone to talk to FMD AI, or type instead." : "Didn't catch that. Try again, or type instead.");
    r.onend = () => setListening(false);
    rec.current = r;
    setErr(null);
    setListening(true);
    r.start();
  };
  const remove = async (id: string) => {
    if (!userId) return;
    await deleteConversation(userId, id);
    if (conv?.id === id) setConv(null);
    loadList();
  };
  const feedback = async (m: Message, helpful: boolean) => {
    if (!conv) return;
    track("ai_feedback", { helpful });
    setConv(await rate(userId, conv, m.id, helpful));
  };
  const newChat = () => (setConv(null), setListOpen(false));

  // chats and tools in full: the sheet the rail's "Your chats" opens, and the menu on phones
  const side = (
    <div className="grid content-start gap-4">
      <Button onClick={newChat}>
        <Plus className="size-4" strokeWidth={1.75} /> New chat
      </Button>
      <section className="grid gap-1.5">
        <h2 className="px-1 text-[13px] uppercase tracking-[0.12em] text-ink-3">Your chats</h2>
        {!userId ? (
          <p className="px-1 text-[13.5px] text-ink-3">
            <Link href="/login?next=%2Fassistant" className="font-medium text-ink underline underline-offset-4">
              Log in
            </Link>{" "}
            to keep your chats.
          </p>
        ) : !historyOn ? (
          <p className="px-1 text-[13.5px] text-ink-3">
            Chats aren&apos;t saved. Turn on “Save my FMD AI conversations” in{" "}
            <Link href="/account/privacy" className="font-medium text-ink underline underline-offset-4">
              Privacy and data
            </Link>
            .
          </p>
        ) : list.length === 0 ? (
          <p className="px-1 text-[13.5px] text-ink-3">No saved chats yet.</p>
        ) : (
          <ul className="grid gap-0.5">
            {list.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => (setConv(c), setListOpen(false))}
                  aria-current={conv?.id === c.id ? "true" : undefined}
                  className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left ${conv?.id === c.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-glass)]"}`}
                >
                  <span className="block truncate text-[14px] text-ink">{c.title}</span>
                  <span className="block text-[12px] text-ink-3">{when(Date.parse(c.updated_at))}</span>
                </button>
                <IconButton label={`Delete chat: ${c.title}`} className="size-8" onClick={() => remove(c.id)}>
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {userId && list.length > 1 && (
          <button type="button" onClick={() => deleteAllConversations(userId).then(() => (setConv(null), loadList()))} className="px-1 text-left text-[13px] text-ink-3 hover:text-ink">
            Delete all chats
          </button>
        )}
      </section>
      <section className="grid gap-1.5">
        <h2 className="px-1 text-[13px] uppercase tracking-[0.12em] text-ink-3">Tools</h2>
        {TOOLS.map(([href, label]) => {
          const Icon = TOOL_ICONS[href];
          return (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink-2 hover:bg-[var(--surface-glass)] hover:text-ink">
              <Icon className="size-4" strokeWidth={1.5} /> {label}
            </Link>
          );
        })}
      </section>
    </div>
  );

  const railBtn = "grid size-11 place-items-center rounded-2xl text-ink-2 transition-colors hover:bg-[var(--accent-soft)] hover:text-ink";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[64px_minmax(0,1fr)]">
      {/* the slim rail: a new chat, your chats, the tools */}
      <nav aria-label="FMD AI" className="app-panel sticky top-24 hidden h-fit flex-col items-center gap-1.5 p-2 lg:flex">
        <button type="button" onClick={newChat} aria-label="New chat" title="New chat" className="grid size-11 place-items-center rounded-2xl bg-[var(--button-primary)] text-[var(--button-primary-fg)]">
          <Plus className="size-5" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => setListOpen(true)} aria-label="Your chats" title="Your chats" className={railBtn}>
          <History className="size-5" strokeWidth={1.5} />
        </button>
        <span aria-hidden className="my-1 h-px w-7 bg-[var(--border)]" />
        {TOOLS.map(([href, label]) => {
          const Icon = TOOL_ICONS[href];
          return (
            <Link key={href} href={href} aria-label={label} title={label} className={railBtn}>
              <Icon className="size-5" strokeWidth={1.5} />
            </Link>
          );
        })}
      </nav>

      <section className="ai-stage app-panel relative isolate flex min-h-[calc(100dvh-170px)] min-w-0 flex-col overflow-hidden p-0">
        {/* the homepage's horizon: a lit arc along the bottom of the stage */}
        <div aria-hidden className="ai-horizon pointer-events-none absolute inset-x-[-15%] bottom-[-62%] -z-10 h-[78%] rounded-[50%]" />

        <header className="flex items-center gap-2 px-4 py-3 sm:px-5">
          {conv && <Mascot mood={mood} className="size-11 shrink-0" />}
          <p className="mr-auto flex items-center gap-2 text-[16px] font-medium text-ink">
            FMD AI <Tag tone="muted">Demo</Tag>
          </p>
          <label className="flex items-center gap-2 text-[13px] text-ink-3">
            <span className="sr-only sm:not-sr-only">Language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="h-9 rounded-full border border-line bg-[var(--surface-glass)] px-3 text-[13.5px] text-ink">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <IconButton label="Chats and tools" className="size-9 lg:hidden" onClick={() => setListOpen(true)}>
            <History className="size-4" strokeWidth={1.75} />
          </IconButton>
        </header>

        <div ref={thread} className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6" aria-live="polite">
          {!conv ? (
            <div className="mx-auto grid max-w-[860px] justify-items-center gap-5 pb-2 pt-2 text-center sm:pt-4">
              <Mascot mood={mood} className="h-[150px] w-[150px] sm:h-[190px] sm:w-[190px]" />
              <div className="grid gap-2">
                <p className="eyebrow">FMD AI</p>
                <h1 className="text-balance text-[clamp(28px,4.2vw,46px)] font-light leading-[1.08] tracking-[-0.035em]">
                  <span className="headline-silver">Hi, I&apos;m FMD AI.</span>{" "}
                  <span style={{ color: "var(--headline-accent)" }}>How can I help with your dental care?</span>
                </h1>
                <p className="mx-auto max-w-[56ch] text-[14.5px] text-ink-3">
                  Ask in your own words. FMD AI explains and points you to the right care; it doesn&apos;t diagnose, prescribe or book anything for you.
                </p>
              </div>
              <ul className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STARTERS.map(({ Icon, topic, question }) => (
                  <li key={topic}>
                    <button
                      type="button"
                      onClick={() => ask(question)}
                      className="ai-starter group grid h-full w-full content-start gap-2.5 rounded-2xl border border-line bg-[var(--surface-glass)] p-4 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
                    >
                      <span className="grid size-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--headline-accent)]">
                        <Icon className="size-[18px]" strokeWidth={1.75} />
                      </span>
                      <span className="text-[14.5px] font-medium text-ink">{topic}</span>
                      <span className="text-[13.5px] leading-snug text-ink-3 group-hover:text-ink-2">“{question}”</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="mx-auto grid max-w-[760px] gap-6 pt-2">
              {conv.messages.map((m) => (
                <li key={m.id}>{m.role === "user" ? <UserBubble m={m} /> : <Reply m={m} onRate={(h) => feedback(m, h)} />}</li>
              ))}
              {busy && (
                <li className="flex items-center gap-2 text-[13.5px] text-ink-3">
                  <span className="ai-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  FMD AI is thinking…
                </li>
              )}
            </ol>
          )}
        </div>

        <form onSubmit={submit} className="mx-auto grid w-full max-w-[860px] gap-2 px-3 pb-4 sm:px-6 sm:pb-5">
          {err && (
            <Notice kind="error">
              {err}{" "}
              <Link href="/help/contact?topic=ai" className="font-medium underline underline-offset-4">
                Get help
              </Link>
            </Notice>
          )}
          {listening && (
            <p role="status" className="flex items-center gap-2 text-[13px] text-[var(--tone-bad)]">
              <span className="size-2 animate-pulse rounded-full bg-[var(--tone-bad)]" /> Listening… tap the microphone to stop. Your browser&apos;s speech service turns your voice into text.
            </p>
          )}
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[13px] text-ink-2">
                  {f.name}
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* the floating question bar: one glowing pill holding attach, the question, voice and send */}
          <div className="ai-composer flex items-end gap-1.5 rounded-[28px] border border-line-strong bg-[var(--surface)] p-1.5">
            <label className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-[var(--accent-soft)] hover:text-ink has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--accent)]">
              <Paperclip className="size-[18px]" strokeWidth={1.75} />
              <span className="sr-only">Attach a photo or document</span>
              <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => (attach(e.target.files), (e.target.value = ""))} />
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy) ask(text);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Describe what you're noticing…"
              aria-label="Your question"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[15.5px] text-ink outline-none placeholder:text-ink-3"
            />
            <button
              type="button"
              onClick={voice}
              aria-label={listening ? "Stop listening" : "Speak your question"}
              aria-pressed={listening}
              className={`grid size-10 shrink-0 place-items-center rounded-full hover:bg-[var(--accent-soft)] ${listening ? "text-[var(--tone-bad)]" : "text-ink-2 hover:text-ink"}`}
            >
              {listening ? <MicOff className="size-[18px]" strokeWidth={1.75} /> : <Mic className="size-[18px]" strokeWidth={1.75} />}
            </button>
            <button
              type="submit"
              disabled={busy || (!text.trim() && !files.length)}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--button-primary)] text-[var(--button-primary-fg)] transition-opacity disabled:opacity-40"
            >
              <Send className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <p className="px-2 text-center text-[12px] text-ink-3">
            {!userId ? "Not saved: log in to keep chats." : historyOn ? "Saved to your chats. You can delete them any time." : "Not saved: turn on chat history in Privacy and data."} FMD AI never books,
            messages or pays for you.
          </p>
        </form>
      </section>

      {listOpen && (
        <Sheet title="Chats and tools" onClose={() => setListOpen(false)}>
          {side}
        </Sheet>
      )}
    </div>
  );
}

function UserBubble({ m }: { m: Message }) {
  return (
    <div className="ml-auto grid max-w-[85%] justify-items-end gap-1">
      {m.text && <p className="whitespace-pre-line rounded-[20px] rounded-br-md bg-[var(--accent-soft)] px-4 py-2.5 text-[15px] text-ink">{m.text}</p>}
      {m.attachments?.map((a) => (
        <p key={a.name} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Paperclip className="size-3.5" strokeWidth={1.75} /> {a.name}
        </p>
      ))}
    </div>
  );
}

function Reply({ m, onRate }: { m: Message; onRate: (helpful: boolean) => void }) {
  return (
    <div className="grid max-w-[92%] gap-2.5">
      <p className="flex items-center gap-2 text-[12.5px] uppercase tracking-[0.12em] text-ink-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- versioned still, cached forever */}
        <img {...stillImg(GUIDE_STILL)} alt="" decoding="async" className="size-7 rounded-full bg-[var(--accent-soft)] object-contain object-bottom" />
        FMD AI
      </p>
      {m.urgent ? (
        <div role="alert" className="grid gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--tone-bad)_55%,transparent)] bg-[color-mix(in_srgb,var(--tone-bad)_8%,transparent)] p-4">
          <p className="flex items-center gap-2 text-[15.5px] font-medium text-ink">
            <AlertTriangle className="size-5 text-[var(--tone-bad)]" strokeWidth={1.75} /> This may need urgent care
          </p>
          <p className="text-[14.5px] text-ink">{m.text}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="tel:112">Call 112</ButtonLink>
            {m.actions?.map((a) => (
              <ButtonLink key={a.href} href={a.href} variant="secondary">
                {a.label}
              </ButtonLink>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{m.text}</p>
          {m.note && <p className="text-[13px] text-ink-3">{m.note}</p>}
          <div>
            <Tag tone="muted">Educational guidance, not a diagnosis</Tag>
          </div>
          {m.actions && m.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {m.actions.map((a) => (
                <ButtonLink key={a.href} href={a.href} variant="secondary" size="sm">
                  {a.label}
                </ButtonLink>
              ))}
            </div>
          )}
        </>
      )}
      <div className="flex items-center gap-1 text-ink-3">
        <span className="mr-1 text-[12.5px]">Was this helpful?</span>
        {[true, false].map((h) => (
          <button
            key={String(h)}
            type="button"
            aria-label={h ? "Helpful" : "Not helpful"}
            aria-pressed={m.helpful === h}
            onClick={() => onRate(h)}
            className={`grid size-8 place-items-center rounded-full border ${m.helpful === h ? "border-[var(--accent)] text-ink" : "border-transparent hover:text-ink"}`}
          >
            {h ? <ThumbsUp className="size-3.5" strokeWidth={1.75} /> : <ThumbsDown className="size-3.5" strokeWidth={1.75} />}
          </button>
        ))}
      </div>
    </div>
  );
}
