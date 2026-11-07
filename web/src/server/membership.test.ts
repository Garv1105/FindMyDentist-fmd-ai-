import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { resetDb, run } from "./db.ts";
import { type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { activateMembership, catalogFor, consume, entitlementsOf, membershipStatus } from "./membership.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => await resetDb());

async function user(email: string, accountType: string, ops = false): Promise<Auth> {
  return await testUser(email, { accountType, roles: ops ? ["fmd_ops"] : [] });
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};

test("catalog shows PRD prices, tax note and pending decisions; Clinic OS stays separate", async () => {
  const dentist = await catalogFor(await user("d@example.com", "dentist"));
  assert.equal(dentist.membership.priceInr, 550);
  assert.equal(dentist.membership.period, "year");
  assert.match(dentist.membership.taxNote!, /GST/);
  assert.equal(dentist.separateProducts[0].code, "clinic_os");
  assert.equal(dentist.separateProducts[0].priceInr, 2000);
  assert.equal(dentist.checkout.available, false);
  const student = await catalogFor(await user("s@example.com", "student"));
  assert.equal(student.membership.priceInr, 400);
  assert.ok(student.membership.pendingDecision);
  assert.equal(student.addOns[0].priceInr, 350);
  const patient = await catalogFor(await user("p@example.com", "patient"));
  assert.equal(patient.membership.priceInr, 0);
  assert.equal(patient.membership.taxNote, null);
});

test("Scholar is entitled only by an active student membership, decided on the server", async () => {
  const ops = await user("ops@example.com", "patient", true);
  const s = await user("s@example.com", "student");
  const d = await user("d@example.com", "dentist");
  assert.equal((await entitlementsOf(s)).scholar, false);
  assert.equal(await status(async () => await activateMembership(s, { userId: s.user.id, evidence: "UPI ref 123456" })), 403); // can't self-activate
  assert.equal(await status(async () => await activateMembership(ops, { userId: s.user.id, evidence: "" })), 400);
  await activateMembership(ops, { userId: s.user.id, evidence: "UPI ref 123456; student ID checked" });
  assert.equal((await entitlementsOf(s)).scholar, true);
  await activateMembership(ops, { userId: d.user.id, evidence: "Bank transfer ref 99887766" });
  assert.equal((await entitlementsOf(d)).mainMembership, true);
  assert.equal((await entitlementsOf(d)).scholar, false); // professionals are not assumed to get Scholar
  // expiry ends access
  await run("UPDATE subscriptions SET ends_at = ? WHERE user_id = ?", Date.now() - 1000, s.user.id);
  assert.equal((await entitlementsOf(s)).scholar, false);
});

test("usage meter counts and refuses at the limit instead of silently charging", async () => {
  const ops = await user("ops@example.com", "patient", true);
  const s = await user("s@example.com", "student");
  assert.equal(await status(async () => await consume(s, "scholar_requests")), 403);
  await activateMembership(ops, { userId: s.user.id, evidence: "UPI ref 123456" });
  await consume(s, "scholar_requests");
  await consume(s, "scholar_requests");
  const m = await membershipStatus(s);
  assert.equal(m.usage[0].used, 2);
  assert.equal(m.usage[0].provisional, true);
  await run("UPDATE usage_counters SET used = 300");
  assert.equal(await status(async () => await consume(s, "scholar_requests")), 429);
});
