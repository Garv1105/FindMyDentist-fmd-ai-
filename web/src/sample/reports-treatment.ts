/**
 * FMD Clinic reports, stage 3: Recall & follow-up (RPT-07), Case acceptance (RPT-09) and Pending treatment (RPT-10).
 * Built from the definitions in reports.ts; `money: false` (front desk) leaves out every ₹ figure.
 */
import { istDate, requireClinic } from "./clinic.ts";
import { CHANNELS, daysOverdue, recallsBetween, type Recall } from "./recall.ts";
import { addMonths, DECLINE_REASONS, isPending, planItemsIn, tile, type Filters, type PlanItem } from "./reports.ts";

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const age = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const LIST_MAX = 100;

/* ---------------- recall ---------------- */

export async function recallReport(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const today = istDate(now);
  const tiles = await Promise.all(["recallOverdue", "recallCompletion", "recallConversion"].map((id) => tile(clinicId, id, f)));
  // the work lists are as of today: the last 12 months of dues plus the next 30 days
  const open = recallsBetween(f.branchId, addMonths(today, -12), addDays(today, 30), today);
  const inPeriod = recallsBetween(f.branchId, f.from, f.to, today);
  const row = (r: Recall) => ({ name: r.name, due: r.due, daysOverdue: r.due <= today ? daysOverdue(r, today) : null, channel: r.channel ?? null, attempts: r.attempts });
  const take = (list: Recall[]) => ({ count: list.length, rows: list.slice(0, LIST_MAX).map(row) });
  const tabs = {
    due: take(open.filter((r) => r.status === "due")),
    overdue: take(open.filter((r) => r.status === "overdue").sort((a, b) => a.due.localeCompare(b.due))),
    contacted: take(open.filter((r) => r.status === "contacted")),
    completed: take(inPeriod.filter((r) => r.status === "completed")),
    opted_out: take(open.filter((r) => r.status === "opted_out")),
  };
  const byChannel = CHANNELS.map((channel) => {
    const list = inPeriod.filter((r) => r.channel === channel);
    const booked = list.filter((r) => r.status === "completed").length;
    return { channel, contacted: list.length, booked, value: pct(booked, list.length) };
  });
  return { tiles, tabs, byChannel };
}

/* ---------------- case acceptance ---------------- */

const BANDS: [string, number][] = [
  ["Under ₹5k", 5000],
  ["₹5k–25k", 25000],
  ["₹25k–1L", 100000],
  ["Over ₹1L", Infinity],
];
const bandOf = (inr: number) => BANDS.find(([, max]) => inr < max)![0];

function split(items: PlanItem[], groupOf: (x: PlanItem) => string, order?: string[]) {
  const by = new Map<string, PlanItem[]>();
  for (const x of items) by.set(groupOf(x), [...(by.get(groupOf(x)) ?? []), x]);
  const keys = order ? order.filter((k) => by.has(k)) : [...by.keys()].sort();
  return keys.map((label) => {
    const list = by.get(label)!;
    const acc = list.filter((x) => x.accepted);
    const val = (l: PlanItem[]) => l.reduce((n, x) => n + x.estimateInr, 0);
    return { label, presented: list.length, accepted: acc.length, value: pct(acc.length, list.length), byValue: pct(val(acc), val(list)) };
  });
}

export async function acceptanceReport(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const tiles = await Promise.all(["caseAcceptance", "daysToAccept"].map((id) => tile(clinicId, id, f)));
  const items = planItemsIn(f, now);
  const declined = items.filter((x) => x.status === "declined");
  return {
    tiles,
    cuts: {
      Dentist: split(items, (x) => x.appt.dentist),
      Category: split(items, (x) => x.category),
      "Value band": split(items, (x) => bandOf(x.estimateInr), BANDS.map(([l]) => l)),
      "New or returning": split(items, (x) => (x.appt.newPatient ? "New patients" : "Returning patients"), ["New patients", "Returning patients"]),
    },
    outcomes: (["accepted", "declined", "deferred", "undecided"] as const).map((s) => ({ status: s, count: items.filter((x) => x.status === s).length })),
    declineReasons: DECLINE_REASONS.map((reason) => ({ reason, count: declined.filter((x) => x.declineReason === reason).length })).filter((r) => r.count),
  };
}

/* ---------------- pending treatment ---------------- */

export async function pendingReport(clinicId: string, f: Filters, opts: { money: boolean }) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const today = istDate(now);
  // a snapshot as of today: everything presented in the last 12 months, whatever the period picker says
  const window: Filters = { ...f, from: addMonths(today, -12), to: today };
  const items = planItemsIn(window, now);
  const row = (x: PlanItem) => ({
    name: x.appt.patientName,
    procedure: x.procedure,
    dentist: x.appt.dentist,
    presented: x.appt.start.slice(0, 10),
    ageDays: age(x.appt.start.slice(0, 10), today),
    ...(opts.money ? { estimateInr: x.estimateInr } : {}),
  });
  const group = (key: string, label: string, list: PlanItem[]) => ({
    key,
    label,
    count: list.length,
    ...(opts.money ? { valueInr: list.reduce((n, x) => n + x.estimateInr, 0) } : {}),
    rows: list.sort((a, b) => a.appt.start.localeCompare(b.appt.start)).slice(0, LIST_MAX).map(row),
  });
  const groups = [
    group("unscheduled", "Accepted, not scheduled", items.filter((x) => x.progress === "not scheduled")),
    group("course", "Course started, not finished", items.filter((x) => x.progress === "course incomplete")),
    group("deferred", "Deferred by the patient", items.filter((x) => x.status === "deferred")),
    group("stale", "Presented, no decision for 30+ days", items.filter((x) => x.status === "undecided" && age(x.appt.start.slice(0, 10), today) >= 30)),
  ];
  const tiles = opts.money ? [await tile(clinicId, "pendingValue", window)] : [];
  return { tiles, groups, since: window.from, pendingCount: items.filter(isPending).length };
}
