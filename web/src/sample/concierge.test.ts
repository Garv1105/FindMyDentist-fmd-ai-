import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelEnquiry, checkEnquiry, createEnquiry, getEnquiry, respond, sendMessage, STEP_MS, type Input } from "./concierge.ts";

const NOW = Date.parse("2026-11-10T11:00:00+05:30");
const ok: Input = { need: "Dental implants", area: "Jayanagar, Bengaluru", timing: "This week", method: "phone", value: "98765 43210", best_time: "Morning", notes: "", consent: true };

test("only what coordination needs, checked", () => {
  assert.equal(checkEnquiry(ok), null);
  assert.match(checkEnquiry({ ...ok, need: "" })!, /what you need/);
  assert.match(checkEnquiry({ ...ok, value: "12345" })!, /10-digit/);
  assert.match(checkEnquiry({ ...ok, method: "email", value: "nope" })!, /email/);
  assert.match(checkEnquiry({ ...ok, consent: false })!, /Agree/);
});

test("the coordinator moves it along, then waits: nothing is final until the person says yes", async () => {
  const e = await createEnquiry("e1", ok, NOW);
  assert.match(e.ref, /^EDGE-/);
  assert.equal(e.status, "new");
  assert.equal((await getEnquiry("e1", e.ref, NOW + STEP_MS))!.status, "contact_attempted");
  const waiting = (await getEnquiry("e1", e.ref, NOW + 10 * STEP_MS))!;
  assert.equal(waiting.status, "awaiting_you", "stops at the person's decision, however long it waits");
  assert.equal(waiting.proposals.length, 2);
  const one = await respond("e1", e.ref, "pr-clinic", true, NOW + 10 * STEP_MS);
  assert.equal(one.status, "awaiting_you", "one yes isn't everything");
  assert.equal((await respond("e1", e.ref, "pr-fee", true, NOW + 10 * STEP_MS)).status, "confirmed");
  await assert.rejects(sendMessage("e1", e.ref, "hi", NOW + 10 * STEP_MS), /finished/);
});

test("saying no sends the coordinator back to look again; cancel works while open", async () => {
  const e = await createEnquiry("e2", ok, NOW);
  await getEnquiry("e2", e.ref, NOW + 4 * STEP_MS);
  assert.equal((await respond("e2", e.ref, "pr-fee", false, NOW + 4 * STEP_MS)).status, "coordinating");
  assert.equal((await cancelEnquiry("e2", e.ref, NOW + 5 * STEP_MS)).status, "cancelled");
});
