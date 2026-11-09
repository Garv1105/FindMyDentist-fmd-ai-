import assert from "node:assert/strict";
import { test } from "node:test";
import { areasFor, canOpenClinic, DEMO_USERS, findDemoUser, makeUser, PREVIEW_CODE, readStored, safeNext, userByPhone } from "./demo.ts";

test("six demo people, one per role", () => {
  assert.deepEqual(
    DEMO_USERS.map((u) => u.id),
    ["demo-patient", "demo-dentist", "demo-owner", "demo-desk", "demo-student", "demo-company"],
  );
  assert.equal(new Set(DEMO_USERS.map((u) => u.role)).size, 6);
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
  assert.equal(safeNext("/\t/evil.com"), "/"); // browsers drop tabs: would become //evil.com
  assert.equal(safeNext("/\n/evil.com"), "/");
  assert.equal(safeNext("/clinic/smile-studio?date=2026-11-10#x"), "/clinic/smile-studio?date=2026-11-10#x");
});

test("sign in by phone: any formatting of a demo person's number finds them", () => {
  const owner = findDemoUser("demo-owner")!;
  assert.equal(userByPhone(owner.phone)?.id, "demo-owner");
  assert.equal(userByPhone(owner.phone.replace(/\D/g, "").slice(-10))?.id, "demo-owner");
  assert.equal(userByPhone("+91 " + owner.phone.replace(/\D/g, "").slice(-10))?.id, "demo-owner");
  assert.equal(userByPhone("90000 00000"), null);
  assert.match(PREVIEW_CODE, /^\d{6}$/);
});

test("creating an account: clinic roles join the demo clinic; names and phones are checked", () => {
  const owner = makeUser({ name: "  Meera  Iyer ", role: "clinic_owner", phone: "98111 22233" });
  assert.equal(owner.name, "Meera Iyer");
  assert.equal(owner.initials, "MI");
  assert.equal(owner.clinicId, "smile-studio");
  assert.equal(owner.phone, "+91 98111 22233");
  assert.equal(makeUser({ name: "Ravi", role: "patient", phone: "9811122233" }).clinicId, null);
  assert.throws(() => makeUser({ name: " ", role: "patient", phone: "9811122233" }));
  assert.throws(() => makeUser({ name: "Ravi", role: "patient", phone: "123" }));
});

test("stored sign-in: a known id, or a created account saved as JSON; junk is ignored", () => {
  assert.equal(readStored("demo-owner")?.name, "Dr. Ananya Rao");
  const u = makeUser({ name: "Meera Iyer", role: "student", phone: "9811122233" });
  assert.equal(readStored(JSON.stringify(u))?.name, "Meera Iyer");
  assert.equal(readStored("{not json"), null);
  assert.equal(readStored(JSON.stringify({ name: "x" })), null);
  assert.equal(readStored(null), null);
});

test("the profile menu lists what each role can open", () => {
  const labels = (id: string) => areasFor(findDemoUser(id)!).flatMap((g) => g.items.map((i) => i.label));
  const owner = areasFor(findDemoUser("demo-owner")!);
  assert.equal(owner[0].title, "FMD Clinic");
  assert.deepEqual(
    owner[0].items.filter((i) => i.href).map((i) => i.label),
    ["Home", "Calendar", "Patients", "Billing"],
  );
  assert.ok(owner[0].items.every((i) => !i.href || i.href.startsWith("/clinic/smile-studio")));
  assert.ok(labels("demo-patient").some((l) => /FMD Main/.test(l)));
  assert.ok(!labels("demo-patient").includes("Billing"));
  assert.ok(areasFor(findDemoUser("demo-patient")!).flatMap((g) => g.items).every((i) => !i.href)); // FMD Main isn't built yet
  assert.ok(labels("demo-student").some((l) => /Scholar/.test(l)));
});
