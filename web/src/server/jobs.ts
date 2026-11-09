import { randomUUID } from "node:crypto";
import { all, audit, one, run } from "./db.ts";
import { requireRole, type Auth } from "./auth.ts";
import { bad, HttpError, notFound } from "./http.ts";
import { CITIES } from "../lib/catalog.ts";

export const ROLE_TYPES = {
  associate: "Associate dentist",
  consultant: "Consultant / specialist",
  assistant: "Dental assistant",
  hygienist: "Dental hygienist",
  front_desk: "Front desk / coordinator",
  internship: "Internship",
  other: "Other",
} as const;
const LISTING_DAYS = 30;

type JobRow = {
  id: string;
  poster_user_id: string;
  org_name: string;
  title: string;
  role_type: keyof typeof ROLE_TYPES;
  city: string;
  area: string;
  description: string;
  requirements: string;
  compensation: string;
  apply_method: "email" | "url" | "phone";
  apply_value: string;
  status: "active" | "closed" | "removed";
  employer_verified: number;
  created_at: number;
  expires_at: number;
};

const t = (v: unknown, min: number, max: number, field: string, optional = false) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && optional) return "";
  if (s.length < min || s.length > max) throw bad(`${field} must be ${min}–${max} characters.`);
  return s;
};

/** Posting permission (MAIN-48): verified dentists and company accounts. */
function canPost(a: Auth) {
  if (a.user.account_type === "company") return true;
  return !!one("SELECT 1 FROM dentists WHERE user_id = ? AND verification_status = 'verified'", a.user.id);
}

function applyValue(method: string, raw: unknown) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (method === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return s.toLowerCase();
  if (method === "url" && /^https:\/\/[^\s]{4,300}$/.test(s)) return s;
  if (method === "phone" && /^[6-9]\d{9}$/.test(s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, ""))) return `+91${s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "")}`;
  throw bad(method === "url" ? "Enter an https:// application link." : method === "email" ? "Enter a valid application email." : "Enter a valid 10-digit mobile number.");
}

export function postJob(a: Auth, input: Record<string, unknown>) {
  if (!canPost(a)) throw new HttpError(403, "forbidden", "Job posting is available to verified dentists and dental company accounts.");
  const role = typeof input.roleType === "string" && input.roleType in ROLE_TYPES ? input.roleType : null;
  if (!role) throw bad("Choose a role type.");
  const city = typeof input.city === "string" && (CITIES as readonly string[]).includes(input.city) ? input.city : null;
  if (!city) throw bad("Choose a city.");
  const method = input.applyMethod === "email" || input.applyMethod === "url" || input.applyMethod === "phone" ? input.applyMethod : null;
  if (!method) throw bad("Choose how candidates apply.");
  const id = randomUUID();
  const now = Date.now();
  run(
    `INSERT INTO jobs (id, poster_user_id, org_name, title, role_type, city, area, description, requirements, compensation, apply_method, apply_value, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, a.user.id, t(input.orgName, 2, 120, "Clinic or company name"), t(input.title, 5, 120, "Title"), role, city, t(input.area, 0, 80, "Area", true),
    t(input.description, 30, 4000, "Description"), t(input.requirements, 0, 2000, "Requirements", true), t(input.compensation, 0, 120, "Compensation", true),
    method, applyValue(method, input.applyValue), now, now + LISTING_DAYS * 86400_000,
  );
  audit(a.user.id, "job.posted", "job", id);
  return view(one<JobRow>("SELECT * FROM jobs WHERE id = ?", id)!, a);
}

function view(j: JobRow, a: Auth | null) {
  const expired = j.expires_at < Date.now();
  return {
    id: j.id,
    orgName: j.org_name,
    title: j.title,
    roleType: j.role_type,
    roleLabel: ROLE_TYPES[j.role_type] ?? j.role_type,
    city: j.city,
    area: j.area,
    description: j.description,
    requirements: j.requirements,
    compensation: j.compensation || "Not stated",
    apply: { method: j.apply_method, value: j.apply_value },
    status: expired && j.status === "active" ? "expired" : j.status,
    employerVerified: j.employer_verified === 1,
    postedAt: j.created_at,
    expiresAt: j.expires_at,
    mine: !!a && a.user.id === j.poster_user_id,
  };
}

export function searchJobs(a: Auth | null, f: { q?: string; city?: string; role?: string } = {}) {
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 80);
  return all<JobRow>("SELECT * FROM jobs WHERE status = 'active' AND expires_at > ? ORDER BY created_at DESC LIMIT 100", Date.now())
    .filter((j) => !f.city || j.city === f.city)
    .filter((j) => !f.role || j.role_type === f.role)
    .filter((j) => !q || `${j.title} ${j.org_name} ${j.area} ${j.description}`.toLowerCase().includes(q))
    .map((j) => view(j, a));
}

export function myJobs(a: Auth) {
  return all<JobRow>("SELECT * FROM jobs WHERE poster_user_id = ? ORDER BY created_at DESC", a.user.id).map((j) => view(j, a));
}

/** Renew (+30 days from now) or close. Only the poster; removed listings can't be revived. */
export function updateJob(a: Auth, id: string, action: unknown) {
  const j = one<JobRow>("SELECT * FROM jobs WHERE id = ?", id);
  if (!j || j.poster_user_id !== a.user.id) throw notFound("Listing not found.");
  if (j.status === "removed") throw new HttpError(409, "removed", "This listing was removed by moderators and can't be changed.");
  if (action === "renew") run("UPDATE jobs SET status = 'active', expires_at = ? WHERE id = ?", Date.now() + LISTING_DAYS * 86400_000, id);
  else if (action === "close") run("UPDATE jobs SET status = 'closed' WHERE id = ?", id);
  else throw bad("Choose renew or close.");
  audit(a.user.id, `job.${String(action)}`, "job", id);
  return view(one<JobRow>("SELECT * FROM jobs WHERE id = ?", id)!, a);
}

/** Employer verification is a deliberate staff decision, never implied (MAIN-50). */
export function verifyEmployer(a: Auth, id: string) {
  requireRole(a, "fmd_ops", "super_admin");
  if (!one("SELECT 1 FROM jobs WHERE id = ?", id)) throw notFound("Listing not found.");
  run("UPDATE jobs SET employer_verified = 1 WHERE id = ?", id);
  audit(a.user.id, "job.employer_verified", "job", id);
}
