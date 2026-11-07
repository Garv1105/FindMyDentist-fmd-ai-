import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb } from "./db.ts";
import { type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { act, enquiryDetail, listQueue, myEnquiries, submitEnquiry } from "./concierge.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => await resetDb());

async function user(email: string, ops = false): Promise<Auth> {
  return await testUser(email, { name: email.split("@")[0] + " Test", roles: ops ? ["fmd_ops"] : [] });
}
const status = async (fn: () => unknown) => {
  try { await fn(); } catch (e) { return (e as HttpError).status; }
  return 200;
};
const valid = { name: "Meera K", contactMethod: "phone", contactValue: "98450 12345", need: "Finding the right specialist", area: "Indiranagar", timing: "This week", consent: true };

test("submission needs consent, validates contact, issues a reference and is not a confirmation", async () => {
  assert.equal(await status(async () => await submitEnquiry({ ...valid, consent: false }, null)), 400);
  assert.equal(await status(async () => await submitEnquiry({ ...valid, contactValue: "123" }, null)), 400);
  assert.equal(await status(async () => await submitEnquiry({ ...valid, need: "Book me a root canal now" }, null)), 400);
  const r = await submitEnquiry(valid, null);
  assert.match(r.reference, /^CQ-[A-Z2-9]{6}$/);
  assert.equal(r.status, "new");
});

test("open requests per contact are rate limited", async () => {
  for (let i = 0; i < 3; i++) await submitEnquiry(valid, null);
  assert.equal(await status(async () => await submitEnquiry(valid, null)), 429);
});

test("patients cannot reach the queue; patients see only their own status", async () => {
  const p = await user("p@example.com");
  const other = await user("q@example.com");
  await submitEnquiry(valid, p);
  assert.equal(await status(async () => await listQueue(p)), 403);
  assert.equal((await myEnquiries(p)).length, 1);
  assert.equal((await myEnquiries(other)).length, 0);
  assert.deepEqual(Object.keys((await myEnquiries(p))[0]).sort(), ["createdAt", "need", "reference", "status", "statusLabel", "updatedAt"]);
});

test("coordinator lifecycle: attempt → contacted → coordinating → awaiting → confirmed (needs patient confirmation) → closed", async () => {
  const ops = await user("ops@example.com", true);
  await submitEnquiry(valid, null);
  const id = (await listQueue(ops)).items[0].id;

  await act(ops, id, { type: "attempt", channel: "phone", result: "no_answer" });
  assert.equal((await enquiryDetail(ops, id)).enquiry.status, "contact_attempted");
  await act(ops, id, { type: "attempt", channel: "whatsapp", result: "reached" });
  assert.equal((await enquiryDetail(ops, id)).enquiry.status, "contacted");

  assert.equal(await status(async () => await act(ops, id, { type: "status", to: "confirmed" })), 409); // illegal jump
  await act(ops, id, { type: "status", to: "coordinating" });
  await act(ops, id, { type: "status", to: "awaiting_patient" });
  assert.equal(await status(async () => await act(ops, id, { type: "status", to: "confirmed", note: "ok" })), 400);
  await act(ops, id, { type: "status", to: "confirmed", patientConfirmed: true, note: "Patient agreed: Dr X, Sat 10am, consultation ₹500" });
  assert.equal(await status(async () => await act(ops, id, { type: "status", to: "closed" })), 400); // outcome required
  await act(ops, id, { type: "status", to: "closed", note: "Appointment attended" });
  assert.equal(await status(async () => await act(ops, id, { type: "status", to: "coordinating" })), 409); // terminal
  await act(ops, id, { type: "note", note: "Follow-up call done" }); // notes still allowed

  const d = await enquiryDetail(ops, id);
  assert.equal(d.enquiry.outcome, "Appointment attended");
  assert.ok(d.enquiry.first_contact_at);
  assert.ok(d.events.length >= 8);
  assert.ok(await one("SELECT 1 FROM audit_events WHERE action = 'concierge.viewed'"));
});

test("cancel from any open state; reassignment only to coordinators; overdue surfaces first", async () => {
  const ops = await user("ops@example.com", true);
  const ops2 = await user("ops2@example.com", true);
  const patient = await user("pat@example.com");
  await submitEnquiry(valid, null);
  await submitEnquiry({ ...valid, contactValue: "98450 99999" }, null);
  const [a, b] = (await listQueue(ops)).items;

  assert.equal(await status(async () => await act(ops, a.id, { type: "assign", assigneeId: patient.user.id })), 400);
  await act(ops, a.id, { type: "assign", assigneeId: ops2.user.id });
  assert.equal((await listQueue(ops2, { mine: true })).items.length, 1);

  await one("UPDATE concierge_enquiries SET next_action_due = 1 WHERE id = ? RETURNING id", b.id);
  const q = await listQueue(ops);
  assert.equal(q.items[0].id, b.id);
  assert.equal(q.items[0].overdue, true);
  assert.equal(q.metrics.overdue, 1);

  await act(ops, b.id, { type: "status", to: "cancelled", note: "Patient withdrew" });
  assert.equal((await listQueue(ops, { status: "open" })).items.length, 1);
});
