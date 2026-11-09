import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { dayBills, getBill, getBillingSummary, listBills, MODES, recordPayment, refundBill, voidBill } from "./billing.ts";
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

test("refund and void: owner only, need a reason, only for paid bills", async () => {
  const [b] = await listBills(C, { branchId: "main", now });
  await assert.rejects(refundBill(C, b.id, { reason: "x", ...desk }, now));
  await assert.rejects(refundBill(C, b.id, { reason: "  ", ...owner }, now));
  const r = await refundBill(C, b.id, { reason: "Treatment not needed", ...owner }, now);
  assert.equal(r.status, "refunded");
  assert.equal(r.change?.reason, "Treatment not needed");
  await assert.rejects(voidBill(C, b.id, { reason: "x", ...owner }, now)); // already refunded
  const s = await getBillingSummary(C, { branchId: "main", now });
  assert.equal(s.refunds.count, 1);
  assert.equal(s.refunds.totalInr, b.amountInr);
  await assert.rejects(refundBill(C, "nope", { reason: "x", ...owner }, now));
});

test("voided bills leave today's total", async () => {
  const before = await getBillingSummary(C, { branchId: "main", now });
  const b = (await listBills(C, { branchId: "main", now })).find((x) => x.date === "2026-11-10")!;
  await voidBill(C, b.id, { reason: "Entered twice", ...owner }, now);
  const after = await getBillingSummary(C, { branchId: "main", now });
  assert.equal(after.today.totalInr, before.today.totalInr - b.amountInr);
  assert.equal(after.refunds.voids, 1);
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
