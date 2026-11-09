import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { resetSample } from "./clinic.ts";
import { addNote, addPatient, amendNote, findDuplicates, getPatient, listPatients, planTotal } from "./patients.ts";

beforeEach(resetSample);
const C = "smile-studio";

test("search by name (any case), phone fragment or patient id", async () => {
  assert.deepEqual((await listPatients(C, { q: "arjun" })).map((p) => p.name), ["Arjun Mehta", "Arjun K. Mehta"]);
  assert.equal((await listPatients(C, { q: "99860" }))[0]?.name, "Priya Sharma");
  assert.equal((await listPatients(C, { q: "fmd-00412" }))[0]?.name, "Arjun Mehta");
  assert.equal((await listPatients(C, { q: "zzz" })).length, 0);
});

test("filters", async () => {
  const names = async (filter: "recall" | "in_treatment" | "consent_missing") => (await listPatients(C, { filter })).map((p) => p.name);
  assert.ok((await names("recall")).includes("Meera Joshi"));
  assert.ok((await names("in_treatment")).includes("Sana Qureshi"));
  assert.ok((await names("consent_missing")).includes("Meera Joshi"));
  assert.ok(!(await names("in_treatment")).includes("Priya Sharma"));
});

test("duplicates share phone and date of birth", async () => {
  const pairs = await findDuplicates(C);
  assert.equal(pairs.length, 1);
  assert.deepEqual(pairs[0].map((p) => p.name).sort(), ["Arjun K. Mehta", "Arjun Mehta"]);
});

test("patient detail; unknown id is null", async () => {
  const p = await getPatient(C, "p-arjun");
  assert.equal(p?.pid, "FMD-00412");
  assert.ok(p?.alerts.some((a) => /penicillin/i.test(a)));
  assert.equal(p?.teeth["36"], "treatment");
  assert.ok((p?.toothHistory["36"] ?? []).length >= 2);
  assert.equal(await getPatient(C, "nope"), null);
});

test("amending a signed note keeps the original and appends the amendment", async () => {
  const before = (await getPatient(C, "p-arjun"))!.notes[0];
  const n = await amendNote(C, "p-arjun", before.id, { text: "Canal ML length 21.5 mm.", reason: "Measurement correction", by: "Dr. Rao" });
  assert.equal(n.text, before.text);
  assert.equal(n.amendments.length, before.amendments.length + 1);
  assert.equal(n.amendments.at(-1)?.reason, "Measurement correction");
  assert.equal((await getPatient(C, "p-arjun"))!.notes[0].amendments.length, before.amendments.length + 1);
  await assert.rejects(amendNote(C, "p-arjun", before.id, { text: "x", reason: "  ", by: "Dr. Rao" }));
  await assert.rejects(amendNote(C, "p-arjun", "nope", { text: "x", reason: "r", by: "Dr. Rao" }));
});

test("plan total = lines − discount", async () => {
  const plan = (await getPatient(C, "p-arjun"))!.plans[0];
  assert.equal(planTotal(plan), 13500);
});

test("adding a patient: listed, and needs a name and a 10-digit phone", async () => {
  const p = await addPatient(C, { name: "Kabir Rao", phone: "98450 77777", dob: "1990-04-02", sex: "M" });
  assert.equal((await listPatients(C, { q: "kabir" }))[0]?.id, p.id);
  await assert.rejects(addPatient(C, { name: " ", phone: "9845077777", dob: "1990-04-02", sex: "M" }));
  await assert.rejects(addPatient(C, { name: "X", phone: "123", dob: "1990-04-02", sex: "M" }));
});

test("adding a note: signed, newest first, and needs text", async () => {
  const n = await addNote(C, "p-arjun", { text: "Patient reports less pain.", by: "Dr. Rao" });
  assert.equal(n.signed, true);
  assert.equal((await getPatient(C, "p-arjun"))!.notes[0].id, n.id);
  await assert.rejects(addNote(C, "p-arjun", { text: "   ", by: "Dr. Rao" }));
  await assert.rejects(addNote(C, "nope", { text: "x", by: "Dr. Rao" }));
});

test("no balances: patients carry no dues, and Arjun's bills are each paid in full", async () => {
  for (const p of await listPatients(C)) assert.ok(!("balanceInr" in p) && !p.flags.includes("balance" as never), p.name);
  const a = (await getPatient(C, "p-arjun"))!;
  assert.ok(a.payments.length >= 2 && a.payments.every((x) => x.amountInr > 0));
  assert.ok(!a.timeline.some((e) => /due|balance|part/i.test(e.title + e.detail)));
});
