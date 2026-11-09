/**
 * FMD Clinic billing sample data (PRD 6.5, as the owner runs it): every bill is paid in full when it's raised, so
 * nothing is ever "due". Each completed visit is a bill on its day; payments recorded at the desk are added on top.
 * There are no refunds. A bill raised by mistake can be voided by the owner, with a reason kept on record.
 *
 * Later (with FMD Manager): bills raised automatically from completed appointments, patient details pre-filled,
 * staff only choosing the payment mode.
 */
import { CHAIRS, dayAppointments, FEES, istDate, onReset, requireClinic } from "./clinic.ts";
import { patientByName, patientByPhone } from "./patients.ts";

export const MODES = ["UPI", "Cash", "Card", "Bank transfer", "Insurance", "EMI partner"] as const;
export type Mode = (typeof MODES)[number];
export type BillStatus = "paid" | "void";

/**
 * GST rate per treatment, as set by the clinic (its CA confirms the mapping; nothing here is tax advice).
 * Sample values: healthcare treatments exempt, cosmetic whitening at 18%.
 */
export const GST_RATES: Record<string, number> = { Whitening: 18 };
const gstRateFor = (treatment: string) => GST_RATES[treatment] ?? 0;

export const DISCOUNT_REASONS = ["Returning patient", "Family member", "Senior citizen", "Staff", "Dental camp", "Other"] as const;

export type BillLine = { what: string; listFeeInr: number; discountInr: number; gstRate: number; gstInr: number; amountInr: number };

/** One line: discount comes off the list fee, then GST is added on what's left. */
export function line(what: string, listFeeInr: number, discountInr = 0, gstRate = 0): BillLine {
  const taxable = listFeeInr - discountInr;
  const gstInr = Math.round((taxable * gstRate) / 100);
  return { what, listFeeInr, discountInr, gstRate, gstInr, amountInr: taxable + gstInr };
}

export type Bill = {
  id: string;
  branchId: string;
  date: string; // YYYY-MM-DD (IST)
  time: string; // HH:MM
  patientName: string;
  patientId: string;
  phone: string;
  items: BillLine[];
  /** paid in full: the sum of the lines */
  amountInr: number;
  discount?: { amountInr: number; reason: string; approvedBy: string };
  mode: Mode;
  ref?: string;
  by: string;
  status: BillStatus;
  change?: { kind: "void"; reason: string; by: string; date: string };
};

/* ---------------- in-memory changes ---------------- */

const recorded: Bill[] = [];
const changes = new Map<string, NonNullable<Bill["change"]>>();
onReset.push(() => {
  recorded.length = 0;
  changes.clear();
});

/* ---------------- helpers ---------------- */

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const compact = (date: string) => date.slice(2).replace(/-/g, "");
const digits = (s: string) => s.replace(/\D/g, "");
const fmtPhone = (d: string) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
/** A stable number from a string, so made-up IDs and phones never change between reloads. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function whoIs(name: string) {
  const p = patientByName(name);
  if (p) return { patientId: p.pid, phone: p.phone };
  const h = hash(name);
  return { patientId: `FMD-${String(h % 90000).padStart(5, "0")}`, phone: fmtPhone(`9${String(h % 1_000_000_000).padStart(9, "0")}`) };
}

const branchIds = (branchId: string) => (branchId === "all" ? Object.keys(CHAIRS) : [branchId]);

/** The bills one branch's completed visits produce on a date. */
function visitBills(branchId: string, date: string, now: Date): Bill[] {
  return dayAppointments(branchId, date, now)
    .filter((a) => a.status === "completed")
    .map((a, i) => {
      const end = new Date(Date.parse(a.start) + a.minutes * 60_000 + 5.5 * 3600_000).toISOString().slice(11, 16);
      const fee = FEES[a.type] ?? 1000;
      // a few returning patients get 10% off, approved by the owner (sample)
      const off = hash(`${a.id}-d`) % 7 === 0 ? Math.round(fee / 10) : 0;
      const l = line(`${a.type} · ${a.dentist}`, fee, off, gstRateFor(a.type));
      return {
        id: `B-${compact(date)}-${branchId === "main" ? "" : `${branchId.toUpperCase()}-`}${a.start.slice(11, 16).replace(":", "")}`,
        branchId,
        date,
        time: end,
        patientName: a.patientName,
        ...whoIs(a.patientName),
        items: [l],
        amountInr: l.amountInr,
        ...(off ? { discount: { amountInr: off, reason: "Returning patient", approvedBy: "Dr. Ananya Rao" } } : {}),
        mode: MODES[(hash(a.id) + i) % MODES.length],
        by: branchId === "main" ? "Kavya Menon" : "Front desk",
        status: "paid" as const,
      };
    });
}

const withChange = (b: Bill): Bill => {
  const c = changes.get(b.id);
  return c ? { ...b, change: c, status: "void" } : b;
};

/** One day's bills (any date, not just this month), newest first. */
function billsOn(branchId: string, date: string, now: Date): Bill[] {
  const ids = branchIds(branchId);
  return [...ids.flatMap((b) => visitBills(b, date, now)), ...recorded.filter((b) => ids.includes(b.branchId) && b.date === date)]
    .map(withChange)
    .sort((a, b) => b.time.localeCompare(a.time) || b.id.localeCompare(a.id));
}

/** Every bill this month up to today, newest first. */
function monthBills(branchId: string, now: Date): Bill[] {
  const today = istDate(now);
  const days: string[] = [];
  for (let d = `${today.slice(0, 8)}01`; d <= today; d = addDays(d, 1)) days.push(d);
  const ids = branchIds(branchId);
  return [...days.flatMap((d) => ids.flatMap((b) => visitBills(b, d, now))), ...recorded.filter((b) => ids.includes(b.branchId))]
    .map(withChange)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`) || b.id.localeCompare(a.id));
}

/* ---------------- API ---------------- */

export async function listBills(clinicId: string, opts: { branchId: string; q?: string; now?: Date }): Promise<Bill[]> {
  requireClinic(clinicId);
  const q = opts.q?.trim().toLowerCase() ?? "";
  const qd = digits(q);
  return monthBills(opts.branchId, opts.now ?? new Date()).filter(
    (b) =>
      !q ||
      b.patientName.toLowerCase().includes(q) ||
      b.patientId.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (qd.length >= 3 && digits(b.phone).includes(qd)),
  );
}

/** The bills raised on one day; Home's "Collected" card uses this, so it matches Billing for that day. */
export async function dayBills(clinicId: string, opts: { branchId: string; date: string; now?: Date }): Promise<Bill[]> {
  requireClinic(clinicId);
  return billsOn(opts.branchId, opts.date, opts.now ?? new Date());
}

export async function getBill(clinicId: string, id: string, now = new Date()): Promise<Bill | null> {
  requireClinic(clinicId);
  return monthBills("all", now).find((b) => b.id === id) ?? null;
}

export async function getBillingSummary(clinicId: string, opts: { branchId: string; now?: Date }) {
  requireClinic(clinicId);
  const now = opts.now ?? new Date();
  const today = istDate(now);
  const bills = monthBills(opts.branchId, now);
  const paid = bills.filter((b) => b.status === "paid");
  const todays = paid.filter((b) => b.date === today);
  const byMode = Object.fromEntries(MODES.map((m) => [m, { totalInr: 0, count: 0 }])) as Record<Mode, { totalInr: number; count: number }>;
  for (const b of todays) {
    byMode[b.mode].totalInr += b.amountInr;
    byMode[b.mode].count++;
  }
  const sum = (list: Bill[]) => list.reduce((n, b) => n + b.amountInr, 0);
  return {
    today: {
      totalInr: sum(todays),
      count: todays.length,
      byMode,
      bills: todays,
      discounts: todays.filter((b) => b.discount).map((b) => ({ billId: b.id, patientName: b.patientName, ...b.discount! })),
    },
    month: { totalInr: sum(paid), count: paid.length, averageInr: paid.length ? Math.round(sum(paid) / paid.length) : 0, voids: bills.filter((b) => b.status === "void").length, discountsInr: paid.reduce((n, b) => n + (b.discount?.amountInr ?? 0), 0) },
  };
}

export type PaymentInput = {
  branchId: string;
  name: string;
  phone: string;
  patientId: string;
  /** the fee before any discount */
  amountInr: number;
  mode: Mode;
  discountInr?: number;
  discountReason?: string;
  ref?: string;
  by: string;
  what?: string;
};

/** A payment taken at the desk: always the full amount, with a receipt (the bill) straight away. */
export async function recordPayment(clinicId: string, input: PaymentInput, now = new Date()): Promise<Bill> {
  requireClinic(clinicId);
  const name = input.name.trim();
  const d = digits(input.phone).replace(/^91(?=\d{10}$)/, "");
  if (!name) throw new Error("Enter the patient's name");
  if (d.length !== 10) throw new Error("Enter a 10-digit mobile number");
  if (!Number.isInteger(input.amountInr) || input.amountInr <= 0) throw new Error("Enter the amount in whole rupees");
  if (!MODES.includes(input.mode)) throw new Error("Choose how the patient paid");
  const off = input.discountInr ?? 0;
  if (!Number.isInteger(off) || off < 0) throw new Error("Enter the discount in whole rupees");
  if (off >= input.amountInr) throw new Error("The discount must be less than the fee");
  if (off > 0 && !input.discountReason?.trim()) throw new Error("Give a reason for the discount");
  const l = line(input.what?.trim() || "Treatment", input.amountInr, off);
  const today = istDate(now);
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const bill: Bill = {
    id: `B-${compact(today)}-R${String(recorded.length + 1).padStart(2, "0")}`,
    branchId: input.branchId === "all" ? "main" : input.branchId,
    date: today,
    time: ist.toISOString().slice(11, 16),
    patientName: name,
    // no ID typed: reuse the patient this phone belongs to, else give a new patient their first ID
    patientId: input.patientId.trim() || patientByPhone(d)?.pid || `FMD-${String(13000 + recorded.length).padStart(5, "0")}`,
    phone: fmtPhone(d),
    items: [l],
    amountInr: l.amountInr,
    ...(off ? { discount: { amountInr: off, reason: input.discountReason!.trim(), approvedBy: input.by } } : {}),
    mode: input.mode,
    ref: input.ref?.trim() || undefined,
    by: input.by,
    status: "paid",
  };
  recorded.push(bill);
  return bill;
}

type ChangeBy = { reason: string; by: string; role: string };

/** Cancels a bill raised by mistake (e.g. entered twice). Owner only, with a reason; the bill stays in the list, struck through. */
export async function voidBill(clinicId: string, id: string, who: ChangeBy, now = new Date()): Promise<Bill> {
  requireClinic(clinicId);
  if (who.role !== "clinic_owner") throw new Error("Only the clinic owner can void a bill");
  if (!who.reason.trim()) throw new Error("Give a reason for voiding the bill");
  const bill = monthBills("all", now).find((b) => b.id === id);
  if (!bill) throw new Error("Bill not found");
  if (bill.status !== "paid") throw new Error("This bill is already void");
  changes.set(id, { kind: "void", reason: who.reason.trim(), by: who.by, date: istDate(now) });
  return withChange(bill);
}
