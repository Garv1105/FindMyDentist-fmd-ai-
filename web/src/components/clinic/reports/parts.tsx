"use client";

import { Info } from "lucide-react";
import { useId } from "react";
import type { MetricDef } from "@/sample/reports";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function fmt(v: number | null | undefined, unit: MetricDef["unit"]) {
  if (v === null || v === undefined) return "—";
  if (unit === "inr") return inr(v);
  if (unit === "pct") return `${v}%`;
  if (unit === "rating") return `${v} ★`;
  return v.toLocaleString("en-IN");
}

/** Lower is better for these; a rise shows in amber. */
const LOWER_IS_BETTER = new Set(["noShowRate", "recallOverdue"]);

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
  return <span className="rounded-full border border-dashed border-[color-mix(in_srgb,var(--tone-warn)_60%,transparent)] px-2 py-px text-[11.5px] font-semibold text-[var(--tone-warn)]">Estimate</span>;
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
