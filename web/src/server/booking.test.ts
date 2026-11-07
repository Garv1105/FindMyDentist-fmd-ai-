import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { grantRole, type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { availability, bookingHistory, cancelBooking, clinicUpdateBooking, myBookings, requestBooking, rescheduleBooking } from "./booking.ts";
import { searchProviders } from "./providers.ts";
import { seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => {
  await resetDb();
  await seedDemoDirectory();
});

async function user(email: string): Promise<Auth> {
  return await testUser(email, { name: "Test " + email.split("@")[0] });
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const id = async (name: string) => (await one<{ id: string }>("SELECT id FROM dentists WHERE name = ?", name))!.id;
let n = 0;
const key = () => `test-key-${++n}-xxxxxxxx`;

test("live schedule exposes slots and next-available; request-only clinics expose none", async () => {
  const live = await availability(await id("Dr. Aditi Sharma"));
  assert.equal(live.live, true);
  assert.ok(live.slots.length > 0);
  assert.ok(live.slots.every((s) => s.startsAt > Date.now() + 119 * 60_000)); // minimum notice respected
  const req = await availability(await id("Dr. Rohan Mehta"));
  assert.equal(req.live, false);
  assert.equal(req.slots.length, 0);
  const cards = (await searchProviders({})).organic;
  assert.ok(cards.find((c) => c.name === "Dr. Aditi Sharma")!.nextAvailable);
  assert.equal(cards.find((c) => c.name === "Dr. Rohan Mehta")!.nextAvailable, null);
});

test("explicit confirmation required; idempotent retries; status starts as awaiting clinic", async () => {
  const a = await user("a@example.com");
  const d = await id("Dr. Aditi Sharma");
  const slotId = (await availability(d)).slots[0].id;
  assert.equal(await status(async () => await requestBooking(a, { dentistId: d, slotId, idempotencyKey: key() })), 400);
  const k = key();
  const b1 = await requestBooking(a, { dentistId: d, slotId, confirmed: true, idempotencyKey: k });
  const b2 = await requestBooking(a, { dentistId: d, slotId, confirmed: true, idempotencyKey: k });
  assert.equal(b1.id, b2.id);
  assert.equal(b1.statusLabel, "Awaiting clinic confirmation");
  assert.equal((await myBookings(a)).length, 1);
  assert.ok(!(await availability(d)).slots.some((s) => s.id === slotId)); // the slot is held
});

test("a slot cannot be double-booked; a second active request with the same dentist is refused", async () => {
  const a = await user("a@example.com");
  const b = await user("b@example.com");
  const d = await id("Dr. Aditi Sharma");
  const slotId = (await availability(d)).slots[0].id;
  await requestBooking(a, { dentistId: d, slotId, confirmed: true, idempotencyKey: key() });
  assert.equal(await status(async () => await requestBooking(b, { dentistId: d, slotId, confirmed: true, idempotencyKey: key() })), 409);
  const other = (await availability(d)).slots[0].id;
  assert.equal(await status(async () => await requestBooking(a, { dentistId: d, slotId: other, confirmed: true, idempotencyKey: key() })), 409);
});

test("two people asking for the same slot at the same moment: exactly one gets it", async () => {
  const [a, b] = await Promise.all([user("a@example.com"), user("b@example.com")]);
  const d = await id("Dr. Aditi Sharma");
  const slotId = (await availability(d)).slots[0].id;
  const results = await Promise.allSettled([a, b].map((u) => requestBooking(u, { dentistId: d, slotId, confirmed: true, idempotencyKey: key() })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.equal((lost.reason as HttpError).status, 409);
});

test("past or too-soon slots are refused", async () => {
  const a = await user("a@example.com");
  const d = await id("Dr. Aditi Sharma");
  const s = (await one<{ id: string }>("SELECT id FROM slots WHERE dentist_id = ? ORDER BY starts_at LIMIT 1", d))!;
  await run("UPDATE slots SET starts_at = ? WHERE id = ?", Date.now() + 30 * 60_000, s.id);
  assert.equal(await status(async () => await requestBooking(a, { dentistId: d, slotId: s.id, confirmed: true, idempotencyKey: key() })), 409);
});

test("request-only clinic needs a preferred window and snapshots fee and terms", async () => {
  const a = await user("a@example.com");
  const d = await id("Dr. Rohan Mehta");
  assert.equal(await status(async () => await requestBooking(a, { dentistId: d, confirmed: true, idempotencyKey: key() })), 400);
  const b = await requestBooking(a, { dentistId: d, preferredWindow: "Weekday mornings", confirmed: true, idempotencyKey: key() });
  assert.equal(b.startsAt, null);
  assert.match(b.feeNote, /₹700/);
});

test("cancel, atomic reschedule, history; other patients get 404", async () => {
  const a = await user("a@example.com");
  const eve = await user("eve@example.com");
  const d = await id("Dr. Aditi Sharma");
  const [s1, s2] = (await availability(d)).slots;
  const b = await requestBooking(a, { dentistId: d, slotId: s1.id, confirmed: true, idempotencyKey: key() });
  assert.equal(await status(async () => await cancelBooking(eve, b.id, "")), 404);
  assert.equal(await status(async () => await bookingHistory(eve, b.id)), 404);

  // a failed reschedule (no confirmation) leaves the original untouched
  assert.equal(await status(async () => await rescheduleBooking(a, b.id, { slotId: s2.id, idempotencyKey: key() })), 400);
  assert.equal((await myBookings(a))[0].status, "requested");

  const nb = await rescheduleBooking(a, b.id, { slotId: s2.id, confirmed: true, idempotencyKey: key() });
  assert.equal(nb.startsAt, s2.startsAt);
  assert.equal((await bookingHistory(a, b.id)).booking.status, "rescheduled");
  assert.ok((await availability(d)).slots.some((s) => s.id === s1.id)); // old slot released

  await cancelBooking(a, nb.id, "Travelling");
  assert.equal(await status(async () => await cancelBooking(a, nb.id, "")), 409);
  assert.deepEqual(
    (await bookingHistory(a, nb.id)).events.map((e) => e.to_status),
    ["requested", "cancelled_by_patient"],
  );
});

test("only staff of that clinic can confirm or decline", async () => {
  const a = await user("a@example.com");
  const staffOther = await user("other@clinic.test");
  const staff = await user("staff@clinic.test");
  const d = await id("Dr. Aditi Sharma");
  const clinicId = (await one<{ clinic_id: string }>("SELECT clinic_id FROM dentist_clinics WHERE dentist_id = ?", d))!.clinic_id;
  const otherClinic = (await one<{ id: string }>("SELECT id FROM clinics WHERE id != ? LIMIT 1", clinicId))!.id;
  await grantRole(staff.user.id, "clinic_front_desk", null, clinicId);
  await grantRole(staffOther.user.id, "clinic_front_desk", null, otherClinic);
  const b = await requestBooking(a, { dentistId: d, slotId: (await availability(d)).slots[0].id, confirmed: true, idempotencyKey: key() });
  assert.equal(await status(async () => await clinicUpdateBooking(a, b.id, "confirmed")), 403);
  assert.equal(await status(async () => await clinicUpdateBooking(staffOther, b.id, "confirmed")), 403);
  assert.equal(await status(async () => await clinicUpdateBooking(staff, b.id, "completed")), 409);
  assert.equal((await clinicUpdateBooking(staff, b.id, "confirmed")).statusLabel, "Confirmed by clinic");
  assert.equal(await status(async () => await clinicUpdateBooking(staff, b.id, "cancelled_by_clinic", "")), 400);
});
