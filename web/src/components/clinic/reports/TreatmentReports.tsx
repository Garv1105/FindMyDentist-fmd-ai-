"use client";

import { useState } from "react";
import { Button, Empty, Panel, Tag } from "@/components/app/kit";
import type { Filters } from "@/sample/reports";
import type { acceptanceReport, pendingReport, recallReport } from "@/sample/reports-treatment";
import { BarRow, fmt, inr, MetricTile } from "./parts";

export type RecallData = Awaited<ReturnType<typeof recallReport>>;
export type AcceptData = Awaited<ReturnType<typeof acceptanceReport>>;
export type PendingData = Awaited<ReturnType<typeof pendingReport>>;
type Open = (id: string, label: string, extra?: Partial<Filters>) => void;

const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const short = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });
const segBtn = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-[13.5px] ${on ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:text-ink"}`;
const approvalNote = "FMD Manager drafts the messages; staff approve them before anything is sent.";

/* ---------------- Recall & follow-up ---------------- */

const TABS = [
  ["overdue", "Overdue"],
  ["due", "Due in 30 days"],
  ["contacted", "Contacted"],
  ["completed", "Completed"],
  ["opted_out", "Opted out"],
] as const;

export function Recall({ data, onOpen, onSay }: { data: RecallData; onOpen: Open; onSay: (t: string) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overdue");
  const list = data.tabs[tab];
  const maxCh = Math.max(1, ...data.byChannel.map((c) => c.value ?? 0));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} note={t.denominator ? `${t.numerator} of ${t.denominator}` : undefined} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Recall list <span className={sub}>6-month check · as of today</span>
          </h2>
          <div role="tablist" aria-label="Recall status" className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={segBtn(tab === k)}>
                {label} <span className="tabular-nums text-ink-3">{data.tabs[k].count}</span>
              </button>
            ))}
          </div>
          {list.count === 0 ? (
            <div className="mt-3">
              <Empty title="Nobody here" />
            </div>
          ) : (
            <ul className="mt-2 max-h-[420px] overflow-y-auto">
              {list.rows.map((r) => (
                <li key={`${r.name}-${r.due}`} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] text-ink">{r.name}</span>
                    <span className="block text-[13px] text-ink-3">
                      due {short(r.due)}
                      {r.channel ? ` · ${r.channel}${r.attempts ? `, ${r.attempts} attempt${r.attempts === 1 ? "" : "s"}` : ""}` : ""}
                    </span>
                  </span>
                  {tab === "overdue" && r.daysOverdue !== null && <Tag tone={r.daysOverdue > 90 ? "bad" : "warn"}>{r.daysOverdue} days</Tag>}
                </li>
              ))}
            </ul>
          )}
          {list.count > list.rows.length && <p className="mt-2 text-[13px] text-ink-3">Showing the first {list.rows.length} of {list.count}. Export for the full list.</p>}
          {(tab === "overdue" || tab === "due") && list.count > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-[13px] text-ink-3">{approvalNote}</p>
              <Button size="sm" onClick={() => onSay(`Recall task for ${list.count} patient${list.count === 1 ? "" : "s"} queued for FMD Manager to draft. Nothing is sent until staff approve it (demo).`)}>
                Create recall task
              </Button>
            </div>
          )}
        </Panel>
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Recall → booking <span className={sub}>by channel, this period</span>
          </h2>
          <ul className="mt-2">
            {data.byChannel.map((c) => (
              <BarRow key={c.channel} label={c.channel} sub={`${c.booked} of ${c.contacted} booked`} value={c.value ?? 0} max={maxCh} text={fmt(c.value, "pct")} />
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-3">Opted-out patients are never contacted and are left out of every rate.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Case acceptance ---------------- */

const OUTCOME: Record<string, [string, "ok" | "bad" | "warn" | "muted"]> = {
  accepted: ["Accepted", "ok"],
  declined: ["Declined", "bad"],
  deferred: ["Deferred", "warn"],
  undecided: ["No decision yet", "muted"],
};

export function Acceptance({ data, onOpen }: { data: AcceptData; onOpen: Open }) {
  const cutNames = Object.keys(data.cuts) as (keyof AcceptData["cuts"])[];
  const [cut, setCut] = useState<keyof AcceptData["cuts"]>(cutNames[0]);
  const rows = data.cuts[cut];
  const maxReason = Math.max(1, ...data.declineReasons.map((r) => r.count));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} note={t.id === "caseAcceptance" ? `by value ${fmt(t.byValue ?? null, "pct")}` : "median"} />
        ))}
        <Panel className="col-span-2 p-3.5 sm:col-span-1 sm:p-4">
          <span className="text-[13.5px] text-ink-3">Outcomes</span>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.outcomes.map((o) => (
              <li key={o.status}>
                <Tag tone={OUTCOME[o.status][1]}>
                  {OUTCOME[o.status][0]} {o.count}
                </Tag>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel as="section" className="p-4 sm:p-5">
          <div className={h2}>
            <h2>Acceptance by</h2>
            <label className="text-[13px] font-normal text-ink-3">
              <span className="sr-only">Split by</span>
              <select value={cut} onChange={(e) => setCut(e.target.value as typeof cut)} className="h-9 rounded-full border border-line bg-[var(--surface-glass)] px-3 text-[14px] text-ink outline-none [color-scheme:dark]">
                {cutNames.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          {rows.length === 0 ? (
            <div className="mt-2">
              <Empty title="No plans presented in this period" />
            </div>
          ) : (
            <ul className="mt-2">
              {rows.map((r) => (
                <BarRow key={r.label} label={r.label} sub={`${r.accepted} of ${r.presented} · by value ${fmt(r.byValue, "pct")}`} value={r.value ?? 0} max={100} text={fmt(r.value, "pct")} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-[13px] text-ink-3">Values are treatment estimates (Estimate), not invoiced amounts.</p>
        </Panel>
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Why patients declined <span className={sub}>reason picked at the desk</span>
          </h2>
          {data.declineReasons.length === 0 ? (
            <div className="mt-2">
              <Empty title="No declines in this period" />
            </div>
          ) : (
            <ul className="mt-2">
              {data.declineReasons.map((r) => (
                <BarRow key={r.reason} label={r.reason} value={r.count} max={maxReason} text={String(r.count)} tone={r.reason === "Other" ? "muted" : "warn"} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Pending treatment ---------------- */

export function Pending({ data, money, onOpen, onSay }: { data: PendingData; money: boolean; onOpen: Open; onSay: (t: string) => void }) {
  const [open, setOpen] = useState(data.groups[0]?.key ?? "");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} />
        ))}
        {data.groups.map((g) => (
          <Panel key={g.key} className="p-3.5 sm:p-4">
            <button type="button" onClick={() => setOpen(g.key)} className="block w-full text-left" aria-pressed={open === g.key}>
              <span className="block text-[13.5px] text-ink-3">{g.label}</span>
              <span className={`mt-0.5 block text-[24px] font-light tracking-[-0.03em] sm:text-[28px] ${open === g.key ? "text-[var(--accent)]" : "text-ink"}`}>{g.count}</span>
              {money && g.valueInr !== undefined && <span className="block text-[13px] text-ink-3">{inr(g.valueInr)} estimated</span>}
            </button>
          </Panel>
        ))}
      </div>
      {data.groups
        .filter((g) => g.key === open)
        .map((g) => (
          <Panel as="section" key={g.key} className="p-4 sm:p-5">
            <h2 className={h2}>
              {g.label} <span className={sub}>presented since {short(data.since)}, oldest first</span>
            </h2>
            {g.count === 0 ? (
              <div className="mt-2">
                <Empty title="Nothing pending here" />
              </div>
            ) : (
              <ul className="mt-2 max-h-[440px] overflow-y-auto">
                {g.rows.map((r) => (
                  <li key={`${r.name}-${r.presented}-${r.procedure}`} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] text-ink">
                        {r.name} · {r.procedure}
                      </span>
                      <span className="block text-[13px] text-ink-3">
                        {r.dentist} · presented {short(r.presented)}
                        {money && "estimateInr" in r && r.estimateInr !== undefined ? ` · ${inr(r.estimateInr)}` : ""}
                      </span>
                    </span>
                    <Tag tone={r.ageDays > 90 ? "bad" : r.ageDays > 30 ? "warn" : "muted"}>{r.ageDays} days</Tag>
                  </li>
                ))}
              </ul>
            )}
            {g.count > g.rows.length && <p className="mt-2 text-[13px] text-ink-3">Showing the oldest {g.rows.length} of {g.count}.</p>}
            {g.count > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-[13px] text-ink-3">{approvalNote}</p>
                <Button size="sm" onClick={() => onSay(`Follow-up task for ${g.count} patient${g.count === 1 ? "" : "s"} (${g.label.toLowerCase()}) queued for FMD Manager. Nothing is sent until staff approve it (demo).`)}>
                  Create follow-up task
                </Button>
              </div>
            )}
          </Panel>
        ))}
    </div>
  );
}
