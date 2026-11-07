import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { one, resetDb } from "./db.ts";
import { currentAuth, currentConsents, requestDeletion, requireAuth, requireRole, updateConsents, verifyAccess, type ApiMe } from "./auth.ts";
import { HttpError } from "./http.ts";
import { testUser } from "./testing.ts";

process.env.FMD_DB = ":memory:";
const SECRET = "test-secret-of-at-least-thirty-two-characters!";
process.env.FMD_API_JWT_SECRET = SECRET;

/* A token exactly as FastAPI signs it (server/app/core/security.py). */
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(claims: Record<string, unknown> = {}, secret = SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, sid: "sess-1", iss: "fmd-api", aud: "fmd", iat: now, exp: now + 900, ...claims })}`;
  const key = createHmac("sha256", secret).update("fmd-access-jwt-v1").digest();
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}
const req = (t?: string) => new Request("http://x/", { headers: t ? { cookie: `fmd_access=${t}` } : {} });

const USER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ME: ApiMe = {
  id: USER_ID,
  full_name: "Asha Rao",
  phone: "+919876543210",
  email: "asha@example.com",
  email_verified: true,
  mfa_enabled: false,
  city: "Bengaluru",
  dentist_profile: null,
  workspaces: [{ clinic_id: "c-1", clinic_name: "Smile Studio", role: "receptionist" }],
};

/* FastAPI's /auth/me, faked: what it answers and how often it is asked */
let answer: ApiMe | number | "down" = ME;
let calls = 0;
const realFetch = globalThis.fetch;
beforeEach(() => {
  resetDb();
  answer = ME;
  calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (answer === "down") throw new Error("connection refused");
    if (typeof answer === "number") return new Response("{}", { status: answer });
    return Response.json(answer);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.FMD_OPS_EMAILS;
});

const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};

test("only FastAPI's own, unexpired, untampered tokens are accepted", () => {
  assert.deepEqual(verifyAccess(token()), { sub: USER_ID, sid: "sess-1" });
  assert.equal(verifyAccess(token({}, "another-secret-of-at-least-thirty-two-chars")), null);
  assert.equal(verifyAccess(token({ exp: Math.floor(Date.now() / 1000) - 1 })), null);
  assert.equal(verifyAccess(token({ iss: "someone-else" })), null);
  assert.equal(verifyAccess(token({ aud: "other" })), null);
  const [h, , s] = token().split(".");
  assert.equal(verifyAccess(`${h}.${b64({ sub: "attacker", sid: "x", iss: "fmd-api", aud: "fmd", exp: 9e9 })}.${s}`), null);
  assert.equal(verifyAccess("not-a-jwt"), null);
});

test("first visit links the FastAPI account: same id, profile, clinic roles, consents", async () => {
  const a = (await currentAuth(req(token())))!;
  assert.equal(a.user.id, USER_ID);
  assert.equal(a.user.name, "Asha Rao");
  assert.equal(a.user.email, "asha@example.com");
  assert.equal(a.user.account_type, "patient");
  assert.equal(a.sessionId, "sess-1");
  assert.ok(a.roles.includes("patient"));
  assert.ok(a.roles.includes("clinic_front_desk")); // FastAPI receptionist
  assert.equal(one<{ org_id: string }>("SELECT org_id FROM user_roles WHERE user_id = ? AND role = 'clinic_front_desk'", USER_ID)!.org_id, "c-1");
  const c = currentConsents(USER_ID);
  assert.equal(c.terms, true);
  assert.equal(c.comms_marketing, false);
});

test("the cache is used until stale; fresh re-reads FastAPI and mirrors its changes", async () => {
  await currentAuth(req(token()));
  await currentAuth(req(token()));
  assert.equal(calls, 1);
  answer = { ...ME, full_name: "Asha R.", dentist_profile: { council: "KSDC", registration_no: "1", verification_status: "pending" }, workspaces: [] };
  const a = (await currentAuth(req(token()), { fresh: true }))!;
  assert.equal(calls, 2);
  assert.equal(a.user.name, "Asha R.");
  assert.equal(a.user.account_type, "dentist");
  assert.ok(a.roles.includes("dentist") && !a.roles.includes("patient"));
  assert.ok(!a.roles.some((r) => r.startsWith("clinic_")), "a membership that ended in FastAPI ends here");
});

test("signed out when FastAPI rejects the session, or has never been reachable for this user", async () => {
  answer = 401;
  assert.equal(await currentAuth(req(token())), null);
  answer = "down";
  assert.equal(await currentAuth(req(token())), null);
  assert.equal(await currentAuth(req()), null);
  assert.equal(await status(() => requireAuth(req())), 401);
});

test("a known user stays signed in while FastAPI is briefly unreachable", async () => {
  await currentAuth(req(token()));
  answer = "down";
  assert.equal((await currentAuth(req(token()), { fresh: true }))?.user.id, USER_ID);
});

test("staff roles come from env, and only for a verified email", async () => {
  process.env.FMD_OPS_EMAILS = "asha@example.com";
  answer = { ...ME, email_verified: false };
  assert.ok(!(await currentAuth(req(token())))!.roles.includes("fmd_ops"));
  answer = ME;
  assert.ok((await currentAuth(req(token()), { fresh: true }))!.roles.includes("fmd_ops"));
});

test("requireRole denies and audits", async () => {
  const a = testUser("o@example.com");
  assert.equal(await status(() => requireRole(a, "fmd_ops")), 403);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM audit_events WHERE action = 'access.denied'")!.n, 1);
});

test("consents: marketing is separate from appointments; terms cannot be withdrawn here; history kept", () => {
  const a = testUser("asha@example.com");
  assert.equal(currentConsents(a.user.id).comms_marketing, false);
  const c = updateConsents(a, { comms_marketing: true, terms: false } as never);
  assert.equal(c.comms_marketing, true);
  assert.equal(c.comms_appointments, false);
  assert.equal(c.terms, true);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) n FROM consents WHERE user_id = ? AND purpose = 'comms_marketing'", a.user.id)!.n, 2);
});

test("deletion request is recorded once", async () => {
  const a = testUser("asha@example.com");
  assert.match(requestDeletion(a, "moving").reference, /^DEL-/);
  assert.equal(await status(() => requestDeletion(testUser("b@example.com"), "")), 200);
  assert.equal(await status(() => requestDeletion(a, "")), 409);
});
