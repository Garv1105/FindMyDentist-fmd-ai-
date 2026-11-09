/**
 * Preview accounts: sign in with any phone number and the code shown on screen, or pick a person to try a role.
 * Real sign-in replaces this when the backend lands. Kept free of React so it can be tested with node --test; the
 * hook lives in useDemoUser.ts.
 */

export type DemoRole = "patient" | "dentist" | "clinic_owner" | "clinic_front_desk" | "student" | "company";

export type DemoUser = {
  id: string;
  name: string;
  initials: string;
  role: DemoRole;
  title: string;
  phone: string;
  /** the clinic this person works at; null for people outside FMD Clinic */
  clinicId: string | null;
};

export const ROLES: { role: DemoRole; label: string; hint: string }[] = [
  { role: "patient", label: "Patient", hint: "Find dentists, book, keep records" },
  { role: "dentist", label: "Dentist", hint: "Profile, posts, patients" },
  { role: "clinic_owner", label: "Clinic owner", hint: "Runs FMD Clinic" },
  { role: "clinic_front_desk", label: "Clinic staff", hint: "Front desk, assistant" },
  { role: "student", label: "Student", hint: "FMD Scholar" },
  { role: "company", label: "Dental company", hint: "Jobs, products" },
];
const TITLE: Record<DemoRole, string> = {
  patient: "Patient",
  dentist: "Dentist",
  clinic_owner: "Owner",
  clinic_front_desk: "Front desk",
  student: "Student",
  company: "Dental company",
};
const DEMO_CLINIC = "smile-studio";
const isClinicRole = (r: DemoRole) => r === "clinic_owner" || r === "clinic_front_desk";

export const DEMO_USERS: DemoUser[] = [
  { id: "demo-patient", name: "Priya Sharma", initials: "PS", role: "patient", title: "Patient", phone: "+91 99860 44120", clinicId: null },
  { id: "demo-dentist", name: "Dr. Karthik Iyer", initials: "KI", role: "dentist", title: "Dentist", phone: "+91 98450 20202", clinicId: null },
  { id: "demo-owner", name: "Dr. Ananya Rao", initials: "AR", role: "clinic_owner", title: "Owner", phone: "+91 98450 10101", clinicId: DEMO_CLINIC },
  { id: "demo-desk", name: "Kavya Menon", initials: "KM", role: "clinic_front_desk", title: "Front desk", phone: "+91 98450 30303", clinicId: DEMO_CLINIC },
  { id: "demo-student", name: "Rhea Kapoor", initials: "RK", role: "student", title: "Student", phone: "+91 98450 40404", clinicId: null },
  { id: "demo-company", name: "Vivek Shah", initials: "VS", role: "company", title: "Dental company", phone: "+91 98450 50505", clinicId: null },
];

/** The code every preview sign-in accepts; it's shown on screen, so no message is ever sent. */
export const PREVIEW_CODE = "246810";

export const findDemoUser = (id: string | null) => DEMO_USERS.find((u) => u.id === id) ?? null;

const tenDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
export const formatPhone = (phone: string) => {
  const d = tenDigits(phone);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
};
export const isPhone = (phone: string) => tenDigits(phone).length === 10;

/** A preview person with this mobile number, however it's typed. */
export const userByPhone = (phone: string) => (isPhone(phone) ? (DEMO_USERS.find((u) => tenDigits(u.phone) === tenDigits(phone)) ?? null) : null);

/** A new preview account. Clinic owners and staff join the demo clinic so FMD Clinic has something to show. */
export function makeUser(input: { name: string; role: DemoRole; phone: string }): DemoUser {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Enter your name");
  if (!isPhone(input.phone)) throw new Error("Enter a 10-digit mobile number");
  const initials = name.replace(/^Dr\.?\s+/i, "").split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return {
    id: `user-${tenDigits(input.phone)}`,
    name,
    initials,
    role: input.role,
    title: TITLE[input.role],
    phone: formatPhone(input.phone),
    clinicId: isClinicRole(input.role) ? DEMO_CLINIC : null,
  };
}

/** What the browser remembers: a preview person's id, or a created account as JSON. Anything else is ignored. */
export function readStored(raw: string | null): DemoUser | null {
  if (!raw) return null;
  if (!raw.startsWith("{")) return findDemoUser(raw);
  try {
    const u = JSON.parse(raw) as Partial<DemoUser>;
    return u && typeof u.name === "string" && typeof u.phone === "string" && u.role && ROLES.some((r) => r.role === u.role) ? makeUser({ name: u.name, role: u.role, phone: u.phone }) : null;
  } catch {
    return null;
  }
}

export const canOpenClinic = (user: DemoUser | null, clinicId: string) => user?.clinicId === clinicId;

/**
 * Only same-site paths. Parsed the way a browser would (it drops tabs and newlines, so "/\t/evil.com" means
 * "//evil.com"), then kept only if it stays on this site.
 */
export function safeNext(next: string | null) {
  if (!next?.startsWith("/")) return "/";
  const base = "http://same.site";
  const u = new URL(next, base);
  return u.origin === base ? u.pathname + u.search + u.hash : "/";
}

/** Where a person lands after signing in. */
export const homeOf = (user: DemoUser) => (user.clinicId ? `/clinic/${user.clinicId}` : "/");

export type MenuItem = { label: string; href?: string; note?: string };
export type MenuGroup = { title: string; items: MenuItem[] };

/** The parts of FMD a role can open, for the profile menu. Items without an href aren't built yet. */
export function areasFor(user: DemoUser): MenuGroup[] {
  const groups: MenuGroup[] = [];
  if (user.clinicId) {
    const base = `/clinic/${user.clinicId}`;
    groups.push({
      title: "FMD Clinic",
      items: [
        { label: "Home", href: base, note: "today's briefing" },
        { label: "Calendar", href: `${base}/calendar` },
        { label: "Patients", href: `${base}/patients` },
        { label: "Billing", href: `${base}/billing` },
        { label: "Tasks · Reports · AI manager", note: "coming next" },
      ],
    });
  }
  const main: Record<DemoRole, string> = {
    patient: "Assistant, dentists, appointments, records",
    dentist: "Your profile, posts and patients",
    clinic_owner: "Assistant, dentists, feed",
    clinic_front_desk: "Assistant, dentists, feed",
    student: "Feed, jobs and your membership",
    company: "Jobs and your company page",
  };
  groups.push({ title: "FMD Main", items: [{ label: `FMD Main · ${main[user.role]}`, note: "coming soon" }] });
  if (user.role === "student") groups.push({ title: "FMD Scholar", items: [{ label: "FMD Scholar workspace", note: "coming soon" }] });
  return groups;
}
