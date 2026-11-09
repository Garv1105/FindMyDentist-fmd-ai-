/**
 * FMD Clinic reports, stage 4 (owner only): Procedure mix & revenue (RPT-11), Revenue summary (RPT-13) and the GST &
 * invoice register (RPT-15). No refunds anywhere (owner decision): a bill raised by mistake is voided and shows in the
 * register as a credit note. GST rates come from the clinic's own mapping (billing.ts GST_RATES), which its CA confirms.
 */
import { dayBills, type Bill, type BillLine } from "./clinic-billing.ts";
import { CHAIRS, istDate, requireClinic } from "./clinic.ts";
import { hash } from "./people.ts";
import { addMonths, billsIn, CATEGORY, metric, planItemsIn, tile, type Filters } from "./reports.ts";

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const net = (l: BillLine) => l.listFeeInr - l.discountInr;
const procedureOf = (l: BillLine) => l.what.split(" · ")[0];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The 6 calendar months up to the period end, the last one cut at the period end. */
const sixMonths = (to: string) =>
  Array.from({ length: 6 }, (_, i) => addMonths(to, i - 5).slice(0, 7)).map((m) => ({
    month: m,
    label: MONTHS[Number(m.slice(5, 7)) - 1],
    from: `${m}-01`,
    to: m === to.slice(0, 7) ? to : addDays(addMonths(`${m}-01`, 1), -1),
  }));

/* ---------------- procedure mix ---------------- */

export async function procedureMix(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const tiles = await Promise.all(["netRevenue", "realisationRate"].map((id) => tile(clinicId, id, f)));
  const lines = (await billsIn(clinicId, f, now)).flatMap((b) => b.items);
  const sum = (ls: BillLine[], g: (l: BillLine) => string) => {
    const by = new Map<string, { label: string; count: number; netInr: number; listInr: number }>();
    for (const l of ls) {
      const r = by.get(g(l)) ?? { label: g(l), count: 0, netInr: 0, listInr: 0 };
      r.count++;
      r.netInr += net(l);
      r.listInr += l.listFeeInr;
      by.set(r.label, r);
    }
    return [...by.values()].map((r) => ({ ...r, realised: pct(r.netInr, r.listInr) })).sort((a, b) => b.netInr - a.netInr);
  };
  const categories = sum(lines, (l) => CATEGORY(procedureOf(l)));
  const top = sum(lines, procedureOf).slice(0, 20);

  // month on month by category (net), the 6 months up to the period end
  const months = await Promise.all(
    sixMonths(f.to).map(async (m) => {
      const ls = (await billsIn(clinicId, { ...f, from: m.from, to: m.to }, now)).flatMap((b) => b.items);
      return { label: m.label, byCategory: Object.fromEntries(sum(ls, (l) => CATEGORY(procedureOf(l))).map((c) => [c.label, c.netInr])) as Record<string, number> };
    }),
  );

  // estimate vs final bill, for accepted plan items whose treatment is done (sample: the final bill moves ±15%)
  const done = planItemsIn(f, now).filter((x) => x.progress === "completed");
  const variance = new Map<string, { estimate: number; final: number }>();
  for (const x of done) {
    const v = variance.get(x.category) ?? { estimate: 0, final: 0 };
    v.estimate += x.estimateInr;
    // shortcut: a hash-made final amount; the backend reads the real invoice lines for the plan item
    v.final += Math.round(x.estimateInr * (0.85 + (hash(`${x.appt.id}-fin`) % 31) / 100));
    variance.set(x.category, v);
  }
  return {
    tiles,
    categories,
    top,
    months,
    variance: [...variance].map(([category, v]) => ({ category, ...v, diffPct: pct(v.final - v.estimate, v.estimate) })),
  };
}

/* ---------------- revenue summary ---------------- */

export async function revenueSummary(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const ids = ["grossRevenue", "discountTotal", "netRevenue", "revenuePerVisit", "revenuePerNewPatient", "revenuePerActivePatient"];
  const tiles = await Promise.all(ids.map((id) => tile(clinicId, id, f)));

  // gross → discounts → net, month by month (no refunds: the clinic doesn't give them)
  const bridge = await Promise.all(
    sixMonths(f.to).map(async (m) => {
      const [g, d, n] = await Promise.all(["grossRevenue", "discountTotal", "netRevenue"].map((id) => metric(clinicId, id, { ...f, from: m.from, to: m.to })));
      return { label: m.label, grossInr: g.value ?? 0, discountInr: d.value ?? 0, netInr: n.value ?? 0 };
    }),
  );

  const bills = (await billsIn(clinicId, f, now)).filter((b): b is Bill & { discount: NonNullable<Bill["discount"]> } => Boolean(b.discount));
  const leak = (g: (b: (typeof bills)[number]) => string) => {
    const by = new Map<string, { label: string; count: number; amountInr: number }>();
    for (const b of bills) {
      const r = by.get(g(b)) ?? { label: g(b), count: 0, amountInr: 0 };
      r.count++;
      r.amountInr += b.discount.amountInr;
      by.set(r.label, r);
    }
    return [...by.values()].sort((a, b) => b.amountInr - a.amountInr);
  };

  const branches = f.branchId === "all" ? Object.keys(CHAIRS) : [f.branchId];
  const byBranch = await Promise.all(
    branches.map(async (b) => {
      const [n, v] = await Promise.all([metric(clinicId, "netRevenue", { ...f, branchId: b }), metric(clinicId, "revenuePerVisit", { ...f, branchId: b })]);
      return { branchId: b, netInr: n.value ?? 0, visits: v.denominator ?? 0, perVisitInr: v.value };
    }),
  );
  return {
    tiles,
    bridge,
    discounts: { byReason: leak((b) => b.discount.reason), byStaff: leak((b) => b.discount.approvedBy), byProcedure: leak((b) => procedureOf(b.items[0])) },
    byBranch,
  };
}

/* ---------------- GST & invoice register ---------------- */

/** "2026-27" for any date from 1 Apr 2026 to 31 Mar 2027. */
const fyOf = (date: string) => {
  const y = Number(date.slice(0, 4));
  const start = date.slice(5) >= "04-01" ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

export async function gstRegister(clinicId: string, f: Filters) {
  requireClinic(clinicId);
  const now = f.now ?? new Date();
  const tiles = await Promise.all(["gstCollected", "exemptValue", "netRevenue"].map((id) => tile(clinicId, id, f)));
  const days: string[] = [];
  for (let d = f.from; d <= f.to && d <= istDate(now); d = addDays(d, 1)) days.push(d);
  // every bill, paid or void: a voided bill is listed as a credit note against itself
  const all = (await Promise.all(days.map((date) => dayBills(clinicId, { branchId: f.branchId, date, now })))).flat();
  const rows = all
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .map((b) => {
      const taxable = b.items.filter((l) => l.gstRate > 0);
      return {
        invoice: `INV/${fyOf(b.date)}/${b.id}`,
        date: b.date,
        patientName: b.patientName,
        taxableInr: taxable.reduce((n, l) => n + net(l), 0),
        rates: [...new Set(taxable.map((l) => l.gstRate))],
        gstInr: b.items.reduce((n, l) => n + l.gstInr, 0),
        exemptInr: b.items.filter((l) => l.gstRate === 0).reduce((n, l) => n + net(l), 0),
        totalInr: b.amountInr,
        creditNote: b.status === "void" ? { reason: b.change?.reason ?? "", by: b.change?.by ?? "" } : null,
      };
    });
  const paid = rows.filter((r) => !r.creditNote);
  const total = (k: "taxableInr" | "gstInr" | "exemptInr" | "totalInr") => paid.reduce((n, r) => n + r[k], 0);
  return { tiles, rows, totals: { invoices: paid.length, creditNotes: rows.length - paid.length, taxableInr: total("taxableInr"), gstInr: total("gstInr"), exemptInr: total("exemptInr"), totalInr: total("totalInr") } };
}
