import assert from "node:assert/strict";
import { test } from "node:test";
import { canOpenClinic, DEMO_USERS, findDemoUser, safeNext } from "./demo.ts";

test("four demo people", () => {
  assert.deepEqual(
    DEMO_USERS.map((u) => u.id),
    ["demo-patient", "demo-dentist", "demo-owner", "demo-desk"],
  );
});

test("findDemoUser", () => {
  assert.equal(findDemoUser("demo-owner")?.name, "Dr. Ananya Rao");
  assert.equal(findDemoUser("nope"), null);
  assert.equal(findDemoUser(null), null);
});

test("canOpenClinic: only that clinic's people", () => {
  assert.equal(canOpenClinic(findDemoUser("demo-owner"), "smile-studio"), true);
  assert.equal(canOpenClinic(findDemoUser("demo-desk"), "smile-studio"), true);
  assert.equal(canOpenClinic(findDemoUser("demo-patient"), "smile-studio"), false);
  assert.equal(canOpenClinic(findDemoUser("demo-owner"), "other"), false);
  assert.equal(canOpenClinic(null, "smile-studio"), false);
});

test("safeNext: same-site paths only", () => {
  assert.equal(safeNext("/clinic/smile-studio"), "/clinic/smile-studio");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext(null), "/");
});
