"use client";

import { Send, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Empty, Panel, Tag } from "@/components/app/kit";
import { fieldCls } from "@/components/app/Sheet";
import { ask, getManager, logDecision, setDraft, toggleScheduled, type ChatMessage } from "@/sample/manager";
import { TaskCard } from "../home/AiBriefing";
import { todayIst, useClinic } from "../Shell";

type Data = Awaited<ReturnType<typeof getManager>>;
const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const SUGGESTIONS = ["How many no-shows this week?", "Revenue this month?", "How many recalls are overdue?", "Draft reminders for tomorrow"];
const OUTCOME: Record<string, ["ok" | "warn" | "muted" | "accent", string]> = { approved: ["ok", "Approved"], done: ["accent", "Done"], skipped: ["muted", "Skipped"], edited: ["warn", "Edited, approved"] };

export function AiManager() {
  const { clinic, branchId, user } = useClinic();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const isOwner = user.role === "clinic_owner";

  const load = useCallback(
    () =>
      getManager(clinic.id, { branchId, date: todayIst() }).then(
        (d) => {
          setData(d);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [clinic.id, branchId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const send = async (text: string, e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setQ("");
    await ask(clinic.id, text, { branchId, today: todayIst() });
    await load();
    setBusy(false);
  };

  if (failed)
    return (
      <Panel className="p-6">
        <Empty title="The AI manager couldn't load" hint="Try again in a moment." />
      </Panel>
    );
  if (!data) return <div className="grid gap-4 lg:grid-cols-2" aria-busy aria-label="Loading">{[0, 1, 2, 3].map((i) => <Panel key={i} className="h-[180px] motion-safe:animate-pulse" />)}</div>;

  const waiting = data.queue.filter((t) => t.needsApproval && t.status === "proposed").length;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-2xl border border-line px-4 py-3 text-[14px] text-ink-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--tone-ok)]" strokeWidth={1.75} />
        FMD Manager prepares and drafts. Anything that leaves the clinic, like a message, a post or a review reply, waits for a person to approve it. It never gives clinical advice.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>
          Waiting for you <span className={sub}>{waiting ? `${waiting} need${waiting === 1 ? "s" : ""} approval` : "nothing to approve"}</span>
        </h2>
        {data.queue.length === 0 ? (
          <Panel className="p-5">
            <Empty title="Nothing in the queue" hint="New drafts appear here for approval." />
          </Panel>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.queue.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                clinicId={clinic.id}
                onChange={(next) => {
                  logDecision(next, user.name);
                  void load();
                }}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel as="section" className="flex flex-col p-4 sm:p-5">
          <h2 className={h2}>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--accent)]" strokeWidth={1.75} /> Ask FMD Manager
            </span>
            <span className={sub}>answers come from your clinic&apos;s figures</span>
          </h2>
          <div className="mt-3 flex max-h-[360px] min-h-[160px] flex-col gap-2 overflow-y-auto" aria-live="polite">
            {data.chat.length === 0 && <p className="text-[14px] text-ink-3">Ask about no-shows, revenue, new patients, recalls or chair use.</p>}
            {data.chat.map((m: ChatMessage, i) => (
              <p
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed ${m.from === "you" ? "self-end bg-[var(--accent-soft)] text-ink" : "self-start border border-line text-ink-2"}`}
              >
                {m.text}
              </p>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => send(q, e)} className="mt-3 flex gap-2">
            <label htmlFor="ai-q" className="sr-only">
              Ask FMD Manager
            </label>
            <input id="ai-q" className={`${fieldCls} flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your clinic…" />
            <Button type="submit" disabled={!q.trim() || busy} aria-label="Send">
              <Send className="size-4" strokeWidth={1.75} />
            </Button>
          </form>
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Scheduled <span className={sub}>{isOwner ? "switch on or off" : "set by the owner"}</span>
          </h2>
          <ul className="mt-2">
            {data.scheduled.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 border-t border-line py-3 first:border-0">
                <span className="min-w-0">
                  <span className="block text-[14.5px] text-ink">{s.title}</span>
                  <span className="block text-[13px] text-ink-3">
                    {s.when} · {s.what}
                  </span>
                  {s.needsApproval && <span className="mt-1 inline-block"><Tag tone="warn">Needs approval</Tag></span>}
                </span>
                <label className="inline-flex shrink-0 items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={s.on}
                    disabled={!isOwner}
                    onChange={async () => {
                      await toggleScheduled(clinic.id, s.id);
                      void load();
                    }}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {s.on ? "On" : "Off"}
                </label>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Content drafts <span className={sub}>you edit and post them yourself</span>
          </h2>
          <ul className="mt-2">
            {data.drafts.map((d) => (
              <li key={d.id} className="border-t border-line py-3 first:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14.5px] text-ink">
                    {d.title} <span className="text-[13px] text-ink-3">· {d.kind}</span>
                  </span>
                  {d.status !== "draft" && <Tag tone={d.status === "approved" ? "ok" : "muted"}>{d.status === "approved" ? "Approved, ready to post" : "Discarded"}</Tag>}
                </div>
                {editing === d.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <label htmlFor={`draft-${d.id}`} className="sr-only">
                      Edit {d.title}
                    </label>
                    <textarea id={`draft-${d.id}`} className={`${fieldCls} min-h-[110px] py-2.5`} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          await setDraft(clinic.id, d.id, { body: draftText }, user.name);
                          setEditing(null);
                          void load();
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{d.body}</p>
                )}
                {d.status === "draft" && editing !== d.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await setDraft(clinic.id, d.id, { status: "approved" }, user.name);
                        void load();
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDraftText(d.body);
                        setEditing(d.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await setDraft(clinic.id, d.id, { status: "discarded" }, user.name);
                        void load();
                      }}
                    >
                      Discard
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[13px] text-ink-3">Approving marks a draft ready; FMD never posts on its own (demo).</p>
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            History <span className={sub}>who approved what</span>
          </h2>
          <ul className="mt-2 max-h-[420px] overflow-y-auto">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-0">
                <span className="min-w-0">
                  <span className="block text-[14.5px] text-ink">{h.what}</span>
                  <span className="block text-[13px] text-ink-3">
                    {h.at} · {h.by}
                  </span>
                </span>
                <Tag tone={OUTCOME[h.outcome][0]}>{OUTCOME[h.outcome][1]}</Tag>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
