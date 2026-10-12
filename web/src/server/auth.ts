import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { deliverOtp, exposeDevCode } from "./adapters/otp.ts";
import { bad, forbidden, HttpError, readCookie, unauthenticated } from "./http.ts";

export const ACCOUNT_TYPES = ["patient", "dentist", "student", "company"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Internal roles are granted by FMD, never self-selected (PRD §3). */
export const INTERNAL_ROLES = ["fmd_ops", "moderator", "super_admin", "accountant"] as const;
/** Clinic roles are org-scoped: clinic_owner, clinic_dentist, clinic_front_desk, clinic_finance, clinic_assistant. */
export type Role = AccountType | (typeof INTERNAL_ROLES)[number] | `clinic_${"owner" | "dentist" | "front_desk" | "finance" | "assistant"}`;

/** Purposes are separate on purpose: appointment messages ≠ marketing (Annex L). */
export const CONSENT_PURPOSES = ["terms", "privacy", "comms_appointments", "comms_marketing", "ai_history"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export const POLICY_VERSION = "2026-10-draft"; // ponytail: single policy version string; versioned policy table when legal publishes texts

export const SESSION_COOKIE = "fmd_session";
const SESSION_MS = 30 * 24 * 3600_000;
const OTP_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_WINDOW = 5;
const OTP_WINDOW_MS = 15 * 60_000;
const TICKET_MS = 15 * 60_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  account_type: AccountType;
  language: string;
  status: "active" | "deletion_requested" | "disabled";
  created_at: number;
};

/** Normalise an email or Indian mobile number; anything else is rejected. */
export function normaliseTarget(raw: unknown): { target: string; kind: "email" | "phone" } {
  if (typeof raw !== "string") throw bad("Enter your email or mobile number.");
  const s = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254) return { target: s.toLowerCase(), kind: "email" };
  const digits = s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
  if (/^[6-9]\d{9}$/.test(digits)) return { target: `+91${digits}`, kind: "phone" };
  throw bad("Enter a valid email address or 10-digit Indian mobile number.");
}

export function requestOtp(rawTarget: unknown) {
  const { target, kind } = normaliseTarget(rawTarget);
  const now = Date.now();
  const recent = one<{ n: number }>("SELECT COUNT(*) AS n FROM otp_challenges WHERE target = ? AND created_at > ?", target, now - OTP_WINDOW_MS)!.n;
  if (recent >= OTP_MAX_PER_WINDOW) throw new HttpError(429, "rate_limited", "Too many codes requested. Please wait 15 minutes.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  run(
    "INSERT INTO otp_challenges (id, target, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    randomUUID(),
    target,
    sha(`${target}:${code}`),
    now,
    now + OTP_MS,
  );
  const delivery = deliverOtp(target, code);
  return { target, kind, delivery, devCode: !delivery.configured && exposeDevCode() ? code : undefined };
}

type Challenge = { id: string; code_hash: string; attempts: number; expires_at: number };

/**
 * Verify a code. Existing account → session. New target → a short-lived signup ticket,
 * so we never reveal whether an account exists before the code is proven.
 */
export function verifyOtp(rawTarget: unknown, rawCode: unknown, userAgent = "") {
  const { target } = normaliseTarget(rawTarget);
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!/^\d{6}$/.test(code)) throw bad("Enter the 6-digit code.");
  const now = Date.now();
  return tx(() => {
    const c = one<Challenge>(
      "SELECT id, code_hash, attempts, expires_at FROM otp_challenges WHERE target = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
      target,
    );
    if (!c || c.expires_at < now) throw new HttpError(400, "code_expired", "That code has expired. Request a new one.");
    if (c.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, "too_many_attempts", "Too many attempts. Request a new code.");
    if (!same(c.code_hash, sha(`${target}:${code}`))) {
      run("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?", c.id);
      return { ok: false as const };
    }
    const user = findUserByTarget(target);
    if (user) {
      run("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?", now, c.id);
      if (user.status === "disabled") throw forbidden();
      return { ok: true as const, ...createSession(user.id, userAgent) };
    }
    const ticket = randomBytes(24).toString("base64url");
    run("UPDATE otp_challenges SET consumed_at = ?, ticket_hash = ?, ticket_expires_at = ? WHERE id = ?", now, sha(ticket), now + TICKET_MS, c.id);
    return { ok: true as const, needsProfile: true as const, ticket };
  });
}

/** Create the account for a verified target. Terms and privacy are required; the rest are opt-in. */
export function register(input: {
  ticket: unknown;
  name: unknown;
  accountType: unknown;
  consents: Partial<Record<ConsentPurpose, boolean>>;
  userAgent?: string;
}) {
  if (typeof input.ticket !== "string" || !input.ticket) throw bad("Your verification has expired. Start again.");
  if (!ACCOUNT_TYPES.includes(input.accountType as AccountType)) throw bad("Choose an account type.");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) throw bad("Enter your name (2–80 characters).");
  if (!input.consents.terms || !input.consents.privacy) throw bad("Please accept the terms and privacy notice to continue.");
  const now = Date.now();
  return tx(() => {
    const t = one<{ id: string; target: string }>(
      "SELECT id, target FROM otp_challenges WHERE ticket_hash = ? AND ticket_expires_at > ?",
      sha(input.ticket as string),
      now,
    );
    if (!t) throw new HttpError(400, "ticket_expired", "Your verification has expired. Start again.");
    run("UPDATE otp_challenges SET ticket_hash = NULL WHERE id = ?", t.id); // single use
    if (findUserByTarget(t.target)) throw new HttpError(409, "exists", "An account already exists. Please sign in.");
    const id = randomUUID();
    const isEmail = t.target.includes("@");
    run(
      "INSERT INTO users (id, email, phone, name, account_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      isEmail ? t.target : null,
      isEmail ? null : t.target,
      name,
      input.accountType as string,
      now,
      now,
    );
    grantRole(id, input.accountType as Role, null);
    for (const r of bootstrapRoles(t.target)) grantRole(id, r, null);
    for (const p of CONSENT_PURPOSES) recordConsent(id, p, Boolean(input.consents[p]));
    audit(id, "user.registered", "user", id, { accountType: input.accountType });
    return createSession(id, input.userAgent ?? "");
  });
}

/** FMD staff accounts are bootstrapped from env (comma-separated emails), not self-selected. */
function bootstrapRoles(target: string): Role[] {
  const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const roles: Role[] = [];
  if (list(process.env.FMD_OPS_EMAILS).includes(target)) roles.push("fmd_ops");
  if (list(process.env.FMD_ADMIN_EMAILS).includes(target)) roles.push("super_admin");
  if (list(process.env.FMD_ACCOUNTANT_EMAILS).includes(target)) roles.push("accountant");
  return roles;
}

export function grantRole(userId: string, role: Role, by: string | null, orgId = "") {
  run("INSERT OR IGNORE INTO user_roles (user_id, role, org_id, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)", userId, role, orgId, Date.now(), by);
  audit(by, "role.granted", "user", userId, { role, orgId });
}

export function rolesOf(userId: string): { role: Role; org_id: string }[] {
  return all("SELECT role, org_id FROM user_roles WHERE user_id = ?", userId);
}

function findUserByTarget(target: string) {
  return one<User>(`SELECT * FROM users WHERE ${target.includes("@") ? "email" : "phone"} = ?`, target);
}

/* ---------------- sessions ---------------- */

function createSession(userId: string, userAgent: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  run(
    "INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
    sha(token),
    userId,
    now,
    now,
    now + SESSION_MS,
    userAgent.slice(0, 200),
  );
  audit(userId, "session.created", "user", userId);
  return { token, maxAge: SESSION_MS / 1000 };
}

export function sessionCookie(token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge)}${secure}`;
}
export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export type Auth = { user: User; roles: Role[]; sessionId: string };

/** Resolve the signed-in user, or null. Every protected service call starts here. */
export function currentAuth(req: Request): Auth | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const sid = sha(token);
  const now = Date.now();
  const s = one<{ user_id: string; last_seen_at: number }>(
    "SELECT user_id, last_seen_at FROM sessions WHERE id = ? AND revoked_at IS NULL AND expires_at > ?",
    sid,
    now,
  );
  if (!s) return null;
  const user = one<User>("SELECT * FROM users WHERE id = ?", s.user_id);
  if (!user || user.status === "disabled") return null;
  if (now - s.last_seen_at > 5 * 60_000) run("UPDATE sessions SET last_seen_at = ? WHERE id = ?", now, sid);
  return { user, roles: rolesOf(user.id).map((r) => r.role), sessionId: sid };
}

export function requireAuth(req: Request): Auth {
  const a = currentAuth(req);
  if (!a) throw unauthenticated();
  return a;
}

export function requireRole(a: Auth, ...roles: Role[]) {
  if (!roles.some((r) => a.roles.includes(r))) {
    audit(a.user.id, "access.denied", "role", null, { needed: roles });
    throw forbidden();
  }
}

export function listSessions(a: Auth) {
  return all<{ id: string; created_at: number; last_seen_at: number; user_agent: string }>(
    "SELECT id, created_at, last_seen_at, user_agent FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC",
    a.user.id,
    Date.now(),
  ).map((s) => ({ ref: s.id.slice(0, 12), current: s.id === a.sessionId, createdAt: s.created_at, lastSeenAt: s.last_seen_at, device: s.user_agent }));
}

/** Revoke one of *your own* sessions by its public ref (or all others with ref "others"). */
export function revokeSession(a: Auth, ref: string) {
  const now = Date.now();
  if (ref === "others") {
    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL", now, a.user.id, a.sessionId);
  } else {
    if (!/^[0-9a-f]{12}$/.test(ref)) throw bad("Unknown session.");
    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND substr(id, 1, 12) = ? AND revoked_at IS NULL", now, a.user.id, ref);
  }
  audit(a.user.id, "session.revoked", "user", a.user.id, { ref });
}

export function signOut(a: Auth) {
  run("UPDATE sessions SET revoked_at = ? WHERE id = ?", Date.now(), a.sessionId);
}

/* ---------------- profile, consent, deletion ---------------- */

export function recordConsent(userId: string, purpose: ConsentPurpose, granted: boolean) {
  run(
    "INSERT INTO consents (id, user_id, purpose, granted, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    randomUUID(),
    userId,
    purpose,
    granted ? 1 : 0,
    POLICY_VERSION,
    Date.now(),
  );
}

/** Latest decision per purpose (history is kept — consents are append-only). */
export function currentConsents(userId: string): Record<ConsentPurpose, boolean> {
  const rows = all<{ purpose: ConsentPurpose; granted: number }>(
    `SELECT c.purpose, c.granted FROM consents c
     WHERE c.user_id = ? AND c.created_at = (SELECT MAX(created_at) FROM consents WHERE user_id = c.user_id AND purpose = c.purpose)`,
    userId,
  );
  const out = Object.fromEntries(CONSENT_PURPOSES.map((p) => [p, false])) as Record<ConsentPurpose, boolean>;
  for (const r of rows) out[r.purpose] = r.granted === 1;
  return out;
}

/** Only optional purposes can be changed here; withdrawing terms is an account-deletion request. */
export function updateConsents(a: Auth, changes: Partial<Record<ConsentPurpose, boolean>>) {
  const cur = currentConsents(a.user.id);
  for (const p of ["comms_appointments", "comms_marketing", "ai_history"] as const) {
    if (typeof changes[p] === "boolean" && changes[p] !== cur[p]) {
      recordConsent(a.user.id, p, changes[p]!);
      audit(a.user.id, "consent.changed", "user", a.user.id, { purpose: p, granted: changes[p] });
    }
  }
  return currentConsents(a.user.id);
}

export function updateProfile(a: Auth, input: { name?: unknown; language?: unknown }) {
  const name = input.name === undefined ? a.user.name : typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) throw bad("Enter your name (2–80 characters).");
  const language = input.language === undefined ? a.user.language : String(input.language);
  if (!["en", "hi", "kn", "te", "ta"].includes(language)) throw bad("Unsupported language.");
  run("UPDATE users SET name = ?, language = ?, updated_at = ? WHERE id = ?", name, language, Date.now(), a.user.id);
  audit(a.user.id, "profile.updated", "user", a.user.id);
  return { ...a.user, name, language };
}

export function requestDeletion(a: Auth, reason: unknown) {
  const open = one("SELECT id FROM deletion_requests WHERE user_id = ? AND status IN ('received','in_review')", a.user.id);
  if (open) throw new HttpError(409, "exists", "A deletion request is already being processed.");
  const id = randomUUID();
  tx(() => {
    run(
      "INSERT INTO deletion_requests (id, user_id, reason, created_at) VALUES (?, ?, ?, ?)",
      id,
      a.user.id,
      typeof reason === "string" ? reason.trim().slice(0, 500) : "",
      Date.now(),
    );
    run("UPDATE users SET status = 'deletion_requested', updated_at = ? WHERE id = ?", Date.now(), a.user.id);
    audit(a.user.id, "deletion.requested", "user", a.user.id);
  });
  return { reference: `DEL-${id.slice(0, 8).toUpperCase()}` };
}

/** What a client may see about the signed-in user. */
export function publicMe(a: Auth) {
  const { user } = a;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    accountType: user.account_type,
    language: user.language,
    status: user.status,
    roles: a.roles,
    consents: currentConsents(user.id),
  };
}
