import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { resetDb, run } from "./db.ts";
import { type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { attach, myTickets, openTicket, queue, readAttachment, reopen, reply, staffUpdate, ticketDetail } from "./support.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => await resetDb());

async function user(email: string, staff = false): Promise<Auth> {
  return await testUser(email, { roles: staff ? ["fmd_ops"] : [] });
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const t = { area: "booking", severity: "high", subject: "Booking stuck", body: "My booking request shows no update after two days." };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("open, validate, and isolate tickets between users", async () => {
  const a = await user("a@example.com");
  const b = await user("b@example.com");
  assert.equal(await status(async () => await openTicket(a, { ...t, area: "nope" })), 400);
  assert.equal(await status(async () => await openTicket(a, { ...t, body: "short" })), 400);
  const tk = await openTicket(a, t);
  assert.match(tk.reference, /^SR-/);
  assert.equal(await status(async () => await ticketDetail(b, tk.id)), 404);
  assert.equal(await status(async () => await reply(b, tk.id, { body: "hello" })), 404);
  assert.equal(await status(async () => await queue(a)), 403);
  assert.equal((await myTickets(a)).length, 1);
});

test("staff triage: internal notes stay internal; waiting-on-user flips back on reply; resolution required; reopen window", async () => {
  const a = await user("a@example.com");
  const ops = await user("ops@example.com", true);
  const tk = await openTicket(a, t);
  await staffUpdate(ops, tk.id, { assignToMe: true, status: "in_progress" });
  await reply(ops, tk.id, { body: "Checked logs: clinic has not responded yet.", internal: true });
  await reply(ops, tk.id, { body: "We're contacting the clinic for you." });
  await staffUpdate(ops, tk.id, { status: "waiting_on_user" });
  const mine = await ticketDetail(a, tk.id);
  assert.ok(!mine.messages.some((m) => m.internal));
  assert.equal(mine.messages.length, 2);
  assert.equal((await ticketDetail(ops, tk.id)).messages.length, 3);
  await reply(a, tk.id, { body: "Thanks, still waiting." });
  assert.equal((await ticketDetail(a, tk.id)).status, "in_progress");

  assert.equal(await status(async () => await staffUpdate(ops, tk.id, { status: "resolved" })), 400);
  await staffUpdate(ops, tk.id, { status: "resolved", resolution: "Clinic confirmed the booking for Saturday." });
  assert.equal(await status(async () => await reply(a, tk.id, { body: "one more thing" })), 409);
  assert.equal((await reopen(a, tk.id)).status, "open");
  await staffUpdate(ops, tk.id, { status: "resolved", resolution: "Resolved again." });
  await run("UPDATE tickets SET resolved_at = ? WHERE id = ?", Date.now() - 30 * 86400_000, tk.id);
  assert.equal(await status(async () => await reopen(a, tk.id)), 409);
  assert.equal((await queue(ops)).metrics.reopenRate, 100);
});

test("attachments: screenshots/PDF only, size-limited, visible only to requester and staff", async () => {
  const a = await user("a@example.com");
  const b = await user("b@example.com");
  const ops = await user("ops@example.com", true);
  const tk = await openTicket(a, t);
  assert.equal(await status(async () => await attach(a, tk.id, new TextEncoder().encode("<html></html>"))), 415);
  assert.equal(await status(async () => await attach(a, tk.id, new Uint8Array(6 * 1024 * 1024))), 413);
  const d = await attach(a, tk.id, PNG);
  const att = d.attachments[0].id;
  assert.equal((await readAttachment(ops, tk.id, att)).mime, "image/png");
  assert.equal(await status(async () => await readAttachment(b, tk.id, att)), 404);
});
