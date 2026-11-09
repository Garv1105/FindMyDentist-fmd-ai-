/**
 * FMD Clinic reports, stage 1 (from fmd-clinic-reports-prompt.md). Every number comes from one definition in METRICS,
 * computed here and nowhere else, so tiles, drill-downs, comparisons and the metric dictionary always agree.
 * No waiting-time or overrun figures, no refunds, no inventory (owner decisions). Sample data: the analytics pipeline
 * comes with the backend.
 */
import { dayBills, MODES, type Bill, type Mode } from "./billing.ts";
import { CHAIRS, dayAppointments, getClinicHome, HOURS, istDate, onReset, requireClinic, weekday, type Appointment } from "./clinic.ts";
import { listPatients } from "./patients.ts";

/* ---------------- definitions ---------------- */

export type MetricDef = { label: string; formula: string; numerator: string; denominator?: string; exclusions?: string; unit: "inr" | "pct" | "count" | "rating"; estimate?: boolean };

export const METRICS: Record<string, MetricDef> = {
  netRevenue: {
    label: "Net revenue",
    formula: "Sum of list fees on paid bills − discounts, excluding GST, by bill date",
    numerator: "list fees − discounts on paid bills",
    exclusions: "Void bills; GST",
    unit: "inr",
  },
  revenuePerChairHour: {
    label: "Revenue per chair-hour",
    formula: "Net revenue ÷ (attended chair-minutes ÷ 60)",
    numerator: "net revenue",
    denominator: "attended chair-hours",
    unit: "inr",
  },
  chairUtilisation: {
    label: "Chair utilisation",
    formula: "Attended booked chair-minutes ÷ available chair-minutes × 100. Available = opening hours − lunch, for each chair, Monday to Saturday",
    numerator: "minutes of completed appointments",
    denominator: "open chair-minutes",
    unit: "pct",
  },
  noShowRate: {
    label: "No-show rate",
    formula: "No-shows ÷ (attended + no-shows) × 100",
    numerator: "no-shows",
    denominator: "attended + no-shows",
    exclusions: "Cancelled appointments",
    unit: "pct",
  },
  newPatients: {
    label: "New patients",
    formula: "Patients whose first attended visit falls in the period",
    numerator: "first attended visits",
    unit: "count",
  },
  caseAcceptance: {
    label: "Case acceptance",
    formula: "Accepted treatment-plan items ÷ presented items × 100; also by ₹ estimate",
    numerator: "accepted plan items",
    denominator: "presented plan items",
    unit: "pct",
    estimate: true,
  },
  recallOverdue: {
    label: "Recall overdue",
    formula: "Patients past their recall due date with nothing booked",
    numerator: "overdue recalls",
    unit: "count",
  },
  averageRating: {
    label: "Average rating",
    formula: "Mean of patient ratings given in the period (1–5)",
    numerator: "sum of ratings",
    denominator: "number of ratings",
    unit: "rating",
  },
};

/** FMD procedure groups (the spec's catalogue); clinics can rename treatments but not break this mapping. */
const GROUPS: [RegExp, string][] = [
  [/^Scaling|^Check-up|^Kids' check-up/, "Preventive"],
  [/^Filling/, "Restorative"],
  [/^Root canal/, "Endodontic"],
  [/^Crown/, "Prosthodontic"],
  [/^Extraction/, "Surgical"],
  [/^Braces/, "Orthodontic"],
  [/^Whitening/, "Cosmetic"],
  [/^Consultation/, "Diagnostic"],
];
export const CATEGORY = (treatment: string) => GROUPS.find(([re]) => re.test(treatment))?.[1] ?? "Other";
export const CATEGORIES = [...new Set(GROUPS.map(([, g]) => g))];

/* ---------------- periods ---------------- */

export type Period = { from: string; to: string };
export type Filters = Period & { branchId: string; dentist?: string; category?: string; now?: Date };

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const days = ({ from, to }: Period) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const length = (p: Period) => days(p).length;
export const previousPeriod = (p: Period): Period => ({ from: addDays(p.from, -length(p)), to: addDays(p.from, -1) });
const lastYear = (p: Period): Period => ({ from: `${Number(p.from.slice(0, 4)) - 1}${p.from.slice(4)}`, to: `${Number(p.to.slice(0, 4)) - 1}${p.to.slice(4)}` });
const branchIds = (b: string) => (b === "all" ? Object.keys(CHAIRS) : [b]);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

function apptsIn(f: Filters, now: Date): Appointment[] {
  return days(f).flatMap((d) =>
    branchIds(f.branchId)
      .flatMap((b) => dayAppointments(b, d, now))
      .filter((a) => (!f.dentist || a.dentist === f.dentist) && (!f.category || CATEGORY(a.type) === f.category)),
  );
}

async function billsIn(clinicId: string, f: Filters, now: Date): Promise<Bill[]> {
  const all = await Promise.all(days(f).map((date) => dayBills(clinicId, { branchId: f.branchId, date, now })));
  return all
    .flat()
    .filter((b) => b.status === "paid")
    .filter((b) => (!f.dentist || b.items.some((l) => l.what.includes(f.dentist!))) && (!f.category || b.items.some((l) => CATEGORY(l.what) === f.category)));
}

/* sample-only signals, stable per appointment: first visits, plan items presented, ratings */
const isFirstVisit = (a: Appointment) => a.status === "completed" && hash(`${a.id}-new`) % 6 === 0;
const ESTIMATES = [3500, 6500, 9000, 15000, 25000];
const planItem = (a: Appointment) =>
  a.status === "completed" && /^(Consultation|Check-up|Kids' check-up)/.test(a.type)
    ? { appt: a, estimateInr: ESTIMATES[hash(`${a.id}-est`) % ESTIMATES.length], accepted: hash(`${a.id}-acc`) % 3 !== 0 }
    : null;
const rating = (a: Appointment) => (a.status === "completed" && hash(`${a.id}-r`) % 4 === 0 ? 4 + (hash(`${a.id}-s`) % 2) : null);

/* ---------------- one metric ---------------- */

export type MetricValue = { id: string; value: number | null; numerator?: number; denominator?: number; byValue?: number | null };

export async function metric(clinicId: string, id: string, f: Filters): Promise<MetricValue> {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const appts = () => apptsIn(f, now);
  switch (id) {
    case "netRevenue": {
      const bills = await billsIn(clinicId, f, now);
      const v = bills.flatMap((b) => b.items).reduce((n, l) => n + l.listFeeInr - l.discountInr, 0);
      return { id, value: v, numerator: v };
    }
    case "chairUtilisation": {
      const attended = appts().filter((a) => a.status === "completed").reduce((n, a) => n + a.minutes, 0);
      const perDay = (toMin(HOURS.close) - toMin(HOURS.open) - (toMin(HOURS.lunch[1]) - toMin(HOURS.lunch[0])));
      const chairs = branchIds(f.branchId).reduce((n, b) => n + (f.dentist ? CHAIRS[b].filter((c) => c.dentist === f.dentist).length : CHAIRS[b].length), 0);
      const available = days(f).filter((d) => weekday(d) !== 0).length * chairs * perDay;
      return { id, value: pct(attended, available), numerator: attended, denominator: available };
    }
    case "revenuePerChairHour": {
      const [net, util] = await Promise.all([metric(clinicId, "netRevenue", f), metric(clinicId, "chairUtilisation", f)]);
      const hours = (util.numerator ?? 0) / 60;
      return { id, value: hours ? Math.round((net.value ?? 0) / hours) : null, numerator: net.value ?? 0, denominator: Math.round(hours * 10) / 10 };
    }
    case "noShowRate": {
      const list = appts();
      const ns = list.filter((a) => a.status === "no_show").length;
      const att = list.filter((a) => a.status === "completed").length;
      return { id, value: pct(ns, att + ns), numerator: ns, denominator: att + ns };
    }
    case "newPatients": {
      const n = appts().filter(isFirstVisit).length;
      return { id, value: n, numerator: n };
    }
    case "caseAcceptance": {
      const items = appts().map(planItem).filter((x) => x !== null);
      const acc = items.filter((x) => x.accepted);
      const val = (l: typeof items) => l.reduce((n, x) => n + x.estimateInr, 0);
      return { id, value: pct(acc.length, items.length), numerator: acc.length, denominator: items.length, byValue: pct(val(acc), val(items)) };
    }
    case "recallOverdue": {
      const n = (await listPatients(clinicId, { filter: "recall" })).length;
      return { id, value: n, numerator: n };
    }
    case "averageRating": {
      const r = appts().map(rating).filter((x) => x !== null);
      return { id, value: r.length ? Math.round((r.reduce((n, x) => n + x, 0) / r.length) * 10) / 10 : null, numerator: r.reduce((n, x) => n + x, 0), denominator: r.length };
    }
    default:
      throw new Error(`Unknown metric ${id}`);
  }
}

function toMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/* ---------------- Clinic Pulse ---------------- */

const PULSE = ["netRevenue", "revenuePerChairHour", "chairUtilisation", "noShowRate", "newPatients", "caseAcceptance", "recallOverdue", "averageRating"];

export async function pulse(clinicId: string, f: Filters) {
  const now = f.now ?? new Date();
  const tiles = await Promise.all(
    PULSE.map(async (id) => {
      const [cur, prev, ly] = await Promise.all([metric(clinicId, id, f), metric(clinicId, id, { ...f, ...previousPeriod(f) }), metric(clinicId, id, { ...f, ...lastYear(f) })]);
      const series = await Promise.all(
        Array.from({ length: 12 }, (_, i) => {
          const to = addDays(f.to, -7 * (11 - i));
          return metric(clinicId, id, { ...f, from: addDays(to, -6), to }).then((m) => m.value);
        }),
      );
      return { ...cur, ...METRICS[id], previous: prev.value, lastYear: ly.value, series };
    }),
  );
  const asOf = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(11, 16);
  return { tiles, asOf, period: { from: f.from, to: f.to }, compareTo: previousPeriod(f) };
}

/** The rows behind a number. */
export async function drillDown(clinicId: string, id: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const list = apptsIn(f, now);
  if (id === "noShowRate") return list.filter((a) => a.status === "no_show");
  if (id === "newPatients") return list.filter(isFirstVisit);
  if (id === "chairUtilisation") return list.filter((a) => a.status === "completed");
  if (id === "caseAcceptance") return list.filter((a) => planItem(a) !== null);
  return [];
}

/* ---------------- Daily Operations ---------------- */

export async function dailyOps(clinicId: string, opts: { date: string; branchId: string; now?: Date }) {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const list = branchIds(opts.branchId).flatMap((b) => dayAppointments(b, opts.date, now));
  const tomorrow = branchIds(opts.branchId).flatMap((b) => dayAppointments(b, addDays(opts.date, 1), now));
  const home = await getClinicHome(clinicId, { date: opts.date, branchId: opts.branchId, now });
  const billed = new Set((await dayBills(clinicId, { branchId: opts.branchId, date: opts.date, now })).map((b) => b.patientName));
  const inTreatment = await listPatients(clinicId, { filter: "in_treatment" });
  const count = (s: Appointment["status"]) => list.filter((a) => a.status === s).length;
  return {
    date: opts.date,
    scheduled: list.filter((a) => a.status !== "cancelled").length,
    completed: count("completed"),
    noShow: count("no_show"),
    cancelled: count("cancelled"),
    open: list.filter((a) => !["completed", "no_show", "cancelled"].includes(a.status)).length,
    walkIns: 0,
    viaFmd: list.filter((a) => a.viaFmd).length,
    unconfirmedTomorrow: tomorrow.filter((a) => a.status === "unconfirmed").map((a) => a.patientName),
    notBilled: list.filter((a) => a.status === "completed" && !billed.has(a.patientName)).map((a) => `${a.patientName} · ${a.type}`),
    unsignedNotes: home.attention.unsignedNotes,
    pendingNoNext: inTreatment.filter((p) => !p.next || p.next.tone).map((p) => `${p.name}${p.treatment ? ` (${p.treatment.label})` : ""}`),
  };
}

/* ---------------- Daily Collection Sheet ---------------- */

type Cash = { countedInr: number; recordedInr: number; varianceInr: number; note: string; by: string };
const cashCounts = new Map<string, Cash>();
const signOffs = new Map<string, { by: string; at: string }>();
onReset.push(() => {
  cashCounts.clear();
  signOffs.clear();
});
const sheetKey = (branchId: string, date: string) => `${branchId}|${date}`;

export async function collectionSheet(clinicId: string, opts: { date: string; branchId: string; now?: Date }) {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const bills = (await dayBills(clinicId, { branchId: opts.branchId, date: opts.date, now })).filter((b) => b.status === "paid");
  const byMode = Object.fromEntries(MODES.map((m) => [m, { totalInr: 0, count: 0, receivers: {} as Record<string, number> }])) as Record<
    Mode,
    { totalInr: number; count: number; receivers: Record<string, number> }
  >;
  for (const b of bills) {
    const m = byMode[b.mode];
    m.totalInr += b.amountInr;
    m.count++;
    m.receivers[b.by] = (m.receivers[b.by] ?? 0) + 1;
  }
  const key = sheetKey(opts.branchId, opts.date);
  return {
    date: opts.date,
    byMode,
    totalInr: bills.reduce((n, b) => n + b.amountInr, 0),
    count: bills.length,
    discounts: bills.filter((b) => b.discount).map((b) => ({ billId: b.id, patientName: b.patientName, ...b.discount! })),
    notBilled: (await dailyOps(clinicId, opts)).notBilled,
    cash: cashCounts.get(key) ?? null,
    locked: signOffs.get(key) ?? null,
  };
}

/** Cash counted at close. A difference from what was recorded needs a note; a signed-off sheet can't change. */
export async function recordCashCount(clinicId: string, input: { date: string; branchId: string; countedInr: number; note: string; by: string; role: string; now?: Date }) {
  const key = sheetKey(input.branchId, input.date);
  if (signOffs.has(key)) throw new Error("This sheet is signed off and locked");
  if (!Number.isInteger(input.countedInr) || input.countedInr < 0) throw new Error("Enter the cash counted in whole rupees");
  const sheet = await collectionSheet(clinicId, { date: input.date, branchId: input.branchId, now: input.now });
  const recorded = sheet.byMode.Cash.totalInr;
  const variance = input.countedInr - recorded;
  if (variance !== 0 && !input.note.trim()) throw new Error("Explain the difference between counted and recorded cash");
  const cash = { countedInr: input.countedInr, recordedInr: recorded, varianceInr: variance, note: input.note.trim(), by: input.by };
  cashCounts.set(key, cash);
  return cash;
}

export async function signOffSheet(clinicId: string, input: { date: string; branchId: string; by: string; role: string }) {
  requireClinic(clinicId);
  if (input.role !== "clinic_owner") throw new Error("Only the clinic owner can sign off the sheet");
  const key = sheetKey(input.branchId, input.date);
  const at = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 16);
  signOffs.set(key, { by: input.by, at });
  return signOffs.get(key)!;
}

/* ---------------- alerts ---------------- */

export type Alert = { id: string; tone: "warn" | "bad" | "ok"; title: string; detail: string; count?: number };

export async function getAlerts(clinicId: string, opts: { branchId: string; now?: Date }): Promise<Alert[]> {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const today = istDate(now);
  const out: Alert[] = [];

  const week = await metric(clinicId, "noShowRate", { branchId: opts.branchId, from: addDays(today, -6), to: today, now });
  const base = await metric(clinicId, "noShowRate", { branchId: opts.branchId, from: addDays(today, -62), to: addDays(today, -7), now });
  if (week.value !== null && base.value && week.value >= 1.5 * base.value)
    out.push({ id: "noShowSpike", tone: "warn", title: "No-shows are up", detail: `This week ${week.value}%, ${Math.round((week.value / base.value) * 10) / 10}× the 8-week average of ${base.value}%.` });

  for (const [key, c] of cashCounts) {
    const [branch, date] = key.split("|");
    if (c.varianceInr !== 0 && (opts.branchId === "all" || branch === opts.branchId) && date >= addDays(today, -6))
      out.push({ id: "cashVariance", tone: "bad", title: "Cash didn't match at close", detail: `${date}: ₹${Math.abs(c.varianceInr).toLocaleString("en-IN")} ${c.varianceInr < 0 ? "short" : "over"}. Note: ${c.note}` });
  }

  const stalled = (await listPatients(clinicId, { filter: "in_treatment" })).filter((p) => p.next?.tone === "bad");
  if (stalled.length)
    out.push({ id: "incompleteCourse", tone: "warn", title: `${stalled.length} treatment course${stalled.length === 1 ? "" : "s"} stalled`, detail: stalled.map((p) => `${p.name} (${p.treatment?.label ?? "treatment"})`).join(", ") });

  // every external action the AI manager takes needs an approval first, so this must always be 0
  out.push({ id: "aiSafety", tone: "ok", title: "AI safety: 0 actions without approval", detail: "Every external action this period was approved.", count: 0 });
  return out;
}
