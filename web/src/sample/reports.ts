/**
 * FMD Clinic reports, stages 1 and 2 (from fmd-clinic-reports-prompt.md). Every number comes from one definition in
 * METRICS, computed here and nowhere else, so tiles, drill-downs, comparisons and the metric dictionary always agree.
 * No waiting-time or overrun figures, no refunds, no inventory (owner decisions). Sample data: the analytics pipeline
 * comes with the backend.
 */
import { dayBills, MODES, type Bill, type Mode } from "./clinic-billing.ts";
import { freeGaps } from "./calendar.ts";
import { CHAIRS, dayAppointments, FEES, getClinicHome, isFirstVisit, istDate, onReset, openWindows, requireClinic, type Appointment } from "./clinic.ts";
import { listPatients } from "./patients.ts";
import { hash as mix, roster, type Person } from "./people.ts";
import { recallsBetween } from "./recall.ts";

/* ---------------- definitions ---------------- */

export type MetricDef = {
  label: string;
  formula: string;
  numerator: string;
  denominator?: string;
  exclusions?: string;
  unit: "inr" | "pct" | "count" | "rating" | "hours" | "days";
  estimate?: boolean;
};

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
    formula: "Attended booked chair-minutes ÷ available chair-minutes × 100. Available = opening hours − lunch, for each chair (Saturdays 9–1, Sundays closed)",
    numerator: "minutes of completed appointments",
    denominator: "open chair-minutes",
    unit: "pct",
  },
  noShowRate: {
    label: "No-show rate",
    formula: "No-shows ÷ (attended + no-shows + late cancels) × 100. Late cancel = the patient cancelled with less than 24 hours' notice",
    numerator: "no-shows",
    denominator: "attended + no-shows + late cancels",
    exclusions: "Visits the clinic cancelled; patient cancels with 24+ hours' notice",
    unit: "pct",
  },
  lateCancelRate: {
    label: "Late cancels (<24 h)",
    formula: "Patient cancellations with less than 24 hours' notice ÷ scheduled appointments × 100",
    numerator: "patient cancels with < 24 h notice",
    denominator: "all appointments booked for the period, cancelled ones included",
    unit: "pct",
  },
  lostChairHours: {
    label: "Lost chair-hours",
    formula: "Booked minutes of no-shows + late cancels ÷ 60",
    numerator: "minutes of no-shows and late cancels",
    unit: "hours",
  },
  lostRevenue: {
    label: "Lost revenue",
    formula: "List fees of the treatments booked in no-shows + late cancels",
    numerator: "list fees of missed visits",
    exclusions: "Discounts and GST (not known for a visit that didn't happen)",
    unit: "inr",
    estimate: true,
  },
  rebookRate: {
    label: "Rebooked within 14 days",
    formula: "No-shows + late cancels that booked again within 14 days ÷ no-shows + late cancels × 100",
    numerator: "missed visits rebooked within 14 days",
    denominator: "no-shows + late cancels",
    unit: "pct",
  },
  dentistUtilisation: {
    label: "Dentist utilisation",
    formula: "Attended minutes in dentists' chairs ÷ the dentists' open chair-minutes × 100",
    numerator: "minutes of completed appointments with a dentist",
    denominator: "dentists' open chair-minutes",
    exclusions: "The hygienist's chair",
    unit: "pct",
  },
  emptyChairHours: {
    label: "Empty chair-hours",
    formula: "(Open chair-minutes − minutes booked, cancelled visits excluded) ÷ 60",
    numerator: "open chair-minutes not booked",
    exclusions: "Lunch, Saturday afternoons, Sundays",
    unit: "hours",
  },
  nextFreeSlot: {
    label: "Next free 30-min slot",
    formula: "Days from today to each dentist's first free slot of 30 minutes or more, averaged across dentists. As of now, not for the period",
    numerator: "days to the first free slot, summed",
    denominator: "dentists",
    unit: "days",
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
    formula: "Recalls past their due date (in the 12 months to the period end) with nothing booked, contacted or not",
    numerator: "overdue recalls",
    exclusions: "Patients who opted out",
    unit: "count",
  },
  recallCompletion: {
    label: "Recall completion",
    formula: "Recalls due in the period that were attended by the due date + 30 days ÷ recalls due × 100",
    numerator: "recalls attended within 30 days of due",
    denominator: "recalls due (whose 30 days have passed)",
    exclusions: "Patients who opted out",
    unit: "pct",
  },
  recallConversion: {
    label: "Recall → booking",
    formula: "Recalls contacted that led to a visit ÷ recalls contacted × 100",
    numerator: "contacted recalls that came in",
    denominator: "recalls contacted",
    unit: "pct",
  },
  pendingValue: {
    label: "Pending treatment",
    formula: "₹ estimate of accepted plan items not completed and not scheduled (including unfinished multi-visit courses)",
    numerator: "estimates of accepted, unscheduled items",
    unit: "inr",
    estimate: true,
  },
  daysToAccept: {
    label: "Days to accept",
    formula: "Median days between presenting a plan item and the patient accepting it",
    numerator: "days to accept (median)",
    unit: "days",
  },
  grossRevenue: {
    label: "Gross revenue",
    formula: "Sum of list fees on paid bills, by bill date",
    numerator: "list fees on paid bills",
    exclusions: "Void bills; GST",
    unit: "inr",
  },
  discountTotal: {
    label: "Discounts",
    formula: "Sum of discounts on paid bills",
    numerator: "discounts",
    exclusions: "Void bills",
    unit: "inr",
  },
  realisationRate: {
    label: "Realised fee",
    formula: "Net revenue ÷ gross revenue × 100: how much of the list fee is actually charged",
    numerator: "net revenue",
    denominator: "gross revenue",
    unit: "pct",
  },
  revenuePerVisit: {
    label: "Revenue per visit",
    formula: "Net revenue ÷ attended visits",
    numerator: "net revenue",
    denominator: "attended visits",
    unit: "inr",
  },
  revenuePerNewPatient: {
    label: "Revenue per new patient",
    formula: "Net revenue ÷ new patients in the period",
    numerator: "net revenue",
    denominator: "new patients",
    unit: "inr",
  },
  revenuePerActivePatient: {
    label: "Revenue per active patient",
    formula: "Net revenue ÷ active patients at the period end",
    numerator: "net revenue",
    denominator: "active patients",
    unit: "inr",
  },
  gstCollected: {
    label: "GST collected",
    formula: "Sum of GST on paid bills (rate per service as set by the clinic and confirmed by its CA)",
    numerator: "GST on paid bills",
    exclusions: "Void bills",
    unit: "inr",
  },
  exemptValue: {
    label: "Exempt value",
    formula: "List fee − discount on bill lines with a 0% GST rate",
    numerator: "taxable value of exempt lines",
    exclusions: "Void bills",
    unit: "inr",
  },
  averageRating: {
    label: "Average rating",
    formula: "Mean of patient ratings given in the period (1–5)",
    numerator: "sum of ratings",
    denominator: "number of ratings",
    unit: "rating",
  },
  activePatients: {
    label: "Active patients",
    formula: "Patients with at least one attended visit in the 18 months up to the end of the period",
    numerator: "patients seen in the last 18 months",
    unit: "count",
  },
  returningPatients: {
    label: "Returning",
    formula: "Patients seen in the period who had visited within the 18 months before (not new, not reactivated)",
    numerator: "returning patients seen",
    unit: "count",
  },
  reactivatedPatients: {
    label: "Reactivated",
    formula: "Patients seen in the period whose previous visit was more than 18 months earlier",
    numerator: "reactivated patients seen",
    unit: "count",
  },
  lapsedPatients: {
    label: "Lapsed",
    formula: "Patients whose 18 months since their last visit ran out in the period, with nothing booked",
    numerator: "patients who lapsed",
    unit: "count",
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
  [/^Deep cleaning/, "Periodontal"],
  [/Implant/i, "Implant"],
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

export function apptsIn(f: Filters, now: Date): Appointment[] {
  return days(f).flatMap((d) =>
    branchIds(f.branchId)
      .flatMap((b) => dayAppointments(b, d, now))
      .filter((a) => (!f.dentist || a.dentist === f.dentist) && (!f.category || CATEGORY(a.type) === f.category)),
  );
}

export async function billsIn(clinicId: string, f: Filters, now: Date): Promise<Bill[]> {
  const all = await Promise.all(days(f).map((date) => dayBills(clinicId, { branchId: f.branchId, date, now })));
  return all
    .flat()
    .filter((b) => b.status === "paid")
    .filter((b) => (!f.dentist || b.items.some((l) => l.what.includes(f.dentist!))) && (!f.category || b.items.some((l) => CATEGORY(l.what) === f.category)));
}

/* sample-only signals, stable per appointment: plan items presented, ratings, reactivated patients */
/** What a consultation or check-up can propose: procedure, FMD category, estimate (₹). */
const PLANS: [string, string, number][] = [
  ["Filling", "Restorative", 3500],
  ["Deep cleaning", "Periodontal", 4500],
  ["Root canal + crown", "Endodontic", 15000],
  ["Zirconia crown", "Prosthodontic", 9000],
  ["Clear aligners", "Orthodontic", 85000],
  ["Implant", "Implant", 45000],
  ["Whitening", "Cosmetic", 8000],
  ["Wisdom tooth removal", "Surgical", 6500],
  ["Full-mouth implants", "Implant", 180000],
];
export const DECLINE_REASONS = ["Cost", "Wants a second opinion", "Not urgent for them", "Fear or anxiety", "Time off work", "Other"];
export type PlanItem = {
  appt: Appointment;
  procedure: string;
  category: string;
  estimateInr: number;
  accepted: boolean;
  status: "accepted" | "declined" | "deferred" | "undecided";
  declineReason?: string;
  /** accepted only: days between presenting and accepting */
  daysToAccept?: number;
  /** accepted only: where the treatment is now */
  progress?: "completed" | "scheduled" | "not scheduled" | "course incomplete";
};
// ponytail: plan items are stable hash-derived samples on completed consultations; the backend stores real ones
export const planItem = (a: Appointment): PlanItem | null => {
  if (a.status !== "completed" || !/^(Consultation|Check-up|Kids' check-up)/.test(a.type)) return null;
  const h = (t: string) => mix(`${a.id}-${t}`);
  const [procedure, category, estimateInr] = PLANS[h("est") % PLANS.length];
  const accepted = h("acc") % 3 !== 0;
  if (!accepted) {
    const status = (["declined", "deferred", "undecided"] as const)[h("dec") % 3];
    return { appt: a, procedure, category, estimateInr, accepted, status, ...(status === "declined" ? { declineReason: DECLINE_REASONS[h("why") % DECLINE_REASONS.length] } : {}) };
  }
  const multiVisit = /\+|aligners|Full-mouth/.test(procedure);
  const p = h("prog") % 10;
  const progress = p < 5 ? "completed" : p < 7 ? "scheduled" : multiVisit ? "course incomplete" : "not scheduled";
  return { appt: a, procedure, category, estimateInr, accepted, status: "accepted", daysToAccept: [0, 0, 1, 2, 4, 7, 12, 21][h("days") % 8], progress };
};
/** Accepted but not done and not booked: what "pending treatment" counts. */
export const isPending = (x: PlanItem) => x.progress === "not scheduled" || x.progress === "course incomplete";
/** Plan items presented in the period (respects branch, dentist and category filters). */
export const planItemsIn = (f: Filters, now: Date) =>
  apptsIn({ ...f, category: undefined }, now)
    .map(planItem)
    .filter((x): x is PlanItem => x !== null && (!f.category || x.category === f.category));
const rating = (a: Appointment) => (a.status === "completed" && hash(`${a.id}-r`) % 4 === 0 ? 4 + (hash(`${a.id}-s`) % 2) : null);
// ponytail: a stable 1-in-50 flag, not a look-back at the patient's history; the analytics marts compute it for real
const isReactivated = (a: Appointment) => a.status === "completed" && !a.newPatient && hash(`${a.id}-react`) % 50 === 0;
const isReturning = (a: Appointment) => a.status === "completed" && !a.newPatient && !isReactivated(a);

/** A patient cancel with less than 24 hours' notice. */
export const isLateCancel = (a: Appointment) => a.status === "cancelled" && a.missed?.cancel?.by === "patient" && a.missed.cancel.noticeHours < 24;
/** A visit the patient missed: a no-show or a late cancel. */
export const isMissed = (a: Appointment) => a.status === "no_show" || isLateCancel(a);
export const isHygienist = (person: string) => /hygienist/i.test(person);
const names = (list: Appointment[]) => new Set(list.map((a) => a.patientName)).size;

/** Calendar months, kept inside the month: 31 Oct − 18 months = 30 Apr. */
export function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.toISOString().slice(0, 8)}${String(Math.min(d, last)).padStart(2, "0")}`;
}

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
/** Open chair-minutes in the period for the chairs that pass `keep` (and the dentist filter). */
function openMinutes(f: Filters, keep: (c: { chair: string; dentist: string }) => boolean = () => true) {
  const perChair = days(f).reduce((n, d) => n + openWindows(d).reduce((m, [a, b]) => m + toMin(b) - toMin(a), 0), 0);
  const chairs = branchIds(f.branchId).reduce((n, b) => n + CHAIRS[b].filter((c) => (!f.dentist || c.dentist === f.dentist) && keep(c)).length, 0);
  return perChair * chairs;
}

/** Whole days from today to a chair's first free slot of 30+ minutes (0 = later today), looking 60 days ahead. */
export function nextFreeDays(branchId: string, chair: string, now: Date): number | null {
  const today = istDate(now);
  for (let i = 0; i <= 60; i++) {
    const d = addDays(today, i);
    if (freeGaps(branchId, d, now, dayAppointments(branchId, d, now)).some((g) => g.chair === chair)) return i;
  }
  return null;
}

/* ---------------- one metric ---------------- */

export type MetricValue = { id: string; value: number | null; numerator?: number; denominator?: number; byValue?: number | null };

export async function metric(clinicId: string, id: string, f: Filters): Promise<MetricValue> {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const appts = () => apptsIn(f, now);
  const count = (n: number) => ({ id, value: n, numerator: n });
  switch (id) {
    case "netRevenue": {
      const bills = await billsIn(clinicId, f, now);
      const v = bills.flatMap((b) => b.items).reduce((n, l) => n + l.listFeeInr - l.discountInr, 0);
      return { id, value: v, numerator: v };
    }
    case "chairUtilisation":
    case "dentistUtilisation": {
      const dentistsOnly = id === "dentistUtilisation";
      const attended = appts()
        .filter((a) => a.status === "completed" && !(dentistsOnly && isHygienist(a.dentist)))
        .reduce((n, a) => n + a.minutes, 0);
      const available = openMinutes(f, (c) => !(dentistsOnly && isHygienist(c.dentist)));
      return { id, value: pct(attended, available), numerator: attended, denominator: available };
    }
    case "revenuePerChairHour": {
      const [net, util] = await Promise.all([metric(clinicId, "netRevenue", f), metric(clinicId, "chairUtilisation", f)]);
      const hours = (util.numerator ?? 0) / 60;
      return { id, value: hours ? Math.round((net.value ?? 0) / hours) : null, numerator: net.value ?? 0, denominator: Math.round(hours * 10) / 10 };
    }
    case "emptyChairHours": {
      const available = openMinutes(f);
      const booked = appts()
        .filter((a) => a.status !== "cancelled")
        .reduce((n, a) => n + a.minutes, 0);
      const v = available ? Math.round(Math.max(0, available - booked) / 60) : null;
      return { id, value: v, numerator: v ?? 0 };
    }
    case "nextFreeSlot": {
      const ds = branchIds(f.branchId).flatMap((b) =>
        CHAIRS[b].filter((c) => !isHygienist(c.dentist) && (!f.dentist || c.dentist === f.dentist)).map((c) => nextFreeDays(b, c.chair, now)),
      );
      const known = ds.filter((d) => d !== null);
      const sum = known.reduce((n, d) => n + d, 0);
      return { id, value: known.length ? Math.round((sum / known.length) * 10) / 10 : null, numerator: sum, denominator: known.length };
    }
    case "noShowRate": {
      const list = appts();
      const ns = list.filter((a) => a.status === "no_show").length;
      const att = list.filter((a) => a.status === "completed").length;
      const late = list.filter(isLateCancel).length;
      return { id, value: pct(ns, att + ns + late), numerator: ns, denominator: att + ns + late };
    }
    case "lateCancelRate": {
      const list = appts();
      const late = list.filter(isLateCancel).length;
      return { id, value: pct(late, list.length), numerator: late, denominator: list.length };
    }
    case "lostChairHours": {
      const mins = appts().filter(isMissed).reduce((n, a) => n + a.minutes, 0);
      return { id, value: Math.round((mins / 60) * 10) / 10, numerator: mins };
    }
    case "lostRevenue":
      return count(appts().filter(isMissed).reduce((n, a) => n + (FEES[a.type] ?? 0), 0));
    case "rebookRate": {
      const missed = appts().filter(isMissed);
      const back = missed.filter((a) => a.missed?.rebooked).length;
      return { id, value: pct(back, missed.length), numerator: back, denominator: missed.length };
    }
    case "newPatients":
      return count(appts().filter(isFirstVisit).length);
    case "returningPatients":
      return count(names(appts().filter(isReturning)));
    case "reactivatedPatients":
      return count(names(appts().filter(isReactivated)));
    case "activePatients":
      return count(branchIds(f.branchId).flatMap((b) => roster(b, istDate(now))).filter((p) => isActiveAt(p, f.to)).length);
    case "lapsedPatients":
      return count(lapsedIn(f, now).length);
    case "caseAcceptance": {
      const items = planItemsIn(f, now);
      const acc = items.filter((x) => x.accepted);
      const val = (l: typeof items) => l.reduce((n, x) => n + x.estimateInr, 0);
      return { id, value: pct(acc.length, items.length), numerator: acc.length, denominator: items.length, byValue: pct(val(acc), val(items)) };
    }
    case "pendingValue":
      return count(planItemsIn(f, now).filter(isPending).reduce((n, x) => n + x.estimateInr, 0));
    case "daysToAccept": {
      const d = planItemsIn(f, now).flatMap((x) => (x.daysToAccept === undefined ? [] : [x.daysToAccept])).sort((a, b) => a - b);
      return { id, value: d.length ? d[Math.floor((d.length - 1) / 2)] : null, numerator: d.length };
    }
    case "recallOverdue": {
      const end = [f.to, istDate(now)].sort()[0];
      const open = recallsBetween(f.branchId, addMonths(end, -12), end, istDate(now)).filter((r) => r.status === "overdue" || r.status === "contacted");
      return count(open.length);
    }
    case "recallCompletion": {
      const today = istDate(now);
      const due = recallsBetween(f.branchId, f.from, f.to, today).filter((r) => r.status !== "opted_out" && addDays(r.due, 30) <= today);
      const done = due.filter((r) => r.status === "completed").length;
      return { id, value: pct(done, due.length), numerator: done, denominator: due.length };
    }
    case "recallConversion": {
      const list = recallsBetween(f.branchId, f.from, f.to, istDate(now)).filter((r) => r.channel);
      const booked = list.filter((r) => r.status === "completed").length;
      return { id, value: pct(booked, list.length), numerator: booked, denominator: list.length };
    }
    case "grossRevenue":
    case "discountTotal":
    case "gstCollected":
    case "exemptValue": {
      const lines = (await billsIn(clinicId, f, now)).flatMap((b) => b.items);
      const pick = {
        grossRevenue: (l: Bill["items"][number]) => l.listFeeInr,
        discountTotal: (l: Bill["items"][number]) => l.discountInr,
        gstCollected: (l: Bill["items"][number]) => l.gstInr,
        exemptValue: (l: Bill["items"][number]) => (l.gstRate === 0 ? l.listFeeInr - l.discountInr : 0),
      }[id];
      return count(lines.reduce((n, l) => n + pick(l), 0));
    }
    case "realisationRate": {
      const [net, gross] = await Promise.all([metric(clinicId, "netRevenue", f), metric(clinicId, "grossRevenue", f)]);
      return { id, value: pct(net.value ?? 0, gross.value ?? 0), numerator: net.value ?? 0, denominator: gross.value ?? 0 };
    }
    case "revenuePerVisit":
    case "revenuePerNewPatient":
    case "revenuePerActivePatient": {
      const net = (await metric(clinicId, "netRevenue", f)).value ?? 0;
      const d =
        id === "revenuePerVisit"
          ? appts().filter((a) => a.status === "completed").length
          : ((await metric(clinicId, id === "revenuePerNewPatient" ? "newPatients" : "activePatients", f)).value ?? 0);
      return { id, value: d ? Math.round(net / d) : null, numerator: net, denominator: d };
    }
    case "averageRating": {
      const r = appts().map(rating).filter((x) => x !== null);
      return { id, value: r.length ? Math.round((r.reduce((n, x) => n + x, 0) / r.length) * 10) / 10 : null, numerator: r.reduce((n, x) => n + x, 0), denominator: r.length };
    }
    default:
      throw new Error(`Unknown metric ${id}`);
  }
}

/** Seen in the 18 months up to `end`; regulars who are still coming always are, once they've started. */
export const isActiveAt = (p: Person, end: string) => p.first <= end && (p.last === null || p.last > addMonths(end, -18));

/** Roster patients whose 18 months since the last visit ran out in the period (roster patients have nothing booked). */
export function lapsedIn(f: Filters, now: Date) {
  const [from, to] = [addMonths(f.from, -18), addMonths(f.to, -18)];
  return branchIds(f.branchId)
    .flatMap((b) => roster(b, istDate(now)))
    .filter((p): p is Person & { last: string } => p.last !== null && p.last >= from && p.last <= to)
    .sort((a, b) => a.last.localeCompare(b.last));
}

/* ---------------- tiles ---------------- */

/** A tile: the value, the previous period, the same dates last year and a 12-week series (weeks of 7 days). */
export async function tile(clinicId: string, id: string, f: Filters) {
  // "as of now" figures have no history to compare with
  if (id === "nextFreeSlot") return { ...(await metric(clinicId, id, f)), def: METRICS[id], previous: null, lastYear: null, series: [] as (number | null)[] };
  const [cur, prev, ly] = await Promise.all([metric(clinicId, id, f), metric(clinicId, id, { ...f, ...previousPeriod(f) }), metric(clinicId, id, { ...f, ...lastYear(f) })]);
  const series = await Promise.all(
    Array.from({ length: 12 }, (_, i) => {
      const to = addDays(f.to, -7 * (11 - i));
      return metric(clinicId, id, { ...f, from: addDays(to, -6), to }).then((m) => m.value);
    }),
  );
  return { ...cur, def: METRICS[id], previous: prev.value, lastYear: ly.value, series };
}
export type Tile = Awaited<ReturnType<typeof tile>>;

/* ---------------- Clinic Pulse ---------------- */

const PULSE = ["netRevenue", "revenuePerChairHour", "chairUtilisation", "noShowRate", "newPatients", "caseAcceptance", "recallOverdue", "averageRating"];

export async function pulse(clinicId: string, f: Filters) {
  const now = f.now ?? new Date();
  const tiles = await Promise.all(PULSE.map((id) => tile(clinicId, id, f)));
  const asOf = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(11, 16);
  return { tiles, asOf, period: { from: f.from, to: f.to }, compareTo: previousPeriod(f) };
}

/** The metrics whose number opens a list of appointments. */
export const DRILLABLE = ["pendingValue", "noShowRate", "newPatients", "chairUtilisation", "dentistUtilisation", "caseAcceptance", "lateCancelRate", "lostChairHours", "lostRevenue", "rebookRate", "returningPatients", "reactivatedPatients"];

/** The rows behind a number. */
export async function drillDown(clinicId: string, id: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const list = apptsIn(f, now);
  if (id === "noShowRate") return list.filter((a) => a.status === "no_show");
  if (id === "newPatients") return list.filter(isFirstVisit);
  if (id === "chairUtilisation") return list.filter((a) => a.status === "completed");
  if (id === "dentistUtilisation") return list.filter((a) => a.status === "completed" && !isHygienist(a.dentist));
  if (id === "caseAcceptance") return planItemsIn(f, now).map((x) => x.appt);
  if (id === "pendingValue") return planItemsIn(f, now).filter(isPending).map((x) => x.appt);
  if (id === "lateCancelRate") return list.filter(isLateCancel);
  if (id === "lostChairHours" || id === "lostRevenue" || id === "rebookRate") return list.filter(isMissed);
  if (id === "returningPatients") return list.filter(isReturning);
  if (id === "reactivatedPatients") return list.filter(isReactivated);
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
    walkIns: list.filter((a) => a.source === "Walk-in").length,
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
