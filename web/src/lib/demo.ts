/**
 * Demo accounts for the preview: pick a person, no password. Real sign-in replaces this when the backend lands.
 * Kept free of React so it can be tested with node --test; the hook lives in useDemoUser.ts.
 */

export type DemoRole = "patient" | "dentist" | "clinic_owner" | "clinic_front_desk";

export type DemoUser = {
  id: string;
  name: string;
  initials: string;
  role: DemoRole;
  title: string;
  /** the clinic this person works at; null for people outside FMD Clinic */
  clinicId: string | null;
};

export const DEMO_USERS: DemoUser[] = [
  { id: "demo-patient", name: "Priya Sharma", initials: "PS", role: "patient", title: "Patient", clinicId: null },
  { id: "demo-dentist", name: "Dr. Karthik Iyer", initials: "KI", role: "dentist", title: "Dentist", clinicId: null },
  { id: "demo-owner", name: "Dr. Ananya Rao", initials: "AR", role: "clinic_owner", title: "Owner", clinicId: "smile-studio" },
  { id: "demo-desk", name: "Kavya Menon", initials: "KM", role: "clinic_front_desk", title: "Front desk", clinicId: "smile-studio" },
];

export const findDemoUser = (id: string | null) => DEMO_USERS.find((u) => u.id === id) ?? null;

export const canOpenClinic = (user: DemoUser | null, clinicId: string) => user?.clinicId === clinicId;

/** Only same-site paths: no "//host", no "/\host" (browsers treat both as another site). */
export const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : "/");

/** Where a person lands after choosing them. */
export const homeOf = (user: DemoUser) => (user.clinicId ? `/clinic/${user.clinicId}` : "/");
