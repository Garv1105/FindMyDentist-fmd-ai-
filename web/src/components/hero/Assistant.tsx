"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, ArrowUp, History, Plus, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, useMe } from "@/lib/me";
import { useDiscovery } from "../discovery";

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent("fmd:open-ai", { detail: prompt }));
}

type Action = { type: "navigate"; label: string; target: "dentists" | "concierge" | "records" | "appointments"; specialty?: string };
type Msg = { role: "user" | "assistant"; text: string; actions?: Action[]; urgent?: boolean };
type ChatRes = { conversationId: string | null; stored: boolean; urgent: boolean; provider: { name: string; configured: boolean }; reply: { text: string; actions: Action[] } };

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [err, setErr] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [stored, setStored] = useState<boolean | null>(null);
  const [devProvider, setDevProvider] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { setSpecialty } = useDiscovery();
  const router = useRouter();
  const me = useMe();
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // the send function reads the latest state through refs so the event listener below stays stable
  const state = useRef({ msgs, conversationId });

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    setErr("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
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
  };
  const sendRef = useRef(send);
  useEffect(() => {
    state.current = { msgs, conversationId };
    sendRef.current = send;
  });

  useEffect(() => {
    const on = (e: Event) => {
      setOpen(true);
      const p = (e as CustomEvent<string | undefined>).detail;
      if (p) sendRef.current(p);
      else window.setTimeout(() => inputRef.current?.focus(), 350);
    };
    window.addEventListener("fmd:open-ai", on);
    return () => window.removeEventListener("fmd:open-ai", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  /** Actions only navigate. The patient does everything else themselves. */
  const go = (a: Action) => {
    setOpen(false);
    if (a.target === "dentists") {
      if (a.specialty) setSpecialty(a.specialty);
      document.getElementById("dentists")?.scrollIntoView({ behavior: "smooth" });
    } else if (a.target === "concierge") document.getElementById("concierge")?.scrollIntoView({ behavior: "smooth" });
    else router.push(`/${a.target}`);
  };

  const newChat = () => {
    setMsgs([]);
    setConversationId(null);
    setErr("");
    setShowHistory(false);
  };

  const canSave = !!me?.consents.ai_history;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_55%,transparent)] backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="FMD AI assistant"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass absolute inset-y-2 right-2 flex w-[min(460px,calc(100%-16px))] flex-col rounded-[28px]"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="icon-tile size-9">
                <Sparkles className="size-4" strokeWidth={1.4} />
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-medium text-ink">FMD AI</p>
                <p className="text-[11.5px] text-ink-4">Educational guidance · You make every decision</p>
              </div>
              {canSave && (
                <button aria-label="Conversation history" aria-pressed={showHistory} onClick={() => setShowHistory((s) => !s)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
                  <History className="size-4" strokeWidth={1.5} />
                </button>
              )}
              <button aria-label="New conversation" onClick={newChat} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
                <Plus className="size-4" strokeWidth={1.5} />
              </button>
              <button aria-label="Close assistant" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </header>

            {showHistory ? (
              <HistoryList
                onOpen={(id, messages) => {
                  setConversationId(id);
                  setMsgs(messages);
                  setStored(true);
                  setShowHistory(false);
                }}
              />
            ) : (
              <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
                {msgs.length === 0 && (
                  <div className="pt-6">
                    <p className="text-[22px] font-light leading-snug tracking-[-0.02em] text-ink">How can I help with your dental care today?</p>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                      {["My tooth hurts with cold drinks", "How do implants work?", "Braces or aligners?", "Prepare for my appointment"].map((s) => (
                        <button key={s} onClick={() => send(s)} className="glass glass-interactive rounded-2xl p-3 text-left text-[12.5px] leading-snug text-ink-2">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={m.role === "user" ? "ml-10 rounded-2xl rounded-br-md bg-[var(--accent-soft)] px-4 py-3 text-[13.5px] text-ink" : "mr-4"}
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
                        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{m.text}</p>
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
                {typing && (
                  <div className="flex gap-1 py-2" role="status" aria-label="FMD AI is typing">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="size-1.5 rounded-full bg-[var(--text-muted)]" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }} />
                    ))}
                  </div>
                )}
                {err && (
                  <p role="alert" className="rounded-2xl border border-line-strong px-4 py-3 text-[13px] text-ink">
                    <span className="font-medium">Error:</span> {err}
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-line p-3">
              <p className="mb-2 flex items-start gap-2 px-2 text-[11px] leading-snug text-ink-4">
                <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
                <span>
                  FMD AI explains and suggests. It never books, messages clinics or pays on your behalf.{" "}
                  {stored === true && "This conversation is saved to your history."}
                  {stored === false && (me ? "Not saved. You can turn on history in your account." : "Not saved.")}
                  {devProvider && " Development assistant: reviewed rule-based answers, not a language model."}
                </span>
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 rounded-full border border-line bg-[var(--surface-glass)] p-1.5 pl-4 focus-within:border-line-strong"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1000}
                  placeholder="Describe a symptom or ask a question…"
                  aria-label="Message FMD AI"
                  className="h-9 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
                />
                <button aria-label="Send" className="btn-primary size-9 disabled:opacity-50" disabled={!input.trim() || typing}>
                  <ArrowUp className="size-4" strokeWidth={1.75} />
                </button>
              </form>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
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
