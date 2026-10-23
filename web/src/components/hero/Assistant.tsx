"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Copy, History, RefreshCw, ThumbsDown, ThumbsUp, Trash2, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useMe } from "@/lib/me";
import { useDiscovery } from "../discovery";
import { PHASES } from "./phases";

/**
 * Take the visitor up to the hero's own FMD AI box (the end of the hero's scroll story) and, given a question, type it
 * there and send it, as if they had. The hero picks the question up from the "fmd:hero-ask" event once the scroll has
 * arrived.
 */
export function askInHero(prompt?: string) {
  const hero = document.getElementById("top");
  const box = document.getElementById("hero-ai");
  if (!hero || !box) return;
  // the cinematic hero is pinned: its AI box is fully in once the scroll is past the "ai" phase. The still hero (reduced
  // motion) is ordinary flow: bring the box to the middle of the screen
  const pinned = hero.offsetHeight > window.innerHeight * 1.5;
  const top = pinned
    ? hero.offsetTop + (PHASES.ai[1] + 0.02) * (hero.offsetHeight - window.innerHeight)
    : box.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
  // hand the question over once the page has actually arrived (a stray "scrollend" from an earlier scroll can't be
  // trusted), and a beat later, when the box has switched on (it is inert until the hero reaches it)
  const arrived = () => setTimeout(() => window.dispatchEvent(new CustomEvent("fmd:hero-ask", { detail: prompt })), 200);
  const start = performance.now();
  const wait = () => {
    if (Math.abs(window.scrollY - top) < 2 || performance.now() - start > 3000) arrived();
    else requestAnimationFrame(wait);
  };
  window.scrollTo({ top, behavior: "smooth" });
  requestAnimationFrame(wait);
}

type Action = { type: "navigate"; label: string; target: "dentists" | "concierge" | "records" | "appointments"; specialty?: string };
type Msg = { role: "user" | "assistant"; text: string; actions?: Action[]; urgent?: boolean };
type ChatRes = { conversationId: string | null; stored: boolean; urgent: boolean; provider: { name: string; configured: boolean }; reply: { text: string; actions: Action[] } };

export type Chat = ReturnType<typeof useAssistant>;

/** FMD AI thinks this long at least before it answers (its mascot's thinking pose), however fast the answer comes */
const MIN_THINK = 4500;
/** then types the answer out, about CPS letters a second, never for more than MAX_TYPE seconds */
const CPS = 45;
const MAX_TYPE = 12;
export const typeMs = (text: string) => (text.length / Math.max(CPS, text.length / MAX_TYPE)) * 1000;

/** The conversation with FMD AI: its messages and how to add to them. The hero shows it. `typing` = it is thinking
 *  (the answer is on its way); `live` = the answer it is typing out right now. */
export function useAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [live, setLive] = useState<Msg | null>(null);
  const [err, setErr] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [stored, setStored] = useState<boolean | null>(null);
  const [devProvider, setDevProvider] = useState(false);
  // send reads the latest state through a ref so it stays stable for event listeners
  const state = useRef({ msgs, conversationId, typing });
  useEffect(() => {
    state.current = { msgs, conversationId, typing };
  });
  // bumped when the chat is closed or another one is opened: an answer still on its way to the old one is dropped
  const gen = useRef(0);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || state.current.typing) return;
    state.current.typing = true;
    const g = gen.current;
    const asked = performance.now();
    setErr("");
    setLive(null); // an answer still typing out shows in full
    setMsgs((m) => [...m, { role: "user", text }]);
    setTyping(true);
    try {
      const { msgs: prev, conversationId: cid } = state.current;
      const r = await api<ChatRes>("/api/assistant", {
        method: "POST",
        body: { message: text, conversationId: cid, history: prev.slice(-10).map(({ role, text }) => ({ role, text })) },
      });
      await new Promise((done) => setTimeout(done, MIN_THINK - (performance.now() - asked)));
      if (g !== gen.current) return;
      setConversationId(r.conversationId);
      setStored(r.stored);
      setDevProvider(!r.provider.configured);
      const reply: Msg = { role: "assistant", text: r.reply.text, actions: r.reply.actions, urgent: r.urgent };
      setMsgs((m) => [...m, reply]);
      setLive(reply);
      setTimeout(() => setLive((l) => (l === reply ? null : l)), typeMs(reply.text));
    } catch (e) {
      if (g === gen.current) setErr((e as Error).message);
    } finally {
      if (g === gen.current) setTyping(false);
    }
  }, []);

  const load = (id: string | null, messages: Msg[]) => {
    gen.current += 1;
    setTyping(false);
    setLive(null);
    setConversationId(id);
    setMsgs(messages);
    setStored(id ? true : null);
    setErr("");
  };

  return { msgs, typing, live, err, stored, devProvider, send, load };
}

// an answer builds in piece by piece: each paragraph, then its links, then its tools, rising out of a blur
const answer: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const piece: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/** The conversation itself, newest message at the bottom, right above the hero's question box. */
export function ChatThread({ chat }: { chat: Chat }) {
  const [showHistory, setShowHistory] = useState(false);
  const { setSpecialty } = useDiscovery();
  const router = useRouter();
  const me = useMe();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat.msgs, chat.typing]);
  // as an answer types out, keep its newest line in view (unless the visitor has scrolled up to read)
  useEffect(() => {
    const s = scroller.current;
    if (!s || !content.current) return;
    const ro = new ResizeObserver(() => {
      if (s.scrollHeight - s.scrollTop - s.clientHeight < 160) s.scrollTop = s.scrollHeight;
    });
    ro.observe(content.current);
    return () => ro.disconnect();
  }, [showHistory]);

  /** Actions only navigate. The patient does everything else themselves. */
  const go = (a: Action) => {
    if (a.target === "dentists") {
      if (a.specialty) setSpecialty(a.specialty);
      document.getElementById("dentists")?.scrollIntoView({ behavior: "smooth" });
    } else if (a.target === "concierge") document.getElementById("concierge")?.scrollIntoView({ behavior: "smooth" });
    else router.push(`/${a.target}`);
  };

  const status =
    chat.stored === true ? "Saved to your history" : chat.stored === false ? (me ? "Not saved · turn on history in your account" : "Not saved") : "Educational guidance";

  return (
    <div
      // room left for the question box (and the mascot beside it, a little taller), the suggestions and the note below
      // it (they wrap to more rows on phones)
      className="flex h-[clamp(200px,calc(100svh-564px),600px)] w-full flex-col overflow-hidden text-left sm:h-[clamp(220px,calc(100svh-494px),640px)]"
    >
      <header className="flex items-center gap-3 px-2">
        <p className="flex-1 text-[11.5px] text-ink-4">
          FMD AI · {status}
          {chat.devProvider && " · Development assistant: rule-based answers"}
        </p>
        {me?.consents.ai_history && (
          <button aria-label="Conversation history" aria-pressed={showHistory} onClick={() => setShowHistory((s) => !s)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
            <History className="size-4" strokeWidth={1.5} />
          </button>
        )}
        <button
          aria-label="Close chat"
          onClick={() => chat.load(null, [])}
          className="grid size-8 place-items-center rounded-full border border-transparent text-ink-3 transition-[color,border-color,transform] duration-300 hover:rotate-90 hover:border-line-strong hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </header>

      {showHistory ? (
        <HistoryList
          onOpen={(id, messages) => {
            chat.load(id, messages);
            setShowHistory(false);
          }}
        />
      ) : (
        // overscroll-contain: reading back through the chat must not scroll the page out of the hero
        // aria-busy while an answer types out: read once it is all there, not letter by letter
        <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-2 py-5" aria-live="polite" aria-busy={!!chat.live}>
          <div ref={content} className="flex flex-col gap-6">
          {chat.msgs.map((m, i) => (
            <motion.div
              key={i}
              // the question springs up from the box below; the answer builds in (see `answer`). The first one waits
              // for the box to open around it
              {...(m.role === "user"
                ? {
                    initial: { opacity: 0, x: 24, y: 16, scale: 0.9 },
                    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
                    transition: { type: "spring", stiffness: 360, damping: 26, delay: i === 0 ? 0.35 : 0 },
                  }
                : { variants: answer, initial: "hidden", animate: "show", transition: { delayChildren: i === 0 ? 0.35 : 0.05 } })}
              className={m.role === "user" ? "chat-user origin-bottom-right ml-auto max-w-[75%] rounded-xl px-4 py-3 text-[14px] leading-relaxed text-ink" : "mr-6"}
            >
              {m.role === "user" ? (
                m.text
              ) : (
                <div className={m.urgent ? "rounded-2xl border border-line-strong p-3.5" : ""}>
                  {m.urgent && (
                    <motion.p variants={piece} className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink">
                      <AlertTriangle className="size-4" strokeWidth={1.75} /> Urgent: please seek care
                    </motion.p>
                  )}
                  <Typed text={m.text} live={chat.live === m} />
                  {/* its links and tools once it has finished typing */}
                  {chat.live !== m && m.actions && m.actions.length > 0 && (
                    <motion.div variants={piece} className="mt-3 flex flex-wrap gap-2">
                      {m.actions.map((a) => (
                        <button key={a.label} onClick={() => go(a)} className="btn-ghost group h-9 px-4 text-[12.5px]">
                          {a.label}
                          <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.5} />
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {chat.live !== m && <MsgTools
                    text={m.text}
                    // asks the question that came right before it again (does nothing while an answer is on its way)
                    onRetry={() => chat.msgs[i - 1]?.role === "user" && !chat.typing && chat.send(chat.msgs[i - 1].text)}
                  />}
                </div>
              )}
            </motion.div>
          ))}
          <AnimatePresence>
            {chat.typing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="flex gap-1.5 py-2"
                role="status"
                aria-label="FMD AI is typing"
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-[var(--accent)]"
                    animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {chat.err && (
            <p role="alert" className="rounded-2xl border border-line-strong px-4 py-3 text-[13px] text-ink">
              <span className="font-medium">Error:</span> {chat.err}
            </p>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

/** An answer's paragraphs; while `live`, typed out letter by letter (over typeMs) behind a caret. */
function Typed({ text, live }: { text: string; live: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!live) return;
    const start = performance.now();
    const ms = typeMs(text);
    let id = requestAnimationFrame(function tick(now) {
      const k = Math.min(text.length, Math.ceil(((now - start) / ms) * text.length));
      setN(k);
      if (k < text.length) id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [live, text]);
  const paras = (live ? text.slice(0, n) : text).split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {paras.map((para, j) => (
        <motion.p key={j} variants={piece} className="whitespace-pre-line text-[14px] leading-relaxed text-ink">
          {para}
          {live && j === paras.length - 1 && <span aria-hidden className="type-caret" />}
        </motion.p>
      ))}
    </div>
  );
}

/** Under each answer: copy, a thumbs up or down, read it aloud, ask again. */
function MsgTools({ text, onRetry }: { text: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  // ponytail: the vote stays on screen only; post it to the API once there is an endpoint for answer feedback
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const tool = (on = false) => `grid size-7 place-items-center rounded-md transition-colors hover:text-ink ${on ? "text-ink" : "text-ink-4"}`;
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };
  return (
    <motion.div variants={piece} className="mt-2.5 flex gap-0.5">
      <button aria-label={copied ? "Copied" : "Copy answer"} onClick={copy} className={tool(copied)}>
        {copied ? <Check className="size-[15px]" strokeWidth={1.5} /> : <Copy className="size-[15px]" strokeWidth={1.5} />}
      </button>
      <button aria-label="Helpful" aria-pressed={vote === "up"} onClick={() => setVote((v) => (v === "up" ? null : "up"))} className={tool(vote === "up")}>
        <ThumbsUp className="size-[15px]" strokeWidth={1.5} />
      </button>
      <button aria-label="Not helpful" aria-pressed={vote === "down"} onClick={() => setVote((v) => (v === "down" ? null : "down"))} className={tool(vote === "down")}>
        <ThumbsDown className="size-[15px]" strokeWidth={1.5} />
      </button>
      <button aria-label="Read aloud" onClick={speak} className={tool()}>
        <Volume2 className="size-[15px]" strokeWidth={1.5} />
      </button>
      <button aria-label="Ask again" onClick={onRetry} className={tool()}>
        <RefreshCw className="size-[15px]" strokeWidth={1.5} />
      </button>
    </motion.div>
  );
}

function HistoryList({ onOpen }: { onOpen: (id: string, messages: Msg[]) => void }) {
  const [items, setItems] = useState<{ id: string; title: string; updated_at: number }[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    api<{ items: { id: string; title: string; updated_at: number }[] }>("/api/assistant/conversations")
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [version]);
  const open = async (id: string) => {
    const c = await api<{ messages: Msg[] }>(`/api/assistant/conversations/${id}`);
    onOpen(id, c.messages);
  };
  const del = async (id: string) => {
    await api(`/api/assistant/conversations/${id}`, { method: "DELETE" });
    setVersion((v) => v + 1);
  };
  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <p className="text-[12px] uppercase tracking-[0.2em] text-ink-4">Your conversations</p>
      {items?.length === 0 && <p className="mt-4 text-[13px] text-ink-4">No saved conversations.</p>}
      <ul className="mt-3 space-y-2">
        {items?.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <button onClick={() => open(c.id)} className="flex-1 truncate rounded-xl border border-line px-3 py-2.5 text-left text-[13px] text-ink-2 hover:border-line-strong">
              {c.title}
              <span className="block text-[11px] text-ink-4">{new Date(c.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            </button>
            <button aria-label={`Delete conversation ${c.title}`} onClick={() => del(c.id)} className="grid size-9 place-items-center rounded-full border border-line text-ink-3 hover:text-ink">
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
