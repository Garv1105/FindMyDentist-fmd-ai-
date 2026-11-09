"use client";

import { useState } from "react";
import { Button, ButtonLink, Empty, Panel, Tag } from "@/components/app/kit";
import type { Filters } from "@/sample/reports";
import type { noShows, utilisation } from "@/sample/reports-schedule";
import { BarRow, fmt, inr, MetricTile } from "./parts";

export type UtilData = Awaited<ReturnType<typeof utilisation>>;
export type NoShowData = Awaited<ReturnType<typeof noShows>>;
type Open = (id: string, label: string, extra?: Partial<Filters>) => void;

const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
const BRANCH: Record<string, string> = { main: "Main", kora: "Koramangala" };

/* ---------------- Chair & dentist utilisation ---------------- */

export function Utilisation({ data, money, onOpen, calendarHref }: { data: UtilData; money: boolean; onOpen: Open; calendarHref: string }) {
  const { heatmap, quiet, chairs } = data;
  const multiBranch = new Set(chairs.map((c) => c.branchId)).size > 1;
  return (
    <div className="flex flex-col gap-4">
      <div className={`grid grid-cols-2 gap-3 ${money ? "xl:grid-cols-5" : "xl:grid-cols-4"} sm:grid-cols-3`}>
        {data.tiles.map((t) => (
          <MetricTile key={t.id} t={t} onOpen={onOpen} note={t.id === "nextFreeSlot" ? "average per dentist" : t.id === "emptyChairHours" ? "open, not booked" : undefined} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            When the chairs are busy <span className={sub}>weekday × hour · % of chair time used</span>
          </h2>
          <div className="mt-3 grid grid-cols-[2.25rem_repeat(10,minmax(0,1fr))] gap-1 text-center text-[12.5px]" role="table" aria-label="Chair time used by weekday and hour">
            <span role="columnheader" />
            {heatmap.hours.map((h) => (
              <span key={h} role="columnheader" className="text-ink-3">
                {h}
              </span>
            ))}
            {heatmap.rows.map((r) => (
              <div key={r.day} role="row" className="contents">
                <span role="rowheader" className="self-center text-left text-ink-2">
                  {r.day}
                </span>
                {r.cells.map((v, i) =>
                  v === null ? (
                    <span key={i} role="cell" aria-label={`${r.day} ${hourLabel(heatmap.hours[i])}: closed`} className="grid h-8 place-items-center rounded-md text-ink-3">
                      –
                    </span>
                  ) : (
                    <span
                      key={i}
                      role="cell"
                      aria-label={`${r.day} ${hourLabel(heatmap.hours[i])}: ${v}% used`}
                      className="grid h-8 place-items-center rounded-md tabular-nums text-ink"
                      style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(12 + v * 0.7)}%, transparent)` }}
                    >
                      {v}
                    </span>
                  ),
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-3">A dash is closed: lunch 13:00–14:00, and Saturdays from 13:00.</p>
          {quiet.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-3.5">
              <p className="min-w-0 text-[14.5px] text-ink-2">
                <b className="font-medium text-ink">Quietest times:</b> {quiet.map((q) => `${q.day} ${hourLabel(q.hour)} (${q.value}%)`).join(", ")}.
              </p>
              <ButtonLink size="sm" variant="secondary" href={calendarHref}>
                Offer these slots to the waitlist
              </ButtonLink>
            </div>
          )}
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            By chair and dentist <span className={sub}>tap a row for its visits</span>
          </h2>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_3.5rem_auto] gap-x-3 border-b border-line pb-2 text-[13px] text-ink-3 sm:grid-cols-[minmax(0,1fr)_4rem_5.5rem_5.5rem]" aria-hidden>
            <span>Chair</span>
            <span className="text-right">Used</span>
            {money && <span className="hidden text-right sm:block">₹ / chair-hr</span>}
            <span className={`text-right ${money ? "" : "sm:col-span-2"}`}>Next free</span>
          </div>
          <ul>
            {chairs.map((c) => (
              <li key={`${c.branchId}-${c.chair}`} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => onOpen("chairUtilisation", `${c.chair} · ${c.dentist}`, { branchId: c.branchId, dentist: c.dentist })}
                  className="grid w-full grid-cols-[minmax(0,1fr)_3.5rem_auto] items-center gap-x-3 py-2.5 text-left text-[14.5px] hover:bg-[var(--button-secondary)] sm:grid-cols-[minmax(0,1fr)_4rem_5.5rem_5.5rem]"
                >
                  <span className="min-w-0">
                    <span className="block text-ink">
                      {c.chair}
                      {multiBranch && <span className="text-ink-3"> · {BRANCH[c.branchId] ?? c.branchId}</span>}
                    </span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {c.dentist}
                      {money && c.inrPerHour != null && <span className="sm:hidden"> · {inr(c.inrPerHour)}/hr</span>}
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-ink">{fmt(c.util, "pct")}</span>
                  {money && <span className="hidden text-right tabular-nums text-ink-2 sm:block">{c.inrPerHour == null ? "—" : inr(c.inrPerHour)}</span>}
                  <span className={`text-right text-ink-2 ${money ? "" : "sm:col-span-2"}`}>{c.nextFree === null ? "none in 60 days" : c.nextFree === 0 ? "today" : `in ${c.nextFree} day${c.nextFree === 1 ? "" : "s"}`}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-ink-3">Available time = opening hours − lunch, per chair. Dentist utilisation leaves out the hygienist&apos;s chair.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- No-shows & cancellations ---------------- */

const short = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function NoShows({ data, onOpen, onSay }: { data: NoShowData; onOpen: Open; onSay: (t: string) => void }) {
  const cutNames = Object.keys(data.cuts) as (keyof NoShowData["cuts"])[];
  const [cut, setCut] = useState<keyof NoShowData["cuts"]>(cutNames[0]);
  const rate = data.tiles.find((t) => t.id === "noShowRate");
  const overall = rate?.value ?? 0;
  const rows = data.cuts[cut];
  const maxRate = Math.max(1, ...rows.map((r) => r.value ?? 0));
  const maxReason = Math.max(1, ...data.reasons.map((r) => r.count));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {data.tiles.map((t) => (
          <MetricTile
            key={t.id}
            t={t}
            onOpen={onOpen}
            note={
              t.id === "noShowRate" && t.denominator ? `${t.numerator} of ${t.denominator}` : t.id === "lateCancelRate" ? `${t.numerator} visits` : t.id === "rebookRate" && t.denominator ? `${t.numerator} of ${t.denominator}` : t.id === "lostRevenue" ? "from list fees" : undefined
            }
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Why <span className={sub}>reason picked at the desk</span>
          </h2>
          {data.reasons.length === 0 ? (
            <div className="mt-2">
              <Empty title="No missed visits in this period" />
            </div>
          ) : (
            <ul className="mt-2">
              {data.reasons.map((r) => (
                <BarRow key={r.reason} label={r.reason} value={r.count} max={maxReason} text={String(r.count)} tone={r.reason === "No reason recorded" ? "muted" : "accent"} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-[13px] text-ink-3">No-shows and late cancels (&lt;24 h).</p>
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <div className={h2}>
            <h2>Where it happens</h2>
            <label className="inline-flex items-center gap-2 text-[13px] font-normal text-ink-3">
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
              <Empty title="No visits in this period" />
            </div>
          ) : (
            <ul className="mt-2">
              {rows.map((r) => (
                <BarRow key={r.label} label={r.label} sub={`${r.numerator} of ${r.denominator}`} value={r.value ?? 0} max={maxRate} text={fmt(r.value, "pct")} tone={overall && (r.value ?? 0) >= 1.5 * overall ? "bad" : "warn"} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-[13px] text-ink-3">No-show rate in each group; red is 1.5× the overall {fmt(overall, "pct")} or more.</p>
        </Panel>

        <Panel as="section" className="p-4 sm:p-5 lg:col-span-2 xl:col-span-1">
          <h2 className={h2}>
            Missed twice or more <span className={sub}>last 6 months</span>
          </h2>
          {data.repeat.length === 0 ? (
            <div className="mt-2">
              <Empty title="Nobody has missed twice" hint="Patients with 2+ no-shows or late cancels show here." />
            </div>
          ) : (
            <ul className="mt-1 max-h-[340px] overflow-y-auto">
              {data.repeat.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] text-ink">{p.name}</span>
                    <span className="block text-[13px] text-ink-3">
                      {[p.noShows && `${p.noShows} no-show${p.noShows === 1 ? "" : "s"}`, p.lateCancels && `${p.lateCancels} late cancel${p.lateCancels === 1 ? "" : "s"}`].filter(Boolean).join(", ")} · last {short(p.last)}
                      {p.source ? ` · ${p.source}` : ""}
                    </span>
                  </span>
                  <Tag tone="bad">{p.noShows + p.lateCancels}×</Tag>
                </li>
              ))}
            </ul>
          )}
          {data.repeat.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-[13px] text-ink-3">FMD Manager drafts a call-back or reminder; staff approve it before anything is sent.</p>
              <Button size="sm" onClick={() => onSay(`Call-back task for ${data.repeat.length} patient${data.repeat.length === 1 ? "" : "s"} queued for FMD Manager to draft. Nothing is sent until staff approve it (demo).`)}>
                Create call-back task
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
