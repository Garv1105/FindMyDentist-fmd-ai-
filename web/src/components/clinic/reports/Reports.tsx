"use client";

import { Download, Lock } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Empty, Panel, Tag, type Tone } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { CHAIRS, type Appointment } from "@/sample/clinic";
import { MODES } from "@/sample/billing";
import { CATEGORIES, collectionSheet, dailyOps, drillDown, getAlerts, previousPeriod, pulse, recordCashCount, signOffSheet, type Alert, type Filters } from "@/sample/reports";
import { todayIst, useClinic } from "../Shell";
import { Delta, downloadCsv, EstimateBadge, fmt, Formula, inr, mask, Sparkline } from "./parts";

type ReportId = "pulse" | "ops" | "collection";
const NAV: { group: string; items: [id: string, label: string, stage?: number][] }[] = [
  { group: "Every day", items: [["pulse", "Clinic Pulse"], ["ops", "Daily operations"], ["collection", "Daily collection"]] },
  { group: "Schedule", items: [["util", "Utilisation", 2], ["noshow", "No-shows", 2]] },
  { group: "Patients", items: [["base", "Patient base", 2], ["source", "New by source", 2], ["recall", "Recall", 3]] },
  { group: "Treatment", items: [["accept", "Case acceptance", 3], ["pending", "Pending treatment", 3]] },
  { group: "Money", items: [["mix", "Procedure mix", 4], ["revenue", "Revenue summary", 4], ["gst", "GST register", 4]] },
];
/** Spec access table: front desk sees the daily sheets only (no revenue analysis). */
const ALLOWED: Record<string, ReportId[]> = { clinic_owner: ["pulse", "ops", "collection"], clinic_front_desk: ["ops", "collection"] };

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const RANGES = [
  ["this-month", "This month"],
  ["last-7", "Last 7 days"],
  ["last-month", "Last month"],
] as const;
function rangeOf(key: string, today: string) {
  if (key === "last-7") return { from: addDays(today, -6), to: today };
  if (key === "last-month") {
    const first = `${today.slice(0, 8)}01`;
    const end = addDays(first, -1);
    return { from: `${end.slice(0, 8)}01`, to: end };
  }
  return { from: `${today.slice(0, 8)}01`, to: today };
}
const short = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const selectCls = "h-10 rounded-full border border-line bg-[var(--surface-glass)] px-3.5 text-[14px] text-ink outline-none [color-scheme:dark] hover:border-line-strong";
const TONE: Record<Alert["tone"], string> = { ok: "bg-[var(--tone-ok)]", warn: "bg-[var(--tone-warn)]", bad: "bg-[var(--tone-bad)]" };
const STATUS_TAG: Partial<Record<Appointment["status"], [Tone, string]>> = { no_show: ["bad", "No-show"], completed: ["ok", "Attended"] };

type PulseData = Awaited<ReturnType<typeof pulse>>;

/* ---------------- Clinic Pulse ---------------- */

function Pulse({ data, alerts, onOpen }: { data: PulseData; alerts: Alert[]; onOpen: (id: string, label: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.tiles.map((t) => (
          <Panel key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13.5px] text-ink-3">{t.def.label}</span>
              <Formula def={t.def} />
            </div>
            <button
              type="button"
              onClick={() => onOpen(t.id, t.def.label)}
              disabled={!["noShowRate", "newPatients", "chairUtilisation", "caseAcceptance"].includes(t.id)}
              className="mt-0.5 block text-left text-[28px] font-light tracking-[-0.03em] text-ink enabled:hover:underline enabled:hover:decoration-[var(--accent)] enabled:hover:underline-offset-4 disabled:cursor-default"
              aria-label={`${t.def.label}: ${fmt(t.value, t.def.unit)}. Show the rows behind it`}
            >
              {fmt(t.value, t.def.unit)}
            </button>
            {t.id === "caseAcceptance" && (
              <p className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-3">
                by value {fmt(t.byValue ?? null, "pct")} <EstimateBadge />
              </p>
            )}
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]">
              <Delta id={t.id} unit={t.def.unit} cur={t.value} prev={t.previous} label="vs last period" />
              <Delta id={t.id} unit={t.def.unit} cur={t.value} prev={t.lastYear} label="vs last year" />
            </p>
            <Sparkline values={t.series} warn={t.id === "noShowRate"} />
          </Panel>
        ))}
      </div>
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
          Alerts <span className="text-[13px] font-normal text-ink-3">Default thresholds until your first 90 days set a baseline</span>
        </h2>
        <ul>
          {alerts.map((a) => (
            <li key={`${a.id}-${a.detail}`} className="flex items-start gap-3 border-t border-line py-3 first:border-0">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${TONE[a.tone]}`} aria-hidden />
              <span>
                <span className="block text-[15px] font-medium text-ink">{a.title}</span>
                <span className="block text-[13.5px] text-ink-3">{a.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ---------------- Daily Operations ---------------- */

type Ops = Awaited<ReturnType<typeof dailyOps>>;
function DailyOps({ ops, onSay }: { ops: Ops; onSay: (t: string) => void }) {
  const cells: [string, number, string?][] = [
    ["scheduled", ops.scheduled],
    ["completed", ops.completed],
    ["no-show", ops.noShow, ops.noShow ? "var(--tone-bad)" : undefined],
    ["cancelled", ops.cancelled],
    ["walk-ins", ops.walkIns],
    ["booked via FMD Main", ops.viaFmd],
  ];
  const items: [string, string[], string][] = [
    ["Tomorrow, not yet confirmed", ops.unconfirmedTomorrow, "Send reminders"],
    ["Completed but not billed", ops.notBilled, "Raise bill"],
    ["Unsigned clinical notes", ops.unsignedNotes ? [`${ops.unsignedNotes} note${ops.unsignedNotes === 1 ? "" : "s"} to sign`] : [], "Open notes"],
    ["Treatment pending, no next visit", ops.pendingNoNext, "Create recall task"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {cells.map(([label, n, color]) => (
          <Panel key={label} className="p-3.5">
            <span className="block text-[26px] font-light leading-tight" style={{ color: color ?? "var(--text-primary)" }}>
              {n}
            </span>
            <span className="text-[13.5px] text-ink-3">{label}</span>
          </Panel>
        ))}
      </div>
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
          Open items <span className="text-[13px] font-normal text-ink-3">things to clear before closing</span>
        </h2>
        <ul>
          {items.map(([title, list, action]) => (
            <li key={title} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-0">
              <span className="min-w-0">
                <span className="block text-[15px] text-ink">
                  {title} <span className="text-ink-3">· {list.length || "none"}</span>
                </span>
                {list.length > 0 && <span className="block text-[13.5px] text-ink-3">{list.join(", ")}</span>}
              </span>
              {list.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => onSay(`${action}: queued for FMD Manager to prepare (demo, needs approval before anything is sent).`)}>
                  {action}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ---------------- Daily Collection Sheet ---------------- */

type SheetData = Awaited<ReturnType<typeof collectionSheet>>;
function Collection({ sheet, isOwner, onCount, onSignOff }: { sheet: SheetData; isOwner: boolean; onCount: () => void; onSignOff: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className="mb-2 text-[16px] font-medium text-ink">By payment method</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-3">
                <th className="py-2 pr-3 font-medium">Method</th>
                <th className="py-2 pr-3 font-medium">Bills</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 font-medium">Received by</th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => (
                <tr key={m} className="border-b border-line text-ink">
                  <td className="py-2.5 pr-3">{m}</td>
                  <td className="py-2.5 pr-3">{sheet.byMode[m].count}</td>
                  <td className="py-2.5 pr-3">{inr(sheet.byMode[m].totalInr)}</td>
                  <td className="py-2.5 text-ink-2">
                    {Object.entries(sheet.byMode[m].receivers)
                      .map(([who, n]) => `${who.split(" ")[0]} ${n}`)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold text-ink">
                <td className="py-2.5 pr-3">Total</td>
                <td className="py-2.5 pr-3">{sheet.count}</td>
                <td className="py-2.5 pr-3">{inr(sheet.totalInr)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {sheet.cash ? (
          <p
            className={`mt-3 rounded-2xl border p-3.5 text-[14.5px] ${sheet.cash.varianceInr ? "border-[color-mix(in_srgb,var(--tone-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-bad)_6%,transparent)]" : "border-line"}`}
          >
            <b className={`font-semibold ${sheet.cash.varianceInr ? "text-[var(--tone-bad)]" : "text-[var(--tone-ok)]"}`}>
              {sheet.cash.varianceInr ? `Cash variance ${sheet.cash.varianceInr < 0 ? "−" : "+"}${inr(Math.abs(sheet.cash.varianceInr))}.` : "Cash matches."}
            </b>{" "}
            Counted {inr(sheet.cash.countedInr)}, recorded {inr(sheet.cash.recordedInr)}
            {sheet.cash.note ? `. Note (${sheet.cash.by.split(" ")[0]}): "${sheet.cash.note}"` : "."}
          </p>
        ) : (
          !sheet.locked && (
            <Button className="mt-3" size="sm" variant="secondary" onClick={onCount}>
              Count the cash at close
            </Button>
          )
        )}
      </Panel>
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className="mb-1 text-[16px] font-medium text-ink">Discounts today</h2>
        {sheet.discounts.length === 0 ? (
          <p className="py-2 text-[14px] text-ink-3">No discounts today</p>
        ) : (
          <ul>
            {sheet.discounts.map((d) => (
              <li key={d.billId} className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-[14.5px] first:border-0">
                <span>
                  <span className="block text-ink">
                    {inr(d.amountInr)} · {d.patientName}
                  </span>
                  <span className="block text-[13px] text-ink-3">
                    {d.reason} · approved by {d.approvedBy}
                  </span>
                </span>
                <Tag tone="muted">Discount</Tag>
              </li>
            ))}
          </ul>
        )}
        <h2 className="mb-1 mt-4 text-[16px] font-medium text-ink">Completed, not billed</h2>
        <p className="text-[14px] text-ink-3">{sheet.notBilled.length ? sheet.notBilled.join(", ") : "Every completed visit has a bill"}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {sheet.locked ? (
            <p className="inline-flex items-center gap-2 text-[14.5px] text-ink">
              <Lock className="size-4" strokeWidth={1.75} />
              Signed off by {sheet.locked.by} at {sheet.locked.at}. Locked.
            </p>
          ) : (
            <>
              <Button size="sm" disabled={!isOwner} onClick={onSignOff}>
                Sign off and lock
              </Button>
              <span className="text-[13px] text-ink-3">{isOwner ? "A locked sheet can't be changed." : "Only the owner can sign off."}</span>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

function CashSheet({ recorded, onClose, onSave }: { recorded: number; onClose: () => void; onSave: (counted: number, note: string) => Promise<void> }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const diff = counted === "" ? null : Number(counted) - recorded;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave(Number(counted), note);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Sheet title="Count the cash at close" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <p className="text-[15px] text-ink-2">Cash recorded today: {inr(recorded)}</p>
        <Field label="Cash counted (₹)">
          <input className={fieldCls} type="number" inputMode="numeric" min={0} step={1} value={counted} onChange={(e) => setCounted(e.target.value)} />
        </Field>
        {diff !== null && diff !== 0 && (
          <Field label={`Why is it ${diff < 0 ? "short" : "over"} by ${inr(Math.abs(diff))}?`}>
            <input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={counted === ""}>
            Save count
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- page ---------------- */

export function Reports() {
  const { clinic, branchId, date, user } = useClinic();
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const allowed = ALLOWED[user.role] ?? [];
  const asked = params.get("report") as ReportId | null;
  const report: ReportId | null = asked && allowed.includes(asked) ? asked : (allowed[0] ?? null);
  const range = RANGES.some(([k]) => k === params.get("range")) ? params.get("range")! : "this-month";
  const dentist = Object.values(CHAIRS).flat().some((c) => c.dentist === params.get("dentist")) ? params.get("dentist")! : "";
  const category = CATEGORIES.includes(params.get("category") ?? "") ? params.get("category")! : "";
  const pending = useRef<string | null>(null);
  const setParam = useCallback(
    (key: string, value: string) => {
      // start from the change still on its way, so two quick changes don't undo each other
      const p = new URLSearchParams(pending.current ?? window.location.search);
      if (value) p.set(key, value);
      else p.delete(key);
      pending.current = p.toString();
      router.replace(`${path}?${p}`, { scroll: false });
    },
    [path, router],
  );
  useEffect(() => {
    pending.current = null; // the URL has caught up
  }, [params]);

  const [today] = useState(todayIst);
  const [asOf] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 16));
  const period = rangeOf(range, today);
  const filters: Filters = { ...period, branchId, dentist: dentist || undefined, category: category || undefined };
  const key = JSON.stringify({ report, filters, date });

  const [state, setState] = useState<{ key: string; pulse?: PulseData; alerts?: Alert[]; ops?: Ops; sheet?: SheetData } | { key: string; failed: true } | null>(null);
  const [version, setVersion] = useState(0);
  const [drill, setDrill] = useState<{ label: string; rows: Appointment[] } | null>(null);
  const [counting, setCounting] = useState(false);
  const [identifiers, setIdentifiers] = useState(false);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((t: string) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  useEffect(() => {
    if (!report) return;
    let live = true;
    const f = JSON.parse(key).filters as Filters;
    const job =
      report === "pulse"
        ? Promise.all([pulse(clinic.id, f), getAlerts(clinic.id, { branchId: f.branchId })]).then(([p, a]) => ({ key, pulse: p, alerts: a }))
        : report === "ops"
          ? dailyOps(clinic.id, { date, branchId: f.branchId }).then((o) => ({ key, ops: o }))
          : collectionSheet(clinic.id, { date, branchId: f.branchId }).then((s) => ({ key, sheet: s }));
    job.then(
      (s) => live && setState(s),
      () => live && setState({ key, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [clinic.id, report, key, date, version]);

  if (!report) return <Panel className="p-6"><Empty title="Reports aren't available for your role" /></Panel>;
  const ready = state && state.key === key ? state : null;
  const dentists = [...new Set(Object.values(CHAIRS).flat().map((c) => c.dentist))];

  const exportCsv = () => {
    if (!ready || "failed" in ready) return;
    const header = [
      `FMD Clinic report: ${report === "pulse" ? "Clinic Pulse" : report === "ops" ? "Daily operations" : "Daily collection"}`,
      report === "pulse" ? `Range: ${period.from} to ${period.to}` : `Date: ${date}`,
      `Filters: branch ${branchId}${dentist ? `, ${dentist}` : ""}${category ? `, ${category}` : ""}`,
      `Exported ${new Date().toISOString()} by ${user.name}${identifiers ? " (identifiers included)" : " (names masked)"}`,
    ];
    const rows: (string | number)[][] =
      report === "pulse" && ready.pulse
        ? [["Metric", "Value", "Previous period", "Last year", "Formula"], ...ready.pulse.tiles.map((t) => [t.def.label, fmt(t.value, t.def.unit), fmt(t.previous, t.def.unit), fmt(t.lastYear, t.def.unit), t.def.formula])]
        : report === "ops" && ready.ops
          ? [["Figure", "Value"], ["Scheduled", ready.ops.scheduled], ["Completed", ready.ops.completed], ["No-show", ready.ops.noShow], ["Cancelled", ready.ops.cancelled], ["Via FMD Main", ready.ops.viaFmd], ["Unconfirmed tomorrow", ready.ops.unconfirmedTomorrow.map((n) => mask(n, identifiers)).join("; ")]]
          : ready.sheet
            ? [["Method", "Bills", "Amount (₹)"], ...MODES.map((m) => [m, ready.sheet!.byMode[m].count, ready.sheet!.byMode[m].totalInr]), ["Total", ready.sheet.count, ready.sheet.totalInr]]
            : [];
    downloadCsv(`fmd-${report}-${report === "pulse" ? `${period.from}_${period.to}` : date}.csv`, header, rows);
    say("Report exported. The export is recorded with your name and time (demo).");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Panel as="div" className="self-start p-2 lg:sticky lg:top-5">
        <nav aria-label="Reports" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
          {NAV.map((g) => (
            <div key={g.group} className="contents lg:block">
              <p className="hidden px-2.5 pb-1 pt-3 text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3 first:pt-1 lg:block">{g.group}</p>
              {g.items.map(([id, label, stage]) => {
                const on = report === id;
                const usable = !stage && allowed.includes(id as ReportId);
                return usable ? (
                  <button
                    key={id}
                    type="button"
                    aria-current={on ? "page" : undefined}
                    onClick={() => setParam("report", id)}
                    className={`flex shrink-0 items-center justify-between rounded-xl px-2.5 py-2 text-left text-[14px] lg:w-full ${on ? "bg-[var(--accent-soft)] text-ink" : "text-ink-2 hover:text-ink"}`}
                  >
                    {label}
                  </button>
                ) : (
                  <span key={id} className="hidden items-center justify-between rounded-xl px-2.5 py-2 text-[14px] text-ink-3 lg:flex">
                    {label} {stage && <span className="text-[11.5px]">stage {stage}</span>}
                  </span>
                );
              })}
            </div>
          ))}
        </nav>
      </Panel>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {report === "pulse" ? (
            <>
              <label className="sr-only" htmlFor="rep-range">
                Period
              </label>
              <select id="rep-range" className={selectCls} value={range} onChange={(e) => setParam("range", e.target.value)}>
                {RANGES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="rep-dentist">
                Dentist
              </label>
              <select id="rep-dentist" className={selectCls} value={dentist} onChange={(e) => setParam("dentist", e.target.value)}>
                <option value="">All dentists</option>
                {dentists.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="rep-category">
                Procedure group
              </label>
              <select id="rep-category" className={selectCls} value={category} onChange={(e) => setParam("category", e.target.value)}>
                <option value="">All procedures</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-[14.5px] text-ink-2">For {new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })} · change the day with the date picker above</p>
          )}
          <span className="ml-auto text-[13px] text-ink-3">
            Data as of {asOf}
            {report === "pulse" && ` · ${short(period.from)}–${short(period.to)} vs ${short(previousPeriod(period).from)}–${short(previousPeriod(period).to)}`}
          </span>
          {user.role === "clinic_owner" && (
            <label className="inline-flex items-center gap-2 text-[13.5px] text-ink-2">
              <input type="checkbox" checked={identifiers} onChange={(e) => setIdentifiers(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Include identifiers
            </label>
          )}
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!ready || "failed" in ready}>
            <Download className="size-4" strokeWidth={1.75} />
            Export
          </Button>
        </div>

        {toast && (
          <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
            {toast}
          </p>
        )}

        {!ready ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy aria-label="Loading">
            {Array.from({ length: 8 }, (_, i) => (
              <Panel key={i} className="h-[150px] motion-safe:animate-pulse" />
            ))}
          </div>
        ) : "failed" in ready ? (
          <Panel className="p-6">
            <Empty title="This report couldn't be loaded" hint="Try again, or pick another period." />
            <div className="mt-3 text-center">
              <Button size="sm" variant="secondary" onClick={() => setVersion((v) => v + 1)}>
                Try again
              </Button>
            </div>
          </Panel>
        ) : report === "pulse" && ready.pulse ? (
          <Pulse
            data={ready.pulse}
            alerts={ready.alerts ?? []}
            onOpen={async (id, label) => setDrill({ label, rows: await drillDown(clinic.id, id, filters) })}
          />
        ) : report === "ops" && ready.ops ? (
          <DailyOps ops={ready.ops} onSay={say} />
        ) : ready.sheet ? (
          <Collection
            sheet={ready.sheet}
            isOwner={user.role === "clinic_owner"}
            onCount={() => setCounting(true)}
            onSignOff={async () => {
              await signOffSheet(clinic.id, { date, branchId, by: user.name, role: user.role });
              setVersion((v) => v + 1);
              say("Sheet signed off and locked (demo).");
            }}
          />
        ) : null}

        <p className="text-[13px] text-ink-3">
          Figures come from what&apos;s recorded in FMD Clinic. They&apos;re operational, not audited. Exports state the period, filters, time and who exported; names are masked unless the owner includes identifiers.
        </p>
      </div>

      {drill && (
        <Sheet title={drill.label} onClose={() => setDrill(null)} wide>
          <p className="-mt-2 mb-3 text-[13.5px] text-ink-3">
            {drill.rows.length} row{drill.rows.length === 1 ? "" : "s"} · {short(period.from)}–{short(period.to)}
          </p>
          {drill.rows.length === 0 ? (
            <Empty title="Nothing in this period" />
          ) : (
            <ul className="max-h-[50dvh] overflow-y-auto">
              {drill.rows.slice(0, 100).map((a) => {
                const tag = STATUS_TAG[a.status];
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-[14.5px] first:border-0">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">
                        {a.patientName} · {short(a.start.slice(0, 10))} {a.start.slice(11, 16).replace(/^0/, "")}
                      </span>
                      <span className="block truncate text-[13px] text-ink-3">
                        {a.type} · {a.dentist}
                      </span>
                    </span>
                    {tag && <Tag tone={tag[0]}>{tag[1]}</Tag>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setDrill(null);
                say("Follow-up task created for FMD Manager; messages need approval before they're sent (demo).");
              }}
              disabled={drill.rows.length === 0}
            >
              Create follow-up task
            </Button>
          </div>
        </Sheet>
      )}
      {counting && ready && !("failed" in ready) && ready.sheet && (
        <CashSheet
          recorded={ready.sheet.byMode.Cash.totalInr}
          onClose={() => setCounting(false)}
          onSave={async (counted, note) => {
            await recordCashCount(clinic.id, { date, branchId, countedInr: counted, note, by: user.name, role: user.role });
            setCounting(false);
            setVersion((v) => v + 1);
            say("Cash count saved.");
          }}
        />
      )}
    </div>
  );
}
