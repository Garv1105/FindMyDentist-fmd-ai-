import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCompany, checkStudent, getAccountType, saveCompany, saveStudent, setAccountType } from "./onboarding.ts";

const student = { college: "Government Dental College, Bengaluru", course: "BDS", year: "3rd year", id_doc: null };
const company = { name: "BrightSmile Supplies", contact_name: "Ravi Kumar", gstin: null, website: null };

test("student rules", () => {
  assert.equal(checkStudent(student), null);
  assert.match(checkStudent({ ...student, college: " " })!, /college/);
  assert.match(checkStudent({ ...student, course: "MBBS" })!, /course/);
  assert.match(checkStudent({ ...student, year: "9th year" })!, /year/);
});

test("company rules: GSTIN and website are optional but checked", () => {
  assert.equal(checkCompany(company), null);
  assert.equal(checkCompany({ ...company, gstin: "29ABCDE1234F1Z5", website: "https://brightsmile.in" }), null);
  assert.match(checkCompany({ ...company, gstin: "29ABCDE1234" })!, /GSTIN/);
  assert.match(checkCompany({ ...company, website: "brightsmile" })!, /full address/);
  assert.match(checkCompany({ ...company, contact_name: "" })!, /contact/);
});

test("saving: student ID file is checked, company GSTIN is upper-cased", async () => {
  await assert.rejects(saveStudent("u1", student, { name: "id.gif", type: "image/gif", size: 10 }), /PDF, JPG or PNG/);
  const s = await saveStudent("u1", student, { name: "id.pdf", type: "application/pdf", size: 10 });
  assert.equal(s.id_doc?.name, "id.pdf");
  assert.equal((await saveCompany("u1", { ...company, gstin: " 29abcde1234f1z5 " })).gstin, "29ABCDE1234F1Z5");
});

test("account type is per user", async () => {
  assert.equal(await getAccountType("u2"), null);
  await setAccountType("u2", "student");
  assert.equal(await getAccountType("u2"), "student");
});
