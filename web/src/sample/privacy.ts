/**
 * Privacy and data (plan part 1.6, PDR §4.1, §13, §15, Annex L): sample data until the backend has it. Proposed API:
 *   GET  /me/consents                    → Consent[] (the backend already records terms, privacy_notice, marketing at sign-up)
 *   POST /me/consents/{purpose} {granted} → Consent; 422 for a required purpose
 *   GET/PUT /me/communication-preferences → CommPrefs (422 with checkPrefs' messages; the server forces the security row)
 *   POST/GET /me/data-export              → ExportJob; the file is a signed link that expires
 *   POST/GET/DELETE /me/deletion-request  → DeletionRequest; POST needs a fresh OTP
 * Times take `now` so the tests can move the clock.
 */
import { getPublicProfile } from "./dentist.ts";
import { getAccountType, getCompany, getPatientPrefs, getStudent } from "./onboarding.ts";
import { read, write } from "./store.ts";

/* ---------------- consents ---------------- */

export type Purpose = "terms" | "privacy_notice" | "marketing" | "ai_history" | "personalisation";
export const NOTICE_VERSION = "2026-10";

export const PURPOSES: Record<Purpose, { label: string; text: string; required: boolean }> = {
  terms: { label: "Terms of Use", text: "The rules for using FMD.", required: true },
  privacy_notice: { label: "Privacy Notice", text: "How FMD collects, uses and protects your information.", required: true },
  marketing: { label: "Offers and dental tips", text: "Occasional offers and dental tips from FMD. Never sold to others.", required: false },
  ai_history: {
    label: "Save my FMD AI conversations",
    text: "Lets you come back to past chats. When off, a conversation is gone once you close it.",
    required: false,
  },
  personalisation: {
    label: "Personalise what I see",
    text: "Uses what you search, save and tell us to suggest content and dentists. When off, you see general suggestions.",
    required: false,
  },
};

/** latest state of one purpose; `at` is null when it was never given */
export type Consent = { purpose: Purpose; granted: boolean; at: string | null; version: string | null };

const key = (what: string, userId: string) => `fmd-demo:${what}:${userId}`;

export async function getConsents(userId: string, signedUpAt: string): Promise<Consent[]> {
  const saved = read<Partial<Record<Purpose, Consent>>>(key("consents", userId)) ?? {};
  return (Object.keys(PURPOSES) as Purpose[]).map(
    (purpose) =>
      saved[purpose] ??
      (PURPOSES[purpose].required
        ? { purpose, granted: true, at: signedUpAt, version: NOTICE_VERSION } // given at sign-up
        : { purpose, granted: false, at: null, version: null }),
  );
}

export async function setConsent(userId: string, purpose: Purpose, granted: boolean, now = Date.now()): Promise<Consent> {
  if (PURPOSES[purpose].required && !granted) throw new Error(`${PURPOSES[purpose].label} is needed to use FMD. To withdraw it, delete your account.`);
  const all = read<Partial<Record<Purpose, Consent>>>(key("consents", userId)) ?? {};
  const c: Consent = { purpose, granted, at: new Date(now).toISOString(), version: NOTICE_VERSION };
  write(key("consents", userId), { ...all, [purpose]: c });
  // no consent, no offers: withdrawing marketing switches every offers channel off
  if (purpose === "marketing" && !granted) {
    const p = await getPrefs(userId);
    await savePrefs(userId, { ...p, matrix: { ...p.matrix, offers: NONE } }, { marketing: false, emailVerified: true });
  }
  return c;
}

/* ---------------- communication preferences ---------------- */

export type Channel = "sms" | "whatsapp" | "email" | "push";
export type Kind = "appointments" | "reminders" | "security" | "offers";
export const CHANNELS: Record<Channel, string> = { sms: "SMS", whatsapp: "WhatsApp", email: "Email", push: "App" };
export const KINDS: Record<Kind, { label: string; text: string }> = {
  appointments: { label: "Appointments and bookings", text: "Confirmations, changes and cancellations." },
  reminders: { label: "Reminders", text: "Upcoming visits, check-ups and the care reminders you set." },
  security: { label: "Account and security", text: "Sign-ins, password changes and account alerts. Always on, so you hear about anything unusual." },
  offers: { label: "Offers and dental tips", text: "Only with your consent above." },
};

export type CommPrefs = { matrix: Record<Kind, Record<Channel, boolean>>; quiet: { on: boolean; from: string; to: string } };

const NONE: Record<Channel, boolean> = { sms: false, whatsapp: false, email: false, push: false };
/** the server enforces this row whatever is sent */
export const SECURITY: Record<Channel, boolean> = { sms: true, whatsapp: false, email: true, push: true };
export const DEFAULT_PREFS: CommPrefs = {
  matrix: {
    appointments: { sms: true, whatsapp: true, email: true, push: true },
    reminders: { sms: false, whatsapp: true, email: false, push: true },
    security: SECURITY,
    offers: NONE, // marketing is off by default (PDR §13)
  },
  quiet: { on: true, from: "21:00", to: "08:00" },
};

/** The first problem with a set of preferences, or null. */
export function checkPrefs(p: CommPrefs, ctx: { marketing: boolean; emailVerified: boolean }): string | null {
  if (!Object.values(p.matrix.appointments).some(Boolean)) return "Keep at least one way to hear about your appointments.";
  if (!ctx.marketing && Object.values(p.matrix.offers).some(Boolean)) return "Turn on “Offers and dental tips” in your consents first.";
  if (!ctx.emailVerified && (["appointments", "reminders", "offers"] as Kind[]).some((k) => p.matrix[k].email)) return "Add and verify an email in your account to get email messages.";
  if (p.quiet.on && p.quiet.from === p.quiet.to) return "Quiet hours need different start and end times.";
  return null;
}

export async function getPrefs(userId: string): Promise<CommPrefs> {
  return read<CommPrefs>(key("comm", userId)) ?? DEFAULT_PREFS;
}

export async function savePrefs(userId: string, p: CommPrefs, ctx: { marketing: boolean; emailVerified: boolean }): Promise<CommPrefs> {
  const problem = checkPrefs(p, ctx);
  if (problem) throw new Error(problem);
  const clean = { ...p, matrix: { ...p.matrix, security: SECURITY } };
  write(key("comm", userId), clean);
  return clean;
}

/* ---------------- download my data ---------------- */

export type ExportJob = { status: "preparing" | "ready"; requested_at: string; ready_at: string | null; expires_at: string | null };
/** the demo pretends the file takes this long to prepare */
export const PREPARE_MS = 8000;
export const LINK_DAYS = 7;

export async function requestExport(userId: string, now = Date.now()): Promise<ExportJob> {
  const job: ExportJob = { status: "preparing", requested_at: new Date(now).toISOString(), ready_at: null, expires_at: null };
  write(key("export", userId), job);
  return job;
}

/** null when there's no request, or its link has expired */
export async function getExport(userId: string, now = Date.now()): Promise<ExportJob | null> {
  const job = read<ExportJob>(key("export", userId));
  if (!job) return null;
  const ready = Date.parse(job.requested_at) + PREPARE_MS;
  if (now < ready) return job;
  const expires = ready + LINK_DAYS * 86_400_000;
  if (now >= expires) return null;
  return { ...job, status: "ready", ready_at: new Date(ready).toISOString(), expires_at: new Date(expires).toISOString() };
}

/** Everything FMD Main holds about this person so far. The real export adds records, appointments, posts and more. */
export async function buildExport(me: { id: string; created_at: string }) {
  return {
    format: "FMD account data export (demo)",
    exported_at: new Date().toISOString(),
    account: me,
    account_type: await getAccountType(me.id),
    patient_preferences: await getPatientPrefs(me.id),
    student_profile: await getStudent(me.id),
    company_profile: await getCompany(me.id),
    dentist_public_profile: await getPublicProfile(me.id),
    consents: await getConsents(me.id, me.created_at),
    communication_preferences: await getPrefs(me.id),
  };
}

/* ---------------- delete my account ---------------- */

export type DeletionRequest = { status: "received"; requested_at: string; reason: string | null };
export const REASONS = ["I don't use FMD any more", "I have another account", "Privacy concerns", "Too many messages", "Something else"];

export async function getDeletion(userId: string) {
  return read<DeletionRequest>(key("deletion", userId));
}
export async function requestDeletion(userId: string, reason: string | null, now = Date.now()): Promise<DeletionRequest> {
  const r: DeletionRequest = { status: "received", requested_at: new Date(now).toISOString(), reason };
  write(key("deletion", userId), r);
  return r;
}
/** possible until the team starts on it */
export async function cancelDeletion(userId: string) {
  write(key("deletion", userId), null);
}
