"use client";

import { useEffect, useState } from "react";
import { H, inr, useClinic } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type R = {
  utilisationPct: number | null;
  cancellationRatePct: number | null;
  noShowRatePct: number | null;
  appointments: number;
  collectionsInr: number;
  procedureMix: { description: string; n: number }[];
  recallDueNow: number;
  definitions: Record<string, string>;
};
const iso = (t: number) => new Date(t + 5.5 * 3600_000).toISOString().slice(0, 10);
const ms = (d: string) => new Date(`${d}T00:00:00+05:30`).getTime();

export default function ReportsPage() {
  const { call, clinicId } = useClinic();
  const [from, setFrom] = useState(() => iso(Date.now() - 30 * 86400_000));
  const [to, setTo] = useState(() => iso(Date.now()));
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    call<R>(`reports?from=${ms(from)}&to=${ms(to)}`).then(setR).catch((e) => setErr(e.message));
  }, [call, from, to]);
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
  return (
    <>
      <H title="Reports" desc="Operational figures from Clinic OS records, with their definitions. Not audited financial statements.">
        <div className="flex items-center gap-2 text-[12.5px]">
          <input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} h-9 !w-auto text-[12.5px]`} />
          <span className="text-ink-4">to</span>
          <input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} h-9 !w-auto text-[12.5px]`} />
          {/* a CSV file download from an API route, not page navigation */}
          <a href={`/api/clinic/${clinicId}/reports/export?from=${ms(from)}&to=${ms(to)}`} download className="btn-ghost h-9 px-4 text-[12.5px]">
            Export CSV
          </a>
        </div>
      </H>
      {err && <Notice kind="error">{err}</Notice>}
      {r && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(
              [
                ["Utilisation", pct(r.utilisationPct), "utilisationPct"],
                ["Cancellation rate", pct(r.cancellationRatePct), "cancellationRatePct"],
                ["No-show rate", pct(r.noShowRatePct), "noShowRatePct"],
                ["Collections", inr(r.collectionsInr), "collectionsInr"],
                ["Appointments", String(r.appointments), ""],
                ["Due for recall now", String(r.recallDueNow), "recallDueNow"],
              ] as const
            ).map(([label, value, def]) => (
              <div key={label} className="glass rounded-[18px] p-5">
                <dt className="text-[12px] text-ink-4">{label}</dt>
                <dd className="mt-1 text-[26px] font-light text-ink">{value}</dd>
                {def && <p className="mt-1 text-[11.5px] text-ink-4">{r.definitions[def]}</p>}
              </div>
            ))}
          </dl>
          <section className="glass mt-5 rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">Procedure mix (issued invoices)</h2>
            <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
              {r.procedureMix.length === 0 && <li className="text-ink-4">No invoices in this range.</li>}
              {r.procedureMix.map((m) => (
                <li key={m.description} className="flex justify-between">
                  <span>{m.description}</span>
                  <span>{m.n}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
