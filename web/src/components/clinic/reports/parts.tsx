"use client";

import { Info } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Panel } from "@/components/app/kit";
import { DRILLABLE, type MetricDef, type Tile } from "@/sample/reports";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function fmt(v: number | null | undefined, unit: MetricDef["unit"]) {
  if (v === null || v === undefined) return "—";
  if (unit === "inr") return inr(v);
  if (unit === "pct") return `${v}%`;
  if (unit === "rating") return `${v} ★`;
  if (unit === "hours") return `${v.toLocaleString("en-IN")} h`;
  if (unit === "days") return v === 0 ? "today" : `${v} day${v === 1 ? "" : "s"}`;
  return v.toLocaleString("en-IN");
}

/** Lower is better for these; a rise shows in amber. */
const LOWER_IS_BETTER = new Set(["noShowRate", "recallOverdue", "lateCancelRate", "lostChairHours", "lostRevenue", "emptyChairHours", "nextFreeSlot", "lapsedPatients"]);

/** "▲ 8% vs last period" for money and counts; "▲ 2.1 pts" for percentages. */
export function Delta({ id, unit, cur, prev, label }: { id: string; unit: MetricDef["unit"]; cur: number | null; prev: number | null; label: string }) {
  if (cur === null || prev === null) return <span className="text-ink-3">no comparison {label}</span>;
  const diff = cur - prev;
  if (diff === 0) return <span className="text-ink-3">no change {label}</span>;
  const shown =
    unit === "pct" ? `${Math.abs(Math.round(diff * 10) / 10)} pts` : unit === "rating" ? `${Math.abs(Math.round(diff * 10) / 10)}` : prev ? `${Math.abs(Math.round((diff / prev) * 100))}%` : unit === "inr" ? inr(Math.abs(diff)) : `${Math.abs(diff)}`;
  const good = LOWER_IS_BETTER.has(id) ? diff < 0 : diff > 0;
  return (
    <span className={good ? "text-[var(--tone-ok)]" : "text-[var(--tone-warn)]"}>
      {diff > 0 ? "▲" : "▼"} {shown} {label}
    </span>
  );
}

/** A 12-week line; gaps (no data) are skipped, not drawn as zero. */
export function Sparkline({ values, warn = false }: { values: (number | null)[]; warn?: boolean }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return <div className="mt-2 h-7" aria-hidden />;
  const ys = pts.map((p) => p[1]);
  const [lo, hi] = [Math.min(...ys), Math.max(...ys)];
  const y = (v: number) => (hi === lo ? 14 : 24 - ((v - lo) / (hi - lo)) * 20);
  return (
    <svg className="mt-2 h-7 w-full" viewBox="0 0 110 28" preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" stroke={warn ? "var(--tone-warn)" : "var(--accent)"} strokeWidth="2" vectorEffect="non-scaling-stroke" points={pts.map(([i, v]) => `${i * 10},${y(v)}`).join(" ")} />
    </svg>
  );
}

/** The ⓘ next to a number: hover or focus shows its formula. */
export function Formula({ def }: { def: MetricDef }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-describedby={id} aria-label={`How ${def.label} is calculated`} className="grid size-6 place-items-center rounded-full text-ink-3 hover:text-ink focus-visible:text-ink">
        <Info className="size-4" strokeWidth={1.75} />
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none invisible absolute right-0 top-7 z-30 w-[280px] rounded-2xl border border-line-strong bg-[var(--surface-elevated)] p-3 text-left text-[13px] leading-relaxed text-ink-2 opacity-0 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.9)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <b className="block font-medium text-ink">{def.label}</b>
        {def.formula}
        {def.exclusions && <span className="mt-1 block text-ink-3">Excludes: {def.exclusions}</span>}
      </span>
    </span>
  );
}

export function EstimateBadge() {
  return <span className="rounded-full border border-dashed border-[color-mix(in_srgb,var(--tone-warn)_60%,transparent)] px-2 py-px text-[12.5px] font-semibold text-[var(--tone-warn)]">Estimate</span>;
}

/** One KPI: value (opens its rows when it has any), ⓘ formula, change vs last period and last year, 12-week line. */
export function MetricTile({ t, onOpen, note }: { t: Tile; onOpen: (id: string, label: string) => void; note?: ReactNode }) {
  const drillable = DRILLABLE.includes(t.id);
  return (
    <Panel className="min-w-0 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13.5px] text-ink-3">{t.def.label}</span>
        <Formula def={t.def} />
      </div>
      <button
        type="button"
        onClick={() => onOpen(t.id, t.def.label)}
        disabled={!drillable}
        className="mt-0.5 block text-left text-[24px] font-light tracking-[-0.03em] text-ink enabled:hover:underline enabled:hover:decoration-[var(--accent)] enabled:hover:underline-offset-4 disabled:cursor-default sm:text-[28px]"
        aria-label={`${t.def.label}: ${fmt(t.value, t.def.unit)}${drillable ? ". Show the rows behind it" : ""}`}
      >
        {fmt(t.value, t.def.unit)}
      </button>
      {(t.def.estimate || note) && (
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          {note}
          {t.def.estimate && <EstimateBadge />}
        </p>
      )}
      {t.series.length > 0 && (
        <>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]">
            <Delta id={t.id} unit={t.def.unit} cur={t.value} prev={t.previous} label="vs last period" />
            <Delta id={t.id} unit={t.def.unit} cur={t.value} prev={t.lastYear} label="vs last year" />
          </p>
          <Sparkline values={t.series} warn={LOWER_IS_BETTER.has(t.id)} />
        </>
      )}
    </Panel>
  );
}

/** A labelled horizontal bar: label, bar scaled to `max`, value text. */
export function BarRow({ label, value, max, text, tone = "accent", sub }: { label: string; value: number; max: number; text: string; tone?: "accent" | "warn" | "bad" | "muted"; sub?: string }) {
  const color = { accent: "var(--accent)", warn: "var(--tone-warn)", bad: "var(--tone-bad)", muted: "var(--text-muted)" }[tone];
  return (
    <li className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-1.5 text-[14.5px]">
      <span className="min-w-0 text-ink">
        {label}
        {sub && <span className="block text-[12.5px] text-ink-3">{sub}</span>}
      </span>
      <span className="h-2 rounded-full bg-[var(--button-secondary)]" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
      </span>
      <span className="text-right tabular-nums text-ink-2">{text}</span>
    </li>
  );
}

/** Stacked monthly bars with a legend. */
export function StackedBars({ months, series, label }: { months: { label: string; values: number[] }[]; series: { name: string; color: string }[]; label: string }) {
  const max = Math.max(1, ...months.map((m) => m.values.reduce((a, b) => a + b, 0)));
  return (
    <figure aria-label={label}>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {months.map((m) => {
          const total = m.values.reduce((a, b) => a + b, 0);
          return (
            <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[12.5px] tabular-nums text-ink-3">{total}</span>
              <div className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(total / max) * 100}%` }} title={`${m.label}: ${series.map((s, i) => `${s.name} ${m.values[i]}`).join(", ")}`}>
                {m.values.map((v, i) => (
                  <span key={series[i].name} style={{ height: `${total ? (v / total) * 100 : 0}%`, background: series[i].color }} />
                ))}
              </div>
              <span className="text-[12.5px] text-ink-3">{m.label}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Download rows as CSV with a header saying what, when and by whom. */
export function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [...header.map((h) => esc(h)), "", ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Priya Sharma" → "P***** S*****" unless identifiers are included. */
export const mask = (name: string, show: boolean) => (show ? name : name.split(" ").map((w) => (w.length > 1 ? w[0] + "*".repeat(w.length - 1) : w)).join(" "));
