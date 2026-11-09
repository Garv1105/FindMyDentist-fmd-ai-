import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "./auth.ts";
import { availability, bookingHistory, cancelBooking, clinicUpdateBooking, myBookings, requestBooking, rescheduleBooking } from "./booking.ts";
import { searchProviders } from "./providers.ts";
import { seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => {
  resetDb();
  seedDemoDirectory();
});

function user(email: string): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: "Test " + email.split("@")[0], accountType: "patient", consents: { terms: true, privacy: true } });
  return requireAuth(new Request("http://x/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }));
}
const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const id = (name: string) => one<{ id: string }>("SELECT id FROM dentists WHERE name = ?", name)!.id;
let n = 0;
const key = () => `test-key-${++n}-xxxxxxxx`;

test("live schedule exposes slots and next-available; request-only clinics expose none", () => {
  const live = availability(id("Dr. Aditi Sharma"));
  assert.equal(live.live, true);
  assert.ok(live.slots.length > 0);
  assert.ok(live.slots.every((s) => s.startsAt > Date.now() + 119 * 60_000)); // minimum notice respected
  const req = availability(id("Dr. Rohan Mehta"));
  assert.equal(req.live, false);
  assert.equal(req.slots.length, 0);
  const cards = searchProviders({}).organic;
  assert.ok(cards.find((c) => c.name === "Dr. Aditi Sharma")!.nextAvailable);
  assert.equal(cards.find((c) => c.name === "Dr. Rohan Mehta")!.nextAvailable, null);
});

test("explicit confirmation required; idempotent retries; status starts as awaiting clinic", () => {
  const a = user("a@example.com");
  const d = id("Dr. Aditi Sharma");
  const slotId = availability(d).slots[0].id;
  assert.equal(status(() => requestBooking(a, { dentistId: d, slotId, idempotencyKey: key() })), 400);
  const k = key();
  const b1 = requestBooking(a, { dentistId: d, slotId, confirmed: true, idempotencyKey: k });
  const b2 = requestBooking(a, { dentistId: d, slotId, confirmed: true, idempotencyKey: k });
  assert.equal(b1.id, b2.id);
  assert.equal(b1.statusLabel, "Awaiting clinic confirmation");
  assert.equal(myBookings(a).length, 1);
  assert.ok(!availability(d).slots.some((s) => s.id === slotId)); // the slot is held
});

test("a slot cannot be double-booked; a second active request with the same dentist is refused", () => {
  const a = user("a@example.com");
  const b = user("b@example.com");
  const d = id("Dr. Aditi Sharma");
  const slotId = availability(d).slots[0].id;
  requestBooking(a, { dentistId: d, slotId, confirmed: true, idempotencyKey: key() });
  assert.equal(status(() => requestBooking(b, { dentistId: d, slotId, confirmed: true, idempotencyKey: key() })), 409);
  const other = availability(d).slots[0].id;
  assert.equal(status(() => requestBooking(a, { dentistId: d, slotId: other, confirmed: true, idempotencyKey: key() })), 409);
});

test("past or too-soon slots are refused", () => {
  const a = user("a@example.com");
  const d = id("Dr. Aditi Sharma");
  const s = one<{ id: string }>("SELECT id FROM slots WHERE dentist_id = ? ORDER BY starts_at LIMIT 1", d)!;
  run("UPDATE slots SET starts_at = ? WHERE id = ?", Date.now() + 30 * 60_000, s.id);
  assert.equal(status(() => requestBooking(a, { dentistId: d, slotId: s.id, confirmed: true, idempotencyKey: key() })), 409);
});

test("request-only clinic needs a preferred window and snapshots fee and terms", () => {
  const a = user("a@example.com");
  const d = id("Dr. Rohan Mehta");
  assert.equal(status(() => requestBooking(a, { dentistId: d, confirmed: true, idempotencyKey: key() })), 400);
  const b = requestBooking(a, { dentistId: d, preferredWindow: "Weekday mornings", confirmed: true, idempotencyKey: key() });
  assert.equal(b.startsAt, null);
  assert.match(b.feeNote, /₹700/);
});

test("cancel, atomic reschedule, history; other patients get 404", () => {
  const a = user("a@example.com");
  const eve = user("eve@example.com");
  const d = id("Dr. Aditi Sharma");
  const [s1, s2] = availability(d).slots;
  const b = requestBooking(a, { dentistId: d, slotId: s1.id, confirmed: true, idempotencyKey: key() });
  assert.equal(status(() => cancelBooking(eve, b.id, "")), 404);
  assert.equal(status(() => bookingHistory(eve, b.id)), 404);

  // a failed reschedule (no confirmation) leaves the original untouched
  assert.equal(status(() => rescheduleBooking(a, b.id, { slotId: s2.id, idempotencyKey: key() })), 400);
  assert.equal(myBookings(a)[0].status, "requested");

  const nb = rescheduleBooking(a, b.id, { slotId: s2.id, confirmed: true, idempotencyKey: key() });
  assert.equal(nb.startsAt, s2.startsAt);
  assert.equal(bookingHistory(a, b.id).booking.status, "rescheduled");
  assert.ok(availability(d).slots.some((s) => s.id === s1.id)); // old slot released

  cancelBooking(a, nb.id, "Travelling");
  assert.equal(status(() => cancelBooking(a, nb.id, "")), 409);
  assert.deepEqual(
    bookingHistory(a, nb.id).events.map((e) => e.to_status),
    ["requested", "cancelled_by_patient"],
  );
});

test("only staff of that clinic can confirm or decline", () => {
  const a = user("a@example.com");
  const staffOther = user("other@clinic.test");
  const staff = user("staff@clinic.test");
  const d = id("Dr. Aditi Sharma");
  const clinicId = one<{ clinic_id: string }>("SELECT clinic_id FROM dentist_clinics WHERE dentist_id = ?", d)!.clinic_id;
  const otherClinic = one<{ id: string }>("SELECT id FROM clinics WHERE id != ? LIMIT 1", clinicId)!.id;
  grantRole(staff.user.id, "clinic_front_desk", null, clinicId);
  grantRole(staffOther.user.id, "clinic_front_desk", null, otherClinic);
  const b = requestBooking(a, { dentistId: d, slotId: availability(d).slots[0].id, confirmed: true, idempotencyKey: key() });
  assert.equal(status(() => clinicUpdateBooking(a, b.id, "confirmed")), 403);
  assert.equal(status(() => clinicUpdateBooking(staffOther, b.id, "confirmed")), 403);
  assert.equal(status(() => clinicUpdateBooking(staff, b.id, "completed")), 409);
  assert.equal(clinicUpdateBooking(staff, b.id, "confirmed").statusLabel, "Confirmed by clinic");
  assert.equal(status(() => clinicUpdateBooking(staff, b.id, "cancelled_by_clinic", "")), 400);
});
