import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDocument, checkPublicProfile, drName, EMPTY_PROFILE, getPublicProfile, savePublicProfile } from "./dentist.ts";

const ok = { ...EMPTY_PROFILE, about: "Root canal specialist.", years_experience: 8, fee_min: 500, fee_max: 1500, clinics: [{ name: "Smile Studio", area: "Indiranagar", city: "Bengaluru" }] };

test("a complete profile and an empty one both pass", () => {
  assert.equal(checkPublicProfile(ok), null);
  assert.equal(checkPublicProfile(EMPTY_PROFILE), null);
});

test("profile rules", () => {
  assert.match(checkPublicProfile({ ...ok, about: "x".repeat(601) })!, /600/);
  assert.match(checkPublicProfile({ ...ok, years_experience: 61 })!, /0 to 60/);
  assert.match(checkPublicProfile({ ...ok, years_experience: 2.5 })!, /whole number/);
  assert.match(checkPublicProfile({ ...ok, fee_max: null })!, /both/);
  assert.match(checkPublicProfile({ ...ok, fee_min: 2000 })!, /lowest first/);
  assert.match(checkPublicProfile({ ...ok, clinics: [{ name: "", area: "", city: "Pune" }] })!, /name and a city/);
  assert.match(checkPublicProfile({ ...ok, clinics: Array(6).fill(ok.clinics[0]) })!, /up to 5/);
});

test("verification documents: type and size", () => {
  assert.equal(checkDocument({ type: "application/pdf", size: 1000 }), null);
  assert.match(checkDocument({ type: "image/gif", size: 1000 })!, /PDF, JPG or PNG/);
  assert.match(checkDocument({ type: "image/png", size: 6 * 1024 * 1024 })!, /5 MB/);
});

test("save trims, refuses bad profiles, and reads back", async () => {
  await assert.rejects(savePublicProfile("u1", { ...ok, fee_min: 9000 }), /lowest first/);
  await savePublicProfile("u1", { ...ok, about: "  Gentle care.  " });
  assert.equal((await getPublicProfile("u1")).about, "Gentle care.");
  assert.deepEqual(await getPublicProfile("someone-else"), EMPTY_PROFILE);
});

test("Dr. prefix", () => {
  assert.equal(drName("Priya Sharma"), "Dr. Priya Sharma");
  assert.equal(drName("Dr. Karthik Iyer"), "Dr. Karthik Iyer");
  assert.equal(drName("dr Karthik"), "dr Karthik");
});
