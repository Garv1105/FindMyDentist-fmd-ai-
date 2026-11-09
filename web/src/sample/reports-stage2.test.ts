import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { dayAppointments, resetSample, type Appointment } from "./clinic.ts";
import { freeGaps } from "./calendar.ts";
import { roster } from "./people.ts";
import { metric } from "./reports.ts";
import { noShows, utilisation } from "./reports-schedule.ts";
import { newBySource, patientBase } from "./reports-patients.ts";

beforeEach(resetSample);
const C = "smile-studio";
const now = new Date("2026-11-10T19:30:00+05:30");
const today = "2026-11-10";
const oct = { from: "2026-10-01", to: "2026-10-31", branchId: "main", now };
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const appts = (from: string, to: string, branchId = "main") => {
  const out: Appointment[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(...dayAppointments(branchId, d, now));
  return out;
};
const isLate = (a: Appointment) => a.missed?.cancel?.by === "patient" && a.missed.cancel.noticeHours < 24;

/* ---------------- utilisation ---------------- */

test("utilisation: tiles; the heatmap has no lunch hour and no Saturday afternoon; the 3 quietest cells are the lowest", async () => {
  const u = await utilisation(C, oct, { money: true });
  assert.deepEqual(u.tiles.map((t) => t.id), ["chairUtilisation", "dentistUtilisation", "revenuePerChairHour", "emptyChairHours", "nextFreeSlot"]);
  assert.deepEqual(u.heatmap.hours, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(u.heatmap.rows.map((r) => r.day), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  for (const r of u.heatmap.rows) assert.equal(r.cells[4], null, `${r.day} lunch`);
  assert.ok(u.heatmap.rows[5].cells.slice(4).every((c) => c === null), "Saturday afternoon closed");
  const values = u.heatmap.rows.flatMap((r) => r.cells).filter((c): c is number => c !== null).sort((a, b) => a - b);
  assert.deepEqual(u.quiet.map((q) => q.value), values.slice(0, 3));
  assert.ok(values.every((v) => v >= 0 && v <= 100));
});

test("utilisation: one row per chair and per dentist; next free slot agrees with the calendar's free gaps", async () => {
  const u = await utilisation(C, oct, { money: true });
  assert.deepEqual(u.chairs.map((c) => c.chair), ["Chair 1", "Chair 2", "Chair 3"]);
  for (const c of u.chairs) {
    const m = await metric(C, "chairUtilisation", { ...oct, dentist: c.dentist });
    assert.equal(c.util, m.value, c.chair);
    let d = today, days = 0;
    while (!freeGaps("main", d, now, dayAppointments("main", d, now)).some((g) => g.chair === c.chair)) {
      d = addDays(d, 1);
      days++;
    }
    assert.equal(c.nextFree, days, c.chair);
  }
});

test("front desk: utilisation and no-shows without money", async () => {
  const u = await utilisation(C, oct, { money: false });
  assert.ok(!u.tiles.some((t) => t.def.unit === "inr"));
  assert.ok(u.chairs.every((c) => !("inrPerHour" in c)));
  const n = await noShows(C, oct, { money: false });
  assert.ok(!n.tiles.some((t) => t.def.unit === "inr"));
});

/* ---------------- no-shows ---------------- */

test("no-shows: reasons add up to no-shows + late cancels; every cut uses the spec formula and covers every visit", async () => {
  const n = await noShows(C, oct, { money: true });
  assert.deepEqual(n.tiles.map((t) => t.id), ["noShowRate", "lateCancelRate", "lostChairHours", "lostRevenue", "rebookRate"]);
  const list = appts(oct.from, oct.to);
  const missed = list.filter((a) => a.status === "no_show" || isLate(a));
  assert.equal(n.reasons.reduce((s, r) => s + r.count, 0), missed.length);
  const rate = n.tiles[0];
  for (const [cut, rows] of Object.entries(n.cuts)) {
    assert.equal(rows.reduce((s, r) => s + r.denominator, 0), rate.denominator, cut);
    assert.equal(rows.reduce((s, r) => s + r.numerator, 0), rate.numerator, cut);
    for (const r of rows) assert.equal(r.value, r.denominator ? Math.round((r.numerator / r.denominator) * 1000) / 10 : null, `${cut} ${r.label}`);
  }
});

test("no-shows: the repeat list is patients with 2+ misses in the last 6 months", async () => {
  const n = await noShows(C, oct, { money: true });
  assert.ok(n.repeat.length > 0);
  const list = appts(addDays(today, -182), today).filter((a) => a.status === "no_show" || isLate(a));
  for (const r of n.repeat) {
    const mine = list.filter((a) => a.patientName === r.name);
    assert.equal(r.noShows + r.lateCancels, mine.length, r.name);
    assert.ok(mine.length >= 2, r.name);
  }
  for (let i = 1; i < n.repeat.length; i++) assert.ok(n.repeat[i - 1].noShows + n.repeat[i - 1].lateCancels >= n.repeat[i].noShows + n.repeat[i].lateCancels);
});

test("no data: a Sunday gives no rates", async () => {
  const sun = { from: "2026-11-08", to: "2026-11-08", branchId: "main", now };
  const n = await noShows(C, sun, { money: true });
  assert.equal(n.tiles[0].value, null);
  assert.equal(n.tiles[4].value, null);
  assert.equal((await utilisation(C, sun, { money: true })).tiles[0].value, null);
});

/* ---------------- patient base ---------------- */

test("patient base: active = a visit in the 18 months to the period end; lapsed = the 18 months ran out in the period", async () => {
  const b = await patientBase(C, oct);
  const people = roster("main", today);
  const cutoff = "2025-04-30"; // 18 months before 31 Oct 2026
  const active = people.filter((p) => p.first <= oct.to && (p.last === null || p.last > cutoff));
  assert.equal(b.tiles.find((t) => t.id === "activePatients")!.value, active.length);
  const lapsed = people.filter((p) => p.last !== null && p.last >= "2025-04-01" && p.last <= cutoff);
  assert.equal(b.tiles.find((t) => t.id === "lapsedPatients")!.value, lapsed.length);
  assert.equal(b.lapsed.length, lapsed.length);
  // nothing booked after their last visit
  const later = new Set(appts("2025-05-01", today).map((a) => a.patientName));
  for (const l of b.lapsed) assert.ok(!later.has(l.name), l.name);
});

test("patient base: 6 months of new / returning / reactivated; demographics of active patients add up", async () => {
  const b = await patientBase(C, oct);
  assert.deepEqual(b.months.map((m) => m.month), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  const octRow = b.months[5];
  assert.equal(octRow.new, (await metric(C, "newPatients", oct)).value);
  assert.equal(octRow.returning, (await metric(C, "returningPatients", oct)).value);
  const d = b.demographics;
  for (const group of [d.age, d.gender, d.language]) assert.equal(group.reduce((s, [, n]) => s + n, 0), d.total);
  assert.equal(d.total, b.tiles[0].value);
  assert.ok(d.families.groups > 0 && d.families.avg >= 2);
});

/* ---------------- new by source ---------------- */

test("new by source: sources add up to new patients; 6-month revenue ≥ first-visit revenue; recent months are partial", async () => {
  const f = { from: "2026-06-01", to: today, branchId: "all", now };
  const s = await newBySource(C, f);
  const total = s.rows.reduce((n, r) => n + r.count, 0);
  assert.equal(total, (await metric(C, "newPatients", f)).value);
  assert.equal(s.total.count, total);
  for (const r of s.rows) {
    assert.ok(r.sixMonthInr >= r.firstVisitInr, r.source);
    assert.ok(r.partial <= r.count);
  }
  assert.ok(s.rows.some((r) => r.partial > 0));
  assert.equal(s.months.length, 6);
  assert.equal(s.months.reduce((n, m) => n + m.fmd + m.referral + m.other, 0), total);
});

test("referral leaderboard: referrers of new patients in the period, most first, for thank-you notes only", async () => {
  const s = await newBySource(C, { from: "2026-05-01", to: today, branchId: "main", now });
  assert.ok(s.referrers.length > 0);
  for (let i = 1; i < s.referrers.length; i++) assert.ok(s.referrers[i - 1].count >= s.referrers[i].count);
  assert.ok(s.referrers.every((r) => r.kind === "patient" || r.kind === "dentist"));
  assert.ok(!("reward" in s.referrers[0]));
});
