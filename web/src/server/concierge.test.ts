import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb } from "./db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "./auth.ts";
import { act, enquiryDetail, listQueue, myEnquiries, submitEnquiry } from "./concierge.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => resetDb());

function user(email: string, ops = false): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: email.split("@")[0] + " Test", accountType: "patient", consents: { terms: true, privacy: true } });
  const req = () => new Request("http://x/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  if (ops) grantRole(requireAuth(req()).user.id, "fmd_ops", null);
  return requireAuth(req());
}
const status = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as HttpError).status; }
  return 200;
};
const valid = { name: "Meera K", contactMethod: "phone", contactValue: "98450 12345", need: "Finding the right specialist", area: "Indiranagar", timing: "This week", consent: true };

test("submission needs consent, validates contact, issues a reference and is not a confirmation", () => {
  assert.equal(status(() => submitEnquiry({ ...valid, consent: false }, null)), 400);
  assert.equal(status(() => submitEnquiry({ ...valid, contactValue: "123" }, null)), 400);
  assert.equal(status(() => submitEnquiry({ ...valid, need: "Book me a root canal now" }, null)), 400);
  const r = submitEnquiry(valid, null);
  assert.match(r.reference, /^CQ-[A-Z2-9]{6}$/);
  assert.equal(r.status, "new");
});

test("open requests per contact are rate limited", () => {
  for (let i = 0; i < 3; i++) submitEnquiry(valid, null);
  assert.equal(status(() => submitEnquiry(valid, null)), 429);
});

test("patients cannot reach the queue; patients see only their own status", () => {
  const p = user("p@example.com");
  const other = user("q@example.com");
  submitEnquiry(valid, p);
  assert.equal(status(() => listQueue(p)), 403);
  assert.equal(myEnquiries(p).length, 1);
  assert.equal(myEnquiries(other).length, 0);
  assert.deepEqual(Object.keys(myEnquiries(p)[0]).sort(), ["createdAt", "need", "reference", "status", "statusLabel", "updatedAt"]);
});

test("coordinator lifecycle: attempt → contacted → coordinating → awaiting → confirmed (needs patient confirmation) → closed", () => {
  const ops = user("ops@example.com", true);
  submitEnquiry(valid, null);
  const id = listQueue(ops).items[0].id;

  act(ops, id, { type: "attempt", channel: "phone", result: "no_answer" });
  assert.equal(enquiryDetail(ops, id).enquiry.status, "contact_attempted");
  act(ops, id, { type: "attempt", channel: "whatsapp", result: "reached" });
  assert.equal(enquiryDetail(ops, id).enquiry.status, "contacted");

  assert.equal(status(() => act(ops, id, { type: "status", to: "confirmed" })), 409); // illegal jump
  act(ops, id, { type: "status", to: "coordinating" });
  act(ops, id, { type: "status", to: "awaiting_patient" });
  assert.equal(status(() => act(ops, id, { type: "status", to: "confirmed", note: "ok" })), 400);
  act(ops, id, { type: "status", to: "confirmed", patientConfirmed: true, note: "Patient agreed: Dr X, Sat 10am, consultation ₹500" });
  assert.equal(status(() => act(ops, id, { type: "status", to: "closed" })), 400); // outcome required
  act(ops, id, { type: "status", to: "closed", note: "Appointment attended" });
  assert.equal(status(() => act(ops, id, { type: "status", to: "coordinating" })), 409); // terminal
  act(ops, id, { type: "note", note: "Follow-up call done" }); // notes still allowed

  const d = enquiryDetail(ops, id);
  assert.equal(d.enquiry.outcome, "Appointment attended");
  assert.ok(d.enquiry.first_contact_at);
  assert.ok(d.events.length >= 8);
  assert.ok(one("SELECT 1 FROM audit_events WHERE action = 'concierge.viewed'"));
});

test("cancel from any open state; reassignment only to coordinators; overdue surfaces first", () => {
  const ops = user("ops@example.com", true);
  const ops2 = user("ops2@example.com", true);
  const patient = user("pat@example.com");
  submitEnquiry(valid, null);
  submitEnquiry({ ...valid, contactValue: "98450 99999" }, null);
  const [a, b] = listQueue(ops).items;

  assert.equal(status(() => act(ops, a.id, { type: "assign", assigneeId: patient.user.id })), 400);
  act(ops, a.id, { type: "assign", assigneeId: ops2.user.id });
  assert.equal(listQueue(ops2, { mine: true }).items.length, 1);

  one("UPDATE concierge_enquiries SET next_action_due = 1 WHERE id = ? RETURNING id", b.id);
  const q = listQueue(ops);
  assert.equal(q.items[0].id, b.id);
  assert.equal(q.items[0].overdue, true);
  assert.equal(q.metrics.overdue, 1);

  act(ops, b.id, { type: "status", to: "cancelled", note: "Patient withdrew" });
  assert.equal(listQueue(ops, { status: "open" }).items.length, 1);
});
