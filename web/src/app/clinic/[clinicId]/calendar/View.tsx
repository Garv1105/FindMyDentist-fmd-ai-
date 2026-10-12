"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fromLocal, H, time, toLocal, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Appt = { id: string; kind: string; patient: string | null; type: string | null; provider: string | null; chair: string | null; startsAt: number; endsAt: number; status: string; source: string; note: string; next: string[] };
type Req = { id: string; reference: string; patient: string; dentist: string; starts_at: number | null; preferred_window: string; reason: string };
type Cal = { from: number; appointments: Appt[]; fmdRequests: Req[] };
type Settings = { types: { id: string; name: string; duration_min: number; active: number }[]; chairs: { id: string; name: string }[]; providers: { id: string; name: string }[] };

const LABEL: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", checked_in: "Checked in", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
const IST_DAY = (t: number) => Math.floor((t + 5.5 * 3600_000) / 86400_000) * 86400_000 - 5.5 * 3600_000;

export default function CalendarPage() {
  const { call, can } = useClinic();
  const [day, setDay] = useState(() => IST_DAY(Date.now()));
  const [cal, setCal] = useState<Cal | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const load = useCallback(() => {
    call<Cal>(`calendar?from=${day}&days=1`).then(setCal).catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [call, day]);
  useEffect(load, [load]);
  useEffect(() => {
    call<Settings>("settings").then(setS).catch(() => {});
  }, [call]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ kind: "success", text: ok });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const write = can("appointments.write");

  return (
    <>
      <H title="Calendar" desc="Conflicts, buffers and working hours are checked when you book or move a visit.">
        <div className="flex items-center gap-2">
          <button aria-label="Previous day" onClick={() => setDay((d) => d - 86400_000)} className="grid size-9 place-items-center rounded-full border border-line text-ink-3">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[150px] text-center text-[14px] text-ink">{new Date(day + 5.5 * 3600_000).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}</span>
          <button aria-label="Next day" onClick={() => setDay((d) => d + 86400_000)} className="grid size-9 place-items-center rounded-full border border-line text-ink-3">
            <ChevronRight className="size-4" />
          </button>
          <button onClick={() => setDay(IST_DAY(Date.now()))} className="btn-ghost h-9 px-3 text-[12.5px]">
            Today
          </button>
        </div>
      </H>
      {msg && (
        <div className="mb-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          {!cal && <p className="text-ink-4">Loading…</p>}
          {cal?.appointments.length === 0 && <p className="glass rounded-[20px] p-8 text-center text-[13px] text-ink-4">Nothing booked for this day.</p>}
          <ul className="space-y-2">
            {cal?.appointments.map((a) => (
              <li key={a.id} className={`glass rounded-[18px] p-4 ${a.status === "cancelled" || a.status === "no_show" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="w-[120px] text-ink">
                    {time(a.startsAt)}–{time(a.endsAt)}
                  </span>
                  <span className="flex-1 text-ink-2">
                    {a.kind === "block" ? <em>Blocked{a.note ? `: ${a.note}` : ""}</em> : `${a.patient} · ${a.type}`}
                    <span className="text-ink-4">
                      {a.provider && ` · ${a.provider}`}
                      {a.chair && ` · ${a.chair}`}
                      {a.source === "fmd_booking" && " · via FMD"}
                    </span>
                  </span>
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-2">{LABEL[a.status]}</span>
                </div>
                {write && a.next.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-[128px]">
                    {a.next
                      .filter((n) => n !== "cancelled")
                      .map((n) => (
                        <button key={n} onClick={() => act(() => call(`appointments/${a.id}/status`, "POST", { to: n }))} className="btn-ghost h-8 px-3 text-[12px]">
                          {LABEL[n]}
                        </button>
                      ))}
                    <button
                      onClick={() => {
                        const reason = prompt("Reason for cancelling?");
                        if (reason) act(() => call(`appointments/${a.id}/status`, "POST", { to: "cancelled", note: reason }));
                      }}
                      className="h-8 px-2 text-[12px] text-ink-3 underline underline-offset-4"
                    >
                      Cancel
                    </button>
                    <Move a={a} onMove={(t) => act(() => call(`appointments/${a.id}/reschedule`, "POST", { startsAt: t }), "Appointment moved.")} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <aside className="space-y-5">
          {cal && cal.fmdRequests.length > 0 && (
            <section className="glass rounded-[20px] p-5">
              <h2 className="text-[15px] text-ink">Requests from FMD patients</h2>
              <ul className="mt-3 space-y-3">
                {cal.fmdRequests.map((r) => (
                  <FmdRequest key={r.id} r={r} s={s} write={write} onDone={(text) => (setMsg({ kind: "success", text }), load())} onErr={(text) => setMsg({ kind: "error", text })} />
                ))}
              </ul>
            </section>
          )}
          {write && s && <NewAppointment s={s} day={day} onDone={() => (setMsg({ kind: "success", text: "Booked." }), load())} onErr={(text) => setMsg({ kind: "error", text })} />}
        </aside>
      </div>
    </>
  );
}

function Move({ a, onMove }: { a: Appt; onMove: (t: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(toLocal(a.startsAt));
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="h-8 px-2 text-[12px] text-ink-3 underline underline-offset-4">
        Move
      </button>
    );
  return (
    <span className="flex gap-1.5">
      <input aria-label="New time" type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} className={`${inputCls} h-8 !w-auto text-[12px]`} />
      <button onClick={() => (onMove(fromLocal(v)), setOpen(false))} className="btn-primary h-8 px-3 text-[12px]">
        Save
      </button>
    </span>
  );
}

function FmdRequest({ r, s, write, onDone, onErr }: { r: Req; s: Settings | null; write: boolean; onDone: (t: string) => void; onErr: (t: string) => void }) {
  const { call } = useClinic();
  const [type, setType] = useState("");
  const [t, setT] = useState(r.starts_at ? toLocal(r.starts_at) : "");
  const confirm = async () => {
    try {
      await call(`fmd-requests/${r.id}/confirm`, "POST", { typeId: type || s?.types[0]?.id, startsAt: r.starts_at ?? fromLocal(t) });
      onDone(`Confirmed. ${r.patient} sees it in their FMD appointments.`);
    } catch (e) {
      onErr((e as Error).message);
    }
  };
  const decline = async () => {
    const reason = prompt("Tell the patient why (they will see this):");
    if (!reason) return;
    try {
      await call(`fmd-requests/${r.id}/decline`, "POST", { reason });
      onDone("Declined. The patient has been told.");
    } catch (e) {
      onErr((e as Error).message);
    }
  };
  return (
    <li className="rounded-xl border border-line p-3 text-[13px]">
      <p className="text-ink">
        {r.patient} <span className="text-ink-4">· {r.dentist}</span>
      </p>
      <p className="text-ink-3">{r.starts_at ? when(r.starts_at) : `Prefers: ${r.preferred_window}`}</p>
      {r.reason && <p className="text-ink-4">“{r.reason}”</p>}
      {write && (
        <div className="mt-2 space-y-1.5">
          <select aria-label="Appointment type" value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`}>
            {s?.types.filter((x) => x.active).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.duration_min} min)
              </option>
            ))}
          </select>
          {!r.starts_at && <input aria-label="Time to offer" type="datetime-local" value={t} onChange={(e) => setT(e.target.value)} className={`${inputCls} h-9 text-[12.5px]`} />}
          <div className="flex gap-2">
            <button onClick={confirm} disabled={!r.starts_at && !t} className="btn-primary h-8 px-3 text-[12px] disabled:opacity-50">
              Confirm
            </button>
            <button onClick={decline} className="btn-ghost h-8 px-3 text-[12px]">
              Decline
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function NewAppointment({ s, day, onDone, onErr }: { s: Settings; day: number; onDone: () => void; onErr: (t: string) => void }) {
  const { call } = useClinic();
  const [kind, setKind] = useState<"visit" | "block">("visit");
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [f, setF] = useState({ patientId: "", typeId: s.types.find((t) => t.active)?.id ?? "", providerId: s.providers[0]?.id ?? "", chairId: s.chairs[0]?.id ?? "", start: toLocal(day + 10 * 3600_000), end: toLocal(day + 11 * 3600_000), note: "" });
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => call<{ id: string; name: string; phone: string }[]>(`patients?q=${encodeURIComponent(q)}`).then(setPatients).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q, call]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await call("appointments", "POST", { kind, patientId: f.patientId, typeId: f.typeId, providerId: f.providerId, chairId: f.chairId, startsAt: fromLocal(f.start), endsAt: fromLocal(f.end), note: f.note });
      onDone();
    } catch (er) {
      onErr((er as Error).message);
    }
  };
  const cls = `${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`;
  return (
    <form onSubmit={submit} className="glass space-y-2 rounded-[20px] p-5">
      <div className="flex gap-2">
        {(["visit", "block"] as const).map((k) => (
          <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-[12.5px] ${kind === k ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3"}`}>
            {k === "visit" ? "Book a visit" : "Block time"}
          </button>
        ))}
      </div>
      {kind === "visit" && (
        <>
          <input aria-label="Find patient" placeholder="Search patient by name or phone" value={q} onChange={(e) => setQ(e.target.value)} className={cls} />
          {q.trim().length >= 2 && (
            <select aria-label="Patient" value={f.patientId} onChange={(e) => setF({ ...f, patientId: e.target.value })} className={cls}>
              <option value="">{patients.length ? "Choose patient" : "No match. Register them under Patients"}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.phone && `· ${p.phone}`}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Type" value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })} className={cls}>
            {s.types.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.duration_min} min)
              </option>
            ))}
          </select>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Provider" value={f.providerId} onChange={(e) => setF({ ...f, providerId: e.target.value })} className={cls}>
          <option value="">Any provider</option>
          {s.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Chair" value={f.chairId} onChange={(e) => setF({ ...f, chairId: e.target.value })} className={cls}>
          {s.chairs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <input aria-label="Start" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={cls} />
      {kind === "block" && <input aria-label="End" type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className={cls} />}
      <input aria-label="Note" placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={cls} />
      <button className="btn-primary h-9 w-full text-[12.5px]">{kind === "visit" ? "Book" : "Block"}</button>
    </form>
  );
}
