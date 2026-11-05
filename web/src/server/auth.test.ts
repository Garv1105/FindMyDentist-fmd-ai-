import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { audit, one, resetDb } from "./db.ts";
import {
  currentAuth, grantRole, normaliseTarget, register, requestDeletion, requestOtp, requireAuth, requireRole,
  revokeSession, SESSION_COOKIE, updateConsents, verifyOtp, currentConsents, listSessions,
} from "./auth.ts";
import { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => resetDb());

const req = (token?: string) => new Request("http://x/", { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} });
const code = (t: string) => requestOtp(t).devCode!;
const status = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as HttpError).status; }
  return 200;
};
function signUp(target = "asha@example.com", accountType = "patient") {
  const v = verifyOtp(target, code(target));
  assert.ok(v.ok && "needsProfile" in v);
  return register({ ticket: v.ticket, name: "Asha Rao", accountType, consents: { terms: true, privacy: true, comms_appointments: true } }).token;
}

test("normalises Indian mobile numbers and emails; rejects junk", () => {
  assert.equal(normaliseTarget("098765 43210").target, "+919876543210");
  assert.equal(normaliseTarget("+91-98765-43210").target, "+919876543210");
  assert.equal(normaliseTarget(" Asha@Example.COM ").target, "asha@example.com");
  assert.equal(status(() => normaliseTarget("12345")), 400);
});

test("sign-up → session → sign-in again uses the same account", () => {
  const t1 = signUp();
  const a = currentAuth(req(t1))!;
  assert.equal(a.user.name, "Asha Rao");
  assert.deepEqual(a.roles, ["patient"]);
  const v = verifyOtp("asha@example.com", code("asha@example.com"));
  assert.ok(v.ok && "token" in v);
  assert.equal(currentAuth(req(v.token))!.user.id, a.user.id);
});

test("wrong code counts attempts and locks after 5", () => {
  code("x@example.com");
  for (let i = 0; i < 5; i++) assert.equal(verifyOtp("x@example.com", "000000").ok, false);
  assert.equal(status(() => verifyOtp("x@example.com", "000000")), 429);
});

test("expired code is rejected", () => {
  const c = code("y@example.com");
  one("UPDATE otp_challenges SET expires_at = 0 WHERE target = 'y@example.com' RETURNING id");
  assert.equal(status(() => verifyOtp("y@example.com", c)), 400);
});

test("OTP requests are rate limited per target", () => {
  for (let i = 0; i < 5; i++) requestOtp("z@example.com");
  assert.equal(status(() => requestOtp("z@example.com")), 429);
});

test("signup ticket is single use and terms are required", () => {
  const v = verifyOtp("t@example.com", code("t@example.com"));
  assert.ok(v.ok && "ticket" in v);
  assert.equal(status(() => register({ ticket: v.ticket, name: "T User", accountType: "patient", consents: { terms: true } })), 400);
  register({ ticket: v.ticket, name: "T User", accountType: "patient", consents: { terms: true, privacy: true } });
  assert.equal(status(() => register({ ticket: v.ticket, name: "T User", accountType: "patient", consents: { terms: true, privacy: true } })), 400);
});

test("internal roles cannot be self-selected", () => {
  const v = verifyOtp("evil@example.com", code("evil@example.com"));
  assert.ok(v.ok && "ticket" in v);
  assert.equal(status(() => register({ ticket: v.ticket, name: "Evil", accountType: "super_admin", consents: { terms: true, privacy: true } })), 400);
});

test("requireAuth denies anonymous and revoked sessions", () => {
  assert.equal(status(() => requireAuth(req())), 401);
  assert.equal(status(() => requireAuth(req("forged-token"))), 401);
  const t = signUp();
  const a = requireAuth(req(t));
  const t2 = verifyOtp("asha@example.com", code("asha@example.com"));
  assert.ok(t2.ok && "token" in t2);
  revokeSession(a, "others");
  assert.equal(status(() => requireAuth(req(t2.token))), 401);
  assert.equal(listSessions(a).length, 1);
});

test("requireRole denies and audits", () => {
  const a = requireAuth(req(signUp()));
  assert.equal(status(() => requireRole(a, "fmd_ops")), 403);
  assert.ok(one("SELECT id FROM audit_events WHERE action = 'access.denied'"));
  grantRole(a.user.id, "fmd_ops", null);
  assert.equal(status(() => requireRole(requireAuth(req(signUp("o@example.com"))), "fmd_ops")), 403);
});

test("consents: marketing is separate from appointments; terms cannot be withdrawn here; history kept", () => {
  const a = requireAuth(req(signUp()));
  assert.equal(currentConsents(a.user.id).comms_marketing, false);
  const c = updateConsents(a, { comms_marketing: true, terms: false } as never);
  assert.equal(c.comms_marketing, true);
  assert.equal(c.comms_appointments, true);
  assert.equal(c.terms, true);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM consents WHERE user_id = ? AND purpose = 'comms_marketing'", a.user.id)!.n, 2);
});

test("deletion request is recorded once", () => {
  const a = requireAuth(req(signUp()));
  assert.match(requestDeletion(a, "moving").reference, /^DEL-/);
  assert.equal(status(() => requestDeletion(requireAuth(req(signUp("b@example.com"))), "")), 200);
  assert.equal(status(() => requestDeletion(a, "")), 409);
  audit(null, "noop", "test", null);
});
