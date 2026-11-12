"use client";

import { Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AiMascot } from "@/components/mascot/AiMascot";
import { feelingOf, moodFor, type Feeling, type Phase } from "@/lib/expression";
import { ask, type ChatMessage } from "@/sample/manager";
import { useClinic } from "./Shell";

const STARTERS = ["How many no-shows this week?", "Revenue this month so far?", "How many recalls are overdue?", "Draft reminders for tomorrow"];

/**
 * FMD AI wherever you are in FMD Clinic: a mascot button in the corner that opens a chat about the clinic (its
 * numbers, reminders and recalls). The mascot's expression follows the meaning of the chat (lib/expression), as in
 * FMD Main. It answers from the clinic's own data; it never sends anything or gives clinical advice.
 */
export function ClinicAi() {
  const { clinic, branchId, date } = useClinic();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, busy]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => setAnswered(false), 4500);
    return () => clearTimeout(t);
  }, [answered]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), launcher.current?.focus());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const lastAi = msgs.filter((m) => m.from === "ai").at(-1);
  const typing = text.trim() !== "";
  const phase: Phase = busy ? "waiting" : typing ? "typing" : answered ? "answered" : "idle";
  const feeling: Feeling = typing ? feelingOf(text) : lastAi ? feelingOf(lastAi.text) : "calm";
  const mood = moodFor(phase, feeling);

  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { from: "you", text: q.trim(), at: "" }]);
    setText("");
    setBusy(true);
    try {
      const reply = await ask(clinic.id, q, { branchId, today: date });
      setMsgs((m) => [...m, reply]);
      setAnswered(true);
    } catch {
      setMsgs((m) => [...m, { from: "ai", text: "I couldn't answer that just now. Try again in a moment.", at: "" }]);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <>
      {!open && (
        <button
          ref={launcher}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask FMD AI"
          title="Ask FMD AI"
          className="ai-launcher fixed z-40 grid size-16 place-items-center rounded-full border border-line-strong bg-[var(--surface-elevated)]"
          style={{ right: "max(20px, env(safe-area-inset-right))", bottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <AiMascot mood="idle" feeling={lastAi ? feeling : "calm"} lite className="size-12" />
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="FMD AI"
          className="app-panel app-solid ai-stage fixed z-50 flex flex-col overflow-hidden p-0 max-sm:inset-0 max-sm:rounded-none sm:bottom-5 sm:right-5 sm:h-[min(620px,calc(100dvh-40px))] sm:w-[400px]"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <AiMascot mood={mood} feeling={feeling} className="size-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15.5px] font-medium text-ink">FMD AI</p>
              <p className="truncate text-[12.5px] text-ink-3">For {clinic.name} · drafts wait for your approval</p>
            </div>
            <button
              type="button"
              aria-label="Close FMD AI"
              onClick={() => (setOpen(false), launcher.current?.focus())}
              className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-[var(--accent-soft)] hover:text-ink"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </header>

          <div ref={thread} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.length === 0 ? (
              <div className="grid gap-3">
                <p className="text-[14.5px] text-ink-2">Ask about your clinic: no-shows, revenue, new patients, recalls and chair use. I can draft reminders for you to approve.</p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-[var(--surface-glass)] px-3 py-1.5 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol className="grid gap-3">
                {msgs.map((m, i) => (
                  <li key={i} className={m.from === "you" ? "ml-auto max-w-[85%]" : "max-w-[92%]"}>
                    <p
                      className={`whitespace-pre-line rounded-[18px] px-3.5 py-2.5 text-[14px] leading-relaxed text-ink ${
                        m.from === "you" ? "rounded-br-md bg-[var(--accent-soft)]" : "rounded-bl-md border border-line bg-[var(--surface-glass)]"
                      }`}
                    >
                      {m.text}
                    </p>
                  </li>
                ))}
                {busy && (
                  <li className="flex items-center gap-2 text-[13px] text-ink-3">
                    <span className="ai-dots" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                    Looking at your clinic…
                  </li>
                )}
              </ol>
            )}
          </div>

          <form onSubmit={submit} className="grid gap-1.5 px-3 pb-3">
            <div className="ai-composer flex items-end gap-1.5 rounded-[24px] border border-line-strong bg-[var(--surface)] p-1.5">
              <textarea
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                rows={1}
                maxLength={500}
                placeholder="Ask about your clinic…"
                aria-label="Your question"
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Send"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--button-primary)] text-[var(--button-primary-fg)] transition-opacity disabled:opacity-40"
              >
                <Send className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <p className="px-2 text-center text-[11.5px] text-ink-3">FMD AI never sends messages or gives clinical advice.</p>
          </form>
        </section>
      )}
    </>
  );
}
