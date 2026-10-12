import { createHash, randomBytes, randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "../db.ts";
import { requireRole, type Auth } from "../auth.ts";
import { bad, forbidden, HttpError, notFound } from "../http.ts";
import { CITIES } from "../../lib/catalog.ts";

/* ---------------- roles & permissions (PRD §3, §6.1; ROL-05/06/12) ---------------- */

export const CLINIC_ROLES = {
  owner: "Owner / admin",
  dentist: "Dentist",
  front_desk: "Front desk",
  finance: "Finance",
  assistant: "Assistant",
} as const;
export type ClinicRole = keyof typeof CLINIC_ROLES;

/** Least privilege: finance never sees clinical notes; front desk never edits them. */
const P = {
  "appointments.read": ["owner", "dentist", "front_desk", "assistant"],
  "appointments.write": ["owner", "dentist", "front_desk"],
  "patients.read": ["owner", "dentist", "front_desk", "assistant", "finance"],
  "patients.write": ["owner", "dentist", "front_desk"],
  "clinical.read": ["owner", "dentist", "assistant"],
  "clinical.write": ["owner", "dentist"],
  "billing.read": ["owner", "finance", "front_desk"],
  "billing.write": ["owner", "finance", "front_desk"],
  "billing.refund": ["owner", "finance"],
  "inventory.read": ["owner", "assistant", "front_desk", "dentist"],
  "inventory.write": ["owner", "assistant", "front_desk"],
  "inventory.approve": ["owner"],
  "tasks.use": ["owner", "dentist", "front_desk", "finance", "assistant"],
  "reports.read": ["owner", "finance"],
  "staff.manage": ["owner"],
  "settings.manage": ["owner"],
  "ai.use": ["owner", "dentist", "front_desk", "finance", "assistant"],
  "ai.configure": ["owner"],
} as const satisfies Record<string, readonly ClinicRole[]>;
export type Permission = keyof typeof P;

export function clinicRolesOf(userId: string, clinicId: string): ClinicRole[] {
  return all<{ role: string }>("SELECT role FROM user_roles WHERE user_id = ? AND org_id = ? AND role LIKE 'clinic_%'", userId, clinicId)
    .map((r) => r.role.slice("clinic_".length))
    .filter((r): r is ClinicRole => r in CLINIC_ROLES);
}

export function can(a: Auth, clinicId: string, perm: Permission) {
  const roles = clinicRolesOf(a.user.id, clinicId);
  return roles.some((r) => (P[perm] as readonly string[]).includes(r));
}

/**
 * Every Clinic OS service starts here. Non-members get 404 (a clinic's existence and data are not
 * revealed to outsiders — tenant isolation); members without the permission get 403 and an audit entry.
 */
export function requireClinic(a: Auth, clinicId: string, perm: Permission) {
  const roles = clinicRolesOf(a.user.id, clinicId);
  if (!roles.length) throw notFound("Clinic not found.");
  if (!roles.some((r) => (P[perm] as readonly string[]).includes(r))) {
    audit(a.user.id, "clinic.access_denied", "clinic", clinicId, { perm });
    throw forbidden();
  }
  return roles;
}

export function permissionsFor(roles: ClinicRole[]) {
  return (Object.keys(P) as Permission[]).filter((p) => roles.some((r) => (P[p] as readonly string[]).includes(r)));
}

/* ---------------- workspace ---------------- */

type Workspace = { clinic_id: string; status: "setup" | "active" | "suspended"; timezone: string; created_at: number };

export function myClinics(a: Auth) {
  return all<{ id: string; name: string; area: string; city: string; status: string; role: string }>(
    `SELECT c.id, c.name, c.area, c.city, w.status, r.role FROM user_roles r
     JOIN clinic_workspaces w ON w.clinic_id = r.org_id JOIN clinics c ON c.id = w.clinic_id
     WHERE r.user_id = ? AND r.role LIKE 'clinic_%' ORDER BY c.name`,
    a.user.id,
  ).reduce<{ id: string; name: string; area: string; city: string; status: string; roles: string[] }[]>((acc, r) => {
    const found = acc.find((x) => x.id === r.id);
    if (found) found.roles.push(r.role.slice(7));
    else acc.push({ id: r.id, name: r.name, area: r.area, city: r.city, status: r.status, roles: [r.role.slice(7)] });
    return acc;
  }, []);
}

const DEFAULT_TYPES: [string, number, number][] = [
  ["Consultation", 20, 5],
  ["Cleaning (scaling & polishing)", 45, 10],
  ["Filling", 45, 10],
  ["Root canal treatment", 60, 15],
];

/**
 * A dentist account creates a clinic workspace — either for a new clinic or for the directory clinic
 * of a profile they have claimed. It starts in "setup"; FMD activates it after verification (Annex E).
 */
export function createWorkspace(a: Auth, input: Record<string, unknown>) {
  if (a.user.account_type !== "dentist") throw new HttpError(403, "forbidden", "Clinic workspaces are created from a dentist account.");
  const existingClinic = typeof input.clinicId === "string" ? input.clinicId : "";
  const now = Date.now();
  return tx(() => {
    let clinicId = existingClinic;
    if (existingClinic) {
      // only the clinic of a profile this dentist has claimed
      const ok = one("SELECT 1 FROM dentist_clinics dc JOIN dentists d ON d.id = dc.dentist_id WHERE dc.clinic_id = ? AND d.user_id = ?", existingClinic, a.user.id);
      if (!ok) throw new HttpError(403, "forbidden", "You can only set up the clinic linked to your claimed profile.");
      if (one("SELECT 1 FROM clinic_workspaces WHERE clinic_id = ?", existingClinic)) throw new HttpError(409, "exists", "This clinic already has a workspace. Ask its owner for an invitation.");
    } else {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const area = typeof input.area === "string" ? input.area.trim() : "";
      const city = typeof input.city === "string" && (CITIES as readonly string[]).includes(input.city) ? input.city : null;
      if (name.length < 3 || name.length > 100) throw bad("Enter the clinic name.");
      if (!city) throw bad("Choose a city.");
      if (area.length < 2) throw bad("Enter the area or locality.");
      clinicId = randomUUID();
      run(
        "INSERT INTO clinics (id, name, city, area, address, phone, hours, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, '', 0, ?)",
        clinicId, name, city, area, typeof input.address === "string" ? input.address.trim().slice(0, 200) : "", typeof input.phone === "string" ? input.phone.trim().slice(0, 20) : "", now,
      );
    }
    run("INSERT INTO clinic_workspaces (clinic_id, status, created_by, created_at) VALUES (?, 'setup', ?, ?)", clinicId, a.user.id, now);
    run("INSERT OR IGNORE INTO user_roles (user_id, role, org_id, granted_at, granted_by) VALUES (?, 'clinic_owner', ?, ?, ?)", a.user.id, clinicId, now, a.user.id);
    for (let d = 1; d <= 6; d++) run("INSERT INTO clinic_hours (clinic_id, weekday, opens, closes) VALUES (?, ?, '10:00', '18:00')", clinicId, d);
    for (const [name, dur, buf] of DEFAULT_TYPES)
      run("INSERT INTO appointment_types (id, clinic_id, name, duration_min, buffer_min) VALUES (?, ?, ?, ?, ?)", randomUUID(), clinicId, name, dur, buf);
    run("INSERT INTO chairs (id, clinic_id, name) VALUES (?, ?, 'Chair 1')", randomUUID(), clinicId);
    run(
      "INSERT OR IGNORE INTO clinic_booking_policies (clinic_id, live_schedule, schedule_source, min_notice_minutes, cancellation_terms) VALUES (?, 0, 'none', 120, ?)",
      clinicId,
      "Cancellation terms are set by the clinic and confirmed with you.",
    );
    audit(a.user.id, "clinic.workspace_created", "clinic", clinicId);
    return { clinicId };
  });
}

export function workspace(a: Auth, clinicId: string) {
  const roles = requireClinic(a, clinicId, "tasks.use");
  const c = one<{ id: string; name: string; city: string; area: string; address: string; phone: string; is_demo: number }>("SELECT * FROM clinics WHERE id = ?", clinicId)!;
  const w = one<Workspace>("SELECT * FROM clinic_workspaces WHERE clinic_id = ?", clinicId)!;
  return {
    clinic: { id: c.id, name: c.name, city: c.city, area: c.area, address: c.address, phone: c.phone, demo: c.is_demo === 1 },
    status: w.status,
    timezone: w.timezone,
    roles,
    permissions: permissionsFor(roles),
  };
}

/* ---------------- team ---------------- */

export function members(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "tasks.use");
  const rows = all<{ user_id: string; name: string; email: string | null; phone: string | null; role: string }>(
    "SELECT r.user_id, u.name, u.email, u.phone, r.role FROM user_roles r JOIN users u ON u.id = r.user_id WHERE r.org_id = ? AND r.role LIKE 'clinic_%' ORDER BY u.name",
    clinicId,
  );
  const byUser = new Map<string, { userId: string; name: string; contact: string; roles: string[] }>();
  for (const r of rows) {
    const m = byUser.get(r.user_id) ?? { userId: r.user_id, name: r.name, contact: r.email ?? r.phone ?? "", roles: [] };
    m.roles.push(r.role.slice(7));
    byUser.set(r.user_id, m);
  }
  const canManage = can(a, clinicId, "staff.manage");
  return {
    members: [...byUser.values()],
    invites: canManage
      ? all<{ id: string; email: string; role: string; expires_at: number }>("SELECT id, email, role, expires_at FROM clinic_invites WHERE clinic_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?", clinicId, Date.now())
      : [],
  };
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Owner invites staff by email; they accept by signing in with that same email (secure account setup). */
export function invite(a: Auth, clinicId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "staff.manage");
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad("Enter a valid email address.");
  const role = typeof input.role === "string" && input.role in CLINIC_ROLES ? input.role : null;
  if (!role) throw bad("Choose a role.");
  const token = randomBytes(24).toString("base64url");
  const id = randomUUID();
  run(
    "INSERT INTO clinic_invites (id, clinic_id, email, role, token_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, clinicId, email, role, sha(token), Date.now() + 7 * 86400_000, a.user.id, Date.now(),
  );
  audit(a.user.id, "clinic.invite_sent", "clinic", clinicId, { role });
  // OD-14: no email provider — the link is returned for the owner to share; nothing claims it was emailed
  return { inviteId: id, link: `/clinic/join?token=${token}`, delivered: false };
}

export function acceptInvite(a: Auth, token: unknown) {
  if (typeof token !== "string" || !token) throw bad("This invitation link is invalid.");
  return tx(() => {
    const inv = one<{ id: string; clinic_id: string; email: string; role: string; expires_at: number; accepted_at: number | null; revoked_at: number | null }>(
      "SELECT * FROM clinic_invites WHERE token_hash = ?",
      sha(token),
    );
    if (!inv || inv.revoked_at || inv.accepted_at || inv.expires_at < Date.now()) throw new HttpError(410, "invite_invalid", "This invitation has expired or was already used. Ask the clinic for a new one.");
    if ((a.user.email ?? "") !== inv.email) throw new HttpError(403, "wrong_account", `This invitation is for ${inv.email}. Sign in with that email to accept it.`);
    run("INSERT OR IGNORE INTO user_roles (user_id, role, org_id, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)", a.user.id, `clinic_${inv.role}`, inv.clinic_id, Date.now(), null);
    run("UPDATE clinic_invites SET accepted_by = ?, accepted_at = ? WHERE id = ?", a.user.id, Date.now(), inv.id);
    audit(a.user.id, "clinic.invite_accepted", "clinic", inv.clinic_id, { role: inv.role });
    return { clinicId: inv.clinic_id };
  });
}

export function setMemberRoles(a: Auth, clinicId: string, userId: string, roles: unknown) {
  requireClinic(a, clinicId, "staff.manage");
  const list = Array.isArray(roles) ? roles.filter((r): r is ClinicRole => typeof r === "string" && r in CLINIC_ROLES) : [];
  return tx(() => {
    const owners = all<{ user_id: string }>("SELECT user_id FROM user_roles WHERE org_id = ? AND role = 'clinic_owner'", clinicId);
    if (!list.includes("owner") && owners.length === 1 && owners[0].user_id === userId) throw new HttpError(409, "last_owner", "A clinic needs at least one owner.");
    run("DELETE FROM user_roles WHERE user_id = ? AND org_id = ? AND role LIKE 'clinic_%'", userId, clinicId);
    for (const r of list) run("INSERT INTO user_roles (user_id, role, org_id, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)", userId, `clinic_${r}`, clinicId, Date.now(), a.user.id);
    audit(a.user.id, list.length ? "clinic.roles_changed" : "clinic.member_deactivated", "clinic", clinicId, { userId, roles: list });
    return members(a, clinicId);
  });
}

export function revokeInvite(a: Auth, clinicId: string, inviteId: string) {
  requireClinic(a, clinicId, "staff.manage");
  run("UPDATE clinic_invites SET revoked_at = ? WHERE id = ? AND clinic_id = ?", Date.now(), inviteId, clinicId);
  return members(a, clinicId);
}

/* ---------------- settings ---------------- */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function settings(a: Auth, clinicId: string) {
  requireClinic(a, clinicId, "appointments.read");
  return {
    hours: all<{ weekday: number; opens: string; closes: string }>("SELECT weekday, opens, closes FROM clinic_hours WHERE clinic_id = ? ORDER BY weekday, opens", clinicId),
    types: all<{ id: string; name: string; duration_min: number; buffer_min: number; fee_note: string; bookable_online: number; active: number }>(
      "SELECT id, name, duration_min, buffer_min, fee_note, bookable_online, active FROM appointment_types WHERE clinic_id = ? ORDER BY name",
      clinicId,
    ),
    chairs: all<{ id: string; name: string; active: number }>("SELECT id, name, active FROM chairs WHERE clinic_id = ? ORDER BY name", clinicId),
    policy: one<{ min_notice_minutes: number; cancellation_terms: string; live_schedule: number; schedule_source: string }>(
      "SELECT min_notice_minutes, cancellation_terms, live_schedule, schedule_source FROM clinic_booking_policies WHERE clinic_id = ?",
      clinicId,
    ),
    providers: all<{ id: string; name: string }>("SELECT d.id, d.name FROM dentists d JOIN dentist_clinics dc ON dc.dentist_id = d.id WHERE dc.clinic_id = ? ORDER BY d.name", clinicId),
  };
}

export function updateSettings(a: Auth, clinicId: string, input: Record<string, unknown>) {
  requireClinic(a, clinicId, "settings.manage");
  tx(() => {
    if (Array.isArray(input.hours)) {
      const rows = input.hours.map((h) => h as { weekday: number; opens: string; closes: string });
      for (const h of rows) {
        if (!Number.isInteger(h.weekday) || h.weekday < 0 || h.weekday > 6 || !HHMM.test(h.opens) || !HHMM.test(h.closes) || h.opens >= h.closes)
          throw bad("Each opening period needs a weekday and opening time before closing time (HH:MM).");
      }
      run("DELETE FROM clinic_hours WHERE clinic_id = ?", clinicId);
      for (const h of rows) run("INSERT INTO clinic_hours (clinic_id, weekday, opens, closes) VALUES (?, ?, ?, ?)", clinicId, h.weekday, h.opens, h.closes);
    }
    if (input.type && typeof input.type === "object") {
      const t = input.type as { id?: string; name?: string; duration_min?: number; buffer_min?: number; fee_note?: string; bookable_online?: boolean; active?: boolean };
      const name = (t.name ?? "").trim();
      if (name.length < 2 || !Number.isInteger(t.duration_min) || t.duration_min! < 5 || t.duration_min! > 480) throw bad("Appointment types need a name and a duration of 5–480 minutes.");
      const buffer = Number.isInteger(t.buffer_min) ? Math.max(0, Math.min(120, t.buffer_min!)) : 0;
      if (t.id) {
        if (!one("SELECT 1 FROM appointment_types WHERE id = ? AND clinic_id = ?", t.id, clinicId)) throw notFound("Appointment type not found.");
        run(
          "UPDATE appointment_types SET name = ?, duration_min = ?, buffer_min = ?, fee_note = ?, bookable_online = ?, active = ? WHERE id = ?",
          name, t.duration_min!, buffer, (t.fee_note ?? "").slice(0, 120), t.bookable_online === false ? 0 : 1, t.active === false ? 0 : 1, t.id,
        );
      } else
        run(
          "INSERT INTO appointment_types (id, clinic_id, name, duration_min, buffer_min, fee_note, bookable_online) VALUES (?, ?, ?, ?, ?, ?, ?)",
          randomUUID(), clinicId, name, t.duration_min!, buffer, (t.fee_note ?? "").slice(0, 120), t.bookable_online === false ? 0 : 1,
        );
    }
    if (typeof input.chairName === "string" && input.chairName.trim().length >= 2) run("INSERT INTO chairs (id, clinic_id, name) VALUES (?, ?, ?)", randomUUID(), clinicId, input.chairName.trim().slice(0, 40));
    if (input.policy && typeof input.policy === "object") {
      const p = input.policy as { min_notice_minutes?: number; cancellation_terms?: string };
      const notice = Number.isInteger(p.min_notice_minutes) ? Math.max(0, Math.min(7 * 24 * 60, p.min_notice_minutes!)) : undefined;
      if (notice !== undefined) run("UPDATE clinic_booking_policies SET min_notice_minutes = ? WHERE clinic_id = ?", notice, clinicId);
      if (typeof p.cancellation_terms === "string" && p.cancellation_terms.trim().length >= 10)
        run("UPDATE clinic_booking_policies SET cancellation_terms = ? WHERE clinic_id = ?", p.cancellation_terms.trim().slice(0, 300), clinicId);
    }
    audit(a.user.id, "clinic.settings_changed", "clinic", clinicId);
  });
  return settings(a, clinicId);
}

/** FMD staff activate a workspace after verification and commercial setup (Annex E). */
export function activateWorkspace(staff: Auth, clinicId: string, evidence: unknown) {
  requireRole(staff, "fmd_ops", "super_admin");
  if (typeof evidence !== "string" || evidence.trim().length < 6) throw bad("Record what was verified and the subscription reference.");
  if (!one("SELECT 1 FROM clinic_workspaces WHERE clinic_id = ?", clinicId)) throw notFound("Workspace not found.");
  run("UPDATE clinic_workspaces SET status = 'active' WHERE clinic_id = ?", clinicId);
  audit(staff.user.id, "clinic.workspace_activated", "clinic", clinicId, { evidence: evidence.trim() });
}

/** FMD staff view of clinic workspaces awaiting activation (Annex E onboarding queue). */
export function workspacesForOps(staff: Auth) {
  requireRole(staff, "fmd_ops", "super_admin");
  return all<{ clinic_id: string; name: string; city: string; area: string; status: string; created_at: number; owner: string; owner_contact: string | null }>(
    `SELECT w.clinic_id, c.name, c.city, c.area, w.status, w.created_at, u.name AS owner, COALESCE(u.email, u.phone) AS owner_contact
     FROM clinic_workspaces w JOIN clinics c ON c.id = w.clinic_id JOIN users u ON u.id = w.created_by ORDER BY w.status = 'setup' DESC, w.created_at DESC`,
  );
}

export function requireActive(clinicId: string) {
  const w = one<{ status: string }>("SELECT status FROM clinic_workspaces WHERE clinic_id = ?", clinicId);
  if (w?.status !== "active") throw new HttpError(409, "not_active", "This needs an active workspace. FMD activates it after verification.");
}
