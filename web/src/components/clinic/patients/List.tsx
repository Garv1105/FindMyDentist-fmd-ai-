"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Empty, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { addPatient, findDuplicates, listPatients, type Flag, type PatientSummary } from "@/sample/patients";
import { useClinic } from "../Shell";

const FILTERS: [Flag | "", string][] = [
  ["", "All"],
  ["recall", "Due for recall"],
  ["balance", "Balance due"],
  ["in_treatment", "Treatment in progress"],
  ["consent_missing", "Missing consent"],
];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function Avatar({ p }: { p: PatientSummary }) {
  return <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[13.5px] font-semibold text-ink ring-1 ring-[var(--border-strong)]">{p.initials}</span>;
}

const meta = (p: PatientSummary) => `${p.sex} · ${p.age} · ${p.guardian ? `guardian: ${p.guardian}` : p.phone}`;

function NewPatient({ clinicId, onClose, onAdded }: { clinicId: string; onClose: () => void; onAdded: (p: PatientSummary) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", dob: "", sex: "F" as "F" | "M" });
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      onAdded(await addPatient(clinicId, form));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Sheet title="New patient" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Full name">
          <input className={fieldCls} value={form.name} onChange={set("name")} autoComplete="off" />
        </Field>
        <Field label="Mobile number" hint="10 digits; used for reminders once the patient agrees">
          <input className={fieldCls} type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="98450 12345" />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Date of birth">
            <input className={fieldCls} type="date" value={form.dob} onChange={set("dob")} />
          </Field>
          <Field label="Sex">
            <select className={fieldCls} value={form.sex} onChange={set("sex")}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <Button type="submit">Add patient</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** FMD Clinic Patients (PRD 6.3): find anyone fast, see who needs attention, and catch double registrations. */
export function PatientList() {
  const { clinic, base } = useClinic();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Flag | "">("");
  const [rows, setRows] = useState<PatientSummary[] | null>(null);
  const [all, setAll] = useState<PatientSummary[]>([]);
  const [dupes, setDupes] = useState<[PatientSummary, PatientSummary][]>([]);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([listPatients(clinic.id, { q, filter: filter || undefined }), listPatients(clinic.id), findDuplicates(clinic.id)]).then(([r, a, d]) => {
      if (!live) return;
      setRows(r);
      setAll(a);
      setDupes(d);
    });
    return () => {
      live = false;
    };
  }, [clinic.id, q, filter, version]);

  const count = (f: Flag | "") => (f ? all.filter((p) => p.flags.includes(f)).length : all.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search patients</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or patient ID" className={`${fieldCls} rounded-full pl-11`} />
        </label>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" strokeWidth={2.25} />
          New patient
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter patients">
        {FILTERS.map(([f, label]) => (
          <button
            key={f || "all"}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-[14px] ${filter === f ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:text-ink"}`}
          >
            {label} <span className="text-ink-3">{count(f)}</span>
          </button>
        ))}
      </div>

      {toast && (
        <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
          {toast}
        </p>
      )}

      {dupes.map(([a, b]) => (
        <div key={`${a.id}-${b.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--tone-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-warn)_7%,transparent)] px-4 py-3 text-[14.5px] text-ink-2">
          <Tag tone="warn">Possible duplicate</Tag>
          <span className="min-w-0 flex-1">
            <b className="font-medium text-ink">{a.name}</b> and <b className="font-medium text-ink">{b.name}</b> share a phone number and date of birth.
          </span>
          <Link href={`${base}/patients/${b.id}`} className="rounded-full border border-line-strong px-3.5 py-1.5 text-[14px] text-ink hover:border-[var(--accent)]">
            Review
          </Link>
        </div>
      ))}

      <Panel as="section" className="overflow-hidden">
        {!rows ? (
          <div className="h-[360px] motion-safe:animate-pulse" aria-busy />
        ) : rows.length === 0 ? (
          <div className="p-5">
            <Empty title="No patients match" hint="Check the spelling, or search by phone number." />
          </div>
        ) : (
          <>
            {/* laptops: a table */}
            <table className="hidden w-full text-left lg:table">
              <thead>
                <tr className="border-b border-line text-[13px] text-ink-3">
                  {["Patient", "Last visit", "Next", "Treatment", "Balance · consent"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line text-[14.5px] last:border-0 hover:bg-[var(--surface-glass)]">
                    <td className="px-4 py-3">
                      <Link href={`${base}/patients/${p.id}`} className="flex items-center gap-3 whitespace-nowrap">
                        <Avatar p={p} />
                        <span>
                          <span className="block font-medium text-ink">{p.name}</span>
                          <span className="block text-[13px] text-ink-3">{meta(p)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {p.lastVisit ? (
                        <>
                          {p.lastVisit.date}
                          <span className="block text-[13px] text-ink-3">{p.lastVisit.what}</span>
                        </>
                      ) : (
                        <span className="text-ink-3">New patient</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{p.next ? p.next.tone ? <Tag tone={p.next.tone}>{p.next.label}</Tag> : p.next.label : <span className="text-ink-3">—</span>}</td>
                    <td className="px-4 py-3">{p.treatment ? <Tag tone={p.treatment.tone}>{p.treatment.label}</Tag> : <span className="text-ink-3">None</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`block ${p.balanceInr ? "text-ink" : "text-ink-3"}`}>{p.balanceInr ? `${inr(p.balanceInr)} due` : "Nothing due"}</span>
                      <span className="mt-1 block">
                        <Tag tone={p.consent.tone}>{p.consent.tone === "ok" ? `Consent: ${p.consent.label.toLowerCase()}` : p.consent.label}</Tag>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* phones and tablets: cards */}
            <ul className="lg:hidden">
              {rows.map((p) => (
                <li key={p.id} className="border-b border-line last:border-0">
                  <Link href={`${base}/patients/${p.id}`} className="flex items-start gap-3 px-4 py-3.5">
                    <Avatar p={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{p.name}</span>
                      <span className="block text-[13px] text-ink-3">{meta(p)}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.next && <Tag tone={p.next.tone ?? "accent"}>{p.next.label}</Tag>}
                        {p.treatment && <Tag tone={p.treatment.tone}>{p.treatment.label}</Tag>}
                        {p.balanceInr > 0 && <Tag tone="muted">{inr(p.balanceInr)} due</Tag>}
                        {p.consent.tone !== "ok" && <Tag tone={p.consent.tone}>{p.consent.label}</Tag>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {adding && (
        <NewPatient
          clinicId={clinic.id}
          onClose={() => setAdding(false)}
          onAdded={(p) => {
            setAdding(false);
            setVersion((v) => v + 1);
            setToast(`Added ${p.name} (demo, kept until you reload).`);
            setTimeout(() => setToast(""), 3500);
          }}
        />
      )}
    </div>
  );
}
