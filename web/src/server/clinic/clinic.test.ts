import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { one, resetDb, run } from "../db.ts";
import { grantRole, register, requestOtp, requireAuth, SESSION_COOKIE, verifyOtp, type Auth } from "../auth.ts";
import { availability, cancelBooking, myBookings, requestBooking } from "../booking.ts";
import { seedDemoDirectory } from "../seed.ts";
import type { HttpError } from "../http.ts";
import { acceptInvite, activateWorkspace, createWorkspace, invite, members, requireClinic, setMemberRoles, updateSettings, workspace } from "./workspace.ts";
import { calendar, confirmFmdRequest, createAppointment, istDayStart, publishAvailability, rescheduleAppointment, setAppointmentStatus } from "./calendar.ts";
import { addChartEntry, amendNote, chart, createNote, createPatient, createPlan, mergePatients, notes, patientDetail, setPlanStatus, signNote, updateDraft } from "./patients.ts";
import { collectionSheet, createInvoice, issueInvoice, recordPayment, recordRefund, voidInvoice } from "./billing.ts";
import { addItem, dashboard, draftPurchaseOrder, inventory, moveStock, report, updatePurchaseOrder } from "./operations.ts";

process.env.FMD_DB = ":memory:";
beforeEach(() => {
  resetDb();
  seedDemoDirectory();
});

let n = 0;
function user(email: string, accountType = "patient", fmdRole?: "fmd_ops"): Auth {
  const v = verifyOtp(email, requestOtp(email).devCode!);
  assert.ok(v.ok && "ticket" in v);
  const { token } = register({ ticket: v.ticket, name: `User ${email.split("@")[0]}`, accountType, consents: { terms: true, privacy: true } });
  const auth = () => requireAuth(new Request("http://x/", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }));
  if (fmdRole) grantRole(auth().user.id, fmdRole, null);
  return auth();
}
const refresh = (a: Auth) => ({ ...a, roles: a.roles }); // roles for clinic checks are read from the DB each call
const status = (fn: () => unknown) => {
  try {
    fn();
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

/** Owner with a new clinic, plus a linked dentist profile so providers exist. */
function setup() {
  const owner = user("owner@clinic.test", "dentist");
  const { clinicId } = createWorkspace(owner, { name: "Smile Care", city: "Bengaluru", area: "Hebbal" });
  const dentistId = one<{ id: string }>("SELECT id FROM dentists WHERE name = 'Dr. Venkat Rao'")!.id;
  run("INSERT INTO dentist_clinics (dentist_id, clinic_id, fee_note) VALUES (?, ?, '₹500')", dentistId, clinicId);
  const s = one<{ id: string }>("SELECT id FROM appointment_types WHERE clinic_id = ? AND name = 'Consultation'", clinicId)!.id;
  const chair = one<{ id: string }>("SELECT id FROM chairs WHERE clinic_id = ?", clinicId)!.id;
  return { owner, clinicId, dentistId, typeId: s, chairId: chair };
}
function staff(clinicId: string, owner: Auth, email: string, role: string) {
  const u = user(email);
  const { link } = invite(owner, clinicId, { email, role });
  acceptInvite(u, link.split("token=")[1]);
  return refresh(u);
}

test("workspace: dentist-only creation, defaults, email-bound invites, last-owner protection, tenant isolation", () => {
  assert.equal(status(() => createWorkspace(user("p@example.com"), { name: "X Clinic", city: "Bengaluru", area: "Yelahanka" })), 403);
  const { owner, clinicId } = setup();
  const w = workspace(owner, clinicId);
  assert.equal(w.status, "setup");
  assert.ok(w.permissions.includes("staff.manage"));

  const { link } = invite(owner, clinicId, { email: "desk@clinic.test", role: "front_desk" });
  const stranger = user("stranger@example.com");
  assert.equal(status(() => acceptInvite(stranger, link.split("token=")[1])), 403); // wrong email
  const desk = user("desk@clinic.test");
  acceptInvite(desk, link.split("token=")[1]);
  assert.equal(status(() => acceptInvite(desk, link.split("token=")[1])), 410); // single use
  assert.equal(members(owner, clinicId).members.length, 2);
  assert.equal(status(() => setMemberRoles(owner, clinicId, owner.user.id, ["dentist"])), 409);

  // another clinic's owner sees nothing of this clinic
  const other = user("other@clinic.test", "dentist");
  createWorkspace(other, { name: "Other Clinic", city: "Bengaluru", area: "Banashankari" });
  assert.equal(status(() => workspace(other, clinicId)), 404);
  assert.equal(status(() => requireClinic(stranger, clinicId, "patients.read")), 404);
});

test("permission matrix: finance sees billing not clinical; front desk can't write notes or refund", () => {
  const { owner, clinicId } = setup();
  const fin = staff(clinicId, owner, "fin@clinic.test", "finance");
  const desk = staff(clinicId, owner, "desk@clinic.test", "front_desk");
  const { created: pid } = createPatient(owner, clinicId, { fullName: "Ravi Kumar", phone: "9876500001" });
  const noteId = createNote(owner, clinicId, pid!, { complaint: "Sensitivity UL6" });
  assert.equal(status(() => notes(fin, clinicId, pid!)), 403);
  assert.equal(patientDetail(fin, clinicId, pid!).medicalAlerts, undefined);
  assert.equal(patientDetail(fin, clinicId, pid!).timeline.some((t) => t.kind === "note"), false);
  assert.equal(status(() => signNote(desk, clinicId, noteId)), 403);
  const inv = issueInvoice(owner, clinicId, createInvoice(desk, clinicId, { patientId: pid, items: [{ description: "Consultation", qty: 1, unitInr: 500 }] }).id);
  recordPayment(desk, clinicId, inv.id, { amountInr: 500, mode: "upi", idempotencyKey: key() });
  assert.equal(status(() => recordRefund(desk, clinicId, inv.id, { amountInr: 100, mode: "upi", reason: "goodwill", idempotencyKey: key() })), 403);
  assert.equal(recordRefund(fin, clinicId, inv.id, { amountInr: 100, mode: "upi", reason: "Goodwill gesture", idempotencyKey: key() }).paidInr, 400);
  assert.ok(one("SELECT 1 FROM audit_events WHERE action = 'clinic.access_denied'"));
});

test("calendar: working hours, buffers, chair/provider conflicts, legal transitions", () => {
  const { owner, clinicId, dentistId, typeId, chairId } = setup();
  const { created: pid } = createPatient(owner, clinicId, { fullName: "Asha", phone: "9876500002" });
  const t = nextMonday(11);
  assert.equal(status(() => createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, startsAt: nextMonday(20), chairId })), 409); // after hours
  const id = createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, providerId: dentistId, chairId, startsAt: t });
  // consultation is 20 min + 5 min buffer → 11:20 clashes, 11:25 is fine
  assert.equal(status(() => createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, chairId, startsAt: t + 20 * 60_000 })), 409);
  createAppointment(owner, clinicId, { kind: "visit", patientId: pid, typeId, chairId, startsAt: t + 25 * 60_000 });
  assert.equal(status(() => createAppointment(owner, clinicId, { kind: "block", providerId: dentistId, startsAt: t, endsAt: t + 3600_000 })), 409);
  assert.equal(status(() => setAppointmentStatus(owner, clinicId, id, "completed")), 409); // must check in first
  setAppointmentStatus(owner, clinicId, id, "checked_in");
  setAppointmentStatus(owner, clinicId, id, "completed");
  assert.ok(one<{ last_visit_at: number }>("SELECT last_visit_at FROM clinic_patients WHERE id = ?", pid!)!.last_visit_at);
  assert.equal(status(() => rescheduleAppointment(owner, clinicId, id, t + 86400_000)), 409); // completed can't move
  assert.equal(calendar(owner, clinicId, t, 1).appointments.length, 2);
});

test("FMD booking flow: publish needs activation; patient books; clinic confirms; patient cancels → calendar updates", () => {
  const { owner, clinicId, dentistId, typeId } = setup();
  assert.equal(status(() => publishAvailability(owner, clinicId, 7)), 409); // setup workspace can't publish
  const ops = user("ops@fmd.test", "patient", "fmd_ops");
  assert.equal(status(() => activateWorkspace(owner, clinicId, "self activation")), 403);
  activateWorkspace(ops, clinicId, "Registration checked + Clinic OS subscription CO-123");
  assert.ok(publishAvailability(owner, clinicId, 7).slots > 0);
  const av = availability(dentistId, Date.now(), clinicId);
  assert.equal(av.live, true);
  assert.equal(av.scheduleSource, "clinic_os");

  const patient = user("pat@example.com");
  const slot = av.slots.find((s) => s.startsAt === nextMonday(11)) ?? av.slots[0];
  const b = requestBooking(patient, { dentistId, clinicId, slotId: slot.id, confirmed: true, idempotencyKey: key() });
  assert.equal(calendar(owner, clinicId, slot.startsAt, 1).fmdRequests.length, 1);
  // the requested time is held: staff can't double-book the provider over it
  const { created: walkIn } = createPatient(owner, clinicId, { fullName: "Walk In", phone: "9876500009" });
  assert.equal(status(() => createAppointment(owner, clinicId, { kind: "visit", patientId: walkIn, typeId, providerId: dentistId, startsAt: slot.startsAt })), 409);

  const desk = staff(clinicId, owner, "desk@clinic.test", "front_desk");
  const { appointmentId, patientId } = confirmFmdRequest(desk, clinicId, b.id, { typeId });
  assert.equal(myBookings(patient)[0].statusLabel, "Confirmed by clinic");
  assert.ok(one("SELECT 1 FROM clinic_patients WHERE id = ? AND user_id = ?", patientId, patient.user.id)); // linked to FMD user
  assert.equal(status(() => confirmFmdRequest(desk, clinicId, b.id, { typeId })), 409);

  cancelBooking(patient, b.id, "Travelling");
  assert.equal(one<{ status: string }>("SELECT status FROM appointments WHERE id = ?", appointmentId)!.status, "cancelled");
});

test("patients: duplicate detection, merge keeps history", () => {
  const { owner, clinicId, typeId, chairId } = setup();
  const a = createPatient(owner, clinicId, { fullName: "Meera Nair", phone: "98765 11111", dob: "1990-04-01" });
  const dup = createPatient(owner, clinicId, { fullName: "Meera N", phone: "+91 9876511111" });
  assert.equal(dup.created, null);
  assert.equal(dup.duplicateCandidates.length, 1);
  const b = createPatient(owner, clinicId, { fullName: "Meera N", phone: "+91 9876511111", confirmNotDuplicate: true });
  createAppointment(owner, clinicId, { kind: "visit", patientId: b.created, typeId, chairId, startsAt: nextMonday(12) });
  mergePatients(owner, clinicId, a.created!, b.created!);
  assert.equal(patientDetail(owner, clinicId, a.created!).timeline.filter((t) => t.kind === "appointment").length, 1);
  assert.equal(status(() => patientDetail(owner, clinicId, b.created!)), 409);
});

test("clinical notes: drafts editable, signed locked, amendments versioned, AI drafts need explicit acceptance", () => {
  const { owner, clinicId } = setup();
  const { created: pid } = createPatient(owner, clinicId, { fullName: "Kiran", phone: "9876500003" });
  const id = createNote(owner, clinicId, pid!, { complaint: "Pain lower left", findings: "Deep caries 36" });
  updateDraft(owner, clinicId, id, { diagnosis: "Irreversible pulpitis 36" });
  signNote(owner, clinicId, id);
  assert.equal(status(() => updateDraft(owner, clinicId, id, { diagnosis: "changed" })), 409);
  assert.equal(status(() => amendNote(owner, clinicId, id, { diagnosis: "x", reason: "no" })), 400);
  const v2 = amendNote(owner, clinicId, id, { diagnosis: "Symptomatic irreversible pulpitis 36", reason: "Corrected terminology" });
  signNote(owner, clinicId, v2);
  const all = notes(owner, clinicId, pid!);
  assert.deepEqual(all.map((x) => [x.version, x.status]), [[1, "superseded"], [2, "signed"]]);
  assert.equal(all[0].diagnosis, "Irreversible pulpitis 36"); // original preserved

  const ai = createNote(owner, clinicId, pid!, { complaint: "Follow-up" }, { aiDrafted: true });
  assert.equal(status(() => signNote(owner, clinicId, ai)), 400);
  signNote(owner, clinicId, ai, { acceptAiDraft: true });
});

test("odontogram is append-only; plans total correctly and record acknowledgement", () => {
  const { owner, clinicId } = setup();
  const { created: pid } = createPatient(owner, clinicId, { fullName: "Dev", phone: "9876500004" });
  assert.equal(status(() => addChartEntry(owner, clinicId, pid!, { tooth: 19, finding: "x" })), 400);
  addChartEntry(owner, clinicId, pid!, { tooth: 36, surfaces: "mo", finding: "Caries" });
  const c = addChartEntry(owner, clinicId, pid!, { tooth: 36, surfaces: "MO", finding: "Composite restoration" });
  assert.equal(c.current.find((e) => e.tooth === 36)!.finding, "Composite restoration");
  assert.equal(chart(owner, clinicId, pid!).history.length, 2);

  const p = createPlan(owner, clinicId, pid!, { title: "RCT 36", items: [{ procedure: "Root canal", tooth: "36", qty: 1, unitInr: 6000, discountInr: 500 }, { procedure: "Crown", tooth: "36", qty: 1, unitInr: 8000 }] });
  assert.equal(p.totalInr, 13500);
  assert.equal(status(() => setPlanStatus(owner, clinicId, p.id, "accepted", "ok fine")), 409); // must be proposed first
  setPlanStatus(owner, clinicId, p.id, "proposed");
  assert.equal(status(() => setPlanStatus(owner, clinicId, p.id, "accepted", "")), 400);
  assert.equal(setPlanStatus(owner, clinicId, p.id, "accepted", "Patient agreed in person; copy given").status, "accepted");
  const inv = createInvoice(owner, clinicId, { patientId: pid, planId: p.id });
  assert.equal(inv.totalInr, 13500);
});

test("billing: sequential numbers, no overpayment, idempotent payments, void requires refund first, collection sheet", () => {
  const { owner, clinicId } = setup();
  const { created: pid } = createPatient(owner, clinicId, { fullName: "Lata", phone: "9876500005" });
  const d1 = createInvoice(owner, clinicId, { patientId: pid, items: [{ description: "Scaling", qty: 1, unitInr: 1200 }] });
  assert.equal(status(() => recordPayment(owner, clinicId, d1.id, { amountInr: 100, mode: "cash", idempotencyKey: key() })), 409); // draft
  const i1 = issueInvoice(owner, clinicId, d1.id);
  const i2 = issueInvoice(owner, clinicId, createInvoice(owner, clinicId, { patientId: pid, items: [{ description: "X-ray", qty: 2, unitInr: 300 }] }).id);
  assert.match(i1.number, /^INV-\d{4}-0001$/);
  assert.match(i2.number, /^INV-\d{4}-0002$/);
  assert.equal(status(() => recordPayment(owner, clinicId, i1.id, { amountInr: 5000, mode: "cash", idempotencyKey: key() })), 409);
  const k = key();
  recordPayment(owner, clinicId, i1.id, { amountInr: 700, mode: "upi", reference: "UPI123", idempotencyKey: k });
  const again = recordPayment(owner, clinicId, i1.id, { amountInr: 700, mode: "upi", idempotencyKey: k });
  assert.equal(again.paidInr, 700);
  assert.equal(again.status, "partially_paid");
  assert.equal(status(() => voidInvoice(owner, clinicId, i1.id, "Entered twice")), 409);
  recordRefund(owner, clinicId, i1.id, { amountInr: 700, mode: "upi", reason: "Entered twice", idempotencyKey: key() });
  assert.equal(voidInvoice(owner, clinicId, i1.id, "Entered twice").status, "void");
  const sheet = collectionSheet(owner, clinicId, Date.now());
  assert.equal(sheet.collectedInr, 700);
  assert.equal(sheet.refundedInr, 700);
  assert.equal(sheet.outstandingInr, 600); // i2 unpaid
});

test("inventory: no negative stock, expiry needs batch, PO approval by owner only, receiving adds stock", () => {
  const { owner, clinicId } = setup();
  const asst = staff(clinicId, owner, "asst@clinic.test", "assistant");
  const gloves = addItem(asst, clinicId, { name: "Nitrile gloves", unit: "box", reorderLevel: 5 });
  const lido = addItem(asst, clinicId, { name: "Lignocaine 2%", unit: "cartridge", reorderLevel: 20, tracksExpiry: true });
  assert.equal(status(() => moveStock(asst, clinicId, gloves, { reason: "used", qty: 1 })), 409);
  assert.equal(status(() => moveStock(asst, clinicId, lido, { reason: "received", qty: 50 })), 400);
  const soon = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  moveStock(asst, clinicId, lido, { reason: "received", qty: 50, batch: "LG-22", expiresOn: soon });
  moveStock(asst, clinicId, gloves, { reason: "received", qty: 3 });
  const inv = inventory(asst, clinicId);
  assert.equal(inv.alerts.low.map((x) => x.name).join(), "Nitrile gloves");
  assert.equal(inv.alerts.expiring[0].batch, "LG-22");
  const po = draftPurchaseOrder(asst, clinicId, { lines: [{ itemId: gloves, qty: 10 }] });
  assert.equal(status(() => updatePurchaseOrder(asst, clinicId, po, "approved")), 403);
  updatePurchaseOrder(owner, clinicId, po, "approved");
  updatePurchaseOrder(asst, clinicId, po, "sent");
  updatePurchaseOrder(asst, clinicId, po, "received");
  assert.equal(inventory(asst, clinicId).items.find((i) => i.id === gloves)!.stock, 13);
});

test("dashboard respects roles; report states definitions", () => {
  const { owner, clinicId } = setup();
  const desk = staff(clinicId, owner, "desk@clinic.test", "front_desk");
  const asst = staff(clinicId, owner, "asst@clinic.test", "assistant");
  assert.ok("collectionsTodayInr" in dashboard(desk, clinicId));
  assert.ok(!("collectionsTodayInr" in dashboard(asst, clinicId)));
  assert.ok(!("incompleteNotes" in dashboard(desk, clinicId)));
  assert.equal(status(() => report(desk, clinicId, Date.now() - 7 * 86400_000, Date.now())), 403);
  const r = report(owner, clinicId, Date.now() - 7 * 86400_000, Date.now());
  assert.ok(r.definitions.utilisationPct.length > 10);
  updateSettings(owner, clinicId, { hours: [{ weekday: 1, opens: "09:00", closes: "13:00" }] });
  assert.equal(status(() => updateSettings(owner, clinicId, { hours: [{ weekday: 1, opens: "14:00", closes: "13:00" }] })), 400);
});
