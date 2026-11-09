/**
 * FMD Main dentist public profile and verification document: sample data until the backend has them (plan part 1.4).
 * Shapes are the proposed API:
 *   GET/PUT /me/dentist-profile/public  → PublicProfile (PUT returns 422 with the same messages as checkPublicProfile)
 *   POST    /me/dentist-profile/documents (multipart, one file) → VerificationDoc; moves verification to "pending"
 * Saved in this browser only, per user, so a demo survives a reload.
 */
import { read, write } from "./store.ts";

export type ClinicLink = { name: string; area: string; city: string };

export type PublicProfile = {
  /** small JPEG data URL here; a storage URL from the backend */
  photo: string | null;
  about: string;
  years_experience: number | null;
  languages: string[];
  services: string[];
  clinics: ClinicLink[];
  fee_min: number | null;
  fee_max: number | null;
};

export type VerificationDoc = { name: string; size: number; uploaded_at: string; status: "submitted" };

export const EMPTY_PROFILE: PublicProfile = { photo: null, about: "", years_experience: null, languages: [], services: [], clinics: [], fee_min: null, fee_max: null };

export const LIMITS = { about: 600, clinics: 5, years: 60, fee: 100000, docBytes: 5 * 1024 * 1024 } as const;
export const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** The first problem with a profile, or null. The backend should enforce the same rules. */
export function checkPublicProfile(p: PublicProfile): string | null {
  if (p.about.length > LIMITS.about) return `Keep "About you" under ${LIMITS.about} characters.`;
  const y = p.years_experience;
  if (y !== null && (!Number.isInteger(y) || y < 0 || y > LIMITS.years)) return `Years of experience must be a whole number from 0 to ${LIMITS.years}.`;
  if (p.clinics.length > LIMITS.clinics) return `Add up to ${LIMITS.clinics} clinics.`;
  if (p.clinics.some((c) => !c.name.trim() || !c.city.trim())) return "Each clinic needs a name and a city.";
  const { fee_min: lo, fee_max: hi } = p;
  if ((lo === null) !== (hi === null)) return "Enter both the lowest and highest consultation fee, or neither.";
  if (lo !== null && hi !== null && (lo < 0 || hi < lo || hi > LIMITS.fee)) return `Fees must run from ₹0 up to ₹${LIMITS.fee.toLocaleString("en-IN")}, lowest first.`;
  return null;
}

export function checkDocument(f: { type: string; size: number }): string | null {
  if (!DOC_TYPES.includes(f.type)) return "Upload a PDF, JPG or PNG.";
  if (f.size > LIMITS.docBytes) return "That file is over 5 MB. Upload a smaller scan or photo.";
  return null;
}

const pKey = (userId: string) => `fmd-demo:dentist-public:${userId}`;
const dKey = (userId: string) => `fmd-demo:dentist-doc:${userId}`;

export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  return { ...EMPTY_PROFILE, ...read<PublicProfile>(pKey(userId)) };
}

export async function savePublicProfile(userId: string, p: PublicProfile): Promise<PublicProfile> {
  const problem = checkPublicProfile(p);
  if (problem) throw new Error(problem);
  const clean = { ...p, about: p.about.trim(), clinics: p.clinics.map((c) => ({ name: c.name.trim(), area: c.area.trim(), city: c.city.trim() })) };
  write(pKey(userId), clean);
  return clean;
}

export async function getDocument(userId: string): Promise<VerificationDoc | null> {
  return read<VerificationDoc>(dKey(userId));
}

export async function submitDocument(userId: string, f: { name: string; type: string; size: number }): Promise<VerificationDoc> {
  const problem = checkDocument(f);
  if (problem) throw new Error(problem);
  const doc: VerificationDoc = { name: f.name, size: f.size, uploaded_at: new Date().toISOString(), status: "submitted" };
  write(dKey(userId), doc);
  return doc;
}

/** "Priya Sharma" → "Dr. Priya Sharma"; names already starting with Dr stay as they are */
export const drName = (name: string) => (/^dr\.?\s/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`);
