/**
 * Account type and onboarding (plan part 1.5): sample data until the backend has it. Proposed API:
 *   PUT /me/account-type {type}          → and `account_type` added to MeRead
 *   PUT /me/patient-preferences          → PatientPrefs
 *   PUT /me/student-profile              → StudentProfile (422 with checkStudent's messages)
 *   PUT /me/company-profile              → CompanyProfile (422 with checkCompany's messages)
 *   POST /me/verification-documents      → student ID or company proof; verification moves to "pending"
 * Prices are PDR §14. A paid type works as a free account until its membership is paid (part 8.2).
 */
import { checkDocument } from "./dentist.ts";
import { read, write } from "./store.ts";

export type AccountType = "patient" | "dentist" | "student" | "company";

export const ACCOUNT_TYPES: Record<AccountType, { label: string; price: string; yearly: number; blurb: string }> = {
  patient: { label: "Patient", price: "Free", yearly: 0, blurb: "Ask FMD AI, find dentists, book visits and keep your dental records in one place." },
  dentist: { label: "Dentist", price: "₹550 a year", yearly: 550, blurb: "A verified profile patients can find, posts in Explore, and dental jobs." },
  student: { label: "Dental student", price: "₹400 a year", yearly: 400, blurb: "Includes FMD Scholar, the AI study workspace for doubts, viva, seminars and research." },
  company: { label: "Dental company", price: "₹2,000 a year", yearly: 2000, blurb: "A company page, job posts and clearly labelled promotions." },
};

export const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी · Hindi" },
  { code: "te", label: "తెలుగు · Telugu" },
  { code: "kn", label: "ಕನ್ನಡ · Kannada" },
  { code: "ta", label: "தமிழ் · Tamil" },
] as const;

export const COURSES = ["BDS", "MDS", "Diploma in Dental Hygiene", "Diploma in Dental Mechanics"] as const;
export const YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Internship", "Postgraduate 1st year", "Postgraduate 2nd year", "Postgraduate 3rd year"] as const;

export type PatientPrefs = { city: string; language: string };
export type Doc = { name: string; size: number; uploaded_at: string };
export type StudentProfile = { college: string; course: string; year: string; id_doc: Doc | null };
export type CompanyProfile = { name: string; contact_name: string; gstin: string | null; website: string | null };

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function checkStudent(s: StudentProfile): string | null {
  if (!s.college.trim()) return "Enter your college.";
  if (!COURSES.includes(s.course as (typeof COURSES)[number])) return "Choose your course.";
  if (!YEARS.includes(s.year as (typeof YEARS)[number])) return "Choose your year.";
  return null;
}

export function checkCompany(c: CompanyProfile): string | null {
  if (!c.name.trim()) return "Enter the company name.";
  if (!c.contact_name.trim()) return "Enter a contact person.";
  if (c.gstin && !GSTIN.test(c.gstin)) return "That GSTIN doesn't look right. It has 15 characters, like 29ABCDE1234F1Z5.";
  if (c.website && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(c.website)) return "Enter the website as a full address, like https://example.com.";
  return null;
}

const key = (what: string, userId: string) => `fmd-demo:${what}:${userId}`;

export async function getAccountType(userId: string) {
  return read<AccountType>(key("account-type", userId));
}
export async function setAccountType(userId: string, type: AccountType) {
  write(key("account-type", userId), type);
}

export async function getPatientPrefs(userId: string): Promise<PatientPrefs> {
  return read<PatientPrefs>(key("patient", userId)) ?? { city: "", language: "en" };
}
export async function savePatientPrefs(userId: string, p: PatientPrefs) {
  write(key("patient", userId), { city: p.city.trim(), language: p.language });
}

export async function getStudent(userId: string) {
  return read<StudentProfile>(key("student", userId));
}
export async function saveStudent(userId: string, s: StudentProfile, idFile?: { name: string; type: string; size: number }) {
  const problem = checkStudent(s) ?? (idFile ? checkDocument(idFile) : null);
  if (problem) throw new Error(problem);
  const id_doc = idFile ? { name: idFile.name, size: idFile.size, uploaded_at: new Date().toISOString() } : s.id_doc;
  const saved = { ...s, college: s.college.trim(), id_doc };
  write(key("student", userId), saved);
  return saved;
}

export async function getCompany(userId: string) {
  return read<CompanyProfile>(key("company", userId));
}
export async function saveCompany(userId: string, c: CompanyProfile) {
  const clean = { name: c.name.trim(), contact_name: c.contact_name.trim(), gstin: c.gstin?.trim().toUpperCase() || null, website: c.website?.trim() || null };
  const problem = checkCompany(clean);
  if (problem) throw new Error(problem);
  write(key("company", userId), clean);
  return clean;
}
