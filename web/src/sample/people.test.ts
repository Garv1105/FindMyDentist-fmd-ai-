import assert from "node:assert/strict";
import { test } from "node:test";
import { dayAppointments, isFirstVisit, type Appointment } from "./clinic.ts";
import { FMD_SOURCES, roster } from "./people.ts";

const now = new Date("2026-11-10T19:30:00+05:30");
const today = "2026-11-10";
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const past = (branchId: string, n: number) => {
  const out: Appointment[] = [];
  for (let i = 1; i <= n; i++) out.push(...dayAppointments(branchId, addDays(today, -i), now));
  return out;
};

test("roster: ~2,200 + ~800 unique patients, never a Sunday, first ≤ last < today", () => {
  const main = roster("main", today), kora = roster("kora", today);
  assert.equal(main.length, 2200);
  assert.equal(kora.length, 800);
  const names = new Set([...main, ...kora].map((p) => p.name));
  assert.equal(names.size, 3000);
  for (const p of [...main, ...kora]) {
    assert.ok(p.first < today && (p.last === null || (p.first <= p.last && p.last < today)), p.name);
    assert.notEqual(new Date(`${p.first}T00:00:00Z`).getUTCDay(), 0);
    if (p.source === "Patient referral" || p.source === "Dentist referral") assert.ok(p.referredBy, p.name);
  }
});

test("past visits fall inside each patient's first..last visit dates, so lapsed lists stay true", () => {
  const people = new Map(roster("main", today).map((p) => [p.name, p]));
  const list = past("main", 120);
  let seen = 0;
  for (const a of list) {
    const p = people.get(a.patientName);
    if (!p) continue;
    seen++;
    const d = a.start.slice(0, 10);
    assert.ok(p.first <= d && (p.last === null || d <= p.last), `${a.patientName} on ${d}, first ${p.first}, last ${p.last}`);
  }
  assert.ok(seen > list.length * 0.9);
});

test("a first visit is the patient's first date and is attended", () => {
  const people = new Map(roster("main", today).map((p) => [p.name, p]));
  const firsts = past("main", 60).filter(isFirstVisit);
  assert.ok(firsts.length > 20);
  for (const a of firsts) assert.equal(people.get(a.patientName)?.first, a.start.slice(0, 10));
});

test("past appointments carry source, lead time, reminder; misses carry a reason; cancels carry who and notice", () => {
  const list = past("main", 90);
  for (const a of list) {
    assert.ok(a.source, a.id);
    assert.equal(a.viaFmd, FMD_SOURCES.includes(a.source!));
    assert.ok(a.bookedDaysAhead! >= 0);
    assert.equal(typeof a.reminderDelivered, "boolean");
    if (a.status === "no_show" || a.status === "cancelled") assert.ok(a.missed?.reason, a.id);
    if (a.status === "cancelled") assert.ok(a.missed?.cancel && a.missed.cancel.noticeHours >= 0, a.id);
  }
  const ns = list.filter((a) => a.status === "no_show").length;
  const att = list.filter((a) => a.status === "completed").length;
  assert.ok(ns / (ns + att) > 0.02 && ns / (ns + att) < 0.12, `no-show share ${ns / (ns + att)}`);
  assert.ok(list.some((a) => a.missed?.cancel?.by === "clinic"));
  assert.ok(list.some((a) => a.missed?.cancel?.by === "patient" && a.missed.cancel.noticeHours < 24));
  assert.ok(list.some((a) => a.chair === "Chair 3"), "the hygienist's chair is used on past days");
});

test("today and future keep the day plan", () => {
  assert.equal(dayAppointments("main", "2026-11-10", now)[0].patientName, "Rohan Gupta");
  assert.equal(dayAppointments("main", "2026-11-11", now)[0].patientName, "Rohan Gupta");
  assert.ok(!dayAppointments("main", "2026-11-11", now).some((a) => a.chair === "Chair 3"));
});
