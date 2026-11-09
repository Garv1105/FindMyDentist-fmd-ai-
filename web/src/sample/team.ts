/**
 * FMD Clinic team and settings sample data (roadmap C6): the people, their roles and access, clinic settings,
 * the AI manager's permissions, and each dentist's own profile (what FMD Main shows). In memory; resets on reload.
 */
import { CHAIRS, HOURS, onReset, requireClinic } from "./clinic.ts";
import { GST_RATES } from "./clinic-billing.ts";

export type TeamRole = "Owner" | "Associate dentist" | "Hygienist" | "Front desk";
export type Member = { id: string; name: string; role: TeamRole; branches: string[]; chair?: string; phone: string; status: "active" | "invited"; demoUserId?: string };

const MEMBERS: Member[] = [
  { id: "m-rao", name: "Dr. Ananya Rao", role: "Owner", branches: ["main", "kora"], chair: "Chair 2", phone: "+91 98450 10101", status: "active", demoUserId: "demo-owner" },
  { id: "m-iyer", name: "Dr. Karthik Iyer", role: "Associate dentist", branches: ["main"], chair: "Chair 1", phone: "+91 98450 20202", status: "active", demoUserId: "demo-dentist" },
  { id: "m-menon", name: "Dr. Lakshmi Menon", role: "Associate dentist", branches: ["kora"], chair: "Chair 1", phone: "+91 98450 60606", status: "active" },
  { id: "m-meera", name: "Meera (hygienist)", role: "Hygienist", branches: ["main"], chair: "Chair 3", phone: "+91 98450 70707", status: "active" },
  { id: "m-kavya", name: "Kavya Menon", role: "Front desk", branches: ["main"], phone: "+91 98450 30303", status: "active", demoUserId: "demo-desk" },
];

/** What each role can open (the reports spec's access table, applied to the whole clinic). */
export const ACCESS: Record<TeamRole, string> = {
  Owner: "Everything, including money, team and settings",
  "Associate dentist": "Their own calendar, patients and tasks; their own profile",
  Hygienist: "Their own calendar and patients",
  "Front desk": "Calendar, patients, billing, daily sheets, recall; no revenue analysis",
};

export type AiPermission = { id: string; label: string; detail: string; allowed: boolean; locked?: boolean };
const AI_PERMISSIONS: AiPermission[] = [
  { id: "read", label: "Read the schedule, patients and bills", detail: "So it can answer questions and prepare lists.", allowed: true },
  { id: "draft-messages", label: "Draft reminders and recall messages", detail: "Drafts wait in the approval queue.", allowed: true },
  { id: "send-messages", label: "Send messages without approval", detail: "Always off: a person approves every message before it leaves the clinic.", allowed: false, locked: true },
  { id: "draft-content", label: "Draft posts and review replies", detail: "You edit and post them yourself.", allowed: true },
  { id: "book", label: "Book, move or cancel appointments", detail: "Off: it can suggest slots; staff make the booking.", allowed: false },
  { id: "billing", label: "Prepare the daily payment sheet", detail: "Totals only; it never changes a bill.", allowed: true },
  { id: "clinical", label: "Give clinical advice", detail: "Always off: no diagnosis, no prescriptions.", allowed: false, locked: true },
];

export type DentistProfile = {
  displayName: string;
  qualifications: string;
  registration: { council: string; number: string; verified: boolean };
  specialities: string[];
  languages: string[];
  experienceYears: number;
  bio: string;
  consultationFeeInr: number;
  timings: string;
  services: string[];
  visibleOnFmd: boolean;
};

const PROFILES: Record<string, DentistProfile> = {
  "demo-dentist": {
    displayName: "Dr. Karthik Iyer",
    qualifications: "BDS, MDS (Periodontics)",
    registration: { council: "Karnataka State Dental Council", number: "KSDC-A-14722", verified: false },
    specialities: ["Periodontics", "Preventive dentistry"],
    languages: ["English", "Kannada", "Tamil"],
    experienceYears: 9,
    bio: "I look after gums and the teeth around them: deep cleaning, gum treatment and helping patients keep their own teeth for life.",
    consultationFeeInr: 500,
    timings: "Mon–Sat, 9:30 am – 6:30 pm (Main branch, Chair 1)",
    services: ["Scaling & polishing", "Deep cleaning", "Gum treatment", "Check-up"],
    visibleOnFmd: true,
  },
  "demo-owner": {
    displayName: "Dr. Ananya Rao",
    qualifications: "BDS, MDS (Prosthodontics)",
    registration: { council: "Karnataka State Dental Council", number: "KSDC-A-09310", verified: true },
    specialities: ["Prosthodontics", "Implants", "Root canal"],
    languages: ["English", "Kannada", "Hindi"],
    experienceYears: 14,
    bio: "Founder of Smile Studio Dental. Crowns, bridges, implants and full-mouth rehabilitation, planned carefully and explained clearly.",
    consultationFeeInr: 700,
    timings: "Mon–Sat, 10 am – 7 pm (Main) · Tue & Thu evenings (Koramangala)",
    services: ["Crowns", "Implants", "Root canal", "Consultation"],
    visibleOnFmd: true,
  },
};

/* in-memory changes */
const invited: Member[] = [];
const roleChange = new Map<string, TeamRole>();
const aiAllowed = new Map<string, boolean>();
const profileEdits = new Map<string, DentistProfile>();
let clinicEdits: Partial<ClinicSettings> = {};
onReset.push(() => {
  invited.length = 0;
  roleChange.clear();
  aiAllowed.clear();
  profileEdits.clear();
  clinicEdits = {};
});

export async function listTeam(clinicId: string): Promise<Member[]> {
  requireClinic(clinicId);
  return [...MEMBERS, ...invited].map((m) => ({ ...m, role: roleChange.get(m.id) ?? m.role }));
}

/** Owner only. The invite is a demo: no message is sent. */
export async function inviteMember(clinicId: string, input: { name: string; phone: string; role: TeamRole; branch: string }, byRole: string) {
  requireClinic(clinicId);
  if (byRole !== "clinic_owner") throw new Error("Only the owner can invite people");
  const name = input.name.trim();
  const digits = input.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  if (!name) throw new Error("Enter their name");
  if (digits.length !== 10) throw new Error("Enter a 10-digit mobile number");
  const m: Member = { id: `m-new-${invited.length + 1}`, name, role: input.role, branches: [input.branch], phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, status: "invited" };
  invited.push(m);
  return m;
}

export async function changeRole(clinicId: string, memberId: string, role: TeamRole, byRole: string) {
  requireClinic(clinicId);
  if (byRole !== "clinic_owner") throw new Error("Only the owner can change roles");
  const m = [...MEMBERS, ...invited].find((x) => x.id === memberId);
  if (!m) throw new Error("Not in the team");
  if (m.role === "Owner") throw new Error("The owner's role can't be changed here");
  roleChange.set(memberId, role);
}

export type ClinicSettings = { name: string; phone: string; email: string; address: string; hours: string; saturday: string; gstin: string };
const CLINIC_SETTINGS: ClinicSettings = {
  name: "Smile Studio Dental",
  phone: "080 4123 5678",
  email: "hello@smilestudio.example",
  address: "12, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
  hours: `${HOURS.open}–${HOURS.close}, lunch ${HOURS.lunch[0]}–${HOURS.lunch[1]}`,
  saturday: `${HOURS.open}–${HOURS.saturdayClose}`,
  gstin: "29ABCDE1234F1Z5",
};

export async function getSettings(clinicId: string) {
  requireClinic(clinicId);
  return {
    clinic: { ...CLINIC_SETTINGS, ...clinicEdits },
    chairs: Object.entries(CHAIRS).flatMap(([branch, list]) => list.map((c) => ({ branch, ...c }))),
    gst: Object.entries(GST_RATES).map(([service, rate]) => ({ service, rate })),
    ai: AI_PERMISSIONS.map((p) => ({ ...p, allowed: aiAllowed.get(p.id) ?? p.allowed })),
  };
}

export async function updateClinicSettings(clinicId: string, change: Partial<ClinicSettings>, byRole: string) {
  requireClinic(clinicId);
  if (byRole !== "clinic_owner") throw new Error("Only the owner can change clinic settings");
  if (change.name !== undefined && !change.name.trim()) throw new Error("The clinic needs a name");
  clinicEdits = { ...clinicEdits, ...Object.fromEntries(Object.entries(change).map(([k, v]) => [k, String(v).trim()])) };
}

export async function setAiPermission(clinicId: string, id: string, allowed: boolean, byRole: string) {
  requireClinic(clinicId);
  if (byRole !== "clinic_owner") throw new Error("Only the owner can change what the AI manager may do");
  const p = AI_PERMISSIONS.find((x) => x.id === id);
  if (!p) throw new Error("Unknown permission");
  if (p.locked) throw new Error("This one can't be changed");
  aiAllowed.set(id, allowed);
}

/** A dentist's own profile (what FMD Main shows); null for people who don't have one. */
export async function getProfile(userId: string): Promise<DentistProfile | null> {
  const p = profileEdits.get(userId) ?? PROFILES[userId];
  return p ? structuredClone(p) : null;
}

/** Only the dentist edits their own profile. Changing the registration number clears "verified" until it's checked again. */
export async function updateProfile(userId: string, change: DentistProfile): Promise<DentistProfile> {
  const current = await getProfile(userId);
  if (!current) throw new Error("No dentist profile for this account");
  if (!change.displayName.trim()) throw new Error("Enter your name as patients should see it");
  if (!change.registration.number.trim()) throw new Error("Enter your dental council registration number");
  if (!Number.isFinite(change.consultationFeeInr) || change.consultationFeeInr < 0) throw new Error("Enter the consultation fee in rupees");
  const regChanged = change.registration.number.trim() !== current.registration.number || change.registration.council !== current.registration.council;
  const next: DentistProfile = {
    ...change,
    displayName: change.displayName.trim(),
    bio: change.bio.trim().slice(0, 600),
    registration: { ...change.registration, number: change.registration.number.trim(), verified: regChanged ? false : current.registration.verified },
  };
  profileEdits.set(userId, next);
  return structuredClone(next);
}
