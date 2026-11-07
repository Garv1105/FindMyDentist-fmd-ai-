import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { bad, forbidden, HttpError, readCookie, unauthenticated } from "./http.ts";

/*
 * Who is signed in comes from the FastAPI service (server/): it owns sign-up, login, sessions, MFA, email, dentist
 * profiles and clinic membership. This app trusts its access cookie (a JWT it signs) and keeps a cached `users` row per
 * FastAPI user - same uuid - so every table here that points at users(id) keeps working. The cache is refreshed from
 * GET /api/v1/auth/me at most every SYNC_MS (or on demand), which also brings clinic roles across.
 */

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

export const ACCESS_COOKIE = "fmd_access";
const API_URL = () => process.env.API_URL ?? "http://localhost:8000";
// ponytail: a session revoked in FastAPI stays usable here until its 15-minute access token expires; FastAPI itself
// rejects it at once. Check /auth/me on every request if that window matters.
const SYNC_MS = 5 * 60_000;

/** FastAPI clinic roles → this app's clinic roles (front desk = FastAPI's receptionist). */
const CLINIC_ROLES: Record<string, Role> = {
  owner: "clinic_owner",
  dentist: "clinic_dentist",
  receptionist: "clinic_front_desk",
  finance: "clinic_finance",
  assistant: "clinic_assistant",
};

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
const USER_COLS = "id, email, phone, name, account_type, language, status, created_at";

/** What FastAPI's GET /api/v1/auth/me returns (the fields used here). */
export type ApiMe = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  mfa_methods?: string[];
  city: string | null;
  dentist_profile: { council: string; registration_no: string; verification_status: string } | null;
  workspaces: { clinic_id: string; clinic_name: string; role: string }[];
};

/* ---------------- the FastAPI access token ---------------- */

/** FastAPI signs with HMAC-SHA256(SECRET_KEY, "fmd-access-jwt-v1") (server/app/core/security.py). */
const signingKey = () => {
  const secret = process.env.FMD_API_JWT_SECRET;
  return secret ? createHmac("sha256", secret).update("fmd-access-jwt-v1").digest() : null;
};

/** The token's user and session ids, or null unless it is FastAPI's, unexpired and untampered. */
export function verifyAccess(token: string): { sub: string; sid: string } | null {
  const key = signingKey();
  const parts = token.split(".");
  if (!key || parts.length !== 3) return null;
  const [h, p, s] = parts;
  const want = createHmac("sha256", key).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const c = JSON.parse(Buffer.from(p, "base64url").toString());
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (header.alg !== "HS256" || c.iss !== "fmd-api" || !aud.includes("fmd")) return null;
    if (typeof c.exp !== "number" || c.exp * 1000 <= Date.now()) return null;
    if (typeof c.sub !== "string" || typeof c.sid !== "string") return null;
    return { sub: c.sub, sid: c.sid };
  } catch {
    return null;
  }
}

function accessToken(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readCookie(req, ACCESS_COOKIE) ?? bearer;
}

/** FastAPI's view of the user: null when it rejects the token, "unreachable" when it can't be asked. */
async function fetchMe(token: string): Promise<ApiMe | null | "unreachable"> {
  try {
    const res = await fetch(`${API_URL()}/api/v1/auth/me`, { headers: { cookie: `${ACCESS_COOKIE}=${token}` }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) return "unreachable";
    return (await res.json()) as ApiMe;
  } catch {
    return "unreachable";
  }
}

/** Mirror a FastAPI user into this app: profile, account type, staff roles, clinic roles, first consents. */
export function storeMe(me: ApiMe): User {
  const now = Date.now();
  // only a verified email identifies someone here (staff bootstrap goes by email)
  const email = me.email_verified && me.email ? me.email.toLowerCase() : null;
  return tx(() => {
    const cached = one<User>(`SELECT ${USER_COLS} FROM users WHERE id = ?`, me.id);
    const accountType: AccountType = me.dentist_profile ? "dentist" : (cached?.account_type ?? "patient");
    // an older local-only account holding the same email or phone gives it up (FastAPI is the source of truth)
    if (email) run("UPDATE users SET email = NULL WHERE email = ? AND id != ? AND phone IS NOT NULL", email, me.id);
    run("UPDATE users SET phone = NULL WHERE phone = ? AND id != ? AND email IS NOT NULL", me.phone, me.id);
    const extra = JSON.stringify({
      emailVerified: me.email_verified,
      pendingEmail: me.email_verified ? null : me.email,
      mfaEnabled: me.mfa_enabled,
      mfaMethods: me.mfa_methods ?? [],
      city: me.city,
      dentistProfile: me.dentist_profile,
      workspaces: me.workspaces,
    });
    run(
      `INSERT INTO users (id, email, phone, name, account_type, created_at, updated_at, synced_at, api_me)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, phone = excluded.phone, name = excluded.name,
         account_type = excluded.account_type, updated_at = excluded.updated_at, synced_at = excluded.synced_at, api_me = excluded.api_me`,
      me.id,
      email,
      me.phone,
      me.full_name,
      accountType,
      now,
      now,
      now,
      extra,
    );
    if (!cached) {
      // terms and privacy were accepted at FastAPI sign-up; the optional purposes start off
      for (const p of CONSENT_PURPOSES) recordConsent(me.id, p, p === "terms" || p === "privacy");
      audit(me.id, "user.linked", "user", me.id);
    }
    // account type is one role at a time
    run(`DELETE FROM user_roles WHERE user_id = ? AND role IN (${ACCOUNT_TYPES.map(() => "?").join(",")}) AND role != ?`, me.id, ...ACCOUNT_TYPES, accountType);
    grantRole(me.id, accountType, null);
    if (email) for (const r of bootstrapRoles(email)) grantRole(me.id, r, null);
    // clinic roles mirror FastAPI's active memberships exactly
    run("DELETE FROM user_roles WHERE user_id = ? AND role LIKE 'clinic_%'", me.id);
    for (const w of me.workspaces) {
      const role = CLINIC_ROLES[w.role];
      if (role) run("INSERT OR IGNORE INTO user_roles (user_id, role, org_id, granted_at) VALUES (?, ?, ?, ?)", me.id, role, w.clinic_id, now);
    }
    return one<User>(`SELECT ${USER_COLS} FROM users WHERE id = ?`, me.id)!;
  });
}

/** FMD staff accounts are bootstrapped from env (comma-separated verified emails), not self-selected. */
function bootstrapRoles(email: string): Role[] {
  const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const roles: Role[] = [];
  if (list(process.env.FMD_OPS_EMAILS).includes(email)) roles.push("fmd_ops");
  if (list(process.env.FMD_ADMIN_EMAILS).includes(email)) roles.push("super_admin");
  if (list(process.env.FMD_ACCOUNTANT_EMAILS).includes(email)) roles.push("accountant");
  return roles;
}

export function grantRole(userId: string, role: Role, by: string | null, orgId = "") {
  const r = run("INSERT OR IGNORE INTO user_roles (user_id, role, org_id, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)", userId, role, orgId, Date.now(), by);
  if (r.changes) audit(by, "role.granted", "user", userId, { role, orgId });
}

export function rolesOf(userId: string): { role: Role; org_id: string }[] {
  return all("SELECT role, org_id FROM user_roles WHERE user_id = ?", userId);
}

/* ---------------- the signed-in user ---------------- */

export type Auth = { user: User; roles: Role[]; sessionId: string };

/**
 * Resolve the signed-in user, or null. Every protected service call starts here. `fresh` re-reads FastAPI now
 * (after sign-in, or a change made there) instead of trusting a cache up to SYNC_MS old.
 */
export async function currentAuth(req: Request, { fresh = false } = {}): Promise<Auth | null> {
  const token = accessToken(req);
  const claims = token ? verifyAccess(token) : null;
  if (!token || !claims) return null;
  let user = one<User & { synced_at: number }>(`SELECT ${USER_COLS}, synced_at FROM users WHERE id = ?`, claims.sub) ?? null;
  if (fresh || !user || Date.now() - user.synced_at > SYNC_MS) {
    const me = await fetchMe(token);
    if (me === null) return null; // FastAPI no longer accepts this session
    if (me !== "unreachable" && me.id === claims.sub) user = { ...storeMe(me), synced_at: Date.now() };
  }
  if (!user || user.status === "disabled") return null; // never seen before and FastAPI unreachable: signed out
  const plain: User = { id: user.id, email: user.email, phone: user.phone, name: user.name, account_type: user.account_type, language: user.language, status: user.status, created_at: user.created_at };
  return { user: plain, roles: rolesOf(user.id).map((r) => r.role), sessionId: claims.sid };
}

export async function requireAuth(req: Request, opts?: { fresh?: boolean }): Promise<Auth> {
  const a = await currentAuth(req, opts);
  if (!a) throw unauthenticated();
  return a;
}

export function requireRole(a: Auth, ...roles: Role[]) {
  if (!roles.some((r) => a.roles.includes(r))) {
    audit(a.user.id, "access.denied", "role", null, { needed: roles });
    throw forbidden();
  }
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

/** Latest decision per purpose (history is kept - consents are append-only). */
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

/** Language is this app's; the name belongs to the FastAPI account (set at sign-up). */
export function updateProfile(a: Auth, input: { language?: unknown }) {
  const language = input.language === undefined ? a.user.language : String(input.language);
  if (!["en", "hi", "kn", "te", "ta"].includes(language)) throw bad("Unsupported language.");
  run("UPDATE users SET language = ?, updated_at = ? WHERE id = ?", language, Date.now(), a.user.id);
  audit(a.user.id, "profile.updated", "user", a.user.id);
  return { ...a.user, language };
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

/** What a client may see about the signed-in user: this app's view plus the FastAPI account's. */
export function publicMe(a: Auth) {
  const { user } = a;
  const api = JSON.parse(one<{ api_me: string }>("SELECT api_me FROM users WHERE id = ?", user.id)?.api_me ?? "{}");
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
    emailVerified: Boolean(api.emailVerified),
    pendingEmail: (api.pendingEmail as string | null) ?? null,
    mfaEnabled: Boolean(api.mfaEnabled),
    city: (api.city as string | null) ?? null,
    dentistProfile: (api.dentistProfile as ApiMe["dentist_profile"]) ?? null,
    workspaces: (api.workspaces as ApiMe["workspaces"]) ?? [],
  };
}
