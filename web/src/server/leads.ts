import { randomUUID } from "node:crypto";
import { audit, one, run, tx } from "./db.ts";
import { bad, oneOf, str } from "./http.ts";

/**
 * Homepage leads: a clinic asking for a Clinic OS demo or early access, and the
 * general product-updates waitlist. Collects only what's needed to reply (brief §6, §19).
 */
export const LEAD_KINDS = ["clinic_demo", "clinic_early_access", "waitlist"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

const CONSENT_VERSION: Record<LeadKind, string> = {
  clinic_demo: "clinic-lead-2026-10",
  clinic_early_access: "clinic-lead-2026-10",
  waitlist: "waitlist-2026-10",
};

const email = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 254) throw bad("Enter a valid email address.");
  return s;
};

const mobile = (v: unknown) => {
  const d = (typeof v === "string" ? v : "").replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(d)) throw bad("Enter a valid 10-digit Indian mobile number.");
  return `+91${d}`;
};

/**
 * Always answers with the same shape, so the response never reveals whether an
 * email is already on a list. Bots that fill the hidden `website` field are dropped silently.
 */
export function submitLead(input: Record<string, unknown>): { ok: true } {
  const kind = oneOf(input.kind, "Request type", LEAD_KINDS);
  if (input.consent !== true) throw bad("Please agree to be contacted about this request.");
  if (typeof input.website === "string" && input.website.trim()) return { ok: true }; // honeypot

  const clinic = kind !== "waitlist";
  const l = {
    email: email(input.email),
    name: clinic ? str(input.name, "Your name", { min: 2, max: 80 }) : "",
    clinic_name: clinic ? str(input.clinicName, "Clinic name", { min: 2, max: 120 }) : "",
    city: clinic ? str(input.city, "City", { min: 2, max: 80 }) : "",
    phone: clinic ? mobile(input.phone) : "",
  };

  const now = Date.now();
  // one live request per email and kind per day: repeats are acknowledged, not stored again
  const dup = one<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE email = ? AND kind = ? AND created_at > ?", l.email, kind, now - 24 * 3600_000)!.n;
  if (dup) return { ok: true };

  const id = randomUUID();
  tx(() => {
    run(
      "INSERT INTO leads (id, kind, name, clinic_name, city, phone, email, consent_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, kind, l.name, l.clinic_name, l.city, l.phone, l.email, CONSENT_VERSION[kind], now,
    );
    audit(null, "lead.submitted", "lead", id, { kind });
  });
  return { ok: true };
}
