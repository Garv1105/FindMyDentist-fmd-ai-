/**
 * Digital treatment warranty certificates (plan part 3.4, PDR Annex A): sample data until the backend has them.
 * Proposed API:
 *   GET /me/certificates → Certificate[]     GET /certificates/{id} → Certificate
 *   GET /certificates/verify/{code} (public, no sign-in) → PublicCertificate: only what proves it's genuine,
 *       never the patient's name, tooth or other health details
 * Rules: the clinic is the issuer and owns the terms. FMD shows them exactly as issued and never adds to, broadens or
 * interprets them. Exclusions and conditions are as prominent as what's covered. A correction is a new version, and
 * the history of versions stays visible.
 */
import { demoPdf } from "./files.ts";

export type CertStatus = "active" | "expired" | "amended" | "voided" | "disputed";

export type Certificate = {
  id: string;
  /** non-guessable; printed on the certificate and used by the public check */
  code: string;
  number: string;
  clinic: { id: string; name: string; address: string };
  dentist: { id: string; name: string };
  treatment: string;
  category: string;
  site: string;
  treatment_date: string;
  issue_date: string;
  valid_until: string;
  covered: string[];
  exclusions: string[];
  conditions: string[];
  followups: { label: string; due: string; done: boolean }[];
  status: CertStatus;
  version: number;
  versions: { version: number; at: string; change: string }[];
  journey_id: string;
};

export type PublicCertificate = Pick<Certificate, "number" | "category" | "issue_date" | "valid_until" | "version"> & { clinic: string; status: CertStatus };

const day = 86_400_000;
const date = (t: number) => new Date(t + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** The demo certificate, for the completed filling in the demo history. Same for every account, so the public check
 *  works from any device. */
function demoCertificate(now: number): Certificate {
  const treated = now - 241 * day;
  const valid = date(treated + 730 * day);
  return {
    id: "cert-0147",
    code: "FMD7-K3Q9-XW2P",
    number: "WC-2026-0147",
    clinic: { id: "kor", name: "Demo Dental Studio", address: "80 Feet Rd, Koramangala, Bengaluru (demo)" },
    dentist: { id: "venkat-rao", name: "Dr. Venkat Rao" },
    treatment: "Composite (tooth-coloured) filling",
    category: "Fillings",
    site: "Upper right second premolar (tooth 15)",
    treatment_date: date(treated),
    issue_date: date(treated + day),
    valid_until: valid,
    covered: ["Replacing the filling if it comes loose or breaks in normal use", "Repairing chips in the filling", "One adjustment of the bite after the filling"],
    exclusions: [
      "Damage from an injury or accident",
      "New decay in the tooth that isn't caused by the filling",
      "Work on the tooth by another dentist or clinic",
      "Staining from food, drink or smoking",
    ],
    conditions: ["Have a check-up at the clinic every 6 months", "Tell the clinic within 30 days of noticing a problem", "Bring this certificate or its number to the visit"],
    followups: [
      { label: "6-month check-up", due: date(treated + 182 * day), done: true },
      { label: "12-month check-up", due: date(treated + 365 * day), done: false },
    ],
    status: valid < date(now) ? "expired" : "active",
    version: 2,
    versions: [
      { version: 1, at: date(treated + day), change: "Issued." },
      { version: 2, at: date(treated + 3 * day), change: "The clinic corrected the tooth from upper right first premolar (14) to upper right second premolar (15)." },
    ],
    journey_id: "j-fill",
  };
}

export async function getCertificates(now = Date.now()) {
  return [demoCertificate(now)];
}

export async function getCertificate(id: string, now = Date.now()) {
  return (await getCertificates(now)).find((c) => c.id === id) ?? null;
}

/** The public check: genuine or not, and the minimum needed to trust it. */
export async function verify(code: string, now = Date.now()): Promise<PublicCertificate | null> {
  const c = (await getCertificates(now)).find((x) => x.code === code.trim().toUpperCase());
  return c ? { number: c.number, category: c.category, issue_date: c.issue_date, valid_until: c.valid_until, version: c.version, clinic: c.clinic.name, status: c.status } : null;
}

export const verifyPath = (c: Pick<Certificate, "code">) => `/verify/${c.code}`;

export function certificatePdf(c: Certificate, patient: string, origin: string): Blob {
  return demoPdf(`Warranty certificate ${c.number}`, [
    `Issued by ${c.clinic.name}, ${c.clinic.address}`,
    `Patient: ${patient} · Treating dentist: ${c.dentist.name}`,
    `Treatment: ${c.treatment}, ${c.site}`,
    `Treated ${c.treatment_date} · Issued ${c.issue_date} · Valid until ${c.valid_until} · Version ${c.version}`,
    "",
    "Covered:",
    ...c.covered.map((x) => `  - ${x}`),
    "Not covered:",
    ...c.exclusions.map((x) => `  - ${x}`),
    "Conditions:",
    ...c.conditions.map((x) => `  - ${x}`),
    "",
    `Check it's genuine: ${origin}${verifyPath(c)}  (code ${c.code})`,
    "The clinic issued these terms. FMD shows them as issued and does not add to them.",
    "DEMO CERTIFICATE · not a real warranty",
  ]);
}
