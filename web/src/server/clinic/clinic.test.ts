import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "../db.ts";
import { type Auth } from "../auth.ts";
import { apiClinic, apiRole, joinClinic, leaveClinic, testClinic, testUser } from "../testing.ts";
import { availability, cancelBooking, myBookings, requestBooking } from "../booking.ts";
import { seedDemoDirectory } from "../seed.ts";
import type { HttpError } from "../http.ts";
import { activateWorkspace, createWorkspace, members, requireClinic, updateSettings, workspace } from "./workspace.ts";
import { calendar, confirmFmdRequest, createAppointment, istDayStart, publishAvailability, rescheduleAppointment, setAppointmentStatus } from "./calendar.ts";
import { addChartEntry, amendNote, chart, createNote, createPatient, createPlan, mergePatients, notes, patientDetail, setPlanStatus, signNote, updateDraft } from "./patients.ts";
import { collectionSheet, createInvoice, issueInvoice, recordPayment, recordRefund, voidInvoice } from "./billing.ts";
import { addItem, dashboard, draftPurchaseOrder, inventory, moveStock, report, updatePurchaseOrder } from "./operations.ts";

process.env.FMD_DB = ":memory:";
beforeEach(async () => {
  await resetDb();
  await seedDemoDirectory();
});

let n = 0;
async function user(email: string, accountType = "patient", fmdRole?: "fmd_ops"): Promise<Auth> {
  return await testUser(email, { name: `User ${email.split("@")[0]}`, accountType, roles: fmdRole ? [fmdRole] : [] });
}
const status = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return (e as HttpError).status;
  }
  return 200;
};
const key = () => `key-${++n}-xxxxxxxx`;
/** Next Monday 11:00 IST, safely in the future and within default hours (Mon–Sat 10–18). */
function nextMonday(hour = 11) {
  let d = istDayStart(Date.now()) + 86400_000;
  while (new Date(d + 5.5 * 3600_000).getUTCDay() !== 1) d += 86400_000;
  return d + hour * 3600_000;
}

const API = new Map<string, string>(); // workspace → its FastAPI clinic

/** Owner with a new clinic (created in FastAPI, set up here), plus a linked dentist profile so providers exist. */
async function setup() {
  const { owner, clinicId, api } = await testClinic(createWorkspace, await user("owner@clinic.test", "dentist"));
  API.set(clinicId, api);
  const dentistId = (await one<{ id: string }>("SELECT id FROM dentists WHERE name = 'Dr. Venkat Rao'"))!.id;
  await run("INSERT INTO dentist_clinics (dentist_id, clinic_id, fee_note) VALUES (?, ?, '₹500')", dentistId, clinicId);
  const s = (await one<{ id: string }>("SELECT id FROM appointment_types WHERE clinic_id = ? AND name = 'Consultation'", clinicId))!.id;
  const chair = (await one<{ id: string }>("SELECT id FROM chairs WHERE clinic_id = ?", clinicId))!.id;
  return { owner, clinicId, dentistId, typeId: s, chairId: chair };
}
/** Staff who accepted the owner's invitation in FastAPI, as this app sees them after their next sign-in. */
async function staff(clinicId: string, _owner: Auth, email: string, role: string) {
  return await joinClinic(await user(email), API.get(clinicId)!, apiRole(role));
}

test("workspace: only the FastAPI clinic's owner sets it up, once; defaults; roles come from FastAPI; tenant isolation", async () => {
  const notOwner = await user("p@example.com");
  assert.equal(await status(async () => await createWorkspace(notOwner, { apiClinicId: apiClinic(), name: "X Clinic", city: "Bengaluru", area: "Yelahanka" })), 403);
  const { owner, clinicId } = await setup();
  assert.equal(await status(async () => await createWorkspace(owner, { apiClinicId: API.get(clinicId), name: "Again", city: "Bengaluru", area: "Hebbal" })), 409);
  const w = await workspace(owner, clinicId);
  assert.equal(w.status, "setup");
  assert.equal(w.apiClinicId, API.get(clinicId));
  assert.ok(w.permissions.includes("staff.manage"));

  // staff join in FastAPI; their role (receptionist = front desk) arrives with their next sign-in
  const desk = await staff(clinicId, owner, "desk@clinic.test", "front_desk");
  assert.deepEqual((await workspace(desk, clinicId)).roles, ["front_desk"]);
  assert.equal((await members(owner, clinicId)).members.length, 2);
  // removed in FastAPI: access ends here on the next sync
  await leaveClinic(desk, API.get(clinicId)!);
  assert.equal(await status(async () => await workspace(desk, clinicId)), 404);

  // another clinic's owner sees nothing of this clinic
  const other = (await testClinic(createWorkspace, await user("other@clinic.test", "dentist"), "Other Clinic", "Banashankari")).owner;
  assert.equal(await status(async () => await workspace(other, clinicId)), 404);
  assert.equal(await status(async () => await requireClinic(await user("stranger@example.com"), clinicId, "patients.read")), 404);
});

test("permission matrix: finance sees billing not clinical; front desk can't write notes or refund", async () => {
  const { owner, clinicId } = await setup();
  const fin = await staff(clinicId, owner, "fin@clinic.test", "finance");
  const desk = await staff(clinicId, owner, "desk@clinic.test", "front_desk");
  const { created: pid } = await createPatient(owner, clinicId, { fullName: "Ravi Kumar", phone: "9876500001" });
  const noteId = await createNote(owner, clinicId, pid!, { complaint: "Sensitivity UL6" });
  assert.equal(await status(async () => await notes(fin, clinicId, pid!)), 403);
  assert.equal((await patientDetail(fin, clinicId, pid!)).medicalAlerts, undefined);
  assert.equal((await patientDetail(fin, clinicId, pid!)).timeline.some((t) => t.kind === "note"), false);
  assert.equal(await status(async () => await signNote(desk, clinicId, noteId)), 403);
  const inv = await issueInvoice(owner, clinicId, (await createInvoice(desk, clinicId, { patientId: pid, items: [{ description: "Consultation", qty: 1, unitInr: 500 }] })).id);
  await recordPayment(desk, clinicId, inv.id, { amountInr: 500, mode: "upi", idempotencyKey: key() });
  assert.equal(await status(async () => await recordRefund(desk, clinicId, inv.id, { amountInr: 100, mode: "upi", reason: "goodwill", idempotencyKey: key() })), 403);
  assert.equal((await recordRefund(fin, clinicId, inv.id, { amountInr: 100, mode: "upi", reason: "Goodwill gesture", idempotencyKey: key() })).paidInr, 400);
  assert.ok(await one("SELECT 1 FROM audit_events WHERE action = 'clinic.access_denied'"));
});

test("calendar: working hours, buffers, chair/provider conflicts, legal transitions", async () => {
  const { owner, clinicId, dentistId, typeId, chairId } = await setup();
  const { created: pid } = await createPatient(owner, clinicId, { fullName: "Asha", phone: "9876500002" });
  const t = nextMonday(11);
  assert.equal(await status(async () => await createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, startsAt: nextMonday(20), chairId })), 409); // after hours
  const id = await createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, providerId: dentistId, chairId, startsAt: t });
  // consultation is 20 min + 5 min buffer → 11:20 clashes, 11:25 is fine
  assert.equal(await status(async () => await createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, chairId, startsAt: t + 20 * 60_000 })), 409);
  await createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, chairId, startsAt: t + 25 * 60_000 });
  assert.equal(await status(async () => await createAppointment(owner, clinicId, { kind: "block", providerId: dentistId, startsAt: t, endsAt: t + 3600_000 })), 409);
  assert.equal(await status(async () => await setAppointmentStatus(owner, clinicId, id, "completed")), 409); // must check in first
  await setAppointmentStatus(owner, clinicId, id, "checked_in");
  await setAppointmentStatus(owner, clinicId, id, "completed");
  assert.ok((await one<{ last_visit_at: number }>("SELECT last_visit_at FROM clinic_patients WHERE id = ?", pid!))!.last_visit_at);
  assert.equal(await status(async () => await rescheduleAppointment(owner, clinicId, id, t + 86400_000)), 409); // completed can't move
  assert.equal((await calendar(owner, clinicId, t, 1)).appointments.length, 2);
});

test("FMD booking flow: publish needs activation; patient books; clinic confirms; patient cancels → calendar updates", async () => {
  const { owner, clinicId, dentistId, typeId } = await setup();
  assert.equal(await status(async () => await publishAvailability(owner, clinicId, 7)), 409); // setup workspace can't publish
  const ops = await user("ops@fmd.test", "patient", "fmd_ops");
  assert.equal(await status(async () => await activateWorkspace(owner, clinicId, "self activation")), 403);
  await activateWorkspace(ops, clinicId, "Registration checked + Clinic OS subscription CO-123");
  assert.ok((await publishAvailability(owner, clinicId, 7)).slots > 0);
  const av = await availability(dentistId, Date.now(), clinicId);
  assert.equal(av.live, true);
  assert.equal(av.scheduleSource, "clinic_os");

  const patient = await user("pat@example.com");
  const slot = av.slots.find((s) => s.startsAt === nextMonday(11)) ?? av.slots[0];
  const b = await requestBooking(patient, { dentistId, clinicId, slotId: slot.id, confirmed: true, idempotencyKey: key() });
  assert.equal((await calendar(owner, clinicId, slot.startsAt, 1)).fmdRequests.length, 1);
  // the requested time is held: staff can't double-book the provider over it
  const { created: walkIn } = await createPatient(owner, clinicId, { fullName: "Walk In", phone: "9876500009" });
  assert.equal(await status(async () => await createAppointment(owner, clinicId, { kind: "visit", patientId: walkIn, typeId, providerId: dentistId, startsAt: slot.startsAt })), 409);

  const desk = await staff(clinicId, owner, "desk@clinic.test", "front_desk");
  const { appointmentId, patientId } = await confirmFmdRequest(desk, clinicId, b.id, { typeId });
  assert.equal((await myBookings(patient))[0].statusLabel, "Confirmed by clinic");
  assert.ok(await one("SELECT 1 FROM clinic_patients WHERE id = ? AND user_id = ?", patientId, patient.user.id)); // linked to FMD user
  assert.equal(await status(async () => await confirmFmdRequest(desk, clinicId, b.id, { typeId })), 409);

  await cancelBooking(patient, b.id, "Travelling");
  assert.equal((await one<{ status: string }>("SELECT status FROM appointments WHERE id = ?", appointmentId))!.status, "cancelled");
});

test("patients: duplicate detection, merge keeps history", async () => {
  const { owner, clinicId, typeId, chairId } = await setup();
  const a = await createPatient(owner, clinicId, { fullName: "Meera Nair", phone: "98765 11111", dob: "1990-04-01" });
  const dup = await createPatient(owner, clinicId, { fullName: "Meera N", phone: "+91 9876511111" });
  assert.equal(dup.created, null);
  assert.equal(dup.duplicateCandidates.length, 1);
  const b = await createPatient(owner, clinicId, { fullName: "Meera N", phone: "+91 9876511111", confirmNotDuplicate: true });
  await createAppointment(owner, clinicId, { kind: "visit", patientId: b.created, typeId, chairId, startsAt: nextMonday(12) });
  await mergePatients(owner, clinicId, a.created!, b.created!);
  assert.equal((await patientDetail(owner, clinicId, a.created!)).timeline.filter((t) => t.kind === "appointment").length, 1);
  assert.equal(await status(async () => await patientDetail(owner, clinicId, b.created!)), 409);
});

test("clinical notes: drafts editable, signed locked, amendments versioned, AI drafts need explicit acceptance", async () => {
  const { owner, clinicId } = await setup();
  const { created: pid } = await createPatient(owner, clinicId, { fullName: "Kiran", phone: "9876500003" });
  const id = await createNote(owner, clinicId, pid!, { complaint: "Pain lower left", findings: "Deep caries 36" });
  await updateDraft(owner, clinicId, id, { diagnosis: "Irreversible pulpitis 36" });
  await signNote(owner, clinicId, id);
  assert.equal(await status(async () => await updateDraft(owner, clinicId, id, { diagnosis: "changed" })), 409);
  assert.equal(await status(async () => await amendNote(owner, clinicId, id, { diagnosis: "x", reason: "no" })), 400);
  const v2 = await amendNote(owner, clinicId, id, { diagnosis: "Symptomatic irreversible pulpitis 36", reason: "Corrected terminology" });
  await signNote(owner, clinicId, v2);
  const all = await notes(owner, clinicId, pid!);
  assert.deepEqual(all.map((x) => [x.version, x.status]), [[1, "superseded"], [2, "signed"]]);
  assert.equal(all[0].diagnosis, "Irreversible pulpitis 36"); // original preserved

  const ai = await createNote(owner, clinicId, pid!, { complaint: "Follow-up" }, { aiDrafted: true });
  assert.equal(await status(async () => await signNote(owner, clinicId, ai)), 400);
  await signNote(owner, clinicId, ai, { acceptAiDraft: true });
});

test("odontogram is append-only; plans total correctly and record acknowledgement", async () => {
  const { owner, clinicId } = await setup();
  const { created: pid } = await createPatient(owner, clinicId, { fullName: "Dev", phone: "9876500004" });
  assert.equal(await status(async () => await addChartEntry(owner, clinicId, pid!, { tooth: 19, finding: "x" })), 400);
  await addChartEntry(owner, clinicId, pid!, { tooth: 36, surfaces: "mo", finding: "Caries" });
  const c = await addChartEntry(owner, clinicId, pid!, { tooth: 36, surfaces: "MO", finding: "Composite restoration" });
  assert.equal(c.current.find((e) => e.tooth === 36)!.finding, "Composite restoration");
  assert.equal((await chart(owner, clinicId, pid!)).history.length, 2);

  const p = await createPlan(owner, clinicId, pid!, { title: "RCT 36", items: [{ procedure: "Root canal", tooth: "36", qty: 1, unitInr: 6000, discountInr: 500 }, { procedure: "Crown", tooth: "36", qty: 1, unitInr: 8000 }] });
  assert.equal(p.totalInr, 13500);
  assert.equal(await status(async () => await setPlanStatus(owner, clinicId, p.id, "accepted", "ok fine")), 409); // must be proposed first
  await setPlanStatus(owner, clinicId, p.id, "proposed");
  assert.equal(await status(async () => await setPlanStatus(owner, clinicId, p.id, "accepted", "")), 400);
  assert.equal((await setPlanStatus(owner, clinicId, p.id, "accepted", "Patient agreed in person; copy given")).status, "accepted");
  const inv = await createInvoice(owner, clinicId, { patientId: pid, planId: p.id });
  assert.equal(inv.totalInr, 13500);
});

test("billing: sequential numbers, no overpayment, idempotent payments, void requires refund first, collection sheet", async () => {
  const { owner, clinicId } = await setup();
  const { created: pid } = await createPatient(owner, clinicId, { fullName: "Lata", phone: "9876500005" });
  const d1 = await createInvoice(owner, clinicId, { patientId: pid, items: [{ description: "Scaling", qty: 1, unitInr: 1200 }] });
  assert.equal(await status(async () => await recordPayment(owner, clinicId, d1.id, { amountInr: 100, mode: "cash", idempotencyKey: key() })), 409); // draft
  const i1 = await issueInvoice(owner, clinicId, d1.id);
  const i2 = await issueInvoice(owner, clinicId, (await createInvoice(owner, clinicId, { patientId: pid, items: [{ description: "X-ray", qty: 2, unitInr: 300 }] })).id);
  assert.match(i1.number, /^INV-\d{4}-0001$/);
  assert.match(i2.number, /^INV-\d{4}-0002$/);
  assert.equal(await status(async () => await recordPayment(owner, clinicId, i1.id, { amountInr: 5000, mode: "cash", idempotencyKey: key() })), 409);
  const k = key();
  await recordPayment(owner, clinicId, i1.id, { amountInr: 700, mode: "upi", reference: "UPI123", idempotencyKey: k });
  const again = await recordPayment(owner, clinicId, i1.id, { amountInr: 700, mode: "upi", idempotencyKey: k });
  assert.equal(again.paidInr, 700);
  assert.equal(again.status, "partially_paid");
  assert.equal(await status(async () => await voidInvoice(owner, clinicId, i1.id, "Entered twice")), 409);
  await recordRefund(owner, clinicId, i1.id, { amountInr: 700, mode: "upi", reason: "Entered twice", idempotencyKey: key() });
  assert.equal((await voidInvoice(owner, clinicId, i1.id, "Entered twice")).status, "void");
  const sheet = await collectionSheet(owner, clinicId, Date.now());
  assert.equal(sheet.collectedInr, 700);
  assert.equal(sheet.refundedInr, 700);
  assert.equal(sheet.outstandingInr, 600); // i2 unpaid
});

test("inventory: no negative stock, expiry needs batch, PO approval by owner only, receiving adds stock", async () => {
  const { owner, clinicId } = await setup();
  const asst = await staff(clinicId, owner, "asst@clinic.test", "assistant");
  const gloves = await addItem(asst, clinicId, { name: "Nitrile gloves", unit: "box", reorderLevel: 5 });
  const lido = await addItem(asst, clinicId, { name: "Lignocaine 2%", unit: "cartridge", reorderLevel: 20, tracksExpiry: true });
  assert.equal(await status(async () => await moveStock(asst, clinicId, gloves, { reason: "used", qty: 1 })), 409);
  assert.equal(await status(async () => await moveStock(asst, clinicId, lido, { reason: "received", qty: 50 })), 400);
  const soon = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  await moveStock(asst, clinicId, lido, { reason: "received", qty: 50, batch: "LG-22", expiresOn: soon });
  await moveStock(asst, clinicId, gloves, { reason: "received", qty: 3 });
  const inv = await inventory(asst, clinicId);
  assert.equal(inv.alerts.low.map((x) => x.name).join(), "Nitrile gloves");
  assert.equal(inv.alerts.expiring[0].batch, "LG-22");
  const po = await draftPurchaseOrder(asst, clinicId, { lines: [{ itemId: gloves, qty: 10 }] });
  assert.equal(await status(async () => await updatePurchaseOrder(asst, clinicId, po, "approved")), 403);
  await updatePurchaseOrder(owner, clinicId, po, "approved");
  await updatePurchaseOrder(asst, clinicId, po, "sent");
  await updatePurchaseOrder(asst, clinicId, po, "received");
  assert.equal((await inventory(asst, clinicId)).items.find((i) => i.id === gloves)!.stock, 13);
});

test("dashboard respects roles; report states definitions", async () => {
  const { owner, clinicId } = await setup();
  const desk = await staff(clinicId, owner, "desk@clinic.test", "front_desk");
  const asst = await staff(clinicId, owner, "asst@clinic.test", "assistant");
  assert.ok("collectionsTodayInr" in await dashboard(desk, clinicId));
  assert.ok(!("collectionsTodayInr" in await dashboard(asst, clinicId)));
  assert.ok(!("incompleteNotes" in await dashboard(desk, clinicId)));
  assert.equal(await status(async () => await report(desk, clinicId, Date.now() - 7 * 86400_000, Date.now())), 403);
  const r = await report(owner, clinicId, Date.now() - 7 * 86400_000, Date.now());
  assert.ok(r.definitions.utilisationPct.length > 10);
  await updateSettings(owner, clinicId, { hours: [{ weekday: 1, opens: "09:00", closes: "13:00" }] });
  assert.equal(await status(async () => await updateSettings(owner, clinicId, { hours: [{ weekday: 1, opens: "14:00", closes: "13:00" }] })), 400);
});
