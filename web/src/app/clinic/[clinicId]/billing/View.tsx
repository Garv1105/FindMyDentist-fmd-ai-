"use client";

import { useCallback, useEffect, useState } from "react";
import { H, inr, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Invoice = {
  id: string;
  number: string;
  status: string;
  patient: string;
  totalInr: number;
  paidInr: number;
  balanceInr: number;
  voidReason: string;
  items: { description: string; qty: number; lineInr: number }[];
  payments: { kind: string; amountInr: number; mode: string; reference: string; reason: string; recorded_at: number; by: string }[];
};
type Sheet = { entries: { kind: string; amountInr: number; mode: string; number: string; patient: string; recorded_at: number }[]; byModeInr: Record<string, number>; collectedInr: number; refundedInr: number; netInr: number; outstandingInr: number; note: string };
const MODES = ["cash", "upi", "card", "bank", "other"];
const key = () => crypto.randomUUID();

export default function BillingPage() {
  const { call, can } = useClinic();
  const [list, setList] = useState<Invoice[] | null>(null);
  const [sel, setSel] = useState<Invoice | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const load = useCallback(() => {
    call<Invoice[]>("invoices").then(setList).catch((e) => setMsg({ kind: "error", text: e.message }));
    call<Sheet>("collections").then(setSheet).catch(() => {});
  }, [call]);
  useEffect(load, [load]);
  const act = async (fn: () => Promise<Invoice>) => {
    setMsg(null);
    try {
      setSel(await fn());
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  return (
    <>
      <H title="Billing" desc="The clinic's own treatment billing. These amounts are clinic revenue, never FMD revenue." />
      {msg && (
        <div className="mb-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
      {sheet && (
        <section className="glass mb-5 rounded-[20px] p-5">
          <h2 className="text-[15px] text-ink">Today&apos;s collection sheet</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-5">
            {[
              ["Collected", sheet.collectedInr],
              ["Refunded", sheet.refundedInr],
              ["Net", sheet.netInr],
              ["Outstanding (all)", sheet.outstandingInr],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-ink-4">{l}</p>
                <p className="text-[18px] text-ink">{inr(v as number)}</p>
              </div>
            ))}
            <div>
              <p className="text-ink-4">By mode</p>
              <p className="text-ink-2">{Object.entries(sheet.byModeInr).filter(([, v]) => v).map(([m, v]) => `${m.toUpperCase()} ${inr(v)}`).join(" · ") || "—"}</p>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-4">{sheet.note}</p>
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {can("billing.write") && <NewInvoice onCreated={(i) => (setSel(i), load())} onErr={(t) => setMsg({ kind: "error", text: t })} />}
          <ul className="divide-y divide-[var(--border)] rounded-[18px] border border-line">
            {list?.length === 0 && <li className="p-6 text-center text-[13px] text-ink-4">No invoices yet.</li>}
            {list?.map((i) => (
              <li key={i.id}>
                <button onClick={() => setSel(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-[var(--accent-soft)]">
                  <span className="w-32 font-mono text-ink-3">{i.number}</span>
                  <span className="flex-1 text-ink">{i.patient}</span>
                  <span className="text-ink-2">{inr(i.totalInr)}</span>
                  <span className="w-28 text-right text-[12px] capitalize text-ink-4">{i.status.replace("_", " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {sel && (
          <section className="glass space-y-3 rounded-[20px] p-5 text-[13px]">
            <div className="flex justify-between">
              <p className="font-mono text-ink">{sel.number}</p>
              <span className="capitalize text-ink-3">{sel.status.replace("_", " ")}</span>
            </div>
            <p className="text-ink-2">{sel.patient}</p>
            <ul className="space-y-0.5 text-ink-3">
              {sel.items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {it.description} × {it.qty}
                  </span>
                  <span>{inr(it.lineInr)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-line pt-2 text-ink">
              <span>Total · paid · balance</span>
              <span>
                {inr(sel.totalInr)} · {inr(sel.paidInr)} · {inr(sel.balanceInr)}
              </span>
            </p>
            {sel.voidReason && <p className="text-ink-3">Voided: {sel.voidReason}</p>}
            {sel.payments.map((p, i) => (
              <p key={i} className="text-[12px] text-ink-4">
                {when(p.recorded_at)} · {p.kind === "refund" ? "Refund" : "Payment"} {inr(p.amountInr)} by {p.mode.toUpperCase()}
                {p.reference && ` (${p.reference})`}
                {p.reason && `: ${p.reason}`} · {p.by}
              </p>
            ))}
            {sel.status === "draft" && can("billing.write") && (
              <button onClick={() => act(() => call<Invoice>(`invoices/${sel.id}/issue`, "POST"))} className="btn-primary h-9 px-4 text-[12.5px]">
                Issue invoice
              </button>
            )}
            {["issued", "partially_paid"].includes(sel.status) && can("billing.write") && <Money label="Record payment" path={`invoices/${sel.id}/payments`} onDone={(i) => (setSel(i), load())} onErr={(t) => setMsg({ kind: "error", text: t })} />}
            {sel.paidInr > 0 && can("billing.refund") && <Money label="Record refund" refund path={`invoices/${sel.id}/refunds`} onDone={(i) => (setSel(i), load())} onErr={(t) => setMsg({ kind: "error", text: t })} />}
            {sel.status !== "void" && sel.paidInr === 0 && can("billing.refund") && (
              <button
                onClick={() => {
                  const reason = prompt("Why is this invoice being voided?");
                  if (reason) act(() => call<Invoice>(`invoices/${sel.id}/void`, "POST", { reason }));
                }}
                className="text-[12px] text-ink-3 underline underline-offset-4"
              >
                Void invoice
              </button>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function Money({ label, path, refund, onDone, onErr }: { label: string; path: string; refund?: boolean; onDone: (i: Invoice) => void; onErr: (t: string) => void }) {
  const { call } = useClinic();
  const [f, setF] = useState({ amountInr: "", mode: "upi", reference: "", reason: "" });
  const [k] = useState(key);
  const submit = async () => {
    try {
      onDone(await call<Invoice>(path, "POST", { ...f, amountInr: Number(f.amountInr), idempotencyKey: k }));
    } catch (e) {
      onErr((e as Error).message);
    }
  };
  return (
    <div className="space-y-1.5 rounded-xl border border-line p-3">
      <p className="text-ink-2">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        <input aria-label="Amount (₹)" type="number" min={1} placeholder="₹" value={f.amountInr} onChange={(e) => setF({ ...f, amountInr: e.target.value })} className={`${inputCls} h-9 px-2 text-[12.5px]`} />
        <select aria-label="Mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} className={`${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m.toUpperCase()}
            </option>
          ))}
        </select>
        <input aria-label="Reference" placeholder="Ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={`${inputCls} h-9 px-2 text-[12.5px]`} />
      </div>
      {refund && <input aria-label="Refund reason" placeholder="Reason (required)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />}
      <button onClick={submit} className="btn-primary h-8 px-3 text-[12px]">
        Save
      </button>
    </div>
  );
}

function NewInvoice({ onCreated, onErr }: { onCreated: (i: Invoice) => void; onErr: (t: string) => void }) {
  const { call } = useClinic();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [patientId, setPatientId] = useState("");
  const [plans, setPlans] = useState<{ id: string; title: string; status: string; totalInr: number }[]>([]);
  const [lines, setLines] = useState([{ description: "", qty: 1, unitInr: 0, discountInr: 0 }]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => call<{ id: string; name: string }[]>(`patients?q=${encodeURIComponent(q)}`).then(setPatients).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q, call]);
  useEffect(() => {
    if (patientId) call<typeof plans>(`patients/${patientId}/plans`).then((p) => setPlans(p.filter((x) => x.status === "accepted"))).catch(() => setPlans([]));
  }, [patientId, call]);
  const create = async (planId?: string) => {
    try {
      onCreated(await call<Invoice>("invoices", "POST", planId ? { patientId, planId } : { patientId, items: lines }));
      setOpen(false);
    } catch (e) {
      onErr((e as Error).message);
    }
  };
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary h-9 px-4 text-[12.5px]">
        New invoice
      </button>
    );
  return (
    <div className="glass space-y-2 rounded-[20px] p-5">
      <input aria-label="Find patient" placeholder="Search patient" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-9 text-[12.5px]`} />
      <select aria-label="Patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} className={`${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`}>
        <option value="">Choose patient</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {plans.map((p) => (
        <button key={p.id} onClick={() => create(p.id)} className="btn-ghost h-9 w-full text-[12.5px]">
          Invoice accepted plan: {p.title} ({inr(p.totalInr)})
        </button>
      ))}
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_50px_80px_70px] gap-1.5">
          <input aria-label="Description" placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={`${inputCls} h-9 text-[12px]`} />
          <input aria-label="Qty" type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className={`${inputCls} h-9 px-2 text-[12px]`} />
          <input aria-label="Price (₹)" type="number" min={0} value={l.unitInr} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitInr: Number(e.target.value) } : x)))} className={`${inputCls} h-9 px-2 text-[12px]`} />
          <input aria-label="Discount (₹)" type="number" min={0} value={l.discountInr} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, discountInr: Number(e.target.value) } : x)))} className={`${inputCls} h-9 px-2 text-[12px]`} />
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setLines([...lines, { description: "", qty: 1, unitInr: 0, discountInr: 0 }])} className="text-[12px] text-ink-3 underline underline-offset-4">
          Add line
        </button>
        <button disabled={!patientId} onClick={() => create()} className="btn-primary ml-auto h-9 px-4 text-[12.5px] disabled:opacity-50">
          Save draft
        </button>
      </div>
    </div>
  );
}
