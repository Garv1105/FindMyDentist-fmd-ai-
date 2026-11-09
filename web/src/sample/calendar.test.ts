import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { bookAppointment, getAgenda, getByDentist, getWeekStrip, listWaitlist, offerSlot, setStatus } from "./calendar.ts";
import { getClinicHome, resetSample } from "./clinic.ts";

beforeEach(resetSample);
const now = new Date("2026-11-10T10:40:00+05:30"); // Tuesday
const C = "smile-studio";
const ms = (date: string, hm: string) => Date.parse(`${date}T${hm}:00+05:30`);

test("week strip: 7 days, Sunday closed, booked counts", async () => {
  const w = await getWeekStrip(C, { from: "2026-11-09", days: 7, branchId: "main", now });
  assert.equal(w.length, 7);
  assert.deepEqual(w.map((d) => d.closed), [false, false, false, false, false, false, true]);
  assert.equal(w[1].booked, 14);
  assert.equal(w[6].booked, 0);
});

test("agenda: parts in time order, now highlighted, glance adds up", async () => {
  const a = await getAgenda(C, { date: "2026-11-10", branchId: "main", now });
  assert.deepEqual(a.parts.map((p) => p.name), ["Morning", "Afternoon", "Evening"]);
  const starts = a.parts.flatMap((p) => p.items.map((i) => (i.kind === "appt" ? i.appt.start : i.start)));
  assert.deepEqual(starts, [...starts].sort());
  assert.ok(a.parts.flatMap((p) => p.items).some((i) => i.kind === "appt" && i.isNow));
  assert.equal(a.glance.booked, 14);
  assert.equal(a.glance.unconfirmed, 3);
  assert.equal(a.glance.free, a.parts.flatMap((p) => p.items).filter((i) => i.kind === "free").length);
});

test("free gaps: never overlap bookings or lunch, only after now today, chair 3 open", async () => {
  const a = await getAgenda(C, { date: "2026-11-10", branchId: "main", now });
  const items = a.parts.flatMap((p) => p.items);
  const appts = items.flatMap((i) => (i.kind === "appt" ? [i.appt] : []));
  for (const f of items) {
    if (f.kind !== "free") continue;
    const s = Date.parse(f.start), e = s + f.minutes * 60_000;
    assert.ok(f.minutes >= 30);
    assert.ok(s >= now.getTime(), `free gap before now: ${f.start}`);
    assert.ok(e <= ms("2026-11-10", "13:00") || s >= ms("2026-11-10", "14:00"), "crosses lunch");
    for (const x of appts.filter((x) => x.chair === f.chair)) {
      const xs = Date.parse(x.start), xe = xs + x.minutes * 60_000;
      assert.ok(e <= xs || s >= xe, `${f.chair} ${f.start} overlaps ${x.patientName}`);
    }
  }
  const chair3 = items.filter((i) => i.kind === "free" && i.chair === "Chair 3");
  assert.equal(chair3.length, 2); // rest of the morning, and the afternoon
});

test("filters: dentist and status", async () => {
  const rao = await getAgenda(C, { date: "2026-11-10", branchId: "main", dentist: "Dr. Rao", now });
  assert.ok(rao.parts.flatMap((p) => p.items).every((i) => (i.kind === "appt" ? i.appt.dentist : i.dentist) === "Dr. Rao"));
  const unc = await getAgenda(C, { date: "2026-11-10", branchId: "main", status: "unconfirmed", now });
  assert.equal(unc.parts.flatMap((p) => p.items).length, 3);
  const free = await getAgenda(C, { date: "2026-11-10", branchId: "main", status: "free", now });
  assert.ok(free.parts.flatMap((p) => p.items).every((i) => i.kind === "free"));
});

test("by dentist: one row per chair, same items as the agenda", async () => {
  const rows = await getByDentist(C, { date: "2026-11-10", branchId: "main", now });
  assert.deepEqual(rows.map((r) => r.chair), ["Chair 1", "Chair 2", "Chair 3"]);
  const a = await getAgenda(C, { date: "2026-11-10", branchId: "main", now });
  assert.equal(rows.flatMap((r) => r.slots).length, a.parts.flatMap((p) => p.items).length);
});

test("confirming in the calendar shows on Home", async () => {
  const id = "main-2026-11-10-11:00"; // Arjun Mehta
  assert.equal((await setStatus(C, id, "confirm", now)).status, "confirmed");
  const h = await getClinicHome(C, { date: "2026-11-10", branchId: "main", now });
  assert.equal(h.counts.unconfirmed, 2);
});

test("status actions follow the lifecycle", async () => {
  const id = "main-2026-11-10-11:45"; // Neha, confirmed
  await assert.rejects(setStatus(C, id, "complete", now)); // not checked in yet
  assert.equal((await setStatus(C, id, "check_in", now)).status, "checked_in");
  assert.equal((await setStatus(C, id, "complete", now)).status, "completed");
  await assert.rejects(setStatus(C, id, "cancel", now)); // already finished
  await assert.rejects(setStatus(C, "nope", "confirm", now));
});

test("booking: clash refused with suggestions; free slot books and shows up", async () => {
  const base = { branchId: "main", date: "2026-11-12", minutes: 30, chair: "Chair 2", patientName: "Neha Kulkarni", type: "Filling" };
  const clash = await bookAppointment(C, { ...base, start: "11:00" }, now);
  assert.equal(clash.ok, false);
  assert.ok(!clash.ok && clash.suggestions.length > 0 && clash.suggestions.length <= 3);
  const ok = await bookAppointment(C, { ...base, start: "14:00" }, now);
  assert.equal(ok.ok, true);
  const a = await getAgenda(C, { date: "2026-11-12", branchId: "main", now });
  assert.ok(a.parts.flatMap((p) => p.items).some((i) => i.kind === "appt" && i.appt.patientName === "Neha Kulkarni" && i.appt.start.includes("T14:00")));
  const again = await bookAppointment(C, { ...base, start: "14:00" }, now);
  assert.equal(again.ok, false);
});

test("booking: lunch, before opening, after closing and Sundays are refused", async () => {
  const base = { branchId: "main", date: "2026-11-12", minutes: 60, chair: "Chair 3", patientName: "X", type: "Check-up" };
  for (const start of ["12:30", "08:30", "18:30"]) assert.equal((await bookAppointment(C, { ...base, start }, now)).ok, false, start);
  assert.equal((await bookAppointment(C, { ...base, date: "2026-11-15", start: "10:00" }, now)).ok, false);
  assert.equal((await bookAppointment(C, { ...base, date: "2026-11-09", start: "10:00" }, now)).ok, false); // in the past
});

test("waitlist offer", async () => {
  const [first] = await listWaitlist(C, "main");
  assert.equal(first.offered, false);
  assert.equal((await offerSlot(C, first.id)).offered, true);
  assert.equal((await listWaitlist(C, "main"))[0].offered, true);
});

test("a cancelled visit leaves Home's count and frees its time", async () => {
  await setStatus(C, "main-2026-11-10-11:45", "cancel", now); // Neha
  const h = await getClinicHome(C, { date: "2026-11-10", branchId: "main", now });
  assert.equal(h.counts.total, 13);
  const a = await getAgenda(C, { date: "2026-11-10", branchId: "main", now });
  assert.ok(!a.parts.flatMap((p) => p.items).some((i) => i.kind === "appt" && i.appt.patientName === "Neha Kulkarni"));
});
