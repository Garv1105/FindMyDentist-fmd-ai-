"use client";

import { Bot, CheckCircle2, CircleDashed, Clock, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { H, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Step = { tool: string; label: string; risk: string; status: string; preview: Record<string, unknown> | null; output: Record<string, unknown> | null; error: string; verified: boolean };
type Task = { id: string; instruction: string; intent: string; status: string; question: string; report: string; planner: { name: string }; createdAt: number; steps: Step[]; approvals: { decision: string; note: string; at: number; approver: string }[] };
type Row = { id: string; instruction: string; status: string; requester: string; createdAt: number; scheduled: boolean };
type Settings = { enabled: boolean; recallMonths: number; planner: { name: string; configured: boolean }; approvalPolicy: Record<string, string[]>; usage30d: { tasks: number; toolCalls: number; avgLatencyMs: number; outcomes: Record<string, number> } };

const STATUS: Record<string, string> = {
  clarifying: "Needs your answer",
  running: "Running",
  awaiting_approval: "Waiting for approval",
  completed: "Completed",
  partial: "Partly completed",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Cancelled",
};
const EXAMPLES = ["Find unconfirmed appointments for the next 2 days and create follow-up tasks", "Find patients due for recall and send them a reminder", "Prepare today's payment sheet and find missing invoices", "Check stock and draft a purchase order for anything low", "Give me the end of day handover summary"];

export default function AiManagerPage() {
  const { call, can } = useClinic();
  const [text, setText] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    call<Row[]>("ai/tasks").then(setRows).catch(() => {});
    call<Settings>("ai/settings").then(setSettings).catch(() => {});
  }, [call]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<Task>) => {
    setErr("");
    setBusy(true);
    try {
      setTask(await fn());
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => (e.preventDefault(), text.trim() && run(() => call<Task>("ai/tasks", "POST", { instruction: text }).finally(() => setText(""))));

  return (
    <>
      <H title="AI clinic manager" desc="Prepares and runs clinic work through approved tools. Messages to patients and posts always wait for your approval; money, clinical records and clinical decisions are never handled by the AI." />
      {settings && !settings.planner.configured && (
        <p className="mb-4 rounded-xl border border-dashed border-line-strong px-4 py-2.5 text-[12.5px] text-ink-3">
          Development planner: fixed playbooks matched by keywords, not a language model. A model provider plugs in behind the same tools and approvals.
        </p>
      )}
      <form onSubmit={submit} className="glass flex items-center gap-2 rounded-full p-1.5 pl-5">
        <Bot className="size-4 text-ink-3" strokeWidth={1.5} />
        <input aria-label="Instruction for the AI manager" value={text} onChange={(e) => setText(e.target.value)} placeholder="What should I do? e.g. Find patients due for recall" className="h-11 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
        <button disabled={busy || !text.trim()} className="btn-primary h-10 px-5 text-[13px] disabled:opacity-50">
          {busy ? "Working…" : "Run"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((x) => (
          <button key={x} onClick={() => setText(x)} className="rounded-full border border-line px-3 py-1 text-[12px] text-ink-3 hover:text-ink">
            {x}
          </button>
        ))}
      </div>
      {err && (
        <div className="mt-4">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>{task ? <TaskCard t={task} onAct={run} /> : <p className="glass rounded-[20px] p-8 text-center text-[13px] text-ink-4">Run a task or open one from the history.</p>}</div>
        <aside className="space-y-5">
          <section className="glass rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">Task history</h2>
            <ul className="mt-3 space-y-1.5">
              {rows.length === 0 && <li className="text-[12.5px] text-ink-4">No tasks yet.</li>}
              {rows.map((r) => (
                <li key={r.id}>
                  <button onClick={() => run(() => call<Task>(`ai/tasks/${r.id}`))} className="w-full rounded-xl px-2 py-1.5 text-left text-[12.5px] hover:bg-[var(--accent-soft)]">
                    <span className="block truncate text-ink-2">{r.instruction}</span>
                    <span className="text-[11.5px] text-ink-4">
                      {STATUS[r.status]} · {r.requester}
                      {r.scheduled && " · scheduled"} · {when(r.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <Schedules />
          {settings && (
            <section className="glass rounded-[20px] p-5 text-[12.5px]">
              <h2 className="text-[15px] text-ink">Approval policy</h2>
              {Object.entries({ automatic: "Runs automatically", needsApproval: "Needs approval", neverByAi: "Never done by the AI" }).map(([k, label]) => (
                <div key={k} className="mt-2">
                  <p className="text-ink-2">{label}</p>
                  <ul className="text-ink-4">
                    {settings.approvalPolicy[k].map((x) => (
                      <li key={x}>· {x}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="mt-3 text-ink-4">
                Last 30 days: {settings.usage30d.tasks} tasks, {settings.usage30d.toolCalls} tool calls, avg {settings.usage30d.avgLatencyMs} ms, estimated model cost ₹0 (development planner).
              </p>
              {can("ai.configure") && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <label className="flex items-center gap-2 text-ink-2">
                    Recall after
                    <input
                      aria-label="Recall months"
                      type="number"
                      min={1}
                      max={24}
                      defaultValue={settings.recallMonths}
                      onBlur={(e) => call<Settings>("ai/settings", "POST", { enabled: settings.enabled, recallMonths: Number(e.target.value) }).then(setSettings)}
                      className={`${inputCls} h-8 !w-16 px-2 text-[12px]`}
                    />
                    months
                  </label>
                  <button onClick={() => call<Settings>("ai/settings", "POST", { enabled: !settings.enabled, recallMonths: settings.recallMonths }).then(setSettings)} className="btn-ghost h-8 px-3 text-[12px]">
                    {settings.enabled ? "Turn AI manager off" : "Turn AI manager on"}
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

function StepIcon({ s }: { s: Step }) {
  const I = s.status === "done" ? (s.verified ? CheckCircle2 : ShieldAlert) : s.status === "awaiting_approval" ? Clock : s.status === "failed" || s.status === "blocked" ? XCircle : CircleDashed;
  return <I className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />;
}

function TaskCard({ t, onAct }: { t: Task; onAct: (fn: () => Promise<Task>) => void }) {
  const { call } = useClinic();
  const [answer, setAnswer] = useState("");
  const waiting = t.steps.find((s) => s.status === "awaiting_approval");
  return (
    <section className="glass space-y-4 rounded-[22px] p-5">
      <div className="flex flex-wrap items-start gap-2">
        <p className="flex-1 text-[15px] text-ink">{t.instruction}</p>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-2">{STATUS[t.status]}</span>
      </div>
      {t.status === "clarifying" && (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-2">{t.question}</p>
          <div className="flex gap-2">
            <input aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className={`${inputCls} h-9 text-[13px]`} />
            <button onClick={() => onAct(() => call<Task>(`ai/tasks/${t.id}/answer`, "POST", { answer }))} className="btn-primary h-9 shrink-0 px-4 text-[12.5px]">
              Answer
            </button>
          </div>
        </div>
      )}
      <ol className="space-y-3">
        {t.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[13px]">
            <StepIcon s={s} />
            <div className="min-w-0 flex-1">
              <p className="text-ink-2">
                {s.label} <span className="text-[11.5px] text-ink-4">· {s.risk}</span>
                {s.status === "done" && !s.verified && <span className="text-[11.5px] text-ink-3"> · not verified</span>}
              </p>
              {s.error && <p className="text-[12px] text-ink-3">{s.error}</p>}
              {s.output && <Output o={s.output} />}
              {s.status === "awaiting_approval" && s.preview && (
                <div className="mt-2 rounded-xl border border-line-strong p-3 text-[12.5px] text-ink-2">
                  <p className="text-ink">Preview: nothing has happened yet</p>
                  <Output o={s.preview} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {waiting && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button onClick={() => onAct(() => call<Task>(`ai/tasks/${t.id}/decide`, "POST", { decision: "approve" }))} className="btn-primary h-9 px-4 text-[12.5px]">
            Approve: {waiting.label.toLowerCase()}
          </button>
          <button onClick={() => onAct(() => call<Task>(`ai/tasks/${t.id}/decide`, "POST", { decision: "reject", note: "Rejected from the task card" }))} className="btn-ghost h-9 px-4 text-[12.5px]">
            Reject
          </button>
          <button onClick={() => onAct(() => call<Task>(`ai/tasks/${t.id}/cancel`, "POST"))} className="h-9 px-2 text-[12.5px] text-ink-3 underline underline-offset-4">
            Cancel task
          </button>
        </div>
      )}
      {t.report && <pre className="whitespace-pre-wrap rounded-xl bg-[var(--accent-soft)] p-3 font-sans text-[12.5px] text-ink-2">{t.report}</pre>}
      {t.approvals.map((a, i) => (
        <p key={i} className="text-[12px] text-ink-4">
          {a.decision === "approved" ? "Approved" : "Rejected"} by {a.approver} · {when(a.at)}
          {a.note && ` · ${a.note}`}
        </p>
      ))}
    </section>
  );
}

/** One record as text: internal ids hidden, flags named instead of true/false. */
function readable(o: Record<string, unknown>) {
  return Object.entries(o)
    .filter(([k, v]) => !/(^id$|Id$|_id$)/.test(k) && typeof v !== "object")
    .map(([k, v]) => (typeof v === "boolean" ? `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v ? "yes" : "no"}` : String(v)))
    .join(" · ");
}

/** Compact rendering of a tool's structured output or preview. */
function Output({ o }: { o: Record<string, unknown> }) {
  return (
    <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[12px]">
      {Object.entries(o).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-4">{k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</dt>
          <dd className="text-ink-3">
            {Array.isArray(v)
              ? v.length === 0
                ? "none"
                : v.slice(0, 6).map((x, i) => <span key={i} className="block">{typeof x === "object" ? readable(x as Record<string, unknown>) : String(x)}</span>)
              : typeof v === "object" && v
                ? Object.entries(v as object).map(([a, b]) => `${a}: ${b}`).join(", ")
                : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Schedules() {
  const { call, can } = useClinic();
  const [list, setList] = useState<{ id: string; instruction: string; cadence: string; next_run_at: number; active: number }[]>([]);
  const [f, setF] = useState({ instruction: "", cadence: "daily" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    call<typeof list>("ai/schedules").then(setList).catch(() => {});
  }, [call]);
  return (
    <section className="glass rounded-[20px] p-5 text-[12.5px]">
      <h2 className="text-[15px] text-ink">Recurring tasks</h2>
      <ul className="mt-2 space-y-1.5">
        {list.length === 0 && <li className="text-ink-4">None yet.</li>}
        {list.map((s) => (
          <li key={s.id} className="text-ink-2">
            {s.instruction} <span className="text-ink-4">· {s.cadence} · next {when(s.next_run_at)}</span>
            {can("ai.configure") && (
              <button onClick={() => call<typeof list>(`ai/schedules/${s.id}`, "POST", { active: !s.active }).then(setList)} className="ml-2 underline underline-offset-4">
                {s.active ? "Pause" : "Resume"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {can("ai.configure") && (
        <div className="mt-3 space-y-1.5">
          <input aria-label="Recurring instruction" placeholder="e.g. Give me the end of day handover summary" value={f.instruction} onChange={(e) => setF({ ...f, instruction: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
          <div className="flex gap-2">
            <select aria-label="Cadence" value={f.cadence} onChange={(e) => setF({ ...f, cadence: e.target.value })} className={`${inputCls} h-9 !w-auto text-[12.5px] [&>option]:bg-[var(--surface)]`}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button onClick={() => call<typeof list>("ai/schedules", "POST", f).then((l) => (setList(l), setF({ instruction: "", cadence: "daily" })))} className="btn-ghost h-9 px-3 text-[12px]">
              Add
            </button>
            <button onClick={() => call<{ ran: number }>("ai/schedules/run-due", "POST").then((r) => setMsg(`${r.ran} due task(s) run.`))} className="h-9 px-2 text-[12px] text-ink-3 underline underline-offset-4">
              Run due now
            </button>
          </div>
          {msg && <p className="text-ink-4">{msg}</p>}
        </div>
      )}
    </section>
  );
}
