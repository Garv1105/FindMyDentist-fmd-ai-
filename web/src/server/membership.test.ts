import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { resetDb, run } from "./db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "./auth.ts";
import { activateMembership, catalogFor, consume, entitlementsOf, membershipStatus } from "./membership.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => resetDb());

function user(email: string, accountType: string, ops = false): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: "Test User", accountType, consents: { terms: true, privacy: true } });
  const req = () => new Request("http://x/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  if (ops) grantRole(requireAuth(req()).user.id, "fmd_ops", null);
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

test("catalog shows PRD prices, tax note and pending decisions; Clinic OS stays separate", () => {
  const dentist = catalogFor(user("d@example.com", "dentist"));
  assert.equal(dentist.membership.priceInr, 550);
  assert.equal(dentist.membership.period, "year");
  assert.match(dentist.membership.taxNote!, /GST/);
  assert.equal(dentist.separateProducts[0].code, "clinic_os");
  assert.equal(dentist.separateProducts[0].priceInr, 2000);
  assert.equal(dentist.checkout.available, false);
  const student = catalogFor(user("s@example.com", "student"));
  assert.equal(student.membership.priceInr, 400);
  assert.ok(student.membership.pendingDecision);
  assert.equal(student.addOns[0].priceInr, 350);
  const patient = catalogFor(user("p@example.com", "patient"));
  assert.equal(patient.membership.priceInr, 0);
  assert.equal(patient.membership.taxNote, null);
});

test("Scholar is entitled only by an active student membership, decided on the server", () => {
  const ops = user("ops@example.com", "patient", true);
  const s = user("s@example.com", "student");
  const d = user("d@example.com", "dentist");
  assert.equal(entitlementsOf(s).scholar, false);
  assert.equal(status(() => activateMembership(s, { userId: s.user.id, evidence: "UPI ref 123456" })), 403); // can't self-activate
  assert.equal(status(() => activateMembership(ops, { userId: s.user.id, evidence: "" })), 400);
  activateMembership(ops, { userId: s.user.id, evidence: "UPI ref 123456; student ID checked" });
  assert.equal(entitlementsOf(s).scholar, true);
  activateMembership(ops, { userId: d.user.id, evidence: "Bank transfer ref 99887766" });
  assert.equal(entitlementsOf(d).mainMembership, true);
  assert.equal(entitlementsOf(d).scholar, false); // professionals are not assumed to get Scholar
  // expiry ends access
  run("UPDATE subscriptions SET ends_at = ? WHERE user_id = ?", Date.now() - 1000, s.user.id);
  assert.equal(entitlementsOf(s).scholar, false);
});

test("usage meter counts and refuses at the limit instead of silently charging", () => {
  const ops = user("ops@example.com", "patient", true);
  const s = user("s@example.com", "student");
  assert.equal(status(() => consume(s, "scholar_requests")), 403);
  activateMembership(ops, { userId: s.user.id, evidence: "UPI ref 123456" });
  consume(s, "scholar_requests");
  consume(s, "scholar_requests");
  const m = membershipStatus(s);
  assert.equal(m.usage[0].used, 2);
  assert.equal(m.usage[0].provisional, true);
  run("UPDATE usage_counters SET used = 300");
  assert.equal(status(() => consume(s, "scholar_requests")), 429);
});
