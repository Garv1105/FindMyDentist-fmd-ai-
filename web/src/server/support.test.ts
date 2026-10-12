import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { resetDb, run } from "./db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "./auth.ts";
import { attach, myTickets, openTicket, queue, readAttachment, reopen, reply, staffUpdate, ticketDetail } from "./support.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => resetDb());

function user(email: string, staff = false): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: "Test User", accountType: "patient", consents: { terms: true, privacy: true } });
  const req = () => new Request("http://x/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  if (staff) grantRole(requireAuth(req()).user.id, "fmd_ops", null);
  return requireAuth(req());
}
const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const t = { area: "booking", severity: "high", subject: "Booking stuck", body: "My booking request shows no update after two days." };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("open, validate, and isolate tickets between users", () => {
  const a = user("a@example.com");
  const b = user("b@example.com");
  assert.equal(status(() => openTicket(a, { ...t, area: "nope" })), 400);
  assert.equal(status(() => openTicket(a, { ...t, body: "short" })), 400);
  const tk = openTicket(a, t);
  assert.match(tk.reference, /^SR-/);
  assert.equal(status(() => ticketDetail(b, tk.id)), 404);
  assert.equal(status(() => reply(b, tk.id, { body: "hello" })), 404);
  assert.equal(status(() => queue(a)), 403);
  assert.equal(myTickets(a).length, 1);
});

test("staff triage: internal notes stay internal; waiting-on-user flips back on reply; resolution required; reopen window", () => {
  const a = user("a@example.com");
  const ops = user("ops@example.com", true);
  const tk = openTicket(a, t);
  staffUpdate(ops, tk.id, { assignToMe: true, status: "in_progress" });
  reply(ops, tk.id, { body: "Checked logs: clinic has not responded yet.", internal: true });
  reply(ops, tk.id, { body: "We're contacting the clinic for you." });
  staffUpdate(ops, tk.id, { status: "waiting_on_user" });
  const mine = ticketDetail(a, tk.id);
  assert.ok(!mine.messages.some((m) => m.internal));
  assert.equal(mine.messages.length, 2);
  assert.equal(ticketDetail(ops, tk.id).messages.length, 3);
  reply(a, tk.id, { body: "Thanks, still waiting." });
  assert.equal(ticketDetail(a, tk.id).status, "in_progress");

  assert.equal(status(() => staffUpdate(ops, tk.id, { status: "resolved" })), 400);
  staffUpdate(ops, tk.id, { status: "resolved", resolution: "Clinic confirmed the booking for Saturday." });
  assert.equal(status(() => reply(a, tk.id, { body: "one more thing" })), 409);
  assert.equal(reopen(a, tk.id).status, "open");
  staffUpdate(ops, tk.id, { status: "resolved", resolution: "Resolved again." });
  run("UPDATE tickets SET resolved_at = ? WHERE id = ?", Date.now() - 30 * 86400_000, tk.id);
  assert.equal(status(() => reopen(a, tk.id)), 409);
  assert.equal(queue(ops).metrics.reopenRate, 100);
});

test("attachments: screenshots/PDF only, size-limited, visible only to requester and staff", () => {
  const a = user("a@example.com");
  const b = user("b@example.com");
  const ops = user("ops@example.com", true);
  const tk = openTicket(a, t);
  assert.equal(status(() => attach(a, tk.id, new TextEncoder().encode("<html></html>"))), 415);
  assert.equal(status(() => attach(a, tk.id, new Uint8Array(6 * 1024 * 1024))), 413);
  const d = attach(a, tk.id, PNG);
  const att = d.attachments[0].id;
  assert.equal(readAttachment(ops, tk.id, att).mime, "image/png");
  assert.equal(status(() => readAttachment(b, tk.id, att)), 404);
});
