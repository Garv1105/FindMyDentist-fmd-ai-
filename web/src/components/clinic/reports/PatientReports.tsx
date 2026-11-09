"use client";

import { useState } from "react";
import { Button, Empty, Panel } from "@/components/app/kit";
import type { Appointment } from "@/sample/clinic";
import type { Filters } from "@/sample/reports";
import type { newBySource, patientBase } from "@/sample/reports-patients";
import { inr, MetricTile, StackedBars } from "./parts";

export type BaseData = Awaited<ReturnType<typeof patientBase>>;
export type SourceData = Awaited<ReturnType<typeof newBySource>>;
type Open = (id: string, label: string, extra?: Partial<Filters>, keep?: (a: Appointment) => boolean) => void;

const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const short = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const share = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const NOTES: Record<string, string> = { activePatients: "a visit in 18 months", reactivatedPatients: "back after 18+ months", lapsedPatients: "passed 18 months" };

/* ---------------- Patient base ---------------- */

export function PatientBase({ data, onOpen, onSay }: { data: BaseData; onOpen: Open; onSay: (t: string) => void }) {
  const [allPins, setAllPins] = useState(false);
  const d = data.demographics;
  const line = (rows: [string, number][]) => rows.map(([k, n]) => `${k} ${share(n, d.total)}%`).join(" · ");
  const AGE_COLORS = ["color-mix(in srgb, var(--accent) 35%, transparent)", "color-mix(in srgb, var(--accent) 55%, transparent)", "var(--accent)", "color-mix(in srgb, var(--accent) 70%, black)", "color-mix(in srgb, var(--accent) 50%, black)"];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} note={NOTES[t.id]} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Month by month <span className={sub}>patients seen, by type</span>
          </h2>
          <div className="mt-3">
            <StackedBars
              label="Patients seen per month: new, returning, reactivated"
              months={data.months.map((m) => ({ label: m.label, values: [m.new, m.returning, m.reactivated] }))}
              series={[
                { name: "New", color: "var(--tone-ok)" },
                { name: "Returning", color: "var(--accent)" },
                { name: "Reactivated", color: "var(--tone-warn)" },
              ]}
            />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0">
                <span className="block text-[15px] font-medium text-ink">
                  {data.lapsed.length} patient{data.lapsed.length === 1 ? "" : "s"} lapsed in this period
                </span>
                <span className="block text-[13px] text-ink-3">last visit 18 months ago, nothing booked</span>
              </p>
              {data.lapsed.length > 0 && (
                <Button size="sm" onClick={() => onSay(`Recall task for ${data.lapsed.length} lapsed patient${data.lapsed.length === 1 ? "" : "s"} queued for FMD Manager to draft. Nothing is sent until staff approve it (demo).`)}>
                  Create recall task
                </Button>
              )}
            </div>
            {data.lapsed.length > 0 && (
              <ul className="mt-2 max-h-[220px] overflow-y-auto">
                {data.lapsed.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[14.5px] first:border-0">
                    <span className="min-w-0 truncate text-ink">{p.name}</span>
                    <span className="shrink-0 text-[13px] text-ink-3">last {short(p.last)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Who they are <span className={sub}>{d.total.toLocaleString("en-IN")} active patients</span>
          </h2>
          {d.total === 0 ? (
            <div className="mt-2">
              <Empty title="No active patients yet" />
            </div>
          ) : (
            <dl className="mt-3 flex flex-col gap-3.5 text-[14.5px]">
              <div>
                <dt className="text-[13px] text-ink-3">Age band</dt>
                <dd className="mt-1.5 flex h-3 overflow-hidden rounded-full" aria-hidden>
                  {d.age.map(([k, n], i) => (
                    <span key={k} style={{ width: `${share(n, d.total)}%`, background: AGE_COLORS[i] }} />
                  ))}
                </dd>
                <dd className="mt-1.5 text-ink-2">{line(d.age)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-ink-3">Gender</dt>
                <dd className="text-ink-2">{line(d.gender)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-ink-3">Language</dt>
                <dd className="text-ink-2">{line(d.language)}</dd>
              </div>
              <div>
                <dt className="flex items-center justify-between gap-2 text-[13px] text-ink-3">
                  Pincodes
                  {d.pincodes.length > 3 && (
                    <button type="button" onClick={() => setAllPins((v) => !v)} className="rounded-full px-2 py-1 text-[13px] text-ink-2 underline-offset-4 hover:underline">
                      {allPins ? "Top 3" : `All ${d.pincodes.length}`}
                    </button>
                  )}
                </dt>
                <dd className="text-ink-2">{(allPins ? d.pincodes : d.pincodes.slice(0, 3)).map(([pin, n]) => `${pin} · ${n.toLocaleString("en-IN")}`).join("   ")}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-ink-3">Families</dt>
                <dd className="text-ink-2">
                  {d.families.groups} family groups · {d.families.avg} members on average
                </dd>
              </div>
            </dl>
          )}
          <p className="mt-4 text-[13px] text-ink-3">Counts only. Reports never show diagnoses or notes.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- New patients by source ---------------- */

export function NewBySource({ data, onOpen, onSay }: { data: SourceData; onOpen: Open; onSay: (t: string) => void }) {
  const cell = "py-2.5 pr-3 text-right tabular-nums";
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          Sources <span className={sub}>tap a source for its patients</span>
        </h2>
        {data.rows.length === 0 ? (
          <div className="mt-2">
            <Empty title="No new patients in this period" hint="Try a longer period, such as the last 6 months." />
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[340px] text-left text-[14.5px]">
              <thead>
                <tr className="border-b border-line text-[13px] text-ink-3">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 text-right font-medium">New</th>
                  <th className="py-2 pr-3 text-right font-medium">First visit</th>
                  <th className="py-2 text-right font-medium">6 months</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.source} className="border-b border-line text-ink">
                    <td className="py-2.5 pr-3">
                      <button type="button" onClick={() => onOpen("newPatients", `New patients · ${r.source}`, undefined, (a) => a.source === r.source)} className="text-left hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4">
                        {r.source}
                      </button>
                    </td>
                    <td className={cell}>{r.count}</td>
                    <td className={cell}>{inr(r.firstVisitInr)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {inr(r.sixMonthInr)}
                      {r.partial > 0 && <span className="text-ink-3">*</span>}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-ink">
                  <td className="py-2.5 pr-3">Total</td>
                  <td className={cell}>{data.total.count}</td>
                  <td className={cell}>{inr(data.total.firstVisitInr)}</td>
                  <td className="py-2.5 text-right tabular-nums">{inr(data.total.sixMonthInr)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[13px] text-ink-3">
          FMD sources fill in by themselves; the rest are picked from a list at the first visit. Revenue counts paid bills only (list fee − discount, no GST).
          {data.total.partial > 0 && ` * ${data.total.partial} of ${data.total.count} patients haven't had 6 months yet, so their figure is still growing.`}
        </p>
      </Panel>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Per month <span className={sub}>new patients</span>
          </h2>
          <div className="mt-3">
            <StackedBars
              label="New patients per month by source"
              months={data.months.map((m) => ({ label: m.label, values: [m.fmd, m.referral, m.other] }))}
              series={[
                { name: "FMD Main", color: "var(--accent)" },
                { name: "Referrals", color: "var(--tone-ok)" },
                { name: "Everything else", color: "var(--text-muted)" },
              ]}
            />
          </div>
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Who referred the most <span className={sub}>for thank-you notes only, no rewards</span>
          </h2>
          {data.referrers.length === 0 ? (
            <div className="mt-2">
              <Empty title="No referrals in this period" />
            </div>
          ) : (
            <ul className="mt-1">
              {data.referrers.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] text-ink">{r.name}</span>
                    <span className="block text-[13px] text-ink-3">
                      {r.count} {r.kind === "dentist" ? `patient${r.count === 1 ? "" : "s"}` : `friend${r.count === 1 ? "" : "s"} or family`}
                    </span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => onSay(`FMD Manager is drafting a thank-you note to ${r.name}. You check it and tap Send; nothing goes out before that (demo).`)}>
                    Send thank-you
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-ink-3">The AI drafts the note; you check it and tap Send.</p>
        </Panel>
      </div>
    </div>
  );
}
