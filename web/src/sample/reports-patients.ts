/**
 * FMD Clinic reports, stage 2: Patient base (RPT-05) and New patients by source (RPT-06). Counts only: no diagnoses,
 * notes or medical alerts. Names appear only in the lists you act on (lapsed patients, referrers to thank).
 */
import { dayBills } from "./billing.ts";
import { CHAIRS, isFirstVisit, istDate, requireClinic } from "./clinic.ts";
import { AGE_BANDS, FMD_SOURCES, GENDERS, LANGUAGES, roster, type Person } from "./people.ts";
import { addMonths, apptsIn, isActiveAt, lapsedIn, metric, tile, type Filters } from "./reports.ts";

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const branchIds = (b: string) => (b === "all" ? Object.keys(CHAIRS) : [b]);
const monthEnd = (m: string) => addDays(addMonths(`${m}-01`, 1), -1);
const monthLabel = (m: string) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.slice(5, 7)) - 1];
const tally = <T extends string>(keys: readonly T[], of: (p: Person) => T, people: Person[]): [T, number][] => keys.map((k) => [k, people.filter((p) => of(p) === k).length]);

/* ---------------- patient base ---------------- */

export async function patientBase(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const g: Filters = { ...f, dentist: undefined, category: undefined }; // patient counts aren't split by dentist or procedure
  const tiles = await Promise.all(["activePatients", "newPatients", "returningPatients", "reactivatedPatients", "lapsedPatients"].map((id) => tile(clinicId, id, g)));

  // the 6 months up to the end of the period
  const months = await Promise.all(
    Array.from({ length: 6 }, (_, i) => addMonths(f.to, i - 5).slice(0, 7)).map(async (month) => {
      const p = { ...g, from: `${month}-01`, to: month === f.to.slice(0, 7) ? f.to : monthEnd(month) };
      const [n, r, x] = await Promise.all(["newPatients", "returningPatients", "reactivatedPatients"].map((id) => metric(clinicId, id, p)));
      return { month, label: monthLabel(month), new: n.value ?? 0, returning: r.value ?? 0, reactivated: x.value ?? 0 };
    }),
  );

  const active = branchIds(f.branchId)
    .flatMap((b) => roster(b, istDate(now)))
    .filter((p) => isActiveAt(p, f.to));
  const families = new Map<string, number>();
  for (const p of active) if (p.familyId) families.set(p.familyId, (families.get(p.familyId) ?? 0) + 1);
  const groups = [...families.values()].filter((n) => n >= 2);
  const pins = new Map<string, number>();
  for (const p of active) pins.set(p.pincode, (pins.get(p.pincode) ?? 0) + 1);

  return {
    tiles,
    months,
    lapsed: lapsedIn(g, now).map((p) => ({ name: p.name, last: p.last, source: p.source })),
    demographics: {
      total: active.length,
      age: tally(AGE_BANDS, (p) => p.ageBand, active),
      gender: tally(GENDERS, (p) => p.gender, active),
      language: tally(LANGUAGES, (p) => p.language, active),
      pincodes: [...pins].sort((a, b) => b[1] - a[1]),
      families: { groups: groups.length, avg: groups.length ? Math.round((groups.reduce((a, b) => a + b, 0) / groups.length) * 10) / 10 : 0 },
    },
  };
}

/* ---------------- new patients by source ---------------- */

const group = (source?: string) =>
  source && (FMD_SOURCES as readonly string[]).includes(source) ? "fmd" : source === "Patient referral" || source === "Dentist referral" ? "referral" : "other";

export async function newBySource(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const today = istDate(now);
  const firsts = apptsIn({ ...f, dentist: undefined, category: undefined }, now).filter(isFirstVisit);

  // paid bills per patient, from the period start to 6 months after its end (or today)
  const net = new Map<string, { date: string; inr: number }[]>();
  const until = [addDays(f.to, 182), today].sort()[0];
  for (let d = f.from; d <= until; d = addDays(d, 1))
    for (const b of await dayBills(clinicId, { branchId: f.branchId, date: d, now }))
      if (b.status === "paid") net.set(b.patientName, [...(net.get(b.patientName) ?? []), { date: d, inr: b.items.reduce((n, l) => n + l.listFeeInr - l.discountInr, 0) }]);

  const rows = new Map<string, { source: string; count: number; firstVisitInr: number; sixMonthInr: number; partial: number }>();
  for (const a of firsts) {
    const day = a.start.slice(0, 10);
    const end = addDays(day, 182);
    const bills = net.get(a.patientName) ?? [];
    const r = rows.get(a.source ?? "Not recorded") ?? { source: a.source ?? "Not recorded", count: 0, firstVisitInr: 0, sixMonthInr: 0, partial: 0 };
    r.count++;
    r.firstVisitInr += bills.filter((x) => x.date === day).reduce((n, x) => n + x.inr, 0);
    r.sixMonthInr += bills.filter((x) => x.date >= day && x.date <= end).reduce((n, x) => n + x.inr, 0);
    if (end > today) r.partial++; // hasn't had 6 months yet
    rows.set(r.source, r);
  }
  const list = [...rows.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const sum = (k: "count" | "firstVisitInr" | "sixMonthInr" | "partial") => list.reduce((n, r) => n + r[k], 0);

  const months: { month: string; label: string; fmd: number; referral: number; other: number }[] = [];
  for (let m = f.from.slice(0, 7); m <= f.to.slice(0, 7); m = addMonths(`${m}-01`, 1).slice(0, 7)) {
    const these = firsts.filter((a) => a.start.startsWith(m));
    months.push({ month: m, label: monthLabel(m), fmd: these.filter((a) => group(a.source) === "fmd").length, referral: these.filter((a) => group(a.source) === "referral").length, other: these.filter((a) => group(a.source) === "other").length });
  }

  // who referred the new patients: for a thank-you note, never a reward
  const refs = new Map<string, { name: string; count: number; kind: "patient" | "dentist" }>();
  for (const a of firsts.filter((x) => x.referredBy)) {
    const r = refs.get(a.referredBy!) ?? { name: a.referredBy!, count: 0, kind: a.source === "Dentist referral" ? ("dentist" as const) : ("patient" as const) };
    r.count++;
    refs.set(r.name, r);
  }
  const referrers = [...refs.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6);

  return { rows: list, total: { count: sum("count"), firstVisitInr: sum("firstVisitInr"), sixMonthInr: sum("sixMonthInr"), partial: sum("partial") }, months, referrers };
}
