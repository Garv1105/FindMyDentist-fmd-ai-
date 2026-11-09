/**
 * Jobs (plan part 7.1, PDR §4.9): demo listings and posting until the backend has them. Proposed API:
 *   GET  /jobs?q&role&city&type&experience&salary_min&page → {items: Job[], total}
 *   GET  /jobs/{id} · POST /jobs · PATCH /jobs/{id} · POST /jobs/{id}/renew · POST /jobs/{id}/close · GET /me/jobs
 *   POST /reports {target_type: "job", target_id, category, note}
 * Rules: verified dentists, clinic owners and dental companies can post. A listing runs 30 days and can be renewed.
 * "Employer checked by FMD" appears only when FMD actually checked the employer; otherwise the page says it didn't.
 * Expired and closed listings never show in search.
 */
import { CITIES } from "../lib/catalog.ts";
import { read, write } from "./store.ts";

export const ROLES = {
  associate: "Associate dentist",
  consultant: "Consultant / specialist",
  assistant: "Dental assistant",
  hygienist: "Dental hygienist",
  front_desk: "Front desk / coordinator",
  intern: "Internship",
} as const;
export type Role = keyof typeof ROLES;
export const TYPES = { full_time: "Full time", part_time: "Part time", locum: "Locum" } as const;
export type JobType = keyof typeof TYPES;
export const EXPERIENCE = { "0": "Freshers welcome", "2": "2+ years", "5": "5+ years" } as const;
export const LISTING_DAYS = 30;

export type Apply = { method: "email" | "url" | "phone"; value: string };
export type Job = {
  id: string;
  title: string;
  role: Role;
  type: JobType;
  employer: { name: string; verified: boolean; clinic_id: string | null };
  city: string;
  area: string;
  description: string;
  requirements: string[];
  min_years: number;
  salary: { min: number; max: number } | null;
  apply: Apply;
  posted_at: string;
  expires_at: string;
  status: "active" | "closed";
  mine?: boolean;
  demo: true;
};
export type JobFilters = { q?: string; role?: string; city?: string; type?: string; experience?: string; salary_min?: number };

const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function seed(now: number): Job[] {
  const j = (x: Omit<Job, "posted_at" | "expires_at" | "status" | "demo"> & { ago: number }): Job => {
    const { ago, ...rest } = x;
    return { ...rest, posted_at: iso(now - ago * day), expires_at: iso(now - ago * day + LISTING_DAYS * day), status: "active", demo: true };
  };
  return [
    j({ id: "job-assoc-kor", title: "Associate dentist, general practice", role: "associate", type: "full_time", employer: { name: "Demo Dental Studio", verified: true, clinic_id: "kor" }, city: "Bengaluru", area: "Koramangala", description: "Join a busy 4-chair practice. You'll see your own patients for check-ups, fillings and root canals, with a senior dentist on hand.", requirements: ["BDS, registered with a state dental council", "Comfortable with rotary endodontics", "Kannada or Hindi helpful"], min_years: 2, salary: { min: 45000, max: 70000 }, apply: { method: "email", value: "jobs@demo-dental-studio.example" }, ago: 3 }),
    j({ id: "job-ortho-hsr", title: "Consultant orthodontist, 2 days a week", role: "consultant", type: "part_time", employer: { name: "Demo Ortho Care", verified: true, clinic_id: "hsr" }, city: "Bengaluru", area: "HSR Layout", description: "Take on our braces and aligner cases on Tuesdays and Saturdays.", requirements: ["MDS (Orthodontics)", "Aligner certification preferred"], min_years: 5, salary: null, apply: { method: "url", value: "https://example.com/demo-ortho-care/careers" }, ago: 6 }),
    j({ id: "job-assist-jay", title: "Dental assistant", role: "assistant", type: "full_time", employer: { name: "Demo Implant Centre", verified: true, clinic_id: "jay" }, city: "Bengaluru", area: "Jayanagar", description: "Chairside assistance for implant and surgical work, instrument care and sterilisation.", requirements: ["Diploma in dental mechanics or hygiene, or chairside experience", "Willing to learn surgical assisting"], min_years: 0, salary: { min: 18000, max: 25000 }, apply: { method: "phone", value: "+919876500011" }, ago: 1 }),
    j({ id: "job-hyg-bnd", title: "Dental hygienist", role: "hygienist", type: "full_time", employer: { name: "Demo Seaside Dental", verified: true, clinic_id: "bnd" }, city: "Mumbai", area: "Bandra West", description: "Scaling, polishing and patient education for a family practice.", requirements: ["Diploma in Dental Hygiene", "Marathi or Hindi"], min_years: 2, salary: { min: 25000, max: 35000 }, apply: { method: "email", value: "careers@demo-seaside.example" }, ago: 8 }),
    j({ id: "job-desk-bjh", title: "Front desk coordinator", role: "front_desk", type: "full_time", employer: { name: "Demo Pearl Dental", verified: true, clinic_id: "bjh" }, city: "Hyderabad", area: "Banjara Hills", description: "Greet patients, manage the calendar and explain estimates clearly.", requirements: ["Good English and Telugu", "Calm with anxious patients"], min_years: 0, salary: { min: 20000, max: 26000 }, apply: { method: "email", value: "hello@demo-pearl.example" }, ago: 4 }),
    j({ id: "job-locum-skt", title: "Locum dentist, weekends", role: "associate", type: "locum", employer: { name: "Demo Capital Dental", verified: true, clinic_id: "skt" }, city: "Delhi NCR", area: "Saket", description: "Cover Saturday and Sunday clinics for 3 months.", requirements: ["BDS, registered", "Own transport"], min_years: 2, salary: { min: 4000, max: 5000 }, apply: { method: "phone", value: "+919876500012" }, ago: 12 }),
    j({ id: "job-intern-ady", title: "Internship for BDS graduates", role: "intern", type: "full_time", employer: { name: "Demo Adyar Smiles", verified: false, clinic_id: null }, city: "Chennai", area: "Adyar", description: "Six months of supervised practice across general dentistry.", requirements: ["BDS completed or in internship year", "Tamil helpful"], min_years: 0, salary: { min: 10000, max: 12000 }, apply: { method: "email", value: "intern@demo-adyar.example" }, ago: 2 }),
    j({ id: "job-sales-pune", title: "Clinical educator, aligner company", role: "consultant", type: "full_time", employer: { name: "Demo Aligner Brand", verified: false, clinic_id: null }, city: "Pune", area: "Koregaon Park", description: "Train clinics on aligner planning software. Travel across Maharashtra.", requirements: ["BDS or MDS", "Good presentation skills"], min_years: 2, salary: { min: 60000, max: 90000 }, apply: { method: "url", value: "https://example.com/demo-aligner/jobs" }, ago: 9 }),
    // an old listing: expired, so never shown in search
    j({ id: "job-expired", title: "Associate dentist (old listing)", role: "associate", type: "full_time", employer: { name: "Demo Family Dental", verified: true, clinic_id: "whf" }, city: "Bengaluru", area: "Whitefield", description: "Expired.", requirements: [], min_years: 0, salary: null, apply: { method: "email", value: "old@demo.example" }, ago: 45 }),
  ];
}

const mineKey = (userId: string) => `fmd-demo:jobs:${userId}`;
const reportsKey = (userId: string) => `fmd-demo:job-reports:${userId}`;
const live = (j: Job, now: number) => j.status === "active" && Date.parse(j.expires_at) > now;
export const jobState = (j: Job, now = Date.now()) => (j.status === "closed" ? "closed" : Date.parse(j.expires_at) <= now ? "expired" : "active");

function everything(userId: string | null, now: number) {
  const mine = userId ? (read<Job[]>(mineKey(userId)) ?? []).map((j) => ({ ...j, mine: true })) : [];
  return [...mine, ...seed(now)];
}

export async function searchJobs(userId: string | null, f: JobFilters, now = Date.now()) {
  const q = (f.q ?? "").trim().toLowerCase();
  const items = everything(userId, now)
    .filter((j) => live(j, now))
    .filter(
      (j) =>
        (!q || [j.title, j.employer.name, j.area, j.city, j.description].some((x) => x.toLowerCase().includes(q))) &&
        (!f.role || j.role === f.role) &&
        (!f.city || j.city === f.city) &&
        (!f.type || j.type === f.type) &&
        (f.experience === undefined || f.experience === "" || j.min_years <= Number(f.experience)) &&
        (!f.salary_min || (j.salary && j.salary.max >= f.salary_min)),
    )
    .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  return { items, total: items.length };
}

/** An expired or closed listing still opens from a saved link, but says it's no longer open. */
export async function getJob(userId: string | null, id: string, now = Date.now()) {
  return everything(userId, now).find((j) => j.id === id) ?? null;
}

export async function cardsForJobs(userId: string, ids: string[], now = Date.now()) {
  const all = everything(userId, now);
  return ids.flatMap((id) => all.filter((j) => j.id === id));
}

/* ---------------- posting ---------------- */

export type JobInput = Pick<Job, "title" | "role" | "type" | "city" | "area" | "description" | "min_years" | "salary" | "apply"> & { employer: string; requirements: string };

/** The application route, cleaned, or an error message. */
export function cleanApply(a: Apply): Apply | string {
  const v = a.value.trim();
  if (a.method === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { method: "email", value: v.toLowerCase() } : "Enter a valid application email.";
  if (a.method === "url") return /^https:\/\/[^\s]{4,300}$/.test(v) ? { method: "url", value: v } : "Enter an https:// application link.";
  const digits = v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? { method: "phone", value: `+91${digits}` } : "Enter a valid 10-digit mobile number.";
}

export function checkJob(i: JobInput): string | null {
  if (i.title.trim().length < 5) return "Give the job a title of at least 5 characters.";
  if (!i.employer.trim()) return "Enter the clinic or company name.";
  if (!(CITIES as readonly string[]).includes(i.city)) return "Choose a city.";
  if (i.description.trim().length < 20) return "Describe the job in at least 20 characters.";
  if (i.salary && (i.salary.min < 0 || i.salary.max < i.salary.min)) return "Enter the salary range lowest first, or leave it empty.";
  const a = cleanApply(i.apply);
  return typeof a === "string" ? a : null;
}

/** Who may post: verified dentists, clinic owners (from the real backend's workspaces), dental companies. */
export function canPostJobs(me: { dentist_profile: { verification_status: string } | null; workspaces: { role: string }[] }, accountType: string | null) {
  return me.dentist_profile?.verification_status === "verified" || me.workspaces.some((w) => w.role === "owner") || accountType === "company";
}

export async function myJobs(userId: string): Promise<Job[]> {
  return (read<Job[]>(mineKey(userId)) ?? []).map((j) => ({ ...j, mine: true }));
}

export async function postJob(userId: string, i: JobInput, editId: string | null, now = Date.now()): Promise<Job> {
  const bad = checkJob(i);
  if (bad) throw new Error(bad);
  const all = await myJobs(userId);
  const old = editId ? all.find((j) => j.id === editId) : undefined;
  if (editId && !old) throw new Error("You can only edit your own postings.");
  const job: Job = {
    id: old?.id ?? newId("job"),
    title: i.title.trim(),
    role: i.role,
    type: i.type,
    // FMD hasn't checked an employer just because someone typed its name
    employer: { name: i.employer.trim(), verified: false, clinic_id: null },
    city: i.city,
    area: i.area.trim(),
    description: i.description.trim(),
    requirements: i.requirements.split("\n").map((r) => r.trim()).filter(Boolean),
    min_years: i.min_years,
    salary: i.salary,
    apply: cleanApply(i.apply) as Apply,
    posted_at: old?.posted_at ?? iso(now),
    expires_at: old?.expires_at ?? iso(now + LISTING_DAYS * day),
    status: "active",
    mine: true,
    demo: true,
  };
  write(mineKey(userId), [...all.filter((j) => j.id !== job.id), job]);
  return job;
}

/** Another 30 days from today, and open again if it had expired. */
export async function renewJob(userId: string, id: string, now = Date.now()) {
  write(mineKey(userId), (await myJobs(userId)).map((j) => (j.id === id ? { ...j, status: "active" as const, expires_at: iso(now + LISTING_DAYS * day) } : j)));
}
export async function closeJob(userId: string, id: string) {
  write(mineKey(userId), (await myJobs(userId)).map((j) => (j.id === id ? { ...j, status: "closed" as const } : j)));
}

/* ---------------- reports ---------------- */

export const JOB_REPORTS = {
  fake: "Looks fake or a scam",
  fees: "Asks applicants to pay",
  misleading: "Misleading pay or details",
  discrimination: "Discriminatory",
  expired: "Job is already filled",
  other: "Something else",
} as const;

export async function reportJob(userId: string | null, id: string, reason: keyof typeof JOB_REPORTS | "", note: string) {
  if (!userId) throw new Error("Log in to report a job.");
  if (!reason) throw new Error("Choose what's wrong.");
  if (reason === "other" && !note.trim()) throw new Error("Tell us what's wrong.");
  const all = read<string[]>(reportsKey(userId)) ?? [];
  if (all.includes(id)) throw new Error("You've already reported this job. FMD's team is reviewing it.");
  write(reportsKey(userId), [...all, id]);
}
