import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { requireRole, type Auth } from "./auth.ts";
import { bad, HttpError, notFound } from "./http.ts";
import { CITIES, LANGUAGES, SERVICES, SPECIALTIES } from "../lib/catalog.ts";
import { nextAvailableMap } from "./booking.ts";

/* ---------------- types ---------------- */

type Row = {
  id: string;
  name: string;
  photo: string;
  specialty: string;
  experience_years: number | null;
  qualifications: string;
  languages: string;
  bio: string;
  verification_status: "unverified" | "pending" | "verified";
  verification_checks: string;
  is_demo: number;
  clinic_id: string | null;
  clinic_name: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  fee_note: string | null;
};

export type ProviderCard = {
  id: string;
  name: string;
  photo: string;
  specialty: string;
  experienceYears: number | null;
  languages: string[];
  services: string[];
  clinic: { name: string; area: string; city: string } | null;
  verification: { status: Row["verification_status"]; checks: string };
  sponsored: { sponsor: string } | null;
  /** No reviews system yet (Annex G) — never invent ratings. */
  rating: null;
  /** Live availability only from a connected schedule (MAIN-26); filled by the booking slice. */
  nextAvailable: number | null;
  demo: boolean;
};

const parse = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

const BASE = `SELECT d.*, c.id AS clinic_id, c.name AS clinic_name, c.city, c.area, c.address, c.phone, c.hours, dc.fee_note
  FROM dentists d
  LEFT JOIN dentist_clinics dc ON dc.dentist_id = d.id
  LEFT JOIN clinics c ON c.id = dc.clinic_id`;

function servicesOf(ids: string[]) {
  const m = new Map<string, string[]>();
  if (!ids.length) return m;
  const rows = all<{ dentist_id: string; service: string }>(
    `SELECT dentist_id, service FROM dentist_services WHERE dentist_id IN (${ids.map(() => "?").join(",")}) ORDER BY service`,
    ...ids,
  );
  for (const r of rows) m.set(r.dentist_id, [...(m.get(r.dentist_id) ?? []), r.service]);
  return m;
}

function activeSponsors(ids: string[], now = Date.now()) {
  const m = new Map<string, string>();
  if (!ids.length) return m;
  for (const r of all<{ dentist_id: string; sponsor: string }>(
    `SELECT dentist_id, sponsor FROM placements WHERE kind = 'sponsored' AND starts_at <= ? AND ends_at > ? AND dentist_id IN (${ids.map(() => "?").join(",")})`,
    now,
    now,
    ...ids,
  ))
    m.set(r.dentist_id, r.sponsor);
  return m;
}

function toCard(r: Row, services: string[], sponsor: string | undefined, next?: number): ProviderCard {
  return {
    id: r.id,
    name: r.name,
    photo: r.photo,
    specialty: r.specialty,
    experienceYears: r.experience_years,
    languages: parse(r.languages),
    services,
    clinic: r.clinic_name ? { name: r.clinic_name, area: r.area ?? "", city: r.city ?? "" } : null,
    verification: { status: r.verification_status, checks: r.verification_checks },
    sponsored: sponsor ? { sponsor } : null,
    rating: null,
    nextAvailable: next ?? null,
    demo: r.is_demo === 1,
  };
}

/* ---------------- search ---------------- */

export type SearchInput = { q?: string; city?: string; specialty?: string; service?: string; language?: string; sort?: string; page?: number };
const PAGE_SIZE = 8;

/**
 * Organic results are ranked on relevance + verification only. Sponsored profiles are returned
 * separately (at most 1 per page) so paid placement never silently changes organic order (MAIN-23, ANX-D-04).
 */
export function searchProviders(input: SearchInput) {
  const city = input.city && (CITIES as readonly string[]).includes(input.city) ? input.city : undefined;
  const specialty = input.specialty && (SPECIALTIES as readonly string[]).includes(input.specialty) ? input.specialty : undefined;
  const service = input.service && (SERVICES as readonly string[]).includes(input.service) ? input.service : undefined;
  const language = input.language && (LANGUAGES as readonly string[]).includes(input.language) ? input.language : undefined;
  const q = (input.q ?? "").trim().toLowerCase().slice(0, 80);
  const sort = input.sort === "experience" || input.sort === "name" ? input.sort : "relevance";
  const page = Math.max(1, Math.min(50, Math.floor(input.page ?? 1)));

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (city) {
    where.push("c.city = ?");
    params.push(city);
  }
  if (specialty) {
    where.push("d.specialty = ?");
    params.push(specialty);
  }
  if (service) {
    where.push("EXISTS (SELECT 1 FROM dentist_services s WHERE s.dentist_id = d.id AND s.service = ?)");
    params.push(service);
  }
  if (language) {
    where.push("d.languages LIKE ?");
    params.push(`%"${language}"%`);
  }
  if (q) {
    where.push(
      "(lower(d.name) LIKE ? OR lower(d.specialty) LIKE ? OR lower(c.area) LIKE ? OR lower(c.name) LIKE ? OR EXISTS (SELECT 1 FROM dentist_services s WHERE s.dentist_id = d.id AND lower(s.service) LIKE ?))",
    );
    params.push(...Array(5).fill(`%${q}%`));
  }
  const rows = all<Row>(`${BASE}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`, ...params);

  // one card per dentist (first clinic) — multi-clinic dentists list all clinics on the profile
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  const score = (r: Row) => (r.verification_status === "verified" ? 2 : r.verification_status === "pending" ? 1 : 0) + (q && r.name.toLowerCase().includes(q) ? 3 : 0);
  unique.sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "experience" ? (b.experience_years ?? -1) - (a.experience_years ?? -1) : score(b) - score(a) || a.name.localeCompare(b.name),
  );

  const ids = unique.map((r) => r.id);
  const services = servicesOf(ids);
  const sponsors = activeSponsors(ids);
  const next = nextAvailableMap(ids);
  const organic = unique.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => toCard(r, services.get(r.id) ?? [], sponsors.get(r.id), next.get(r.id)));
  // a sponsored profile already on this page keeps its label there instead of appearing twice
  const onPage = new Set(organic.map((c) => c.id));
  const sponsoredRow = unique.find((r) => sponsors.has(r.id) && !onPage.has(r.id));
  const sponsored = sponsoredRow ? [toCard(sponsoredRow, services.get(sponsoredRow.id) ?? [], sponsors.get(sponsoredRow.id), next.get(sponsoredRow.id))] : [];

  return {
    organic,
    sponsored,
    total: unique.length,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(unique.length / PAGE_SIZE)),
    filters: { city, specialty, service, language, q, sort },
    // no-result help (PLT-06)
    suggestions: unique.length === 0 ? suggest({ city, specialty, service, language, q }) : [],
  };
}

function suggest(f: { city?: string; specialty?: string; service?: string; language?: string; q?: string }) {
  const out: string[] = [];
  if (f.language) out.push(`Try any language instead of ${f.language}.`);
  if (f.specialty) out.push(`Try a General Dentist, who can refer you to a ${f.specialty} if needed.`);
  if (f.city) out.push(`FMD may not have listed providers in ${f.city} yet. FMD Edge can help coordinate.`);
  if (f.q) out.push("Check the spelling, or search by treatment (for example \"Root Canal\").");
  return out;
}

/* ---------------- profile ---------------- */

export function providerProfile(id: string) {
  const rows = all<Row>(`${BASE} WHERE d.id = ?`, id);
  if (!rows.length) throw notFound("Profile not found.");
  const r = rows[0];
  const card = toCard(r, servicesOf([id]).get(id) ?? [], activeSponsors([id]).get(id), nextAvailableMap([id]).get(id));
  return {
    ...card,
    qualifications: parse(r.qualifications),
    bio: r.bio,
    clinics: rows
      .filter((x) => x.clinic_id)
      .map((x) => ({
        id: x.clinic_id!,
        name: x.clinic_name!,
        area: x.area ?? "",
        city: x.city ?? "",
        address: x.address ?? "",
        phone: x.phone ?? "",
        hours: x.hours ?? "",
        feeNote: x.fee_note || "Fee confirmed by the clinic",
      })),
    claimed: !!one("SELECT 1 FROM dentists WHERE id = ? AND user_id IS NOT NULL", id),
  };
}

/* ---------------- claim & verification (MAIN-24, ADM-02) ---------------- */

export function submitClaim(a: Auth, dentistId: string, input: Record<string, unknown>) {
  if (a.user.account_type !== "dentist") throw new HttpError(403, "forbidden", "Only dentist accounts can claim a profile.");
  const d = one<{ user_id: string | null }>("SELECT user_id FROM dentists WHERE id = ?", dentistId);
  if (!d) throw notFound("Profile not found.");
  if (d.user_id) throw new HttpError(409, "claimed", "This profile has already been claimed.");
  const reg = typeof input.registrationNumber === "string" ? input.registrationNumber.trim() : "";
  const council = typeof input.council === "string" ? input.council.trim() : "";
  if (reg.length < 3 || reg.length > 40) throw bad("Enter your dental council registration number.");
  if (council.length < 3 || council.length > 80) throw bad("Enter the council you're registered with.");
  if (one("SELECT 1 FROM profile_claims WHERE dentist_id = ? AND user_id = ? AND status = 'submitted'", dentistId, a.user.id))
    throw new HttpError(409, "exists", "You already have a claim under review for this profile.");
  const id = randomUUID();
  run(
    "INSERT INTO profile_claims (id, dentist_id, user_id, registration_number, council, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    dentistId,
    a.user.id,
    reg,
    council,
    typeof input.note === "string" ? input.note.trim().slice(0, 500) : "",
    Date.now(),
  );
  audit(a.user.id, "claim.submitted", "dentist", dentistId);
  return { claimId: id, status: "submitted" as const };
}

export function listClaims(a: Auth) {
  requireRole(a, "fmd_ops", "super_admin");
  return all<{ id: string; dentist_id: string; dentist_name: string; claimant: string; registration_number: string; council: string; note: string; status: string; created_at: number }>(
    `SELECT pc.id, pc.dentist_id, d.name AS dentist_name, u.name AS claimant, pc.registration_number, pc.council, pc.note, pc.status, pc.created_at
     FROM profile_claims pc JOIN dentists d ON d.id = pc.dentist_id JOIN users u ON u.id = pc.user_id
     ORDER BY pc.status = 'submitted' DESC, pc.created_at ASC`,
  );
}

/**
 * Approve: link the profile to the dentist's account and mark verified, recording *what was checked*.
 * The badge text shown to patients is exactly `checks` — verification must reflect actual checks (MAIN-46).
 */
export function decideClaim(a: Auth, claimId: string, input: Record<string, unknown>) {
  requireRole(a, "fmd_ops", "super_admin");
  const decision = input.decision;
  if (decision !== "approve" && decision !== "reject") throw bad("Choose approve or reject.");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const checks = typeof input.checks === "string" ? input.checks.trim() : "";
  if (decision === "reject" && reason.length < 3) throw bad("Give a reason the dentist will see.");
  if (decision === "approve" && checks.length < 10) throw bad("Describe what was verified (e.g. registration confirmed with the state dental council on a date).");
  tx(() => {
    const c = one<{ dentist_id: string; user_id: string; status: string }>("SELECT dentist_id, user_id, status FROM profile_claims WHERE id = ?", claimId);
    if (!c) throw notFound("Claim not found.");
    if (c.status !== "submitted") throw new HttpError(409, "decided", "This claim has already been decided.");
    const now = Date.now();
    run("UPDATE profile_claims SET status = ?, reviewer_id = ?, reason = ?, decided_at = ? WHERE id = ?", decision === "approve" ? "approved" : "rejected", a.user.id, reason, now, claimId);
    if (decision === "approve") {
      if (one("SELECT 1 FROM dentists WHERE id = ? AND user_id IS NOT NULL", c.dentist_id)) throw new HttpError(409, "claimed", "Profile already claimed.");
      run("UPDATE dentists SET user_id = ?, verification_status = 'verified', verification_checks = ?, verified_at = ? WHERE id = ?", c.user_id, checks, now, c.dentist_id);
      run("UPDATE profile_claims SET status = 'rejected', reason = 'Another claim was approved', decided_at = ? WHERE dentist_id = ? AND status = 'submitted'", now, c.dentist_id);
    }
    audit(a.user.id, `claim.${decision}`, "dentist", c.dentist_id, { claimId });
  });
  return listClaims(a);
}

export function myClaims(a: Auth) {
  return all<{ id: string; dentist_name: string; status: string; reason: string; created_at: number }>(
    "SELECT pc.id, d.name AS dentist_name, pc.status, pc.reason, pc.created_at FROM profile_claims pc JOIN dentists d ON d.id = pc.dentist_id WHERE pc.user_id = ? ORDER BY pc.created_at DESC",
    a.user.id,
  );
}
