import { randomUUID } from "node:crypto";
import { grantRole, rolesOf, storeMe, updateConsents, type AccountType, type ApiMe, type Auth, type ConsentPurpose, type Role, type User } from "./auth.ts";
import { one, run } from "./db.ts";

/*
 * Test helpers. Accounts and clinic teams live in the FastAPI service (tested in server/ with pytest); here a user
 * arrives the way this app sees them: an account synced from FastAPI's /auth/me.
 */

let n = 0;
const accounts = new Map<string, ApiMe>(); // what FastAPI would say about each test user

function authOf(id: string): Auth {
  return {
    user: one<User>("SELECT id, email, phone, name, account_type, language, status, created_at FROM users WHERE id = ?", id)!,
    roles: rolesOf(id).map((r) => r.role),
    sessionId: "test-session",
  };
}

/** A signed-in user as if they had signed up in FastAPI and opened this app once, plus any FMD roles. */
export function testUser(
  email: string,
  opts: { name?: string; accountType?: AccountType | string; roles?: Role[]; consents?: Partial<Record<ConsentPurpose, boolean>> } = {},
): Auth {
  const accountType = (opts.accountType ?? "patient") as AccountType;
  const me: ApiMe = {
    id: randomUUID(),
    full_name: opts.name ?? "Test User",
    phone: `+9190000${String(++n).padStart(5, "0")}`,
    email,
    email_verified: true,
    mfa_enabled: false,
    city: null,
    dentist_profile: accountType === "dentist" ? { council: "Karnataka State Dental Council", registration_no: `T-${n}`, verification_status: "unverified" } : null,
    workspaces: [],
  };
  accounts.set(me.id, me);
  const user = storeMe(me);
  if (accountType !== user.account_type) {
    // student and company are chosen in this app, not in FastAPI
    run("UPDATE users SET account_type = ? WHERE id = ?", accountType, user.id);
    run("DELETE FROM user_roles WHERE user_id = ? AND role = ?", user.id, user.account_type);
    grantRole(user.id, accountType, null);
  }
  for (const r of opts.roles ?? []) grantRole(user.id, r, null);
  const auth = authOf(user.id);
  if (opts.consents) updateConsents(auth, opts.consents);
  return auth;
}

/** A FastAPI clinic id for tests (FastAPI creates the clinic; this app only links a workspace to it). */
export const apiClinic = () => randomUUID();

/**
 * Membership of a FastAPI clinic, as FastAPI reports it on the user's next sync (an owner who created it, or staff who
 * accepted an invitation). Roles are FastAPI's: owner, dentist, receptionist, finance, assistant.
 */
export function joinClinic(a: Auth, apiClinicId: string, role: string): Auth {
  const me = accounts.get(a.user.id)!;
  me.workspaces = [...me.workspaces.filter((w) => w.clinic_id !== apiClinicId), { clinic_id: apiClinicId, clinic_name: "Test clinic", role }];
  storeMe(me);
  return authOf(a.user.id);
}

/** Leaving (or being removed from) a FastAPI clinic, as seen on the next sync. */
export function leaveClinic(a: Auth, apiClinicId: string): Auth {
  const me = accounts.get(a.user.id)!;
  me.workspaces = me.workspaces.filter((w) => w.clinic_id !== apiClinicId);
  storeMe(me);
  return authOf(a.user.id);
}

/** A FastAPI clinic created by `owner`, with this app's workspace set up for it. */
export function testClinic(createWorkspace: (a: Auth, input: Record<string, unknown>) => { clinicId: string }, owner: Auth, name = "Smile Care", area = "Hebbal") {
  const api = apiClinic();
  const o = joinClinic(owner, api, "owner");
  const { clinicId } = createWorkspace(o, { apiClinicId: api, name, city: "Bengaluru", area });
  return { clinicId, api, owner: o };
}

/** This app's clinic role names → FastAPI's (front desk is FastAPI's receptionist). */
export const apiRole = (role: string) => (role === "front_desk" ? "receptionist" : role);
