/**
 * FMD Clinic reports, stage 2: Chair & dentist utilisation (RPT-02) and No-shows & cancellations (RPT-03).
 * Built only from the metric definitions in reports.ts. `money: false` (front desk) leaves out every ₹ figure.
 */
import { CHAIRS, istDate, openWindows, requireClinic, weekday, type Appointment } from "./clinic.ts";
import { FMD_SOURCES } from "./people.ts";
import { apptsIn, isLateCancel, isMissed, metric, nextFreeDays, tile, type Filters } from "./reports.ts";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS_SHOWN = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const branchIds = (b: string) => (b === "all" ? Object.keys(CHAIRS) : [b]);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

/* ---------------- utilisation ---------------- */

export async function utilisation(clinicId: string, f: Filters, opts: { money: boolean }) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const ids = ["chairUtilisation", "dentistUtilisation", ...(opts.money ? ["revenuePerChairHour"] : []), "emptyChairHours", "nextFreeSlot"];
  const tiles = await Promise.all(ids.map((id) => tile(clinicId, id, f)));

  // weekday × hour: attended minutes ÷ open chair-minutes in that hour, over every such weekday in the period
  const used = new Map<string, number>();
  const open = new Map<string, number>();
  const chairs = branchIds(f.branchId).reduce((n, b) => n + CHAIRS[b].filter((c) => !f.dentist || c.dentist === f.dentist).length, 0);
  for (let d = f.from; d <= f.to; d = addDays(d, 1)) {
    for (const h of HOURS_SHOWN) {
      const mins = openWindows(d).reduce((n, [a, b]) => n + overlap(h * 60, h * 60 + 60, toMin(a), toMin(b)), 0);
      const k = `${weekday(d)}|${h}`;
      open.set(k, (open.get(k) ?? 0) + mins * chairs);
    }
  }
  for (const a of apptsIn(f, now).filter((x) => x.status === "completed")) {
    const s = toMin(a.start.slice(11, 16));
    for (const h of HOURS_SHOWN) {
      const k = `${weekday(a.start.slice(0, 10))}|${h}`;
      used.set(k, (used.get(k) ?? 0) + overlap(s, s + a.minutes, h * 60, h * 60 + 60));
    }
  }
  const rows = [1, 2, 3, 4, 5, 6].map((wd) => ({
    day: DAYS[wd],
    cells: HOURS_SHOWN.map((h) => {
      const o = open.get(`${wd}|${h}`) ?? 0;
      return o ? Math.min(100, Math.round(((used.get(`${wd}|${h}`) ?? 0) / o) * 100)) : null;
    }),
  }));
  const quiet = rows
    .flatMap((r) => r.cells.map((value, i) => ({ day: r.day, hour: HOURS_SHOWN[i], value })))
    .filter((c): c is { day: string; hour: number; value: number } => c.value !== null)
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  const chairRows = await Promise.all(
    branchIds(f.branchId).flatMap((b) =>
      CHAIRS[b]
        .filter((c) => !f.dentist || c.dentist === f.dentist)
        .map(async (c) => {
          const ff = { ...f, branchId: b, dentist: c.dentist };
          const util = (await metric(clinicId, "chairUtilisation", ff)).value;
          const base = { branchId: b, chair: c.chair, dentist: c.dentist, util, nextFree: nextFreeDays(b, c.chair, now) };
          return opts.money ? { ...base, inrPerHour: (await metric(clinicId, "revenuePerChairHour", ff)).value } : base;
        }),
    ),
  );
  return { tiles, heatmap: { hours: HOURS_SHOWN, rows }, quiet, chairs: chairRows as ((typeof chairRows)[number] & { inrPerHour?: number | null })[] };
}

/* ---------------- no-shows ---------------- */

type CutRow = { label: string; value: number | null; numerator: number; denominator: number };

/** The no-show rate (spec formula) for each group of visits. Groups appear in `order`; empty ones are left out. */
function cut(list: Appointment[], groupOf: (a: Appointment) => string, order?: string[]): CutRow[] {
  const by = new Map<string, [number, number]>();
  for (const a of list) {
    if (!(a.status === "completed" || a.status === "no_show" || isLateCancel(a))) continue;
    const g = groupOf(a);
    const [n, d] = by.get(g) ?? [0, 0];
    by.set(g, [n + (a.status === "no_show" ? 1 : 0), d + 1]);
  }
  const keys = order ? order.filter((k) => by.has(k)) : [...by.keys()].sort();
  return keys.map((label) => {
    const [numerator, denominator] = by.get(label)!;
    return { label, value: pct(numerator, denominator), numerator, denominator };
  });
}

const partOfDay = (a: Appointment) => {
  const t = a.start.slice(11, 16);
  return t < "12:00" ? "Morning" : t < "17:00" ? "Afternoon" : "After 17:00";
};
const lead = (a: Appointment) => {
  const d = a.bookedDaysAhead ?? 0;
  return d <= 2 ? "0–2 days ahead" : d < 14 ? "3–13 days ahead" : "14+ days ahead";
};
const sourceGroup = (a: Appointment) =>
  a.source && FMD_SOURCES.includes(a.source) ? "FMD Main" : a.source === "Patient referral" || a.source === "Dentist referral" ? "Referral" : (a.source ?? "Not recorded");

export async function noShows(clinicId: string, f: Filters, opts: { money: boolean }) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const ids = ["noShowRate", "lateCancelRate", "lostChairHours", ...(opts.money ? ["lostRevenue"] : []), "rebookRate"];
  const tiles = await Promise.all(ids.map((id) => tile(clinicId, id, f)));
  const list = apptsIn(f, now);

  const reasons = new Map<string, number>();
  for (const a of list.filter(isMissed)) reasons.set(a.missed?.reason ?? "No reason recorded", (reasons.get(a.missed?.reason ?? "No reason recorded") ?? 0) + 1);

  const cuts = {
    Weekday: cut(list, (a) => DAYS[weekday(a.start.slice(0, 10))], DAYS),
    "Time of day": cut(list, partOfDay, ["Morning", "Afternoon", "After 17:00"]),
    Source: cut(list, sourceGroup),
    "New or returning": cut(list, (a) => (a.newPatient ? "New patients" : "Returning patients"), ["New patients", "Returning patients"]),
    "Booked ahead": cut(list, lead, ["0–2 days ahead", "3–13 days ahead", "14+ days ahead"]),
    Reminder: cut(list, (a) => (a.reminderDelivered === false ? "Reminder not delivered" : "Reminder delivered"), ["Reminder delivered", "Reminder not delivered"]),
    Dentist: cut(list, (a) => a.dentist),
  };

  // patients who missed twice or more in the last 6 months, whatever the period
  const today = istDate(now);
  const recent = apptsIn({ ...f, from: addDays(today, -182), to: today }, now).filter(isMissed);
  const people = new Map<string, { name: string; noShows: number; lateCancels: number; last: string; source?: string }>();
  for (const a of recent) {
    const p = people.get(a.patientName) ?? { name: a.patientName, noShows: 0, lateCancels: 0, last: "", source: a.source };
    if (a.status === "no_show") p.noShows++;
    else p.lateCancels++;
    p.last = a.start.slice(0, 10) > p.last ? a.start.slice(0, 10) : p.last;
    people.set(a.patientName, p);
  }
  const repeat = [...people.values()]
    .filter((p) => p.noShows + p.lateCancels >= 2)
    .sort((a, b) => b.noShows + b.lateCancels - (a.noShows + a.lateCancels) || b.last.localeCompare(a.last));

  return { tiles, reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count), cuts, repeat };
}
