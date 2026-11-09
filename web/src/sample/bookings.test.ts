import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingError, cancelBooking, CONFIRM_AFTER_MS, createBooking, ics, lateToCancel, listBookings, rescheduleBooking } from "./bookings.ts";
import { hash, openSlots, requestWindows } from "./providers.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
/** an open slot that isn't one of the demo's "someone just took it" times */
const freeSlot = (dentist: string, i = 0) => openSlots(dentist, NOW).filter((t) => hash(`${dentist}:${t}:race`) % 10 !== 0)[i];
const takenSlot = (dentist: string) => openSlots(dentist, NOW).find((t) => hash(`${dentist}:${t}:race`) % 10 === 0)!;
const me = { for: null, notes: null, type: "consultation" as const };

test("a first visit gets the demo history: past, cancelled by the clinic, moved by the clinic", async () => {
  const all = await listBookings("h1", NOW);
  assert.deepEqual(all.map((b) => b.status), ["completed", "cancelled_by_clinic", "confirmed"]);
  assert.equal(all[2].events.at(-1)?.by, "clinic");
});

test("a clinic with a calendar confirms at once; the same key never books twice", async () => {
  const start = freeSlot("aditi-sharma");
  const a = await createBooking("b1", { ...me, dentist_id: "aditi-sharma", start }, "key-1", NOW);
  assert.equal(a.status, "confirmed");
  const again = await createBooking("b1", { ...me, dentist_id: "aditi-sharma", start }, "key-1", NOW);
  assert.equal(again.id, a.id);
  assert.equal((await listBookings("b1", NOW)).filter((b) => b.dentist.id === "aditi-sharma" && b.status === "confirmed").length, 1);
});

test("a second active booking with the same dentist is refused, pointing at the first", async () => {
  const first = await createBooking("b2", { ...me, dentist_id: "aditi-sharma", start: freeSlot("aditi-sharma") }, "k-a", NOW);
  await assert.rejects(createBooking("b2", { ...me, dentist_id: "aditi-sharma", start: freeSlot("aditi-sharma", 1) }, "k-b", NOW), (e: BookingError) => e.code === "duplicate" && e.bookingId === first.id);
});

test("a time someone just took, or one that isn't open, books nothing", async () => {
  await assert.rejects(createBooking("b3", { ...me, dentist_id: "aditi-sharma", start: takenSlot("aditi-sharma") }, "k1", NOW), (e: BookingError) => e.code === "slot_taken");
  await assert.rejects(createBooking("b3", { ...me, dentist_id: "aditi-sharma", start: NOW + 3_600_000 }, "k2", NOW), (e: BookingError) => e.code === "not_open");
  assert.equal((await listBookings("b3", NOW)).filter((b) => b.key === "k1" || b.key === "k2").length, 0);
});

test("a clinic without a calendar takes a request, then confirms a time in that window", async () => {
  const window = requestWindows(NOW)[0];
  const b = await createBooking("b4", { ...me, dentist_id: "karan-malhotra", window }, "k-r", NOW);
  assert.equal(b.status, "requested");
  assert.equal(b.start, null);
  const later = (await listBookings("b4", NOW + CONFIRM_AFTER_MS)).find((x) => x.id === b.id)!;
  assert.equal(later.status, "confirmed");
  assert.equal(later.events.at(-1)?.by, "clinic");
  assert.ok(later.start! > Date.parse(`${window.date}T00:00:00+05:30`));
});

test("cancel and reschedule: terms, events, and no double cancel", async () => {
  const start = freeSlot("lakshmi-narayan");
  const b = await createBooking("b5", { ...me, dentist_id: "lakshmi-narayan", start }, "k-c", NOW);
  assert.equal(lateToCancel(b, start - 3_600_000), true);
  assert.equal(lateToCancel(b, start - 6 * 3_600_000), false);
  const moved = await rescheduleBooking("b5", b.id, { start: freeSlot("lakshmi-narayan", 3) }, NOW);
  assert.equal(moved.events.at(-1)?.type, "rescheduled");
  const c = await cancelBooking("b5", b.id, NOW);
  assert.equal(c.status, "cancelled_by_patient");
  assert.equal((await cancelBooking("b5", b.id, NOW)).events.length, c.events.length);
  await assert.rejects(rescheduleBooking("b5", b.id, { start: freeSlot("lakshmi-narayan", 4) }, NOW), /can't be changed/);
});

test("a booking for someone else needs a name and a sensible age", async () => {
  await assert.rejects(createBooking("b6", { ...me, for: { name: " ", age: 7 }, dentist_id: "aditi-sharma", start: freeSlot("aditi-sharma") }, "k", NOW), /name/);
});

test("calendar file has the time and no health details", async () => {
  const b = await createBooking("b7", { ...me, notes: "Pain in lower left molar", dentist_id: "aditi-sharma", start: freeSlot("aditi-sharma") }, "k-i", NOW);
  const file = ics(b);
  assert.match(file, /DTSTART:\d{8}T\d{6}Z/);
  assert.doesNotMatch(file, /molar/);
});
