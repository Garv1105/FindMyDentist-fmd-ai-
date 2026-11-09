import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { dayBills, recordPayment, voidBill } from "./clinic-billing.ts";
import { dayAppointments, FEES, resetSample } from "./clinic.ts";
import { setStatus } from "./calendar.ts";
import {
  CATEGORY, collectionSheet, dailyOps, drillDown, getAlerts, METRICS, metric, previousPeriod, pulse, recordCashCount, signOffSheet,
} from "./reports.ts";

beforeEach(resetSample);
const C = "smile-studio";
const now = new Date("2026-11-10T19:30:00+05:30"); // Tuesday evening: the day is finished
const nov = { from: "2026-11-02", to: "2026-11-07" }; // Mon–Sat
const owner = { by: "Dr. Ananya Rao", role: "clinic_owner" };
const desk = { by: "Kavya Menon", role: "clinic_front_desk" };
const appts = (from: string, to: string) => {
  const out = [];
  for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) out.push(...dayAppointments("main", d, now));
  return out;
};

test("every metric has one definition: label, formula, numerator, denominator", () => {
  for (const [id, m] of Object.entries(METRICS)) {
    assert.ok(m.label && m.formula && m.numerator, id);
    assert.ok(!/wait|overrun|refund/i.test(m.formula + m.label), `${id} mentions a removed concept`);
  }
  for (const id of ["netRevenue", "revenuePerChairHour", "chairUtilisation", "noShowRate", "newPatients", "caseAcceptance", "recallOverdue", "averageRating",
    "lateCancelRate", "lostChairHours", "lostRevenue", "rebookRate", "dentistUtilisation", "emptyChairHours", "nextFreeSlot", "activePatients", "returningPatients", "reactivatedPatients", "lapsedPatients"]) assert.ok(METRICS[id], id);
  assert.match(METRICS.noShowRate.formula, /late cancels/);
});

test("every treatment maps to one procedure group", () => {
  for (const t of ["Scaling & polishing", "Filling", "Check-up", "Crown preparation", "Root canal, visit 2", "Consultation", "Extraction, 38", "Braces review", "Whitening", "Kids' check-up"]) assert.ok(CATEGORY(t), t);
});

test("net revenue = paid bills' list fees − discounts, excluding GST and voids, by bill date", async () => {
  const bills = [];
  for (const d of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]) bills.push(...(await dayBills(C, { branchId: "main", date: d, now })));
  const expected = bills.filter((b) => b.status === "paid").flatMap((b) => b.items).reduce((n, l) => n + l.listFeeInr - l.discountInr, 0);
  assert.equal((await metric(C, "netRevenue", { ...nov, branchId: "main", now })).value, expected);
  await voidBill(C, bills[0].id, { reason: "Entered twice", ...owner }, now);
  assert.equal((await metric(C, "netRevenue", { ...nov, branchId: "main", now })).value, expected - (bills[0].items[0].listFeeInr - bills[0].items[0].discountInr));
});

test("no-show rate = no-shows ÷ (attended + no-shows + late cancels); clinic cancels are left out", async () => {
  const list = appts(nov.from, nov.to);
  const ns = list.filter((a) => a.status === "no_show").length;
  const att = list.filter((a) => a.status === "completed").length;
  const late = list.filter((a) => a.missed?.cancel?.by === "patient" && a.missed.cancel.noticeHours < 24).length;
  assert.ok(list.some((a) => a.missed?.cancel?.by === "clinic"), "sample has clinic cancels to leave out");
  const r = await metric(C, "noShowRate", { ...nov, branchId: "main", now });
  assert.equal(r.value, Math.round((ns / (att + ns + late)) * 1000) / 10);
  assert.deepEqual([r.numerator, r.denominator], [ns, att + ns + late]);
  // cancel a future visit: the rate's inputs for the past week don't change
  await setStatus(C, "main-2026-11-11-11:45", "cancel", new Date("2026-11-10T10:00:00+05:30"));
  assert.equal((await metric(C, "noShowRate", { ...nov, branchId: "main", now })).value, r.value);
});

test("late-cancel rate = patient cancels with < 24 h notice ÷ scheduled", async () => {
  const list = appts(nov.from, nov.to);
  const late = list.filter((a) => a.missed?.cancel?.by === "patient" && a.missed.cancel.noticeHours < 24);
  const r = await metric(C, "lateCancelRate", { ...nov, branchId: "main", now });
  assert.deepEqual([r.numerator, r.denominator], [late.length, list.length]);
  assert.ok((await drillDown(C, "lateCancelRate", { ...nov, branchId: "main", now })).every((a) => a.missed!.cancel!.noticeHours < 24));
});

test("lost chair-hours and lost revenue (an estimate) come from no-shows + late cancels; rebook rate from the same visits", async () => {
  const list = appts(nov.from, nov.to);
  const lost = list.filter((a) => a.status === "no_show" || (a.missed?.cancel?.by === "patient" && a.missed.cancel.noticeHours < 24));
  const f = { ...nov, branchId: "main", now };
  assert.equal((await metric(C, "lostChairHours", f)).value, Math.round((lost.reduce((n, a) => n + a.minutes, 0) / 60) * 10) / 10);
  assert.equal((await metric(C, "lostRevenue", f)).value, lost.reduce((n, a) => n + FEES[a.type], 0));
  assert.equal(METRICS.lostRevenue.estimate, true);
  const rb = await metric(C, "rebookRate", f);
  assert.deepEqual([rb.numerator, rb.denominator], [lost.filter((a) => a.missed?.rebooked).length, lost.length]);
  assert.equal((await drillDown(C, "lostRevenue", f)).length, lost.length);
});

test("dentist utilisation leaves out the hygienist's chair", async () => {
  const list = appts(nov.from, nov.to).filter((a) => a.status === "completed" && !a.dentist.includes("hygienist"));
  const r = await metric(C, "dentistUtilisation", { ...nov, branchId: "main", now });
  assert.deepEqual([r.numerator, r.denominator], [list.reduce((n, a) => n + a.minutes, 0), (5 * 540 + 240) * 2]);
});

test("chair utilisation = attended booked minutes ÷ open chair minutes (9–19 less lunch, Saturdays 9–13)", async () => {
  const list = appts(nov.from, nov.to);
  const attended = list.filter((a) => a.status === "completed").reduce((n, a) => n + a.minutes, 0);
  const available = (5 * 540 + 240) * 3; // Mon–Fri 9 hours, Saturday 9–13, × 3 chairs
  const r = await metric(C, "chairUtilisation", { ...nov, branchId: "main", now });
  assert.deepEqual([r.numerator, r.denominator], [attended, available]);
  assert.equal(r.value, Math.round((attended / available) * 1000) / 10);
});

test("revenue per chair-hour = net revenue ÷ attended chair-hours", async () => {
  const net = (await metric(C, "netRevenue", { ...nov, branchId: "main", now })).value!;
  const util = await metric(C, "chairUtilisation", { ...nov, branchId: "main", now });
  assert.equal((await metric(C, "revenuePerChairHour", { ...nov, branchId: "main", now })).value, Math.round(net / (util.numerator! / 60)));
});

test("no data (a Sunday) gives no value, not 0 or NaN", async () => {
  const sun = { from: "2026-11-08", to: "2026-11-08", branchId: "main", now };
  for (const id of ["noShowRate", "chairUtilisation", "revenuePerChairHour", "caseAcceptance", "averageRating", "lateCancelRate", "rebookRate", "dentistUtilisation"]) assert.equal((await metric(C, id, sun)).value, null, id);
  assert.equal((await metric(C, "netRevenue", sun)).value, 0);
});

test("dates are IST calendar days: a payment at 23:59 IST counts on that day, not the next", async () => {
  const late = new Date("2026-11-10T23:59:00+05:30");
  await recordPayment(C, { branchId: "main", name: "A B", phone: "9845012345", patientId: "", amountInr: 1000, mode: "Cash", by: "Kavya" }, late);
  const tue = await metric(C, "netRevenue", { from: "2026-11-10", to: "2026-11-10", branchId: "main", now: late });
  const wed = await metric(C, "netRevenue", { from: "2026-11-11", to: "2026-11-11", branchId: "main", now: new Date("2026-11-11T08:00:00+05:30") });
  assert.ok(tue.value! >= 1000);
  assert.equal(wed.value, 0);
});

test("case acceptance by count and by value (value is an estimate)", async () => {
  const r = await metric(C, "caseAcceptance", { ...nov, branchId: "main", now });
  assert.ok(r.value! >= 0 && r.value! <= 100 && r.denominator! > 0);
  assert.ok(r.byValue != null && r.byValue >= 0 && r.byValue <= 100);
  assert.equal(METRICS.caseAcceptance.estimate, true);
});

test("pulse: 8 tiles, each with previous-period and last-year comparison and a 12-week series", async () => {
  const p = await pulse(C, { ...nov, branchId: "main", now });
  assert.equal(p.tiles.length, 8);
  for (const t of p.tiles) {
    assert.ok("previous" in t && "lastYear" in t, t.id);
    assert.equal(t.series.length, 12, t.id);
  }
  assert.deepEqual(previousPeriod(nov), { from: "2026-10-27", to: "2026-11-01" });
  assert.match(p.asOf, /^\d{2}:\d{2}$/);
});

test("drill-down: the no-show number opens exactly those appointments", async () => {
  const r = await metric(C, "noShowRate", { ...nov, branchId: "main", now });
  const rows = await drillDown(C, "noShowRate", { ...nov, branchId: "main", now });
  assert.equal(rows.length, r.numerator);
  assert.ok(rows.every((x) => x.status === "no_show"));
});

test("daily operations: counts add up; open items list what needs doing", async () => {
  const d = await dailyOps(C, { date: "2026-11-10", branchId: "main", now });
  const list = dayAppointments("main", "2026-11-10", now);
  assert.equal(d.scheduled, list.filter((a) => a.status !== "cancelled").length);
  assert.equal(d.completed + d.noShow + d.cancelled + d.open, list.length);
  assert.equal(d.viaFmd, list.filter((a) => a.viaFmd).length);
  assert.ok(Array.isArray(d.unconfirmedTomorrow) && Array.isArray(d.notBilled) && Array.isArray(d.pendingNoNext));
  assert.ok(!("wait" in d) && !("overrun" in d));
});

test("collection sheet: by mode and receiver; cash variance needs a note; owner sign-off locks it", async () => {
  const s0 = await collectionSheet(C, { date: "2026-11-10", branchId: "main", now });
  const cashRecorded = s0.byMode.Cash.totalInr;
  await assert.rejects(recordCashCount(C, { date: "2026-11-10", branchId: "main", countedInr: cashRecorded - 300, note: "", ...desk, now }));
  await recordCashCount(C, { date: "2026-11-10", branchId: "main", countedInr: cashRecorded - 300, note: "Change from the float", ...desk, now });
  const s1 = await collectionSheet(C, { date: "2026-11-10", branchId: "main", now });
  assert.equal(s1.cash?.varianceInr, -300);
  await assert.rejects(signOffSheet(C, { date: "2026-11-10", branchId: "main", ...desk }));
  await signOffSheet(C, { date: "2026-11-10", branchId: "main", ...owner });
  assert.equal((await collectionSheet(C, { date: "2026-11-10", branchId: "main", now })).locked?.by, "Dr. Ananya Rao");
  await assert.rejects(recordCashCount(C, { date: "2026-11-10", branchId: "main", countedInr: cashRecorded, note: "", ...desk, now }));
  assert.ok(!("refunds" in s1));
});

test("alerts: cash variance shows; AI safety reports 0 unapproved actions", async () => {
  const s0 = await collectionSheet(C, { date: "2026-11-09", branchId: "main", now });
  await recordCashCount(C, { date: "2026-11-09", branchId: "main", countedInr: s0.byMode.Cash.totalInr - 300, note: "Float", ...desk, now });
  const a = await getAlerts(C, { branchId: "main", now });
  assert.ok(a.some((x) => x.id === "cashVariance"));
  assert.equal(a.find((x) => x.id === "aiSafety")?.count, 0);
});

test("pulse tiles keep numbers and definitions apart", async () => {
  const p = await pulse(C, { ...nov, branchId: "main", now });
  const ns = p.tiles.find((t) => t.id === "noShowRate")!;
  assert.equal(typeof ns.numerator, "number");
  assert.equal(ns.def.label, "No-show rate");
});
