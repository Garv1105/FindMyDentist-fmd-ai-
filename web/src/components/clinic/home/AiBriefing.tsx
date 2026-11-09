"use client";

import { ArrowRight, Mic } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Button, Panel, Tag } from "@/components/app/kit";
import { Sheet } from "@/components/app/Sheet";
import type { DemoUser } from "@/lib/demo";
import { briefingText, decideAiTask, type AiTask, type ClinicHome } from "@/sample/clinic";

const SUGGESTIONS = ["Who's due for recall?", "Summarise yesterday's collections", "Find gaps in Thursday's schedule"];

function greeting(user: DemoUser) {
  const hour = new Date(Date.now() + 5.5 * 3600_000).getUTCHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user.name.startsWith("Dr. ") ? `Dr. ${user.name.split(" ").at(-1)}` : user.name.split(" ")[0];
  return `${part}, ${name}.`;
}

/** Numbers in the briefing stand out, so the eye finds them first. */
function Emphasised({ text }: { text: string }) {
  return (
    <>
      {text.split(/((?<![A-Za-z])\d[\d,:]*(?: [a-z]+)?)/).map((part, i) =>
        i % 2 ? (
          <b key={i} className="font-semibold text-ink">
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** PRD 7.4 preview: what will happen, to whom, before anything is approved. */
function ReviewDialog({ task, onClose, onApprove }: { task: AiTask; onClose: () => void; onApprove: () => void }) {
  const p = task.preview;
  return (
    <Sheet title={task.title} onClose={onClose}>
      <p className="-mt-2 mb-1 text-[13.5px] text-ink-3">FMD Manager · {task.source.replace(/^From: /, "from ")}</p>
      {p && "recipients" in p && (
        <>
          <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.1em] text-ink-3">Recipients</p>
          <ul className="mt-1.5 space-y-1 text-[15px] text-ink-2">
            {p.recipients.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.1em] text-ink-3">Message</p>
          <p className="mt-1.5 rounded-2xl border border-line bg-[var(--surface-glass)] p-3.5 text-[15px] leading-relaxed text-ink-2">{p.message}</p>
        </>
      )}
      {p && "lines" in p && (
        <dl className="mt-4 divide-y divide-[var(--border)] text-[15px]">
          {p.lines.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 text-ink-2">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          <div className="flex justify-between py-2 font-medium text-ink">
            <dt>Total</dt>
            <dd>{p.total}</dd>
          </div>
        </dl>
      )}
      <p className="mt-4 text-[13.5px] text-ink-3">This is a preview: approving here doesn&apos;t send or order anything.</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onApprove}>Approve</Button>
      </div>
    </Sheet>
  );
}

const DONE_NOTE: Record<string, string> = {
  "t-reminders": "Sent to 3 patients (demo, nothing was sent)",
  "t-recall": "Sent to 2 patients (demo, nothing was sent)",
};

function TaskCard({ task, clinicId, onChange }: { task: AiTask; clinicId: string; onChange: (t: AiTask) => void }) {
  const [reviewing, setReviewing] = useState(false);
  const decide = async (d: "approve" | "skip" | "undo") => onChange(await decideAiTask(clinicId, task.id, d));
  const opener = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  // focus goes back to the button that opened the review, or to the card once that button is gone (after Approve)
  const restoreFocus = useCallback(() => requestAnimationFrame(() => (opener.current?.isConnected ? opener.current : card.current)?.focus()), []);
  const closeReview = useCallback(() => {
    setReviewing(false);
    restoreFocus();
  }, [restoreFocus]);
  const skipped = task.status === "skipped";
  return (
    <div ref={card} tabIndex={-1} className={`app-panel flex min-w-[272px] outline-none snap-start flex-col gap-2.5 p-4 transition-opacity lg:min-w-0 ${skipped ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium leading-snug text-ink">{task.title}</p>
        {task.status === "proposed" && task.needsApproval && <Tag tone="warn">Needs approval</Tag>}
        {task.status === "approved" && <Tag tone="ok">Approved</Tag>}
        {task.status === "done" && <Tag tone="ok">Done</Tag>}
        {skipped && <Tag tone="muted">Skipped</Tag>}
      </div>
      <p className="text-[14px] leading-relaxed text-ink-2">{task.detail}</p>
      <p className="text-[13px] text-ink-3">{task.source}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {task.status === "proposed" && task.needsApproval && (
          <>
            <Button ref={opener} size="sm" onClick={() => setReviewing(true)}>
              {task.actionLabel}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => decide("skip")}>
              Skip
            </Button>
          </>
        )}
        {task.status === "approved" && <p className="text-[13.5px] text-ink-2">{DONE_NOTE[task.id] ?? "Approved (demo)"}</p>}
        {task.status === "done" && (
          <Button size="sm" variant="secondary">
            {task.actionLabel}
          </Button>
        )}
        {skipped && (
          <Button size="sm" variant="secondary" onClick={() => decide("undo")}>
            Undo
          </Button>
        )}
      </div>
      {reviewing && (
        <ReviewDialog
          task={task}
          onClose={closeReview}
          onApprove={async () => {
            setReviewing(false);
            await decide("approve");
            restoreFocus();
          }}
        />
      )}
    </div>
  );
}

export function AiBriefing({ home, user, clinicId, onTask }: { home: ClinicHome; user: DemoUser; clinicId: string; onTask: (t: AiTask) => void }) {
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<string[]>([]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    setThread((t) => [...t, text.trim()]);
    setDraft("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };
  const generated = new Date(home.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <Panel as="section" className="overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-36 h-[320px] w-[520px] rounded-full bg-[radial-gradient(closest-side,var(--accent-glow),transparent)] opacity-60" aria-hidden />
      <p className="relative flex items-center gap-2.5 text-[13.5px] text-ink-3">
        <span className="size-7 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dbe7ff,var(--accent)_45%,#1b2c66_80%)] shadow-[0_0_18px_var(--accent-glow)]" aria-hidden />
        FMD Manager · briefing generated {generated} from the calendar, patients and billing
      </p>
      <h2 className="relative mt-3 bg-gradient-to-b from-[var(--headline-from)] to-[var(--headline-to)] bg-clip-text text-[26px] font-light tracking-[-0.03em] text-transparent sm:text-[30px]">
        {greeting(user)}
      </h2>
      <p className="relative mt-2 max-w-[780px] text-[16px] leading-relaxed text-ink-2">
        <Emphasised text={briefingText(home)} />
      </p>

      {home.tasks.length > 0 && (
        <div className="relative -mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {home.tasks.map((t) => (
            <TaskCard key={t.id} task={t} clinicId={clinicId} onChange={onTask} />
          ))}
        </div>
      )}

      <form onSubmit={submit} className="relative mt-5 flex items-center gap-2 rounded-full border border-line-strong bg-[color-mix(in_srgb,var(--background)_55%,transparent)] py-1.5 pl-5 pr-1.5">
        <label htmlFor="ask-fmd" className="sr-only">
          Ask FMD Manager to do something
        </label>
        <input
          id="ask-fmd"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask FMD Manager to do something…"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <button type="button" aria-label="Speak (coming soon)" disabled className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3">
          <Mic className="size-[18px]" strokeWidth={1.5} />
        </button>
        <button type="submit" aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--button-primary)] text-[var(--button-primary-fg)]">
          <ArrowRight className="size-4" strokeWidth={2} />
        </button>
      </form>
      <div className="relative mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1.5 text-[13.5px] text-ink-2 hover:border-line-strong hover:text-ink">
            {s}
          </button>
        ))}
      </div>
      {thread.length > 0 && (
        <ul className="relative mt-4 space-y-3" aria-live="polite">
          {thread.map((q, i) => (
            <li key={i} className="space-y-1.5 text-[14.5px]">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--surface-elevated)] px-3.5 py-2 text-ink">{q}</p>
              <p className="w-fit max-w-[85%] text-ink-2">I&apos;ve noted that. Doing this for real arrives with FMD Manager in a later release.</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
