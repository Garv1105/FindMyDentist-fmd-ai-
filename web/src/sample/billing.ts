/**
 * FMD Clinic billing sample data (PRD 6.5, as the owner runs it): every bill is paid in full when it's raised, so
 * nothing is ever "due". Each completed visit is a bill on its day; payments recorded at the desk are added on top.
 * Refunds and voids are owner-only, need a reason, and are recorded; FMD never moves money.
 *
 * Later (with FMD Manager): bills raised automatically from completed appointments, patient details pre-filled,
 * staff only choosing the payment mode.
 */
import { CHAIRS, dayAppointments, FEES, istDate, onReset, requireClinic } from "./clinic.ts";
import { patientByName, patientByPhone } from "./patients.ts";

export const MODES = ["UPI", "Card", "Cash", "Net banking"] as const;
export type Mode = (typeof MODES)[number];
export type BillStatus = "paid" | "refunded" | "void";

export type Bill = {
  id: string;
  branchId: string;
  date: string; // YYYY-MM-DD (IST)
  time: string; // HH:MM
  patientName: string;
  patientId: string;
  phone: string;
  items: { what: string; amountInr: number }[];
  amountInr: number;
  mode: Mode;
  ref?: string;
  by: string;
  status: BillStatus;
  change?: { kind: "refund" | "void"; reason: string; by: string; date: string };
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
      const amountInr = FEES[a.type] ?? 1000;
      return {
        id: `B-${compact(date)}-${branchId === "main" ? "" : `${branchId.toUpperCase()}-`}${a.start.slice(11, 16).replace(":", "")}`,
        branchId,
        date,
        time: end,
        patientName: a.patientName,
        ...whoIs(a.patientName),
        items: [{ what: `${a.type} · ${a.dentist}`, amountInr }],
        amountInr,
        mode: MODES[(hash(a.id) + i) % MODES.length],
        by: branchId === "main" ? "Kavya Menon" : "Front desk",
        status: "paid" as const,
      };
    });
}

const withChange = (b: Bill): Bill => {
  const c = changes.get(b.id);
  return c ? { ...b, change: c, status: c.kind === "refund" ? "refunded" : "void" } : b;
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
  const refunded = bills.filter((b) => b.status === "refunded");
  return {
    today: { totalInr: sum(todays), count: todays.length, byMode, bills: todays },
    month: { totalInr: sum(paid), count: paid.length, averageInr: paid.length ? Math.round(sum(paid) / paid.length) : 0 },
    refunds: { totalInr: sum(refunded), count: refunded.length, voids: bills.filter((b) => b.status === "void").length },
  };
}

export type PaymentInput = { branchId: string; name: string; phone: string; patientId: string; amountInr: number; mode: Mode; ref?: string; by: string; what?: string };

/** A payment taken at the desk: always the full amount, with a receipt (the bill) straight away. */
export async function recordPayment(clinicId: string, input: PaymentInput, now = new Date()): Promise<Bill> {
  requireClinic(clinicId);
  const name = input.name.trim();
  const d = digits(input.phone).replace(/^91(?=\d{10}$)/, "");
  if (!name) throw new Error("Enter the patient's name");
  if (d.length !== 10) throw new Error("Enter a 10-digit mobile number");
  if (!Number.isInteger(input.amountInr) || input.amountInr <= 0) throw new Error("Enter the amount in whole rupees");
  if (!MODES.includes(input.mode)) throw new Error("Choose how the patient paid");
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
    items: [{ what: input.what?.trim() || "Treatment", amountInr: input.amountInr }],
    amountInr: input.amountInr,
    mode: input.mode,
    ref: input.ref?.trim() || undefined,
    by: input.by,
    status: "paid",
  };
  recorded.push(bill);
  return bill;
}

type ChangeBy = { reason: string; by: string; role: string };

function change(kind: "refund" | "void") {
  return async (clinicId: string, id: string, who: ChangeBy, now = new Date()): Promise<Bill> => {
    requireClinic(clinicId);
    if (who.role !== "clinic_owner") throw new Error(`Only the clinic owner can ${kind} a bill`);
    if (!who.reason.trim()) throw new Error(`Give a reason for the ${kind}`);
    const bill = monthBills("all", now).find((b) => b.id === id);
    if (!bill) throw new Error("Bill not found");
    if (bill.status !== "paid") throw new Error(`This bill is already ${bill.status === "void" ? "void" : "refunded"}`);
    changes.set(id, { kind, reason: who.reason.trim(), by: who.by, date: istDate(now) });
    return withChange(bill);
  };
}

/** Records a refund; the money goes back through the clinic's own bank or payment app. */
export const refundBill = change("refund");
/** Cancels a bill raised by mistake; it stays in the list, struck through. */
export const voidBill = change("void");
