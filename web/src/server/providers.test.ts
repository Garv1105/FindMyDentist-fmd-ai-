import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "./db.ts";
import { type Auth } from "./auth.ts";
import { testUser } from "./testing.ts";
import { decideClaim, providerProfile, searchProviders, submitClaim } from "./providers.ts";
import { seedDemoDirectory } from "./seed.ts";
import type { HttpError } from "./http.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => {
  await resetDb();
  await seedDemoDirectory();
});

async function user(email: string, accountType = "patient", ops = false): Promise<Auth> {
  return await testUser(email, { name: "Test " + email.split("@")[0], accountType, roles: ops ? ["fmd_ops"] : [] });
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const id = async (name: string) => (await one<{ id: string }>("SELECT id FROM dentists WHERE name = ?", name))!.id;

test("filters by specialty, service, language and text; unknown values are ignored", async () => {
  assert.deepEqual((await searchProviders({ specialty: "Orthodontist" })).organic.map((d) => d.name), ["Dr. Rohan Mehta"]);
  assert.ok((await searchProviders({ service: "Root Canal Treatment" })).organic.every((d) => d.services.includes("Root Canal Treatment")));
  assert.ok((await searchProviders({ language: "Tamil" })).organic.every((d) => d.languages.includes("Tamil")));
  assert.equal((await searchProviders({ q: "jayanagar" })).total, 2);
  assert.equal((await searchProviders({ specialty: "x'; DROP TABLE dentists; --" })).total, 9);
  assert.equal((await searchProviders({ city: "Mumbai" })).total, 0);
  assert.ok((await searchProviders({ city: "Mumbai" })).suggestions.length > 0);
});

test("verified profiles rank first organically; no ratings are invented", async () => {
  const r = await searchProviders({});
  const statuses = r.organic.map((d) => d.verification.status);
  assert.equal(statuses.indexOf("verified"), 0);
  assert.ok(statuses.lastIndexOf("verified") < statuses.indexOf("unverified"));
  assert.ok(r.organic.every((d) => d.rating === null));
});

test("sponsorship is labelled and never reorders organic results", async () => {
  const withSponsor = (await searchProviders({})).organic.map((d) => d.id);
  assert.equal((await providerProfile(await id("Dr. Rohan Mehta"))).sponsored?.sponsor, "Demo Aligner Brand");
  assert.ok((await searchProviders({ specialty: "Orthodontist" })).organic[0].sponsored);
  await run("DELETE FROM placements");
  assert.deepEqual((await searchProviders({})).organic.map((d) => d.id), withSponsor);
});

test("pagination is bounded", async () => {
  const r = await searchProviders({ page: 999 });
  assert.equal(r.page, 50);
  assert.equal(r.organic.length, 0);
  assert.equal((await searchProviders({ page: -3 })).page, 1);
});

test("claim → ops approval links profile and records the actual checks", async () => {
  const patient = await user("pat@example.com");
  const dentist = await user("doc@example.com", "dentist");
  const ops = await user("ops@example.com", "patient", true);
  const did = await id("Dr. Karan Malhotra");
  assert.equal(await status(async () => await submitClaim(patient, did, { registrationNumber: "A-123", council: "KSDC" })), 403);
  assert.equal(await status(async () => await submitClaim(dentist, did, { registrationNumber: "1", council: "KSDC" })), 400);
  const c = await submitClaim(dentist, did, { registrationNumber: "A-12345", council: "Karnataka State Dental Council" });
  assert.equal(await status(async () => await decideClaim(dentist, c.claimId, { decision: "approve", checks: "looks fine to me ok" })), 403);
  assert.equal(await status(async () => await decideClaim(ops, c.claimId, { decision: "approve", checks: "ok" })), 400);
  await decideClaim(ops, c.claimId, { decision: "approve", checks: "Registration A-12345 confirmed on KSDC register, 11 Oct 2026" });
  const p = await providerProfile(did);
  assert.equal(p.verification.status, "verified");
  assert.match(p.verification.checks, /KSDC register/);
  assert.equal(p.claimed, true);
  assert.equal(await status(async () => await submitClaim(dentist, did, { registrationNumber: "A-12345", council: "KSDC" })), 409);
  assert.equal(await status(async () => await decideClaim(ops, c.claimId, { decision: "reject", reason: "late" })), 409);
});
