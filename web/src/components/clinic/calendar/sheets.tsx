"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { bookAppointment, setStatus, type StatusAction } from "@/sample/calendar";
import { CHAIRS, type Appointment } from "@/sample/clinic";
import { listPatients, type PatientSummary } from "@/sample/patients";
import { hm, statusOf } from "./parts";

const STEPS = ["Booked", "Confirmed", "Checked in", "Done"] as const;
const stepOf = (a: Appointment) => ({ booked: 0, unconfirmed: 0, confirmed: 1, checked_in: 2, completed: 3, no_show: -1, cancelled: -1 })[a.status];

/** What can happen next to an appointment, given where it is now (PRD 6.4 lifecycle). */
function nextActions(a: Appointment): [StatusAction, string][] {
  switch (a.status) {
    case "booked":
    case "unconfirmed":
      return [["confirm", "Mark confirmed"], ["check_in", "Check in"]];
    case "confirmed":
      return [["check_in", "Check in"]];
    case "checked_in":
      return [["complete", "Mark done"]];
    default:
      return [];
  }
}

export function ApptSheet({ appt, clinicId, base, onClose, onChanged }: { appt: Appointment; clinicId: string; base: string; onClose: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState(appt);
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    listPatients(clinicId, { q: appt.patientName }).then((list) => setPatient(list.find((p) => p.name === appt.patientName) ?? null));
  }, [clinicId, appt.patientName]);

  const act = async (a: StatusAction) => {
    try {
      setCurrent(await setStatus(clinicId, current.id, a));
      setError("");
      setConfirmCancel(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const [tone, label] = statusOf(current);
  const step = stepOf(current);
  const open = !["completed", "no_show", "cancelled"].includes(current.status);
  const end = new Date(Date.parse(current.start) + current.minutes * 60_000).toISOString();

  return (
    <Sheet title={current.patientName} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[14px] text-ink-3">
        <Tag tone={tone}>{label}</Tag>
        {patient && (
          <Link href={`${base}/patients/${patient.id}`} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Open patient record ›
          </Link>
        )}
      </div>
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[15px]">
        <dt className="text-ink-3">Time</dt>
        <dd className="text-ink">
          {hm(current.start)} – {new Date(Date.parse(end)).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })} · {current.minutes} min
        </dd>
        <dt className="text-ink-3">Treatment</dt>
        <dd className="text-ink">{current.type}</dd>
        <dt className="text-ink-3">Dentist</dt>
        <dd className="text-ink">
          {current.dentist} · {current.chair}
        </dd>
        <dt className="text-ink-3">Booked</dt>
        <dd className="text-ink">{current.viaFmd ? "By the patient, via FMD" : "At the front desk"}</dd>
        {patient && (
          <>
            <dt className="text-ink-3">Phone</dt>
            <dd className="text-ink">{patient.phone}</dd>
          </>
        )}
      </dl>

      {step >= 0 && (
        <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="text-[12px] text-ink-3" aria-current={i === step ? "step" : undefined}>
              <span className={`mb-1.5 block h-1.5 rounded-full ${i <= step ? "bg-[var(--accent)]" : "bg-[var(--surface-glass)] ring-1 ring-[var(--border)]"}`} />
              <span className={i === step ? "font-medium text-ink" : ""}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[14px] text-[var(--tone-bad)]">
          {error}
        </p>
      )}

      {open && (
        <div className="mt-5 flex flex-wrap gap-2">
          {nextActions(current).map(([a, text], i) => (
            <Button key={a} variant={i === 0 ? "primary" : "secondary"} onClick={() => act(a)}>
              {text}
            </Button>
          ))}
          {current.status !== "checked_in" && (
            <Button variant="secondary" onClick={() => act("no_show")}>
              No-show
            </Button>
          )}
          {confirmCancel ? (
            <Button variant="secondary" className="!border-[var(--tone-bad)] !text-[var(--tone-bad)]" onClick={() => act("cancel")}>
              Yes, cancel it
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
              Cancel appointment
            </Button>
          )}
        </div>
      )}
      <p className="mt-4 text-[13px] text-ink-3">Preview: changes stay on this screen and nothing is sent to the patient.</p>
    </Sheet>
  );
}

export const TREATMENTS: [name: string, minutes: number][] = [
  ["Consultation", 20],
  ["Check-up", 20],
  ["Kids' check-up", 20],
  ["Scaling & polishing", 30],
  ["Filling", 30],
  ["Braces review", 30],
  ["Extraction", 45],
  ["Crown preparation", 45],
  ["Root canal", 60],
  ["Whitening", 60],
];

export type BookDraft = { branchId: string; chair: string; date: string; start: string; patientName?: string };

export function BookSheet({ clinicId, draft, onClose, onBooked }: { clinicId: string; draft: BookDraft; onClose: () => void; onBooked: (a: Appointment) => void }) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [name, setName] = useState(draft.patientName ?? "");
  const [treatment, setTreatment] = useState("Consultation");
  const [where, setWhere] = useState(`${draft.branchId}|${draft.chair}`);
  const [date, setDate] = useState(draft.date);
  const [start, setStart] = useState(draft.start);
  const [problem, setProblem] = useState<{ reason: string; suggestions: string[] } | null>(null);
  useEffect(() => {
    listPatients(clinicId).then(setPatients);
  }, [clinicId]);

  const minutes = TREATMENTS.find(([t]) => t === treatment)?.[1] ?? 30;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setProblem({ reason: "Enter the patient's name.", suggestions: [] });
    const [branchId, chair] = where.split("|");
    const r = await bookAppointment(clinicId, { branchId, chair, date, start, minutes, patientName: name.trim(), type: treatment });
    if (r.ok) onBooked(r.appt);
    else setProblem(r);
  };

  return (
    <Sheet title="New appointment" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Patient">
          <input className={fieldCls} list="fmd-patients" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name of an existing or new patient" autoComplete="off" />
          <datalist id="fmd-patients">
            {patients.map((p) => (
              <option key={p.id} value={p.name}>
                {p.phone}
              </option>
            ))}
          </datalist>
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Treatment">
            <select className={fieldCls} value={treatment} onChange={(e) => setTreatment(e.target.value)}>
              {TREATMENTS.map(([t, m]) => (
                <option key={t} value={t}>
                  {t} · {m} min
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dentist and chair">
            <select className={fieldCls} value={where} onChange={(e) => (setWhere(e.target.value), setProblem(null))}>
              {Object.entries(CHAIRS).flatMap(([b, chairs]) =>
                chairs.map((c) => (
                  <option key={`${b}|${c.chair}`} value={`${b}|${c.chair}`}>
                    {c.dentist} · {c.chair}
                    {b === "kora" ? " · Koramangala" : ""}
                  </option>
                )),
              )}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className={fieldCls} value={date} onChange={(e) => (setDate(e.target.value), setProblem(null))} />
          </Field>
          <Field label="Time">
            <input type="time" step={900} className={fieldCls} value={start} onChange={(e) => (setStart(e.target.value), setProblem(null))} />
          </Field>
        </div>
        {problem && (
          <div role="alert" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-warn)_8%,transparent)] p-3.5 text-[14.5px] text-ink-2">
            {problem.reason}
            {problem.suggestions.length > 0 && (
              <span className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-ink-3">Free nearby:</span>
                {problem.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => (setStart(s), setProblem(null))} className="rounded-full border border-line-strong px-3 py-1 text-[14px] font-medium text-ink hover:border-[var(--accent)]">
                    {s.replace(/^0/, "")}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          <Button type="submit">Book appointment</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
