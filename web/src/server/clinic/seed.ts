import { randomUUID } from "node:crypto";
import { all, one, run, tx } from "../db.ts";
import { istDayStart } from "./calendar.ts";

/**
 * DEV-ONLY demo workspace for reviewing Clinic OS: "Demo Dental Studio" with an owner account
 * (sign in as owner@demo-clinic.test; the code is shown in development). All rows are fictitious and
 * patients are flagged is_demo. Never runs in production or tests (see devSeed).
 */
export const DEMO_OWNER_EMAIL = "owner@demo-clinic.test";

export function seedDemoClinic() {
  const clinic = one<{ id: string }>("SELECT id FROM clinics WHERE name = 'Demo Dental Studio' AND is_demo = 1");
  if (!clinic || one("SELECT 1 FROM clinic_workspaces WHERE clinic_id = ?", clinic.id)) return false;
  const now = Date.now();
  const day = istDayStart(now);
  tx(() => {
    const ownerId = randomUUID();
    run("INSERT INTO users (id, email, name, account_type, created_at, updated_at) VALUES (?, ?, 'Demo Owner', 'dentist', ?, ?)", ownerId, DEMO_OWNER_EMAIL, now, now);
    run("INSERT INTO user_roles (user_id, role, org_id, granted_at) VALUES (?, 'dentist', '', ?), (?, 'clinic_owner', ?, ?)", ownerId, now, ownerId, clinic.id, now);
    for (const p of ["terms", "privacy"]) run("INSERT INTO consents (id, user_id, purpose, granted, policy_version, created_at) VALUES (?, ?, ?, 1, 'demo', ?)", randomUUID(), ownerId, p, now);
    run("INSERT INTO clinic_workspaces (clinic_id, status, created_by, created_at) VALUES (?, 'active', ?, ?)", clinic.id, ownerId, now);
    for (let d = 1; d <= 6; d++) run("INSERT INTO clinic_hours (clinic_id, weekday, opens, closes) VALUES (?, ?, '10:00', '19:00')", clinic.id, d);
    const types = [
      ["Consultation", 20, 5, "₹500"],
      ["Cleaning (scaling & polishing)", 45, 10, "₹1,200"],
      ["Filling", 45, 10, "From ₹1,500"],
      ["Root canal treatment", 60, 15, "From ₹6,000"],
    ].map(([n, d, b, f]) => {
      const id = randomUUID();
      run("INSERT INTO appointment_types (id, clinic_id, name, duration_min, buffer_min, fee_note) VALUES (?, ?, ?, ?, ?, ?)", id, clinic.id, n, d, b, f);
      return id;
    });
    const chairs = ["Chair 1", "Chair 2"].map((n) => {
      const id = randomUUID();
      run("INSERT INTO chairs (id, clinic_id, name) VALUES (?, ?, ?)", id, clinic.id, n);
      return id;
    });
    const providers = all<{ dentist_id: string }>("SELECT dentist_id FROM dentist_clinics WHERE clinic_id = ?", clinic.id).map((r) => r.dentist_id);
    const patients = [
      ["Ananya Krishnan", "+919800000101", 1, 40],
      ["Rahul Verma", "+919800000102", 1, 220],
      ["Fatima Sheikh", "+919800000103", 0, 260],
      ["Suresh Gowda", "+919800000104", 1, 15],
      ["Priya Menon", "+919800000105", 1, null],
    ].map(([name, phone, consent, lastVisitDaysAgo]) => {
      const id = randomUUID();
      run(
        "INSERT INTO clinic_patients (id, clinic_id, full_name, phone, consent_comms, consent_treatment_at, last_visit_at, is_demo, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
        id, clinic.id, name, phone, consent, now, lastVisitDaysAgo === null ? null : now - (lastVisitDaysAgo as number) * 86400_000, ownerId, now, now,
      );
      return id;
    });
    // today's schedule
    const visits: [number, number, number, string][] = [
      [0, 0, 10.5, "completed"],
      [3, 1, 11.5, "checked_in"],
      [4, 0, 15, "booked"],
      [1, 2, 16, "confirmed"],
    ];
    for (const [pi, ti, hour, status] of visits) {
      const start = day + hour * 3600_000;
      const dur = [20, 45, 45, 60][ti] * 60_000;
      const id = randomUUID();
      run(
        "INSERT INTO appointments (id, clinic_id, patient_id, provider_dentist_id, chair_id, type_id, kind, starts_at, ends_at, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'visit', ?, ?, ?, ?, ?, ?)",
        id, clinic.id, patients[pi], providers[pi % Math.max(1, providers.length)] ?? null, chairs[pi % 2], types[ti], start, start + dur, status, ownerId, now, now,
      );
      run("INSERT INTO appointment_events (id, appointment_id, actor_id, to_status, at) VALUES (?, ?, ?, ?, ?)", randomUUID(), id, ownerId, status, now);
    }
    // an issued, part-paid invoice
    const inv = randomUUID();
    run("INSERT INTO invoices (id, clinic_id, patient_id, number, status, total_paise, created_by, created_at, issued_at) VALUES (?, ?, ?, ?, 'partially_paid', 170000, ?, ?, ?)", inv, clinic.id, patients[0], `INV-${new Date(now).getUTCFullYear()}-0001`, ownerId, now, now);
    run("INSERT INTO invoice_items (id, invoice_id, description, qty, unit_paise) VALUES (?, ?, 'Consultation', 1, 50000), (?, ?, 'Scaling & polishing', 1, 120000)", randomUUID(), inv, randomUUID(), inv);
    run("INSERT INTO clinic_payments (id, clinic_id, invoice_id, kind, amount_paise, mode, reference, recorded_by, recorded_at, idempotency_key) VALUES (?, ?, ?, 'payment', 100000, 'upi', 'DEMO-UPI', ?, ?, ?)", randomUUID(), clinic.id, inv, ownerId, now, randomUUID());
    // inventory with one low item and one expiring batch
    const soon = new Date(now + 12 * 86400_000).toISOString().slice(0, 10);
    for (const [name, unit, reorder, qty, tracks, batch] of [
      ["Nitrile gloves (M)", "box", 10, 4, 0, ""],
      ["Lignocaine 2% cartridges", "cartridge", 30, 60, 1, "LG-DEMO-7"],
      ["Composite A2", "syringe", 3, 8, 0, ""],
    ] as const) {
      const id = randomUUID();
      run("INSERT INTO inventory_items (id, clinic_id, name, unit, reorder_level, tracks_expiry, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, clinic.id, name, unit, reorder, tracks, now);
      run("INSERT INTO stock_movements (id, item_id, qty_delta, reason, batch, expires_on, recorded_by, recorded_at) VALUES (?, ?, ?, 'received', ?, ?, ?, ?)", randomUUID(), id, qty, batch, tracks ? soon : "", ownerId, now);
    }
    run("INSERT INTO clinic_tasks (id, clinic_id, title, detail, assignee_id, priority, created_by, created_at) VALUES (?, ?, 'Call lab about crown for Rahul', 'Expected Thursday', ?, 'normal', ?, ?)", randomUUID(), clinic.id, ownerId, ownerId, now);
  });
  return true;
}
