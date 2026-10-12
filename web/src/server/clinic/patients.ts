import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "../db.ts";
import type { Auth } from "../auth.ts";
import { bad, HttpError, notFound } from "../http.ts";
import { sniffMime, storage } from "../adapters/storage.ts";
import { can, requireClinic } from "./workspace.ts";

/* ---------------- patients ---------------- */

type Patient = {
  id: string;
  clinic_id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  medical_alerts: string;
  consent_treatment_at: number | null;
  consent_comms: number;
  last_visit_at: number | null;
  merged_into: string | null;
  is_demo: number;
  created_at: number;
};

const normPhone = (p: unknown) => {
  const d = typeof p === "string" ? p.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "") : "";
  if (!d) return "";
  if (!/^[6-9]\d{9}$/.test(d)) throw bad("Enter a valid 10-digit mobile number.");
  return `+91${d}`;
};

function ownPatient(clinicId: string, id: string) {
  const p = one<Patient>("SELECT * FROM clinic_patients WHERE id = ? AND clinic_id = ?", id, clinicId);
  if (!p) throw notFound("Patient not found.");
  if (p.merged_into) throw new HttpError(409, "merged", "This record was merged into another patient.");
  return p;
}

export function searchPatients(a: Auth, clinicId: string, q = "") {
  requireClinic(a, clinicId, "patients.read");
  const s = q.trim().toLowerCase().slice(0, 60);
  return all<Patient>(
    `SELECT * FROM clinic_patients WHERE clinic_id = ? AND merged_into IS NULL ${s ? "AND (lower(full_name) LIKE ? OR phone LIKE ? OR lower(email) LIKE ?)" : ""} ORDER BY full_name LIMIT 100`,
    clinicId,
    ...(s ? [`%${s}%`, `%${s.replace(/\D/g, "") || s}%`, `%${s}%`] : []),
  ).map((p) => ({ id: p.id, name: p.full_name, phone: p.phone, dob: p.dob, lastVisitAt: p.last_visit_at, linkedToFmd: !!p.user_id, demo: p.is_demo === 1 }));
}

/** Duplicate detection (CLN-10): same phone, or same name and date of birth. Staff must confirm to proceed. */
export function createPatient(a: Auth, clinicId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "patients.write");
  const name = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (name.length < 2 || name.length > 100) throw bad("Enter the patient's full name.");
  const phone = normPhone(input.phone);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 120) : "";
  const dob = typeof input.dob === "string" ? input.dob.trim() : "";
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || new Date(dob).getTime() > Date.now())) throw bad("Enter a valid date of birth.");
  if (input.confirmNotDuplicate !== true) {
    const dupes = all<Patient>(
      `SELECT * FROM clinic_patients WHERE clinic_id = ? AND merged_into IS NULL AND ((? != '' AND phone = ?) OR (lower(full_name) = lower(?) AND ? != '' AND dob = ?))`,
      clinicId, phone, phone, name, dob, dob,
    );
    if (dupes.length)
      return { duplicateCandidates: dupes.map((p) => ({ id: p.id, name: p.full_name, phone: p.phone, dob: p.dob })), created: null };
  }
  const id = randomUUID();
  const now = Date.now();
  run(
    `INSERT INTO clinic_patients (id, clinic_id, full_name, phone, email, dob, gender, medical_alerts, consent_treatment_at, consent_comms, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, clinicId, name, phone, email, dob, typeof input.gender === "string" ? input.gender.slice(0, 20) : "",
    typeof input.medicalAlerts === "string" ? input.medicalAlerts.trim().slice(0, 500) : "",
    input.consentTreatment === true ? now : null, input.consentComms === true ? 1 : 0, a.user.id, now, now,
  );
  audit(a.user.id, "patient.created", "clinic_patient", id);
  return { duplicateCandidates: [], created: id };
}

export function updatePatient(a: Auth, clinicId: string, id: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "patients.write");
  const p = ownPatient(clinicId, id);
  const name = typeof input.fullName === "string" ? input.fullName.trim() : p.full_name;
  if (name.length < 2) throw bad("Enter the patient's full name.");
  const phone = input.phone === undefined ? p.phone : normPhone(input.phone);
  const consentAt = input.consentTreatment === true ? (p.consent_treatment_at ?? Date.now()) : input.consentTreatment === false ? null : p.consent_treatment_at;
  run(
    "UPDATE clinic_patients SET full_name = ?, phone = ?, email = ?, dob = ?, gender = ?, medical_alerts = ?, consent_comms = ?, consent_treatment_at = ?, updated_at = ? WHERE id = ?",
    name,
    phone,
    typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 120) : p.email,
    typeof input.dob === "string" ? input.dob : p.dob,
    typeof input.gender === "string" ? input.gender.slice(0, 20) : p.gender,
    typeof input.medicalAlerts === "string" ? input.medicalAlerts.slice(0, 500) : p.medical_alerts,
    input.consentComms === undefined ? p.consent_comms : input.consentComms === true ? 1 : 0,
    consentAt,
    Date.now(),
    id,
  );
  audit(a.user.id, "patient.updated", "clinic_patient", id);
  return patientDetail(a, clinicId, id);
}

/** Merge a duplicate into the surviving record. History is moved, never deleted; the duplicate is tombstoned. */
export function mergePatients(a: Auth, clinicId: string, keepId: string, dupId: string) {
  requireClinic(a, clinicId, "staff.manage");
  if (keepId === dupId) throw bad("Choose two different records.");
  ownPatient(clinicId, keepId);
  ownPatient(clinicId, dupId);
  tx(() => {
    for (const t of ["appointments", "clinical_notes", "chart_entries", "treatment_plans", "patient_files", "invoices", "waitlist"])
      run(`UPDATE ${t} SET patient_id = ? WHERE patient_id = ? AND clinic_id = ?`, keepId, dupId, clinicId);
    run("UPDATE clinic_patients SET merged_into = ?, updated_at = ? WHERE id = ?", keepId, Date.now(), dupId);
    audit(a.user.id, "patient.merged", "clinic_patient", keepId, { merged: dupId });
  });
}

/**
 * Patient 360 with timeline. What each role sees follows the permission matrix:
 * finance gets billing but no clinical content; front desk gets schedule and billing but no notes.
 */
export function patientDetail(a: Auth, clinicId: string, id: string) {
  requireClinic(a, clinicId, "patients.read");
  const p = ownPatient(clinicId, id);
  const clinical = can(a, clinicId, "clinical.read");
  const billing = can(a, clinicId, "billing.read");
  if (clinical) audit(a.user.id, "patient.clinical_viewed", "clinic_patient", id);

  const timeline: { at: number; kind: string; title: string; detail: string; ref: string }[] = [];
  for (const ap of all<{ id: string; starts_at: number; status: string; type: string | null }>(
    "SELECT a.id, a.starts_at, a.status, t.name AS type FROM appointments a LEFT JOIN appointment_types t ON t.id = a.type_id WHERE a.patient_id = ? AND a.clinic_id = ?",
    id, clinicId,
  ))
    timeline.push({ at: ap.starts_at, kind: "appointment", title: ap.type ?? "Appointment", detail: ap.status, ref: ap.id });
  if (clinical) {
    for (const n of all<{ id: string; created_at: number; status: string; complaint: string; version: number }>(
      "SELECT id, created_at, status, complaint, version FROM clinical_notes WHERE patient_id = ? AND status != 'superseded'",
      id,
    ))
      timeline.push({ at: n.created_at, kind: "note", title: `Clinical note${n.version > 1 ? ` (amended v${n.version})` : ""}`, detail: n.status, ref: n.id });
    for (const t of all<{ id: string; created_at: number; title: string; status: string }>("SELECT id, created_at, title, status FROM treatment_plans WHERE patient_id = ?", id))
      timeline.push({ at: t.created_at, kind: "plan", title: t.title, detail: t.status, ref: t.id });
    for (const f of all<{ id: string; created_at: number; title: string }>("SELECT id, created_at, title FROM patient_files WHERE patient_id = ?", id))
      timeline.push({ at: f.created_at, kind: "file", title: f.title, detail: "attachment", ref: f.id });
  }
  if (billing)
    for (const i of all<{ id: string; created_at: number; number: string; status: string; total_paise: number }>("SELECT id, created_at, number, status, total_paise FROM invoices WHERE patient_id = ?", id))
      timeline.push({ at: i.created_at, kind: "invoice", title: `Invoice ${i.number}`, detail: `${i.status.replace("_", " ")} · ₹${(i.total_paise / 100).toLocaleString("en-IN")}`, ref: i.id });
  timeline.sort((x, y) => y.at - x.at);

  return {
    id: p.id,
    name: p.full_name,
    phone: p.phone,
    email: p.email,
    dob: p.dob,
    gender: p.gender,
    medicalAlerts: clinical ? p.medical_alerts : undefined,
    consentTreatmentAt: p.consent_treatment_at,
    consentComms: p.consent_comms === 1,
    linkedToFmd: !!p.user_id,
    lastVisitAt: p.last_visit_at,
    demo: p.is_demo === 1,
    timeline,
    access: { clinical, billing },
  };
}

/* ---------------- clinical notes (sign, then amend — never silently edit) ---------------- */

type Note = {
  id: string;
  clinic_id: string;
  patient_id: string;
  root_id: string;
  version: number;
  status: "draft" | "signed" | "superseded";
  complaint: string;
  findings: string;
  diagnosis: string;
  plan: string;
  amendment_reason: string;
  ai_drafted: number;
  author_id: string;
  signed_by: string | null;
  signed_at: number | null;
  created_at: number;
};
const FIELDS = ["complaint", "findings", "diagnosis", "plan"] as const;
const fieldsFrom = (input: Record<string, unknown>, base?: Note) =>
  Object.fromEntries(FIELDS.map((f) => [f, typeof input[f] === "string" ? (input[f] as string).trim().slice(0, 4000) : (base?.[f] ?? "")])) as Record<(typeof FIELDS)[number], string>;

export function createNote(a: Auth, clinicId: string, patientId: string, input: Record<string, unknown>, opts: { aiDrafted?: boolean } = {}) {
  requireClinic(a, clinicId, opts.aiDrafted ? "ai.use" : "clinical.write");
  ownPatient(clinicId, patientId);
  const f = fieldsFrom(input);
  if (!FIELDS.some((k) => f[k])) throw bad("Write at least one section of the note.");
  const id = randomUUID();
  run(
    `INSERT INTO clinical_notes (id, clinic_id, patient_id, appointment_id, root_id, version, status, complaint, findings, diagnosis, plan, ai_drafted, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    id, clinicId, patientId, typeof input.appointmentId === "string" ? input.appointmentId : null, id, f.complaint, f.findings, f.diagnosis, f.plan, opts.aiDrafted ? 1 : 0, a.user.id, Date.now(),
  );
  audit(a.user.id, opts.aiDrafted ? "note.ai_drafted" : "note.drafted", "clinical_note", id);
  return id;
}

function ownNote(clinicId: string, id: string) {
  const n = one<Note>("SELECT * FROM clinical_notes WHERE id = ? AND clinic_id = ?", id, clinicId);
  if (!n) throw notFound("Note not found.");
  return n;
}

export function updateDraft(a: Auth, clinicId: string, id: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "clinical.write");
  const n = ownNote(clinicId, id);
  if (n.status !== "draft") throw new HttpError(409, "locked", "Signed notes can't be edited. Create an amendment instead.");
  const f = fieldsFrom(input, n);
  run("UPDATE clinical_notes SET complaint = ?, findings = ?, diagnosis = ?, plan = ? WHERE id = ?", f.complaint, f.findings, f.diagnosis, f.plan, id);
}

/**
 * Signing makes the note the clinician's record (CLN-16). AI drafts need explicit acceptance:
 * `acceptAiDraft: true` from the signing clinician.
 */
export function signNote(a: Auth, clinicId: string, id: string, input: Record<string, unknown> = {}) {
  requireClinic(a, clinicId, "clinical.write");
  return tx(() => {
    const n = ownNote(clinicId, id);
    if (n.status !== "draft") throw new HttpError(409, "locked", "This note is already signed.");
    if (n.ai_drafted && input.acceptAiDraft !== true) throw bad("This note was drafted by the AI manager. Review it and confirm you accept it as your clinical record.");
    run("UPDATE clinical_notes SET status = 'signed', signed_by = ?, signed_at = ? WHERE id = ?", a.user.id, Date.now(), id);
    if (n.version > 1) run("UPDATE clinical_notes SET status = 'superseded' WHERE root_id = ? AND id != ? AND status = 'signed'", n.root_id, id);
    audit(a.user.id, "note.signed", "clinical_note", id, { version: n.version, aiDrafted: n.ai_drafted === 1 });
  });
}

/** Amendment = new draft version with a reason; the signed original stays until the amendment is signed. */
export function amendNote(a: Auth, clinicId: string, id: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "clinical.write");
  const n = ownNote(clinicId, id);
  if (n.status !== "signed") throw new HttpError(409, "not_signed", "Only the current signed version can be amended.");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5) throw bad("Give the reason for the amendment.");
  if (one("SELECT 1 FROM clinical_notes WHERE root_id = ? AND status = 'draft'", n.root_id)) throw new HttpError(409, "pending", "An amendment is already in progress for this note.");
  const f = fieldsFrom(input, n);
  const newId = randomUUID();
  run(
    `INSERT INTO clinical_notes (id, clinic_id, patient_id, appointment_id, root_id, version, status, complaint, findings, diagnosis, plan, amendment_reason, author_id, created_at)
     SELECT ?, clinic_id, patient_id, appointment_id, root_id, ?, 'draft', ?, ?, ?, ?, ?, ?, ? FROM clinical_notes WHERE id = ?`,
    newId, n.version + 1, f.complaint, f.findings, f.diagnosis, f.plan, reason, a.user.id, Date.now(), id,
  );
  audit(a.user.id, "note.amendment_started", "clinical_note", n.root_id, { from: id, reason });
  return newId;
}

export function notes(a: Auth, clinicId: string, patientId: string) {
  requireClinic(a, clinicId, "clinical.read");
  ownPatient(clinicId, patientId);
  return all<Note & { author: string; signer: string | null }>(
    "SELECT n.*, u.name AS author, s.name AS signer FROM clinical_notes n JOIN users u ON u.id = n.author_id LEFT JOIN users s ON s.id = n.signed_by WHERE n.patient_id = ? ORDER BY n.root_id, n.version",
    patientId,
  ).map((n) => ({
    id: n.id,
    rootId: n.root_id,
    version: n.version,
    status: n.status,
    complaint: n.complaint,
    findings: n.findings,
    diagnosis: n.diagnosis,
    plan: n.plan,
    amendmentReason: n.amendment_reason,
    aiDrafted: n.ai_drafted === 1,
    author: n.author,
    signedBy: n.signer,
    signedAt: n.signed_at,
    createdAt: n.created_at,
  }));
}

/* ---------------- odontogram (append-only, FDI notation) ---------------- */

const FDI = (t: number) => (t >= 11 && t <= 48 && t % 10 >= 1 && t % 10 <= 8) || (t >= 51 && t <= 85 && t % 10 >= 1 && t % 10 <= 5);

export function addChartEntry(a: Auth, clinicId: string, patientId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "clinical.write");
  ownPatient(clinicId, patientId);
  const tooth = Number(input.tooth);
  if (!FDI(tooth)) throw bad("Use FDI tooth numbers (11–48, or 51–85 for primary teeth).");
  const finding = typeof input.finding === "string" ? input.finding.trim() : "";
  if (finding.length < 2 || finding.length > 120) throw bad("Describe the finding.");
  const surfaces = typeof input.surfaces === "string" ? input.surfaces.toUpperCase().replace(/[^MODBLIF]/g, "").slice(0, 5) : "";
  run("INSERT INTO chart_entries (id, clinic_id, patient_id, tooth, surfaces, finding, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", randomUUID(), clinicId, patientId, tooth, surfaces, finding, a.user.id, Date.now());
  return chart(a, clinicId, patientId);
}

export function chart(a: Auth, clinicId: string, patientId: string) {
  requireClinic(a, clinicId, "clinical.read");
  const rows = all<{ tooth: number; surfaces: string; finding: string; created_at: number; author: string }>(
    "SELECT c.tooth, c.surfaces, c.finding, c.created_at, u.name AS author FROM chart_entries c JOIN users u ON u.id = c.author_id WHERE c.patient_id = ? AND c.clinic_id = ? ORDER BY c.created_at",
    patientId, clinicId,
  );
  const current = new Map<number, (typeof rows)[number]>();
  for (const r of rows) current.set(r.tooth, r); // latest entry per tooth; earlier ones remain as history
  return { current: [...current.values()], history: rows };
}

/* ---------------- treatment plans & estimates ---------------- */

type PlanItemIn = { procedure?: string; tooth?: string; qty?: number; unitInr?: number; discountInr?: number };

function planTotals(planId: string) {
  const items = all<{ id: string; procedure: string; tooth: string; qty: number; unit_paise: number; discount_paise: number }>("SELECT * FROM plan_items WHERE plan_id = ?", planId);
  const total = items.reduce((s, i) => s + i.qty * i.unit_paise - i.discount_paise, 0);
  return { items: items.map((i) => ({ ...i, lineInr: (i.qty * i.unit_paise - i.discount_paise) / 100 })), totalInr: total / 100 };
}

export function createPlan(a: Auth, clinicId: string, patientId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "clinical.write");
  ownPatient(clinicId, patientId);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 3) throw bad("Give the plan a title.");
  const items = Array.isArray(input.items) ? (input.items as PlanItemIn[]) : [];
  if (!items.length) throw bad("Add at least one procedure.");
  const id = randomUUID();
  tx(() => {
    run("INSERT INTO treatment_plans (id, clinic_id, patient_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)", id, clinicId, patientId, title.slice(0, 120), a.user.id, Date.now(), Date.now());
    for (const it of items) {
      const qty = Number(it.qty ?? 1);
      const unit = Math.round(Number(it.unitInr) * 100);
      const disc = Math.round(Number(it.discountInr ?? 0) * 100);
      if (!it.procedure?.trim() || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(unit) || unit < 0 || disc < 0 || disc > qty * unit)
        throw bad("Each procedure needs a name, quantity, fee and a discount no larger than the line.");
      run("INSERT INTO plan_items (id, plan_id, procedure, tooth, qty, unit_paise, discount_paise) VALUES (?, ?, ?, ?, ?, ?, ?)", randomUUID(), id, it.procedure.trim().slice(0, 120), (it.tooth ?? "").slice(0, 20), qty, unit, disc);
    }
    audit(a.user.id, "plan.created", "treatment_plan", id);
  });
  return plan(a, clinicId, id);
}

export function plan(a: Auth, clinicId: string, id: string) {
  requireClinic(a, clinicId, "patients.read");
  const p = one<{ id: string; patient_id: string; title: string; status: string; acknowledged_at: number | null; acknowledged_note: string; created_at: number }>(
    "SELECT * FROM treatment_plans WHERE id = ? AND clinic_id = ?",
    id, clinicId,
  );
  if (!p) throw notFound("Plan not found.");
  return { id: p.id, patientId: p.patient_id, title: p.title, status: p.status, acknowledgedAt: p.acknowledged_at, acknowledgedNote: p.acknowledged_note, ...planTotals(id) };
}

const PLAN_NEXT: Record<string, string[]> = { draft: ["proposed"], proposed: ["accepted", "declined"], accepted: ["completed"] };

/** Patient acknowledgement is recorded with a note; app acceptance is not a substitute for clinical consent (Annex B). */
export function setPlanStatus(a: Auth, clinicId: string, id: string, to: string, note = "") {
  requireClinic(a, clinicId, "clinical.write");
  const p = plan(a, clinicId, id);
  if (!(PLAN_NEXT[p.status] ?? []).includes(to)) throw new HttpError(409, "invalid_transition", `Can't move a ${p.status} plan to ${to}.`);
  if ((to === "accepted" || to === "declined") && note.trim().length < 3) throw bad("Record how the patient acknowledged the estimate.");
  run(
    "UPDATE treatment_plans SET status = ?, acknowledged_at = CASE WHEN ? IN ('accepted','declined') THEN ? ELSE acknowledged_at END, acknowledged_note = CASE WHEN ? IN ('accepted','declined') THEN ? ELSE acknowledged_note END, updated_at = ? WHERE id = ?",
    to, to, Date.now(), to, note.trim(), Date.now(), id,
  );
  audit(a.user.id, `plan.${to}`, "treatment_plan", id);
  return plan(a, clinicId, id);
}

export function plansFor(a: Auth, clinicId: string, patientId: string) {
  requireClinic(a, clinicId, "patients.read");
  return all<{ id: string }>("SELECT id FROM treatment_plans WHERE patient_id = ? AND clinic_id = ? ORDER BY created_at DESC", patientId, clinicId).map((p) => plan(a, clinicId, p.id));
}

/* ---------------- attachments ---------------- */

export function addFile(a: Auth, clinicId: string, patientId: string, bytes: Uint8Array, title: unknown) {
  requireClinic(a, clinicId, "clinical.write");
  ownPatient(clinicId, patientId);
  if (bytes.byteLength > 25 * 1024 * 1024) throw new HttpError(413, "too_large", "Files must be 25 MB or smaller.");
  const mime = sniffMime(bytes);
  if (!mime) throw new HttpError(415, "unsupported_type", "Upload a PDF, image or DICOM file.");
  const key = storage.put(bytes);
  const id = randomUUID();
  run(
    "INSERT INTO patient_files (id, clinic_id, patient_id, title, storage_key, mime, size_bytes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, clinicId, patientId, typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : "Attachment", key, mime, bytes.byteLength, a.user.id, Date.now(),
  );
  audit(a.user.id, "patient_file.added", "clinic_patient", patientId);
  return id;
}

export function readFile(a: Auth, clinicId: string, fileId: string) {
  requireClinic(a, clinicId, "clinical.read");
  const f = one<{ storage_key: string; mime: string; patient_id: string }>("SELECT storage_key, mime, patient_id FROM patient_files WHERE id = ? AND clinic_id = ?", fileId, clinicId);
  if (!f) throw notFound("File not found.");
  audit(a.user.id, "patient_file.viewed", "clinic_patient", f.patient_id);
  return { bytes: storage.get(f.storage_key), mime: f.mime };
}

export function filesFor(a: Auth, clinicId: string, patientId: string) {
  requireClinic(a, clinicId, "clinical.read");
  return all("SELECT id, title, mime, size_bytes, created_at FROM patient_files WHERE patient_id = ? AND clinic_id = ? ORDER BY created_at DESC", patientId, clinicId);
}
