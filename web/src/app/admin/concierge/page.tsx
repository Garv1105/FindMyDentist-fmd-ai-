"use client";

import { AlertTriangle, Flag, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

type Item = {
  id: string;
  reference: string;
  name: string;
  need: string;
  area: string;
  status: string;
  statusLabel: string;
  priority: "normal" | "high";
  assignee: string | null;
  nextAction: string;
  nextActionDue: number;
  overdue: boolean;
  createdAt: number;
};
type Queue = {
  items: Item[];
  metrics: { total: number; open: number; overdue: number; medianFirstContactHours: number | null; byStatus: Record<string, number>; definitions: Record<string, string> };
};
type Detail = {
  enquiry: Item & {
    contact_method: string;
    contact_value: string;
    timing: string;
    notes: string;
    outcome: string;
    assignee_id: string | null;
    next_action: string;
    next_action_due: number;
    created_at: number;
    allowedNext: { status: string; label: string }[];
  };
  events: { at: number; kind: string; from_status: string | null; to_status: string | null; channel: string | null; result: string | null; body: string; actor: string | null }[];
  coordinators: { id: string; name: string }[];
};

const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const FILTERS = [
  ["open", "Open"],
  ["overdue", "Overdue"],
  ["mine", "Assigned to me"],
  ["", "All"],
] as const;

export default function ConciergeQueuePage() {
  const me = useMe();
  const isOps = !!me?.roles.some((r) => r === "fmd_ops" || r === "super_admin");
  return (
    <Page>
      <p className="eyebrow">FMD Operations</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink">FMD Edge queue</h1>
      <div className="mt-8">
        {me === undefined && <p className="text-ink-3">Loading…</p>}
        {me === null && (
          <Notice kind="info">
            Staff sign-in required. <Link href="/signin?next=/admin/concierge" className="underline">Sign in</Link>
          </Notice>
        )}
        {me && !isOps && <Notice kind="error">This area is for FMD coordinators. Your account doesn&apos;t have access.</Notice>}
        {me && isOps && <Queue />}
      </div>
    </Page>
  );
}

function Queue() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("open");
  const [q, setQ] = useState<Queue | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    const qs = filter === "overdue" ? "overdue=1" : filter === "mine" ? "mine=1" : filter ? `status=${filter}` : "";
    api<Queue>(`/api/admin/concierge?${qs}`)
      .then((r) => {
        setQ(r);
        setErr("");
      })
      .catch((e) => setErr(e.message));
  }, [filter]);
  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      {q && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open" value={q.metrics.open} />
          <Stat label="Overdue" value={q.metrics.overdue} hint={q.metrics.definitions.overdue} />
          <Stat label="Median first contact" value={q.metrics.medianFirstContactHours === null ? "—" : `${q.metrics.medianFirstContactHours} h`} hint={q.metrics.definitions.medianFirstContactHours} />
          <Stat label="Total received" value={q.metrics.total} />
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([v, l]) => (
          <button
            key={l}
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={`rounded-full border px-4 py-1.5 text-[13px] ${filter === v ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3 hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
        <button onClick={load} aria-label="Refresh" className="ml-auto grid size-9 place-items-center rounded-full border border-line text-ink-3 hover:text-ink">
          <RefreshCw className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <ul className="space-y-2">
          {q?.items.length === 0 && <li className="rounded-2xl border border-line p-6 text-center text-[13px] text-ink-4">No requests in this view.</li>}
          {q?.items.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => setSel(i.id)}
                aria-current={sel === i.id}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${sel === i.id ? "border-line-strong bg-[var(--accent-soft)]" : "border-line hover:border-line-strong"}`}
              >
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-mono text-ink-2">{i.reference}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-ink-3">{i.statusLabel}</span>
                  {i.priority === "high" && (
                    <span className="flex items-center gap-1 text-ink-2">
                      <Flag className="size-3" strokeWidth={1.75} /> High
                    </span>
                  )}
                  {i.overdue && (
                    <span className="ml-auto flex items-center gap-1 text-ink">
                      <AlertTriangle className="size-3.5" strokeWidth={1.75} /> Overdue
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[14px] text-ink">
                  {i.name} · <span className="text-ink-3">{i.need}</span>
                </p>
                <p className="mt-1 text-[12px] text-ink-4">
                  {i.area} · {i.assignee ? `Assigned to ${i.assignee}` : "Unassigned"} · Next: {i.nextAction} by {fmt(i.nextActionDue)}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <div>{sel ? <DetailPanel key={sel} id={sel} onChange={load} /> : <p className="rounded-2xl border border-dashed border-line p-6 text-[13px] text-ink-4">Select a request to see details.</p>}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4" title={hint}>
      <dt className="text-[12px] text-ink-4">{label}</dt>
      <dd className="mt-1 text-[22px] font-light text-ink">{value}</dd>
    </div>
  );
}

function DetailPanel({ id, onChange }: { id: string; onChange: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [to, setTo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [attempt, setAttempt] = useState({ channel: "phone", result: "no_answer" });
  const [next, setNext] = useState({ action: "", due: "" });

  useEffect(() => {
    api<Detail>(`/api/admin/concierge/${id}`).then(setD).catch((e) => setErr(e.message));
  }, [id]);

  const act = async (body: Record<string, unknown>) => {
    setErr("");
    try {
      setD(await api<Detail>(`/api/admin/concierge/${id}/actions`, { method: "POST", body }));
      setNote("");
      setTo("");
      setConfirmed(false);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!d) return err ? <Notice kind="error">{err}</Notice> : <p className="text-[13px] text-ink-4">Loading…</p>;
  const e = d.enquiry;
  const closed = e.allowedNext.length === 0;

  return (
    <section className="glass space-y-6 rounded-[26px] p-6" aria-label={`Request ${e.reference}`}>
      <header>
        <p className="font-mono text-[12px] text-ink-3">{e.reference}</p>
        <h2 className="mt-1 text-[20px] font-light text-ink">{e.name}</h2>
        <p className="text-[13px] text-ink-3">
          {e.statusLabel}
          {e.overdue && " · Overdue"} · received {fmt(e.created_at)}
        </p>
      </header>

      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
        <dt className="text-ink-4">Need</dt>
        <dd className="text-ink-2">{e.need}</dd>
        <dt className="text-ink-4">Area · timing</dt>
        <dd className="text-ink-2">
          {e.area} · {e.timing}
        </dd>
        <dt className="text-ink-4">Contact</dt>
        <dd className="flex items-center gap-2 text-ink-2">
          <Phone className="size-3.5" strokeWidth={1.5} /> {e.contact_method}: {e.contact_value}
        </dd>
        {e.notes && (
          <>
            <dt className="text-ink-4">Patient notes</dt>
            <dd className="whitespace-pre-wrap text-ink-2">{e.notes}</dd>
          </>
        )}
        {e.outcome && (
          <>
            <dt className="text-ink-4">Outcome</dt>
            <dd className="text-ink-2">{e.outcome}</dd>
          </>
        )}
      </dl>

      {err && <Notice kind="error">{err}</Notice>}

      {!closed && (
        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <label htmlFor="assignee" className="text-[12px] text-ink-3">
              Coordinator
            </label>
            <select id="assignee" value={e.assignee_id ?? ""} onChange={(ev) => ev.target.value && act({ type: "assign", assigneeId: ev.target.value })} className={`${inputCls} mt-1 h-10 text-[13px] [&>option]:bg-[var(--surface)]`}>
              <option value="">Unassigned</option>
              {d.coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[12px] text-ink-3">Priority</p>
            <button onClick={() => act({ type: "priority", priority: e.priority === "high" ? "normal" : "high" })} className="btn-ghost mt-1 h-10 w-full text-[13px]">
              {e.priority === "high" ? "Set to normal" : "Mark high priority"}
            </button>
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="text-[12px] text-ink-3">Log a contact attempt</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              <select aria-label="Channel" value={attempt.channel} onChange={(ev) => setAttempt((a) => ({ ...a, channel: ev.target.value }))} className={`${inputCls} h-10 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}>
                <option value="phone">Phone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
              <select aria-label="Result" value={attempt.result} onChange={(ev) => setAttempt((a) => ({ ...a, result: ev.target.value }))} className={`${inputCls} h-10 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}>
                <option value="reached">Reached the patient</option>
                <option value="no_answer">No answer</option>
                <option value="left_message">Left a message</option>
                <option value="wrong_number">Wrong number</option>
              </select>
              <button onClick={() => act({ type: "attempt", ...attempt, note })} className="btn-primary h-10 px-4 text-[13px]">
                Log attempt
              </button>
            </div>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="text-[12px] text-ink-3">Next action</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              <input aria-label="Next action" placeholder={e.next_action} value={next.action} onChange={(ev) => setNext((n) => ({ ...n, action: ev.target.value }))} className={`${inputCls} h-10 min-w-[180px] flex-1 text-[13px]`} />
              <input aria-label="Due" type="datetime-local" value={next.due} onChange={(ev) => setNext((n) => ({ ...n, due: ev.target.value }))} className={`${inputCls} h-10 !w-auto text-[13px]`} />
              <button onClick={() => act({ type: "next", nextAction: next.action, dueAt: next.due ? new Date(next.due).getTime() : NaN })} className="btn-ghost h-10 px-4 text-[13px]">
                Set
              </button>
            </div>
          </fieldset>
        </div>
      )}

      <div className="space-y-3 border-t border-line pt-5">
        <label htmlFor="note" className="text-[12px] text-ink-3">
          Note {closed ? "" : "(also used as the reason when changing status)"}
        </label>
        <textarea id="note" rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} className={`${inputCls} h-auto py-3 text-[13px]`} />
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!note.trim()} onClick={() => act({ type: "note", note })} className="btn-ghost h-10 px-4 text-[13px] disabled:opacity-50">
            Add internal note
          </button>
          {!closed && (
            <>
              <select aria-label="Change status" value={to} onChange={(ev) => setTo(ev.target.value)} className={`${inputCls} h-10 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}>
                <option value="">Change status…</option>
                {e.allowedNext.map((s) => (
                  <option key={s.status} value={s.status}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button disabled={!to} onClick={() => act({ type: "status", to, note, patientConfirmed: confirmed })} className="btn-primary h-10 px-4 text-[13px] disabled:opacity-50">
                Update status
              </button>
            </>
          )}
        </div>
        {to === "confirmed" && (
          <label className="flex items-start gap-2 text-[12.5px] text-ink-2">
            <input type="checkbox" checked={confirmed} onChange={(ev) => setConfirmed(ev.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            The patient has reviewed and agreed to the clinic, time and fees described in the note.
          </label>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="text-[13px] text-ink-2">History</h3>
        <ol className="mt-3 space-y-2.5">
          {d.events.map((ev, i) => (
            <li key={i} className="text-[12.5px]">
              <span className="text-ink-4">{fmt(ev.at)} · {ev.actor ?? "Patient"} · </span>
              <span className="text-ink-2">{describe(ev, d.coordinators)}</span>
              {ev.body && ev.kind !== "next_action" && ev.kind !== "priority" && <span className="block whitespace-pre-wrap text-ink-3">{ev.body}</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const LABEL: Record<string, string> = {
  new: "New", contact_attempted: "Contact attempted", contacted: "Contacted", needs_clarification: "Needs clarification",
  coordinating: "Coordinating", awaiting_patient: "Awaiting patient", confirmed: "Confirmed", closed: "Closed", cancelled: "Cancelled",
};
function describe(ev: Detail["events"][number], people: Detail["coordinators"]) {
  switch (ev.kind) {
    case "created": return "Request submitted";
    case "status": return `Status: ${ev.from_status ? LABEL[ev.from_status] : "—"} → ${ev.to_status ? LABEL[ev.to_status] : "—"}`;
    case "contact_attempt": return `Contact attempt by ${ev.channel}: ${ev.result?.replace("_", " ")}`;
    case "assigned": return `${ev.body} to ${people.find((p) => p.id === ev.result)?.name ?? "a coordinator"}`;
    case "next_action": return `Next action: ${ev.body} (due ${fmt(Number(ev.result))})`;
    case "priority": return `Priority set to ${ev.body}`;
    default: return "Note";
  }
}
