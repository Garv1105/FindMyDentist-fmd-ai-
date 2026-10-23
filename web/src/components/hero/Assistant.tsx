"use client";

import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, History, Sparkles, Trash2, X } from "lucide-react";
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

/** The conversation with FMD AI: its messages and how to add to them. The hero shows it. */
export function useAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [err, setErr] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [stored, setStored] = useState<boolean | null>(null);
  const [devProvider, setDevProvider] = useState(false);
  // send reads the latest state through a ref so it stays stable for event listeners
  const state = useRef({ msgs, conversationId, typing });
  useEffect(() => {
    state.current = { msgs, conversationId, typing };
  });

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || state.current.typing) return;
    state.current.typing = true;
    setErr("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setTyping(true);
    try {
      const { msgs: prev, conversationId: cid } = state.current;
      const r = await api<ChatRes>("/api/assistant", {
        method: "POST",
        body: { message: text, conversationId: cid, history: prev.slice(-10).map(({ role, text }) => ({ role, text })) },
      });
      setConversationId(r.conversationId);
      setStored(r.stored);
      setDevProvider(!r.provider.configured);
      setMsgs((m) => [...m, { role: "assistant", text: r.reply.text, actions: r.reply.actions, urgent: r.urgent }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setTyping(false);
    }
  }, []);

  const load = (id: string | null, messages: Msg[]) => {
    setConversationId(id);
    setMsgs(messages);
    setStored(id ? true : null);
    setErr("");
  };

  return { msgs, typing, err, stored, devProvider, send, load };
}

/** The conversation itself, newest message at the bottom, right above the hero's question box. */
export function ChatThread({ chat }: { chat: Chat }) {
  const [showHistory, setShowHistory] = useState(false);
  const { setSpecialty } = useDiscovery();
  const router = useRouter();
  const me = useMe();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat.msgs, chat.typing]);

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
      // room left for the question box, the suggestions and the note below it (they wrap to more rows on phones)
      className="glass-lux flex h-[clamp(220px,calc(100svh-440px),640px)] w-full flex-col overflow-hidden rounded-[30px] text-left sm:h-[clamp(240px,calc(100svh-370px),680px)]"
    >
      <header className="relative flex items-center gap-3 px-5 py-3.5 after:absolute after:inset-x-5 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.14),transparent)]">
        <span className="icon-tile size-8">
          <Sparkles className="size-3.5" strokeWidth={1.4} />
        </span>
        <div className="flex-1">
          <p className="text-[13.5px] font-medium text-ink">FMD AI</p>
          <p className="text-[11px] text-ink-4">
            {status}
            {chat.devProvider && " · Development assistant: rule-based answers"}
          </p>
        </div>
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
        <div ref={scroller} className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5" aria-live="polite">
          {chat.msgs.map((m, i) => (
            <motion.div
              key={i}
              initial={m.role === "user" ? { opacity: 0, y: 14, scale: 0.96 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              // the first question waits for the box to open around it
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i === 0 ? 0.35 : 0 }}
              className={m.role === "user" ? "origin-bottom-right ml-auto max-w-[80%] rounded-[20px] rounded-br-md border border-[rgb(var(--accent-rgb)/0.28)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.3),rgb(var(--accent-rgb)/0.1))] px-4 py-3 text-[14px] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_30px_-12px_rgb(var(--accent-rgb)/0.5)] backdrop-blur-md" : "mr-8 rounded-[20px] rounded-bl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"}
            >
              {m.role === "user" ? (
                m.text
              ) : (
                <div className={m.urgent ? "rounded-2xl border border-line-strong p-3.5" : ""}>
                  {m.urgent && (
                    <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink">
                      <AlertTriangle className="size-4" strokeWidth={1.75} /> Urgent: please seek care
                    </p>
                  )}
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{m.text}</p>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.actions.map((a) => (
                        <button key={a.label} onClick={() => go(a)} className="btn-ghost group h-9 px-4 text-[12.5px]">
                          {a.label}
                          <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.5} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
          {chat.typing && (
            <div className="flex gap-1 py-2" role="status" aria-label="FMD AI is typing">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-1.5 rounded-full bg-[var(--text-muted)]" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }} />
              ))}
            </div>
          )}
          {chat.err && (
            <p role="alert" className="rounded-2xl border border-line-strong px-4 py-3 text-[13px] text-ink">
              <span className="font-medium">Error:</span> {chat.err}
            </p>
          )}
        </div>
      )}
    </div>
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
