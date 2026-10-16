import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb } from "./db.ts";
import type { HttpError } from "./http.ts";
import { submitLead } from "./leads.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => resetDb());

const status = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as HttpError).status; }
  return 200;
};
const count = () => one<{ n: number }>("SELECT COUNT(*) AS n FROM leads")!.n;
const clinic = { kind: "clinic_demo", name: "Dr. Asha Rao", clinicName: "Smile Studio", city: "Bengaluru", phone: "98450 12345", email: "Asha@Example.com", consent: true };

test("clinic requests need consent and the essential details, nothing more", () => {
  assert.equal(status(() => submitLead({ ...clinic, consent: false })), 400);
  assert.equal(status(() => submitLead({ ...clinic, phone: "123" })), 400);
  assert.equal(status(() => submitLead({ ...clinic, clinicName: "" })), 400);
  assert.equal(status(() => submitLead({ ...clinic, kind: "sell_my_data" })), 400);
  submitLead(clinic);
  const row = one<{ email: string; phone: string; kind: string }>("SELECT email, phone, kind FROM leads")!;
  assert.deepEqual({ ...row }, { email: "asha@example.com", phone: "+919845012345", kind: "clinic_demo" });
});

test("waitlist needs only an email; repeats and honeypot hits are acknowledged but not stored", () => {
  const w = { kind: "waitlist", email: "p@example.com", consent: true };
  assert.equal(status(() => submitLead({ ...w, email: "nope" })), 400);
  submitLead(w);
  submitLead(w);
  submitLead({ ...w, email: "bot@example.com", website: "http://spam" });
  assert.equal(count(), 1);
  // the same email may still ask for a different thing
  submitLead({ ...clinic, kind: "clinic_early_access", email: "p@example.com" });
  assert.equal(count(), 2);
});
