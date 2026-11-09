"use client";

import { useState } from "react";
import { Empty, Panel, Tag } from "@/components/app/kit";
import type { Filters } from "@/sample/reports";
import type { gstRegister, procedureMix, revenueSummary } from "@/sample/reports-money";
import { BarRow, EstimateBadge, fmt, inr, mask, MetricTile, StackedBars } from "./parts";

export type MixData = Awaited<ReturnType<typeof procedureMix>>;
export type RevenueData = Awaited<ReturnType<typeof revenueSummary>>;
export type GstData = Awaited<ReturnType<typeof gstRegister>>;
type Open = (id: string, label: string, extra?: Partial<Filters>) => void;

const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const th = "py-2 pr-3 text-right font-medium first:text-left";
const td = "py-2.5 pr-3 text-right tabular-nums";
const short = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const PALETTE = ["var(--accent)", "var(--tone-ok)", "var(--tone-warn)", "#a78bfa", "#f472b6", "var(--text-muted)"];
const BRANCH: Record<string, string> = { main: "Main (Indiranagar)", kora: "Koramangala" };

/* ---------------- Procedure mix & revenue ---------------- */

export function ProcedureMix({ data, onOpen }: { data: MixData; onOpen: Open }) {
  const maxCat = Math.max(1, ...data.categories.map((c) => c.netInr));
  // the 5 biggest categories by revenue keep their own colour in the monthly bars; the rest are "Other"
  const top5 = data.categories.slice(0, 5).map((c) => c.label);
  const series = [...top5, "Other"].map((name, i) => ({ name, color: PALETTE[i] }));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} note={t.id === "realisationRate" ? "of list fees charged" : undefined} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            By category <span className={sub}>net revenue · visits · realised fee</span>
          </h2>
          {data.categories.length === 0 ? (
            <div className="mt-2">
              <Empty title="No paid bills in this period" />
            </div>
          ) : (
            <ul className="mt-2">
              {data.categories.map((c) => (
                <BarRow key={c.label} label={c.label} sub={`${c.count} · realised ${fmt(c.realised, "pct")}`} value={c.netInr} max={maxCat} text={inr(c.netInr)} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Month on month <span className={sub}>net revenue by category</span>
          </h2>
          <div className="mt-3">
            <StackedBars
              label="Net revenue by category per month"
              months={data.months.map((m) => {
                const other = Object.entries(m.byCategory).filter(([k]) => !top5.includes(k)).reduce((n, [, v]) => n + v, 0);
                return { label: m.label, values: [...top5.map((k) => m.byCategory[k] ?? 0), other].map((v) => Math.round(v / 1000)) };
              })}
              series={series}
            />
          </div>
          <p className="mt-2 text-[13px] text-ink-3">Bar labels in ₹ thousands.</p>
        </Panel>
      </div>
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          Top procedures <span className={sub}>up to 20, by net revenue</span>
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[460px] text-[14.5px] text-ink">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-3">
                <th className={th}>Procedure</th>
                <th className={th}>Count</th>
                <th className={th}>List fees</th>
                <th className={th}>Net</th>
                <th className="py-2 text-right font-medium">Realised</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((p) => (
                <tr key={p.label} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3">{p.label}</td>
                  <td className={td}>{p.count}</td>
                  <td className={td}>{inr(p.listInr)}</td>
                  <td className={td}>{inr(p.netInr)}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmt(p.realised, "pct")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          <span className="inline-flex items-center gap-2">
            Estimate vs final bill <EstimateBadge />
          </span>
          <span className={sub}>accepted plans completed in this period</span>
        </h2>
        {data.variance.length === 0 ? (
          <div className="mt-2">
            <Empty title="No completed plan items in this period" />
          </div>
        ) : (
          <ul className="mt-2">
            {data.variance.map((v) => (
              <li key={v.category} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 text-[14.5px] first:border-0">
                <span className="text-ink">{v.category}</span>
                <span className="tabular-nums text-ink-2">
                  {inr(v.estimate)} → {inr(v.final)}{" "}
                  <Tag tone={Math.abs(v.diffPct ?? 0) > 10 ? "warn" : "muted"}>
                    {(v.diffPct ?? 0) > 0 ? "+" : ""}
                    {fmt(v.diffPct, "pct")}
                  </Tag>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Revenue summary ---------------- */

const LEAK = [
  ["byReason", "By reason"],
  ["byStaff", "By who approved"],
  ["byProcedure", "By procedure"],
] as const;

export function RevenueSummary({ data, onOpen }: { data: RevenueData; onOpen: Open }) {
  const [leak, setLeak] = useState<(typeof LEAK)[number][0]>("byReason");
  const rows = data.discounts[leak];
  const maxLeak = Math.max(1, ...rows.map((r) => r.amountInr));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Gross to net <span className={sub}>6 months to the period end · no refunds (clinic policy)</span>
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[380px] text-[14.5px] text-ink">
              <thead>
                <tr className="border-b border-line text-[13px] text-ink-3">
                  <th className={th}>Month</th>
                  <th className={th}>Gross</th>
                  <th className={th}>Discounts</th>
                  <th className="py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.bridge.map((m) => (
                  <tr key={m.label} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">{m.label}</td>
                    <td className={td}>{inr(m.grossInr)}</td>
                    <td className={`${td} text-[var(--tone-warn)]`}>−{inr(m.discountInr)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{inr(m.netInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-ink-3">All excluding GST. Voided bills are left out.</p>
        </Panel>
        <Panel as="section" className="p-4 sm:p-5">
          <div className={h2}>
            <h2>Discounts</h2>
            <label className="text-[13px] font-normal text-ink-3">
              <span className="sr-only">Split discounts</span>
              <select value={leak} onChange={(e) => setLeak(e.target.value as typeof leak)} className="h-9 rounded-full border border-line bg-[var(--surface-glass)] px-3 text-[14px] text-ink outline-none [color-scheme:dark]">
                {LEAK.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {rows.length === 0 ? (
            <div className="mt-2">
              <Empty title="No discounts in this period" />
            </div>
          ) : (
            <ul className="mt-2">
              {rows.map((r) => (
                <BarRow key={r.label} label={r.label} sub={`${r.count} bill${r.count === 1 ? "" : "s"}`} value={r.amountInr} max={maxLeak} text={inr(r.amountInr)} tone="warn" />
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {data.byBranch.length > 1 && (
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>Branches</h2>
          <ul className="mt-2">
            {data.byBranch.map((b) => (
              <li key={b.branchId} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 text-[14.5px] first:border-0">
                <span className="text-ink">{BRANCH[b.branchId] ?? b.branchId}</span>
                <span className="tabular-nums text-ink-2">
                  {inr(b.netInr)} · {b.visits} visits · {b.perVisitInr === null ? "—" : `${inr(b.perVisitInr)} a visit`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ---------------- GST & invoice register ---------------- */

const SHOW = 200;

export function GstRegister({ data, identifiers, onOpen }: { data: GstData; identifiers: boolean; onOpen: Open }) {
  const t = data.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.tiles.map((x) => (
          <MetricTile key={x.id} t={x} onOpen={onOpen} />
        ))}
      </div>
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          Invoice register{" "}
          <span className={sub}>
            {t.invoices} invoices · {t.creditNotes} credit notes · taxable {inr(t.taxableInr)} · GST {inr(t.gstInr)} · exempt {inr(t.exemptInr)}
          </span>
        </h2>
        {data.rows.length === 0 ? (
          <div className="mt-2">
            <Empty title="No invoices in this period" />
          </div>
        ) : (
          <div className="mt-2 max-h-[520px] overflow-auto">
            <table className="w-full min-w-[760px] text-[14px] text-ink">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="border-b border-line text-[13px] text-ink-3">
                  <th className={th}>Invoice</th>
                  <th className={th}>Date</th>
                  <th className={`${th} !text-left`}>Patient</th>
                  <th className={th}>Taxable</th>
                  <th className={th}>Rate</th>
                  <th className={th}>GST</th>
                  <th className={th}>Exempt</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, SHOW).map((r) => (
                  <tr key={r.invoice} className={`border-b border-line last:border-0 ${r.creditNote ? "text-ink-3" : ""}`}>
                    <td className="py-2 pr-3 font-mono text-[13px]">
                      {r.invoice}
                      {r.creditNote && (
                        <span className="ml-2">
                          <Tag tone="warn">Credit note</Tag>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{short(r.date)}</td>
                    <td className="py-2 pr-3">{mask(r.patientName, identifiers)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.taxableInr ? inr(r.taxableInr) : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.rates.length ? r.rates.map((x) => `${x}%`).join(", ") : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.gstInr ? inr(r.gstInr) : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.exemptInr ? inr(r.exemptInr) : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{inr(r.totalInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.rows.length > SHOW && <p className="mt-2 text-[13px] text-ink-3">Showing the first {SHOW} of {data.rows.length}. Export for the full register.</p>}
        <p className="mt-2 text-[13px] text-ink-3">
          GST rates come from your service-to-rate mapping, which your CA should confirm; FMD doesn&apos;t give tax advice. Voided bills appear as credit notes. Patient names are masked unless the owner includes identifiers.
        </p>
      </Panel>
    </div>
  );
}
