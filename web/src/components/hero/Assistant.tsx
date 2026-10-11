"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDiscovery } from "../discovery";

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent("fmd:open-ai", { detail: prompt }));
}

type Msg = { role: "user" | "ai"; text: string; action?: { label: string; specialty: string } };

/** Canned demo replies — the real assistant is educational and never acts on its own. */
function reply(q: string): Msg {
  const s = q.toLowerCase();
  if (/(cold|sensitiv|pain|hurt|ache)/.test(s))
    return {
      role: "ai",
      text: "Sharp sensitivity to cold is often linked to exposed dentine, worn enamel or a cavity — but only an examination can tell. If the pain lingers, wakes you at night or comes with swelling, please see a dentist soon. I can show endodontists near you; you choose whether to book.",
      action: { label: "Show endodontists nearby", specialty: "Endodontist" },
    };
  if (/(implant|missing)/.test(s))
    return {
      role: "ai",
      text: "An implant replaces a tooth root with a titanium post, followed by a crown once the bone has healed — usually a staged process over a few months. Suitability depends on bone, gum health and medical history, which your dentist will assess.",
      action: { label: "See implantologists", specialty: "Implantologist" },
    };
  if (/(brace|align|crooked)/.test(s))
    return {
      role: "ai",
      text: "Braces and clear aligners both move teeth gradually; the right option depends on the complexity of your case. An orthodontist can explain timelines and costs after an assessment.",
      action: { label: "See orthodontists", specialty: "Orthodontist" },
    };
  if (/prepare|appointment/.test(s))
    return {
      role: "ai",
      text: "Before your visit: note when symptoms started, list medicines and allergies, and bring any previous X-rays — you can keep these in your FMD records and choose to share them with the clinic.",
    };
  return {
    role: "ai",
    text: "Tell me what you're noticing — where it hurts, for how long, and what makes it better or worse. I'll explain what it might relate to in plain language and help you find the right kind of dentist.",
    action: { label: "Find a general dentist", specialty: "General Dentist" },
  };
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const { setSpecialty } = useDiscovery();
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, reply(text)]);
    }, 900);
  };

  useEffect(() => {
    const on = (e: Event) => {
      setOpen(true);
      const p = (e as CustomEvent<string | undefined>).detail;
      if (p) send(p);
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
            className="glass absolute inset-y-2 right-2 flex w-[min(440px,calc(100%-16px))] flex-col rounded-[28px]"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="icon-tile size-9">
                <Sparkles className="size-4" strokeWidth={1.4} />
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-medium text-ink">FMD AI</p>
                <p className="text-[11.5px] text-ink-4">Educational guidance · English, हिन्दी, ಕನ್ನಡ, తెలుగు, தமிழ்</p>
              </div>
              <button aria-label="Close assistant" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </header>

            <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {msgs.length === 0 && (
                <div className="pt-6">
                  <p className="text-[22px] font-light leading-snug tracking-[-0.02em] text-ink">How can I help with your dental care today?</p>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {["My tooth hurts with cold drinks", "How do implants work?", "Braces or aligners?", "Prepare for appointment"].map((s) => (
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
                    <div>
                      <p className="text-[13.5px] leading-relaxed text-ink-2">{m.text}</p>
                      {m.action && (
                        <button
                          onClick={() => {
                            setSpecialty(m.action!.specialty);
                            setOpen(false);
                            document.getElementById("dentists")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="btn-ghost group mt-3 h-9 px-4 text-[12.5px]"
                        >
                          {m.action.label}
                          <ArrowRight className="arrow-nudge size-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              {typing && (
                <div className="flex gap-1 py-2" aria-label="FMD AI is typing">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-1.5 rounded-full bg-[var(--text-muted)]"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-line p-3">
              <p className="mb-2.5 flex items-start gap-2 px-2 text-[11px] leading-snug text-ink-4">
                <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
                FMD AI explains and suggests — it never books, messages clinics or pays on your behalf. You confirm every step.
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
                  placeholder="Describe a symptom or ask a question…"
                  aria-label="Message FMD AI"
                  className="h-9 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
                />
                <button aria-label="Send" className="btn-primary size-9" disabled={!input.trim()}>
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
