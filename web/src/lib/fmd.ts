/**
 * Client for the FMD FastAPI backend (repo main-websie/server). The browser calls /api/v1/* on this site and
 * next.config rewrites it to FMD_API_URL, so the backend's HttpOnly cookies (fmd_access, fmd_refresh) stay first-party.
 * Kept free of React so it can be tested with node --test.
 */

const BASE = "/api/v1";

/** UserRead in server/app/schemas/user.py */
export type User = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  year_of_birth: number | null;
  gender: string | null;
  city: string | null;
  created_at: string;
};

/** DentistProfileRead. Verification is set by FMD staff; changing council or registration number resets it to unverified. */
export type DentistProfile = {
  council: string;
  registration_no: string;
  qualifications: string | null;
  specialisation: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
};

/** MeRead: GET /auth/me */
export type Me = User & {
  mfa_method: string | null;
  mfa_methods: string[];
  dentist_profile: DentistProfile | null;
  workspaces: { clinic_id: string; clinic_name: string; role: "owner" | "dentist" | "receptionist" }[];
};

export type MfaChallenge = { mfa_required: true; challenge_token: string };

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

/** The backend's message: AppError gives {error: {code, message}}; FastAPI validation gives {detail: [{msg}]}. */
export function errorMessage(status: number, data: unknown): string {
  const d = data as { error?: { message?: string }; detail?: { msg?: string }[] } | null;
  if (d?.error?.message) return d.error.message;
  const msg = Array.isArray(d?.detail) ? d.detail[0]?.msg : undefined;
  if (msg) return msg.replace(/^Value error, /, "");
  if (status === 429) return "Too many tries. Wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

/**
 * The backend's 401 for a missing or expired access token (server/app/api/deps.py). Every other 401 is a wrong code or
 * password, and retrying it would only burn one of the user's OTP tries.
 */
const EXPIRED = "Not authenticated";

let refreshing: Promise<boolean> | null = null;
/** One refresh at a time: the refresh token rotates, so parallel refreshes would look like token theft. */
const refresh = () =>
  (refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST" })
    .then((r) => r.ok, () => false)
    .finally(() => (refreshing = null)));

type Init = { method?: string; body?: unknown };

export async function fmd<T>(path: string, init: Init = {}, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Can't reach FMD right now. Check your connection and try again.", 0, "network");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  const expired = res.status === 401 && (data as { error?: { message?: string } } | null)?.error?.message === EXPIRED;
  if (expired && retry && (await refresh())) return fmd<T>(path, init, false);
  if (!res.ok) throw new ApiError(errorMessage(res.status, data), res.status, (data as { error?: { code?: string } } | null)?.error?.code ?? "error");
  return data as T;
}

export type OtpPurpose = "signup" | "login" | "reset_password";

export const auth = {
  sendOtp: (identifier: string, purpose: OtpPurpose) => fmd<void>("/auth/otp", { body: { identifier, purpose } }),
  /** Non-production backends hand back the last OTP so the demo works without SMS. */
  devOtp: () => fmd<{ code: string | null }>("/auth/otp/dev").then((r) => r.code, () => null),
  checkPassword: (password: string) => fmd<void>("/auth/password/check", { body: { password } }),
  register: (b: { full_name: string; phone: string; password: string; otp: string; marketing_opt_in: boolean }) =>
    fmd<User>("/auth/register", { body: { ...b, accept_terms: true, age_confirmed: true } }),
  loginPassword: (login: string, password: string) => fmd<User | MfaChallenge>("/auth/login/password", { body: { login, password } }),
  verifyMfa: (challenge_token: string, code: string) => fmd<User>("/auth/mfa/verify", { body: { challenge_token, code } }),
  loginOtp: (identifier: string, code: string) => fmd<User>("/auth/login/otp", { body: { identifier, code } }),
  verifyResetOtp: (identifier: string, code: string) =>
    fmd<{ proof_token: string }>("/auth/otp/verify", { body: { identifier, code, purpose: "reset_password" } }),
  resetPassword: (identifier: string, proof_token: string, new_password: string) =>
    fmd<void>("/auth/password/reset", { body: { identifier, proof_token, new_password } }),
  logout: () => fmd<void>("/auth/logout", { method: "POST" }),
  logoutAll: () => fmd<void>("/auth/logout-all", { method: "POST" }),
  me: () => fmd<Me>("/auth/me"),
};

/** SessionRead: GET /me/sessions */
export type Session = {
  id: string;
  created_at: string;
  last_seen_at: string;
  auth_method: string;
  ip: string | null;
  user_agent: string | null;
  current: boolean;
};

/** /me/*: account settings. Changing or removing a verified email and turning two-step off need the current password. */
export const account = {
  addEmail: (email: string, password?: string) => fmd<void>("/me/email", { body: { email, password } }),
  verifyEmail: (code: string) => fmd<void>("/me/email/verify", { body: { code } }),
  removeEmail: (password: string) => fmd<void>("/me/email", { method: "DELETE", body: { password } }),
  startMfa: () => fmd<void>("/me/mfa/start", { method: "POST" }),
  enableMfa: (code: string) => fmd<void>("/me/mfa", { body: { code } }),
  disableMfa: (password: string) => fmd<void>("/me/mfa", { method: "DELETE", body: { password } }),
  sessions: () => fmd<Session[]>("/me/sessions"),
  revokeSession: (id: string) => fmd<void>(`/me/sessions/${id}`, { method: "DELETE" }),
  /** 409 when the registration number belongs to another FMD account */
  saveDentistProfile: (p: Omit<DentistProfile, "verification_status">) => fmd<DentistProfile>("/me/dentist-profile", { method: "PUT", body: p }),
};

/** Same rules as Password in server/app/schemas/auth.py; the server still checks, and also rejects breached passwords. */
const RULES: [RegExp, string][] = [
  [/^.{8,128}$/, "8 or more characters"],
  [/[a-z]/, "a lowercase letter"],
  [/[A-Z]/, "an uppercase letter"],
  [/[0-9]/, "a number"],
  [/[^A-Za-z0-9]/, "a special character"],
];
export const passwordRules = (pw: string) => RULES.map(([re, label]) => ({ label, ok: re.test(pw) }));

/** "+919876543210" → "+91 98765 43210"; other numbers as stored */
export const fmtPhone = (p: string) => p.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");

/** "Priya Ramesh Sharma" → "PS" */
export const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? (w.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
};

/** "Chrome on Windows" from a User-Agent; plain fallbacks for anything unknown */
export function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : null;
  const os = /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Other device";
}
