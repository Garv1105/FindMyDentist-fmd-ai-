"use client";

import { Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Empty, Panel, Tag, type Tone } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { getBillingSummary, listBills, MODES, recordPayment, refundBill, voidBill, type Bill, type Mode } from "@/sample/billing";
import { listPatients, type PatientSummary } from "@/sample/patients";
import { useClinic } from "../Shell";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const STATUS: Record<Bill["status"], [Tone, string]> = { paid: ["ok", "Paid"], refunded: ["warn", "Refunded"], void: ["muted", "Void"] };
const when = (b: Bill, today: string) =>
  `${b.date === today ? "Today" : new Date(`${b.date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} ${b.time.replace(/^0/, "")}`;
type Summary = Awaited<ReturnType<typeof getBillingSummary>>;

/* ---------------- one bill ---------------- */

function BillDetail({ bill, today, isOwner, onChange, onSay }: { bill: Bill; today: string; isOwner: boolean; onChange: (kind: "refund" | "void") => void; onSay: (t: string) => void }) {
  const [tone, label] = STATUS[bill.status];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[17px] font-medium text-ink">{bill.id}</p>
        <p className="text-[13.5px] text-ink-3">
          {when(bill, today)} · by {bill.by}
        </p>
      </div>
      <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[15px]">
        <dt className="text-ink-3">Patient</dt>
        <dd className="text-ink">{bill.patientName}</dd>
        <dt className="text-ink-3">Patient ID</dt>
        <dd className="text-ink">{bill.patientId}</dd>
        <dt className="text-ink-3">Phone</dt>
        <dd className="text-ink">{bill.phone}</dd>
        <dt className="text-ink-3">Mode</dt>
        <dd className="text-ink">
          {bill.mode}
          {bill.ref ? ` · ref ${bill.ref}` : ""}
        </dd>
      </dl>
      <ul className="mt-3">
        {bill.items.map((i) => (
          <li key={i.what} className="flex justify-between gap-3 border-t border-line py-2.5 text-[15px] text-ink-2">
            {i.what}
            <span className="text-ink">{inr(i.amountInr)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-[15px] font-semibold text-ink">
          <span className="inline-flex items-center gap-2">
            {bill.status === "paid" ? "Paid in full" : "Total"} <Tag tone={tone}>{label}</Tag>
          </span>
          <span className={bill.status === "void" ? "text-ink-3 line-through" : ""}>{inr(bill.amountInr)}</span>
        </li>
      </ul>
      {bill.change && (
        <p className="mt-2 rounded-2xl border border-line p-3 text-[14px] text-ink-2">
          {bill.change.kind === "refund" ? "Refunded" : "Voided"} by {bill.change.by} · reason: {bill.change.reason}
        </p>
      )}
      {bill.status === "paid" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onSay(`Receipt for ${bill.id} is ready to print (demo).`)}>
            Print receipt
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onSay(`Receipt sent to ${bill.phone} (demo, nothing was sent).`)}>
            Send to patient
          </Button>
          <Button size="sm" variant="secondary" disabled={!isOwner} onClick={() => onChange("refund")}>
            Refund
          </Button>
          <Button size="sm" variant="secondary" disabled={!isOwner} onClick={() => onChange("void")}>
            Void
          </Button>
        </div>
      )}
      <p className="mt-3 text-[13px] text-ink-3">
        {isOwner ? "Refund and Void need a reason, which is kept on record." : "Only the clinic owner can refund or void a bill."} FMD doesn&apos;t move money: refunds go back through your own bank or
        payment app. Clinic revenue is kept separate from FMD&apos;s own fees.
      </p>
    </div>
  );
}

function ReasonSheet({ kind, bill, onClose, onDone }: { kind: "refund" | "void"; bill: Bill; onClose: () => void; onDone: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onDone(reason);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Sheet title={`${kind === "refund" ? "Refund" : "Void"} ${bill.id}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <p className="text-[15px] text-ink-2">
          {bill.patientName} · {inr(bill.amountInr)} · {bill.mode}
        </p>
        <Field label="Reason (kept on record)">
          <input className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === "refund" ? "e.g. Treatment not needed" : "e.g. Entered twice"} />
        </Field>
        {kind === "refund" && <p className="text-[13.5px] text-ink-3">Return the money through your own bank or payment app; this records that you did.</p>}
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">{kind === "refund" ? "Record refund" : "Void bill"}</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- record a payment ---------------- */

function RecordPayment({ clinicId, onClose, onSave }: { clinicId: string; onClose: () => void; onSave: (f: { name: string; phone: string; patientId: string; amountInr: number; mode: Mode }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [patientId, setPatientId] = useState("");
  const [filled, setFilled] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Mode>("UPI");
  const [matches, setMatches] = useState<PatientSummary[]>([]);
  const [error, setError] = useState("");
  const typed = useRef("");

  useEffect(() => {
    const q = name.trim();
    if (q.length < 2 || q === typed.current) return setMatches([]);
    let live = true;
    listPatients(clinicId, { q }).then((m) => live && setMatches(m.slice(0, 4)));
    return () => {
      live = false;
    };
  }, [clinicId, name]);

  const pick = (p: PatientSummary) => {
    typed.current = p.name;
    setName(p.name);
    setPhone(p.phone.replace(/^\+91 /, ""));
    setPatientId(p.pid);
    setFilled(true);
    setMatches([]);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave({ name, phone, patientId, amountInr: Number(amount), mode });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const autoCls = filled ? "!border-[color-mix(in_srgb,var(--accent)_55%,transparent)]" : "";

  return (
    <Sheet title="Record a payment" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Patient name">
          <input
            className={fieldCls}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFilled(false);
            }}
            autoComplete="off"
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls="pay-matches"
          />
        </Field>
        {matches.length > 0 && (
          <ul id="pay-matches" role="listbox" aria-label="Matching patients" className="-mt-2 overflow-hidden rounded-2xl border border-line-strong">
            {matches.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button type="button" onClick={() => pick(p)} className="flex w-full flex-wrap justify-between gap-2 px-3.5 py-2.5 text-left text-[14.5px] text-ink hover:bg-[var(--accent-soft)]">
                  {p.name}
                  <span className="text-[13px] text-ink-3">
                    {p.pid} · {p.phone}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Phone number">
            <input className={`${fieldCls} ${autoCls}`} type="tel" inputMode="tel" value={phone} onChange={(e) => (setPhone(e.target.value), setFilled(false))} placeholder="98450 12345" />
          </Field>
          <Field label="Patient ID" hint="Leave empty for a new patient">
            <input className={`${fieldCls} ${autoCls}`} value={patientId} onChange={(e) => (setPatientId(e.target.value), setFilled(false))} placeholder="FMD-00000" />
          </Field>
        </div>
        <Field label="Amount (₹)">
          <input className={fieldCls} type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13.5px] text-ink-3">Mode of payment</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode of payment">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`h-10 rounded-full border px-4 text-[14.5px] ${mode === m ? "border-[var(--button-primary)] bg-[var(--button-primary)] font-semibold text-[var(--button-primary-fg)]" : "border-line-strong text-ink"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </fieldset>
        {filled && <p className="text-[13.5px] text-ink-3">Phone and ID were filled in from the patient&apos;s record; you can change them.</p>}
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <p className="text-[13.5px] text-ink-3">Paid in full. A receipt is created when you save.</p>
        <div className="flex gap-2">
          <Button type="submit">Save payment</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- page ---------------- */

/** FMD Clinic Billing: every bill paid in full, today's takings by mode, and owner-only refunds and voids. */
export function Billing() {
  const { clinic, branchId, user } = useClinic();
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const tab = params.get("tab") === "today" ? "today" : "bills";
  const setTab = (t: "bills" | "today") => {
    const p = new URLSearchParams(params);
    if (t === "bills") p.delete("tab");
    else p.set("tab", t);
    router.replace(`${path}?${p}`, { scroll: false });
  };
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const isOwner = user.role === "clinic_owner";

  const [q, setQ] = useState("");
  const [shown, setShown] = useState(20);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"pay" | { kind: "refund" | "void"; bill: Bill } | { view: Bill } | null>(null);
  const [toast, setToast] = useState("");
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((t: string) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([listBills(clinic.id, { branchId, q }), getBillingSummary(clinic.id, { branchId })]).then(([b, s]) => {
      if (!live) return;
      setBills(b);
      setSummary(s);
    });
    return () => {
      live = false;
    };
  }, [clinic.id, branchId, q, version]);

  const current = bills?.find((b) => b.id === selected) ?? bills?.[0] ?? null;
  const open = (b: Bill) => {
    setSelected(b.id);
    if (!window.matchMedia("(min-width: 1024px)").matches) setSheet({ view: b });
  };
  const change = (kind: "refund" | "void", bill: Bill) => setSheet({ kind, bill });

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {(
            [
              ["Collected today", inr(summary.today.totalInr), `${summary.today.count} bills · ${Object.values(summary.today.byMode).filter((m) => m.count).length} modes`],
              ["Collected this month", inr(summary.month.totalInr), `${summary.month.count} bills`],
              ["Average bill", inr(summary.month.averageInr), "this month"],
              ["Refunds this month", inr(summary.refunds.totalInr), `${summary.refunds.count} refund${summary.refunds.count === 1 ? "" : "s"} · ${summary.refunds.voids} void`],
            ] as const
          ).map(([label, v, sub]) => (
            <Panel key={label} className="p-4 sm:p-5">
              <span className="block text-[13.5px] text-ink-3">{label}</span>
              <span className="mt-1 block text-[26px] font-light tracking-[-0.03em] text-ink sm:text-[30px]">{v}</span>
              <span className="block text-[13.5px] text-ink-2">{sub}</span>
            </Panel>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-full border border-line-strong p-1" role="tablist" aria-label="Billing">
          {(
            [
              ["bills", "Bills"],
              ["today", "Today's collection"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-8 rounded-full px-4 text-[14px] ${tab === t ? "bg-[var(--button-primary)] font-semibold text-[var(--button-primary-fg)]" : "text-ink-2 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "bills" && (
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search bills</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
            <input value={q} onChange={(e) => (setQ(e.target.value), setShown(20))} placeholder="Search by name, phone, patient ID or bill number" className={`${fieldCls} rounded-full pl-11`} />
          </label>
        )}
        <Button className="ml-auto" onClick={() => setSheet("pay")}>
          <Plus className="size-4" strokeWidth={2.25} />
          Record a payment
        </Button>
      </div>

      {toast && (
        <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
          {toast}
        </p>
      )}

      {tab === "bills" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Panel as="section" className="overflow-hidden">
            {!bills ? (
              <div className="h-[360px] motion-safe:animate-pulse" aria-busy />
            ) : bills.length === 0 ? (
              <div className="p-5">
                <Empty title="No bills match" hint="Search by name, phone, patient ID or bill number." />
              </div>
            ) : (
              <ul>
                {bills.slice(0, shown).map((b) => {
                  const [tone, label] = STATUS[b.status];
                  const on = current?.id === b.id;
                  return (
                    <li key={b.id} className="border-b border-line last:border-0">
                      <button
                        type="button"
                        onClick={() => open(b)}
                        aria-current={on ? "true" : undefined}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_auto] sm:px-5 ${on ? "lg:bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-glass)]"}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-medium text-ink">{b.patientName}</span>
                          <span className="block truncate text-[13px] text-ink-3">
                            {b.patientId} · {b.phone}
                          </span>
                        </span>
                        <span className="hidden min-w-0 sm:block">
                          <span className="block truncate text-[14.5px] text-ink">{b.id}</span>
                          <span className="block text-[13px] text-ink-3">
                            {when(b, today)} · {b.mode}
                          </span>
                        </span>
                        <span className={`text-right text-[15px] text-ink ${b.status === "void" ? "text-ink-3 line-through" : ""}`}>{inr(b.amountInr)}</span>
                        <span className="col-start-2 row-start-2 text-right sm:col-start-auto sm:row-start-auto">
                          <Tag tone={tone}>{label}</Tag>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {bills.length > shown && (
                  <li className="p-3 text-center">
                    <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + 20)}>
                      Show more ({bills.length - shown} older)
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </Panel>
          <Panel as="section" className="hidden self-start p-5 lg:sticky lg:top-5 lg:block">
            {current ? <BillDetail bill={current} today={today} isOwner={isOwner} onChange={(k) => change(k, current)} onSay={say} /> : <Empty title="No bill selected" />}
          </Panel>
        </div>
      ) : (
        summary && (
          <Panel as="section" className="p-4 sm:p-5">
            <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
              Today&apos;s collection
              <span className="text-[13.5px] font-normal text-ink-3">
                {new Date(`${today}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
              </span>
            </h2>
            <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {MODES.map((m) => (
                <div key={m} className="rounded-2xl border border-line p-3">
                  <span className="block text-[22px] font-light text-ink">{inr(summary.today.byMode[m].totalInr)}</span>
                  <span className="text-[13.5px] text-ink-3">
                    {m} · {summary.today.byMode[m].count}
                  </span>
                </div>
              ))}
            </div>
            {summary.today.bills.length === 0 ? (
              <Empty title="No bills yet today" />
            ) : (
              <ul>
                {summary.today.bills.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 border-t border-line py-3 text-[15px]">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{b.patientName}</span>
                      <span className="block text-[13px] text-ink-3">
                        {b.time.replace(/^0/, "")} · {b.mode} · {b.id}
                      </span>
                    </span>
                    <span className="text-ink">{inr(b.amountInr)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-line py-3 text-[15px] font-semibold text-ink">
                  Total · {summary.today.count} bills <span>{inr(summary.today.totalInr)}</span>
                </li>
              </ul>
            )}
            <p className="mt-2 text-[13px] text-ink-3">From recorded payments only. Operational figures, not audited accounts.</p>
          </Panel>
        )
      )}

      {sheet === "pay" && (
        <RecordPayment
          clinicId={clinic.id}
          onClose={() => setSheet(null)}
          onSave={async (f) => {
            const b = await recordPayment(clinic.id, { ...f, branchId, by: user.name });
            setSheet(null);
            setSelected(b.id);
            setQ("");
            setVersion((v) => v + 1);
            say(`Saved ${b.id}: ${inr(b.amountInr)} from ${b.patientName} by ${b.mode}, paid in full (demo).`);
          }}
        />
      )}
      {sheet && typeof sheet === "object" && "view" in sheet && (
        <Sheet title="Bill" onClose={() => setSheet(null)}>
          <BillDetail bill={bills?.find((b) => b.id === sheet.view.id) ?? sheet.view} today={today} isOwner={isOwner} onChange={(k) => change(k, sheet.view)} onSay={say} />
        </Sheet>
      )}
      {sheet && typeof sheet === "object" && "kind" in sheet && (
        <ReasonSheet
          kind={sheet.kind}
          bill={sheet.bill}
          onClose={() => setSheet(null)}
          onDone={async (reason) => {
            const done = await (sheet.kind === "refund" ? refundBill : voidBill)(clinic.id, sheet.bill.id, { reason, by: user.name, role: user.role });
            setSheet(null);
            setVersion((v) => v + 1);
            say(`${done.id} ${sheet.kind === "refund" ? "refunded" : "voided"} (demo). The reason is kept on record.`);
          }}
        />
      )}
    </div>
  );
}
