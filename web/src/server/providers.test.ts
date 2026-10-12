import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "./auth.ts";
import { decideClaim, providerProfile, searchProviders, submitClaim } from "./providers.ts";
import { seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => {
  resetDb();
  seedDemoDirectory();
});

function user(email: string, accountType = "patient", ops = false): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: "Test " + email.split("@")[0], accountType, consents: { terms: true, privacy: true } });
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
const id = (name: string) => one<{ id: string }>("SELECT id FROM dentists WHERE name = ?", name)!.id;

test("filters by specialty, service, language and text; unknown values are ignored", () => {
  assert.deepEqual(searchProviders({ specialty: "Orthodontist" }).organic.map((d) => d.name), ["Dr. Rohan Mehta"]);
  assert.ok(searchProviders({ service: "Root Canal Treatment" }).organic.every((d) => d.services.includes("Root Canal Treatment")));
  assert.ok(searchProviders({ language: "Tamil" }).organic.every((d) => d.languages.includes("Tamil")));
  assert.equal(searchProviders({ q: "jayanagar" }).total, 2);
  assert.equal(searchProviders({ specialty: "x'; DROP TABLE dentists; --" }).total, 9);
  assert.equal(searchProviders({ city: "Mumbai" }).total, 0);
  assert.ok(searchProviders({ city: "Mumbai" }).suggestions.length > 0);
});

test("verified profiles rank first organically; no ratings are invented", () => {
  const r = searchProviders({});
  const statuses = r.organic.map((d) => d.verification.status);
  assert.equal(statuses.indexOf("verified"), 0);
  assert.ok(statuses.lastIndexOf("verified") < statuses.indexOf("unverified"));
  assert.ok(r.organic.every((d) => d.rating === null));
});

test("sponsorship is labelled and never reorders organic results", () => {
  const withSponsor = searchProviders({}).organic.map((d) => d.id);
  assert.equal(providerProfile(id("Dr. Rohan Mehta")).sponsored?.sponsor, "Demo Aligner Brand");
  assert.ok(searchProviders({ specialty: "Orthodontist" }).organic[0].sponsored);
  run("DELETE FROM placements");
  assert.deepEqual(searchProviders({}).organic.map((d) => d.id), withSponsor);
});

test("pagination is bounded", () => {
  const r = searchProviders({ page: 999 });
  assert.equal(r.page, 50);
  assert.equal(r.organic.length, 0);
  assert.equal(searchProviders({ page: -3 }).page, 1);
});

test("claim → ops approval links profile and records the actual checks", () => {
  const patient = user("pat@example.com");
  const dentist = user("doc@example.com", "dentist");
  const ops = user("ops@example.com", "patient", true);
  const did = id("Dr. Karan Malhotra");
  assert.equal(status(() => submitClaim(patient, did, { registrationNumber: "A-123", council: "KSDC" })), 403);
  assert.equal(status(() => submitClaim(dentist, did, { registrationNumber: "1", council: "KSDC" })), 400);
  const c = submitClaim(dentist, did, { registrationNumber: "A-12345", council: "Karnataka State Dental Council" });
  assert.equal(status(() => decideClaim(dentist, c.claimId, { decision: "approve", checks: "looks fine to me ok" })), 403);
  assert.equal(status(() => decideClaim(ops, c.claimId, { decision: "approve", checks: "ok" })), 400);
  decideClaim(ops, c.claimId, { decision: "approve", checks: "Registration A-12345 confirmed on KSDC register, 11 Oct 2026" });
  const p = providerProfile(did);
  assert.equal(p.verification.status, "verified");
  assert.match(p.verification.checks, /KSDC register/);
  assert.equal(p.claimed, true);
  assert.equal(status(() => submitClaim(dentist, did, { registrationNumber: "A-12345", council: "KSDC" })), 409);
  assert.equal(status(() => decideClaim(ops, c.claimId, { decision: "reject", reason: "late" })), 409);
});
