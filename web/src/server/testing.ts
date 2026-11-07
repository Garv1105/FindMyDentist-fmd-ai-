import { randomUUID } from "node:crypto";
import { grantRole, rolesOf, storeMe, updateConsents, type AccountType, type Auth, type ConsentPurpose, type Role, type User } from "./auth.ts";
import { one, run } from "./db.ts";

let n = 0;

/**
 * Test helper: a signed-in user as if they had signed up in the FastAPI service and opened this app once (the cached
 * users row, account type, consents), plus any FMD roles. Accounts themselves are tested in server/ (pytest).
 */
export function testUser(
  email: string,
  opts: { name?: string; accountType?: AccountType | string; roles?: Role[]; consents?: Partial<Record<ConsentPurpose, boolean>> } = {},
): Auth {
  const accountType = (opts.accountType ?? "patient") as AccountType;
  const user = storeMe({
    id: randomUUID(),
    full_name: opts.name ?? "Test User",
    phone: `+9190000${String(++n).padStart(5, "0")}`,
    email,
    email_verified: true,
    mfa_enabled: false,
    city: null,
    dentist_profile: accountType === "dentist" ? { council: "Karnataka State Dental Council", registration_no: `T-${n}`, verification_status: "unverified" } : null,
    workspaces: [],
  });
  if (accountType !== user.account_type) {
    // student and company are chosen in this app, not in FastAPI
    run("UPDATE users SET account_type = ? WHERE id = ?", accountType, user.id);
    run("DELETE FROM user_roles WHERE user_id = ? AND role = ?", user.id, user.account_type);
    grantRole(user.id, accountType, null);
  }
  for (const r of opts.roles ?? []) grantRole(user.id, r, null);
  const auth: Auth = {
    user: one<User>("SELECT id, email, phone, name, account_type, language, status, created_at FROM users WHERE id = ?", user.id)!,
    roles: rolesOf(user.id).map((r) => r.role),
    sessionId: "test-session",
  };
  if (opts.consents) updateConsents(auth, opts.consents);
  return auth;
}
