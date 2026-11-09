import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { dayBills, getBill, getBillingSummary, GST_RATES, listBills, MODES, recordPayment, voidBill } from "./billing.ts";
import { resetSample } from "./clinic.ts";

beforeEach(resetSample);
const C = "smile-studio";
const now = new Date("2026-11-10T12:00:00+05:30"); // Tuesday, after the morning's visits
const owner = { by: "Dr. Ananya Rao", role: "clinic_owner" as const };
const desk = { by: "Kavya Menon", role: "clinic_front_desk" as const };

test("every completed visit today is a bill paid in full, newest first", async () => {
  const bills = await listBills(C, { branchId: "main", now });
  const today = bills.filter((b) => b.date === "2026-11-10");
  assert.ok(today.length >= 5);
  assert.ok(today.every((b) => b.status === "paid" && b.amountInr > 0 && MODES.includes(b.mode)));
  assert.ok(today.every((b) => /^FMD-\d{5}$/.test(b.patientId) && /^\+91 \d{5} \d{5}$/.test(b.phone)));
  const times = bills.map((b) => `${b.date}T${b.time}`);
  assert.deepEqual(times, [...times].sort().reverse());
});

test("no dues anywhere: bills have no balance or partial fields", async () => {
  const [b] = await listBills(C, { branchId: "main", now });
  for (const k of ["balanceInr", "dueInr", "paidInr", "outstandingInr"]) assert.ok(!(k in b), k);
});

test("summary: today by mode adds up; month covers the 1st to today", async () => {
  const s = await getBillingSummary(C, { branchId: "main", now });
  const todays = (await listBills(C, { branchId: "main", now })).filter((b) => b.date === "2026-11-10" && b.status === "paid");
  assert.equal(s.today.totalInr, todays.reduce((n, b) => n + b.amountInr, 0));
  assert.equal(s.today.count, todays.length);
  assert.equal(Object.values(s.today.byMode).reduce((n, m) => n + m.totalInr, 0), s.today.totalInr);
  assert.ok(s.month.totalInr > s.today.totalInr && s.month.count > s.today.count);
  assert.equal(s.month.averageInr, Math.round(s.month.totalInr / s.month.count));
});

test("search by name, phone, patient ID or bill number", async () => {
  const all = await listBills(C, { branchId: "main", now });
  const one = all[0];
  for (const q of [one.patientName.toLowerCase(), one.phone.slice(-5), one.patientId, one.id]) {
    assert.ok((await listBills(C, { branchId: "main", q, now })).some((b) => b.id === one.id), q);
  }
});

test("recording a payment: full amount, shows up today, counts in the summary", async () => {
  const before = await getBillingSummary(C, { branchId: "main", now });
  const b = await recordPayment(C, { branchId: "main", name: "Neha Kulkarni", phone: "99001 22334", patientId: "FMD-00820", amountInr: 500, mode: "UPI", by: "Kavya Menon" }, now);
  assert.equal(b.status, "paid");
  assert.equal(b.phone, "+91 99001 22334");
  assert.equal((await getBill(C, b.id))?.amountInr, 500);
  const after = await getBillingSummary(C, { branchId: "main", now });
  assert.equal(after.today.totalInr, before.today.totalInr + 500);
  assert.equal(after.today.byMode.UPI.count, before.today.byMode.UPI.count + 1);
});

test("recording a payment needs a name, a 10-digit phone, a whole positive amount and a known mode", async () => {
  const ok = { branchId: "main", name: "A B", phone: "9845012345", patientId: "", amountInr: 100, mode: "Cash" as const, by: "Kavya" };
  await assert.rejects(recordPayment(C, { ...ok, name: " " }, now));
  await assert.rejects(recordPayment(C, { ...ok, phone: "12345" }, now));
  await assert.rejects(recordPayment(C, { ...ok, amountInr: 0 }, now));
  await assert.rejects(recordPayment(C, { ...ok, amountInr: 10.5 }, now));
  await assert.rejects(recordPayment(C, { ...ok, mode: "Cheque" as never }, now));
  const fresh = await recordPayment(C, ok, now); // a new patient gets an ID
  assert.match(fresh.patientId, /^FMD-\d{5}$/);
});

test("void: owner only, needs a reason, only for paid bills, never twice", async () => {
  const [b] = await listBills(C, { branchId: "main", now });
  await assert.rejects(voidBill(C, b.id, { reason: "x", ...desk }, now));
  await assert.rejects(voidBill(C, b.id, { reason: "  ", ...owner }, now));
  const v = await voidBill(C, b.id, { reason: "Entered twice", ...owner }, now);
  assert.equal(v.status, "void");
  assert.equal(v.change?.reason, "Entered twice");
  await assert.rejects(voidBill(C, b.id, { reason: "x", ...owner }, now)); // already void
  await assert.rejects(voidBill(C, "nope", { reason: "x", ...owner }, now));
});

test("no refunds in FMD: no refund action and no refund figures", async () => {
  const mod = await import("./billing.ts");
  assert.ok(!("refundBill" in mod));
  const s = await getBillingSummary(C, { branchId: "main", now });
  assert.ok(!("refunds" in s) && !("refunds" in s.today));
  assert.ok((await listBills(C, { branchId: "main", now })).every((b) => b.status === "paid" || b.status === "void"));
});

test("voided bills leave today's total", async () => {
  const before = await getBillingSummary(C, { branchId: "main", now });
  const b = (await listBills(C, { branchId: "main", now })).find((x) => x.date === "2026-11-10")!;
  await voidBill(C, b.id, { reason: "Entered twice", ...owner }, now);
  const after = await getBillingSummary(C, { branchId: "main", now });
  assert.equal(after.today.totalInr, before.today.totalInr - b.amountInr);
  assert.equal(after.month.voids, 1);
});

test("bills for any day, including an earlier month (Home uses this)", async () => {
  const oct = await dayBills(C, { branchId: "main", date: "2026-10-30", now });
  assert.ok(oct.length > 0 && oct.every((b) => b.date === "2026-10-30"));
  const today = await dayBills(C, { branchId: "main", date: "2026-11-10", now });
  const s = await getBillingSummary(C, { branchId: "main", now });
  assert.equal(today.filter((b) => b.status === "paid").reduce((n, b) => n + b.amountInr, 0), s.today.totalInr);
});

test("a payment without an ID reuses the patient found by phone", async () => {
  const b = await recordPayment(C, { branchId: "main", name: "Neha K", phone: "+91 99001 22334", patientId: "", amountInr: 500, mode: "Cash", by: "Kavya" }, now);
  assert.equal(b.patientId, "FMD-00820");
});

test("payment modes follow the reports spec", () => {
  assert.deepEqual([...MODES], ["UPI", "Cash", "Card", "Bank transfer", "Insurance", "EMI partner"]);
});

test("bill lines: list fee − discount + GST = amount paid; GST rate comes from the clinic's settings", async () => {
  const bills = await listBills(C, { branchId: "main", now });
  for (const b of bills) {
    for (const l of b.items) assert.equal(l.amountInr, l.listFeeInr - l.discountInr + l.gstInr, b.id);
    assert.equal(b.amountInr, b.items.reduce((n, l) => n + l.amountInr, 0), b.id);
  }
  const whitening = bills.flatMap((b) => b.items).find((l) => l.what.startsWith("Whitening"));
  assert.equal(whitening?.gstRate, GST_RATES.Whitening);
  assert.ok(whitening && whitening.gstInr > 0);
  const discounted = bills.filter((b) => b.discount);
  assert.ok(discounted.length > 0 && discounted.every((b) => b.discount!.reason && b.discount!.approvedBy));
});

test("recording a payment with a discount needs a reason, and the discount can't exceed the fee", async () => {
  const base = { branchId: "main", name: "Neha Kulkarni", phone: "9900122334", patientId: "FMD-00820", amountInr: 2000, mode: "UPI" as const, by: "Kavya" };
  await assert.rejects(recordPayment(C, { ...base, discountInr: 200 }, now));
  await assert.rejects(recordPayment(C, { ...base, discountInr: 2500, discountReason: "Staff" }, now));
  const b = await recordPayment(C, { ...base, discountInr: 200, discountReason: "Returning patient" }, now);
  assert.equal(b.amountInr, 1800);
  assert.equal(b.items[0].listFeeInr, 2000);
  assert.equal(b.discount?.reason, "Returning patient");
});

test("today's discounts are listed with reason and approver (collection sheet)", async () => {
  const s = await getBillingSummary(C, { branchId: "main", now });
  assert.ok(s.today.discounts.every((d) => d.reason && d.approvedBy && d.amountInr > 0));
});

test("discounts this month add up from the paid bills", async () => {
  const s = await getBillingSummary(C, { branchId: "main", now });
  const paid = (await listBills(C, { branchId: "main", now })).filter((b) => b.status === "paid");
  assert.equal(s.month.discountsInr, paid.reduce((n, b) => n + (b.discount?.amountInr ?? 0), 0));
  assert.ok(s.month.discountsInr > 0);
});
