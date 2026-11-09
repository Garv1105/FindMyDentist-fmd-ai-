/**
 * Find a dentist (plan part 2.1, PDR §4.4, §10): a demo directory and its search until the backend has them.
 * Proposed API:
 *   GET /providers?q&loc&lat&lng&within&specialty&service&language&available=today|week&fee_max&gender&sort&page
 *     → SearchResult
 * The ranking rules here are the contract:
 *   - organic order uses only how well a dentist matches and whether FMD verified them, never payment;
 *   - sponsored profiles come back separately, at most one per page, never repeated in that page's organic list,
 *     and must match the same filters;
 *   - availability is shown only from a connected clinic schedule; otherwise the clinic confirms a time.
 *   GET /providers/{id} → ProviderProfile        GET /clinics/{id} → ClinicPage
 *   GET /providers/{id}/availability?from&to → Availability (open slots, or request windows when not connected)
 *   POST /providers/{id}/claim (multipart) → Claim; GET /me/claims
 * Every profile, clinic and sponsor is fictitious, flagged demo, and its verification text says no check was done.
 */
import { CITIES, LANGUAGES, SERVICES, SPECIALTIES } from "../lib/catalog.ts";
import { checkDocument } from "./dentist.ts";
import { read, write } from "./store.ts";

export type Clinic = { id: string; name: string; area: string; city: string; address: string; hours: string; lat: number; lng: number; live: boolean };

export type ProviderCard = {
  id: string;
  name: string;
  photo: string;
  gender: "female" | "male";
  specialty: string;
  experienceYears: number | null;
  languages: string[];
  services: string[];
  clinic: { id: string; name: string; area: string; city: string };
  distanceKm: number | null;
  fee: { min: number; max: number } | null;
  verification: { status: "unverified" | "pending" | "verified"; checks: string };
  sponsored: { sponsor: string } | null;
  /** epoch ms of the earliest open slot, only from a connected schedule */
  nextAvailable: number | null;
  demo: true;
};

export type Sort = "relevance" | "distance" | "soonest";
export type Filters = {
  q?: string;
  /** city or area typed by the user */
  loc?: string;
  lat?: number;
  lng?: number;
  /** km, only with lat/lng */
  within?: number;
  specialty?: string;
  service?: string;
  language?: string;
  available?: "today" | "week";
  fee_max?: number;
  gender?: "female" | "male";
  sort?: Sort;
  page?: number;
};

export type SearchResult = { items: ProviderCard[]; sponsored: ProviderCard[]; total: number; page: number; pages: number; suggestions: string[] };

export const PAGE_SIZE = 8;
const CHECK = "Demo profile: no real verification has been performed.";

/* ---------------- the demo directory ---------------- */

export const CLINICS: Clinic[] = [
  { id: "kor", name: "Demo Dental Studio", area: "Koramangala", city: "Bengaluru", address: "80 Feet Rd, Koramangala (demo)", hours: "Mon–Sat · 10:00–19:30", lat: 12.9352, lng: 77.6245, live: true },
  { id: "hsr", name: "Demo Ortho Care", area: "HSR Layout", city: "Bengaluru", address: "27th Main, HSR Layout (demo)", hours: "Mon–Fri · 09:30–18:00", lat: 12.9116, lng: 77.6474, live: false },
  { id: "jay", name: "Demo Implant Centre", area: "Jayanagar", city: "Bengaluru", address: "4th Block, Jayanagar (demo)", hours: "Tue–Sun · 10:00–20:00", lat: 12.925, lng: 77.5938, live: true },
  { id: "ind", name: "Demo Smile Lounge", area: "Indiranagar", city: "Bengaluru", address: "100 Feet Rd, Indiranagar (demo)", hours: "Mon–Sat · 11:00–20:00", lat: 12.9784, lng: 77.6408, live: false },
  { id: "whf", name: "Demo Family Dental", area: "Whitefield", city: "Bengaluru", address: "ITPL Main Rd, Whitefield (demo)", hours: "Mon–Sat · 09:00–18:00", lat: 12.9698, lng: 77.75, live: false },
  { id: "bnd", name: "Demo Seaside Dental", area: "Bandra West", city: "Mumbai", address: "Hill Rd, Bandra West (demo)", hours: "Mon–Sat · 10:00–19:00", lat: 19.0596, lng: 72.8295, live: true },
  { id: "and", name: "Demo Metro Dental", area: "Andheri East", city: "Mumbai", address: "MIDC Rd, Andheri East (demo)", hours: "Mon–Sat · 09:00–18:00", lat: 19.1136, lng: 72.8697, live: false },
  { id: "bjh", name: "Demo Pearl Dental", area: "Banjara Hills", city: "Hyderabad", address: "Road No. 12, Banjara Hills (demo)", hours: "Mon–Sat · 10:00–20:00", lat: 17.4156, lng: 78.4347, live: true },
  { id: "gcb", name: "Demo Tech City Dental", area: "Gachibowli", city: "Hyderabad", address: "Financial District, Gachibowli (demo)", hours: "Mon–Fri · 09:00–19:00", lat: 17.4401, lng: 78.3489, live: false },
  { id: "tng", name: "Demo Marina Dental", area: "T. Nagar", city: "Chennai", address: "Usman Rd, T. Nagar (demo)", hours: "Mon–Sat · 09:30–19:30", lat: 13.0418, lng: 80.2341, live: false },
  { id: "ady", name: "Demo Adyar Smiles", area: "Adyar", city: "Chennai", address: "LB Rd, Adyar (demo)", hours: "Mon–Sat · 10:00–19:00", lat: 13.0012, lng: 80.2565, live: false },
  { id: "skt", name: "Demo Capital Dental", area: "Saket", city: "Delhi NCR", address: "Press Enclave Rd, Saket (demo)", hours: "Mon–Sat · 10:00–19:00", lat: 28.5245, lng: 77.2066, live: true },
  { id: "ggn", name: "Demo Cyber Dental", area: "Gurugram Sector 29", city: "Delhi NCR", address: "Sector 29, Gurugram (demo)", hours: "Mon–Sat · 10:00–20:00", lat: 28.4687, lng: 77.0656, live: false },
  { id: "kgp", name: "Demo Riverside Dental", area: "Koregaon Park", city: "Pune", address: "North Main Rd, Koregaon Park (demo)", hours: "Mon–Sat · 10:00–19:00", lat: 18.5362, lng: 73.894, live: false },
];

type Row = {
  id: string;
  name: string;
  photo?: string;
  g: "female" | "male";
  sp: string;
  y: number;
  q: string[];
  l: string[];
  s: string[];
  c: string;
  fee?: [number, number];
  v: ProviderCard["verification"]["status"];
  sponsor?: string;
  /** hours from now to the next open slot, for clinics with a connected schedule */
  next?: number;
};

const ROWS: Row[] = [
  { id: "aditi-sharma", name: "Dr. Aditi Sharma", photo: "/img/dr-1.png", g: "female", sp: "General Dentist", y: 11, q: ["BDS", "MDS (Conservative Dentistry)"], l: ["English", "Hindi", "Kannada"], s: ["Consultation", "Teeth Cleaning", "Fillings", "Root Canal Treatment"], c: "kor", fee: [500, 500], v: "verified", next: 3 },
  { id: "rohan-mehta", name: "Dr. Rohan Mehta", photo: "/img/dr-2.png", g: "male", sp: "Orthodontist", y: 9, q: ["BDS", "MDS (Orthodontics)"], l: ["English", "Hindi"], s: ["Consultation", "Braces", "Clear Aligners"], c: "hsr", fee: [700, 900], v: "verified", sponsor: "Demo Aligner Brand" },
  { id: "sneha-iyer", name: "Dr. Sneha Iyer", photo: "/img/dr-3.png", g: "female", sp: "Implantologist", y: 14, q: ["BDS", "MDS (Prosthodontics)", "Fellowship in Implantology"], l: ["English", "Tamil", "Kannada"], s: ["Consultation", "Dental Implants", "Extraction", "Crowns & Bridges"], c: "jay", fee: [800, 1000], v: "verified", next: 26 },
  { id: "karan-malhotra", name: "Dr. Karan Malhotra", photo: "/img/dr-4.png", g: "male", sp: "Cosmetic Dentist", y: 7, q: ["BDS", "Certificate in Aesthetic Dentistry"], l: ["English", "Hindi", "Telugu"], s: ["Consultation", "Smile Design", "Veneers", "Teeth Whitening"], c: "ind", v: "unverified" },
  { id: "farah-khan", name: "Dr. Farah Khan", g: "female", sp: "Pediatric Dentist", y: 8, q: ["BDS", "MDS (Pedodontics)"], l: ["English", "Hindi", "Kannada"], s: ["Consultation", "Kids Dentistry", "Fillings", "Teeth Cleaning"], c: "whf", fee: [600, 600], v: "verified" },
  { id: "venkat-rao", name: "Dr. Venkat Rao", g: "male", sp: "Endodontist", y: 16, q: ["BDS", "MDS (Endodontics)"], l: ["English", "Telugu", "Kannada"], s: ["Consultation", "Root Canal Treatment", "Fillings"], c: "kor", fee: [600, 800], v: "pending", next: 50 },
  { id: "meenakshi-pillai", name: "Dr. Meenakshi Pillai", g: "female", sp: "Periodontist", y: 12, q: ["BDS", "MDS (Periodontics)"], l: ["English", "Malayalam", "Tamil"], s: ["Consultation", "Gum Treatment", "Teeth Cleaning"], c: "jay", fee: [600, 700], v: "verified", next: 5 },
  { id: "arjun-desai", name: "Dr. Arjun Desai", g: "male", sp: "Oral Surgeon", y: 10, q: ["BDS", "MDS (Oral & Maxillofacial Surgery)"], l: ["English", "Hindi", "Marathi"], s: ["Consultation", "Extraction", "Dental Implants"], c: "whf", v: "unverified" },
  { id: "kavya-reddy", name: "Dr. Kavya Reddy", g: "female", sp: "Prosthodontist", y: 6, q: ["BDS", "MDS (Prosthodontics)"], l: ["English", "Telugu", "Hindi"], s: ["Consultation", "Dentures", "Crowns & Bridges"], c: "ind", fee: [500, 600], v: "verified" },
  { id: "nikhil-joshi", name: "Dr. Nikhil Joshi", g: "male", sp: "General Dentist", y: 13, q: ["BDS"], l: ["English", "Hindi", "Marathi"], s: ["Consultation", "Teeth Cleaning", "Fillings", "Extraction"], c: "bnd", fee: [600, 800], v: "verified", next: 4 },
  { id: "priyanka-shah", name: "Dr. Priyanka Shah", g: "female", sp: "Implantologist", y: 15, q: ["BDS", "MDS (Prosthodontics)"], l: ["English", "Hindi", "Marathi"], s: ["Consultation", "Dental Implants", "Crowns & Bridges"], c: "bnd", fee: [900, 1200], v: "verified", sponsor: "Demo Implant Systems", next: 30 },
  { id: "imran-sheikh", name: "Dr. Imran Sheikh", g: "male", sp: "Orthodontist", y: 8, q: ["BDS", "MDS (Orthodontics)"], l: ["English", "Hindi"], s: ["Consultation", "Braces", "Clear Aligners"], c: "and", v: "pending" },
  { id: "lakshmi-narayan", name: "Dr. Lakshmi Narayan", g: "female", sp: "Endodontist", y: 18, q: ["BDS", "MDS (Endodontics)"], l: ["English", "Telugu"], s: ["Consultation", "Root Canal Treatment", "Fillings"], c: "bjh", fee: [700, 900], v: "verified", next: 2 },
  { id: "rahul-varma", name: "Dr. Rahul Varma", g: "male", sp: "Cosmetic Dentist", y: 5, q: ["BDS"], l: ["English", "Telugu", "Hindi"], s: ["Consultation", "Teeth Whitening", "Veneers", "Smile Design"], c: "gcb", fee: [500, 1500], v: "unverified" },
  { id: "deepa-krishnan", name: "Dr. Deepa Krishnan", g: "female", sp: "Pediatric Dentist", y: 9, q: ["BDS", "MDS (Pedodontics)"], l: ["English", "Tamil"], s: ["Consultation", "Kids Dentistry", "Fillings"], c: "tng", fee: [500, 600], v: "verified" },
  { id: "suresh-babu", name: "Dr. Suresh Babu", g: "male", sp: "Periodontist", y: 20, q: ["BDS", "MDS (Periodontics)"], l: ["English", "Tamil", "Telugu"], s: ["Consultation", "Gum Treatment", "Teeth Cleaning"], c: "ady", fee: [700, 700], v: "verified" },
  { id: "ananya-gupta", name: "Dr. Ananya Gupta", g: "female", sp: "General Dentist", y: 7, q: ["BDS"], l: ["English", "Hindi"], s: ["Consultation", "Teeth Cleaning", "Fillings", "Teeth Whitening"], c: "skt", fee: [500, 700], v: "verified", next: 20 },
  { id: "vikram-singh", name: "Dr. Vikram Singh", g: "male", sp: "Oral Surgeon", y: 17, q: ["BDS", "MDS (Oral & Maxillofacial Surgery)"], l: ["English", "Hindi"], s: ["Consultation", "Extraction", "Dental Implants"], c: "ggn", fee: [1000, 1500], v: "pending" },
  { id: "sanjana-kulkarni", name: "Dr. Sanjana Kulkarni", g: "female", sp: "Orthodontist", y: 10, q: ["BDS", "MDS (Orthodontics)"], l: ["English", "Marathi", "Hindi"], s: ["Consultation", "Braces", "Clear Aligners"], c: "kgp", fee: [600, 800], v: "verified" },
];

/* ---------------- matching ---------------- */

/** plain words patients use, mapped to the specialties and treatments that handle them */
const CONCERNS: [RegExp, string[]][] = [
  [/pain|ache|sensitiv|cavit|decay/, ["Root Canal Treatment", "Fillings", "Endodontist", "General Dentist"]],
  [/gum|bleed/, ["Gum Treatment", "Periodontist"]],
  [/crooked|gap|align|straight|bite/, ["Braces", "Clear Aligners", "Orthodontist"]],
  [/missing|lost|replace/, ["Dental Implants", "Dentures", "Implantologist", "Prosthodontist"]],
  [/child|kid|baby/, ["Kids Dentistry", "Pediatric Dentist"]],
  [/yellow|stain|white|smile/, ["Teeth Whitening", "Smile Design", "Cosmetic Dentist"]],
  [/wisdom|pull|remove/, ["Extraction", "Oral Surgeon"]],
  [/clean|check/, ["Teeth Cleaning", "Consultation", "General Dentist"]],
];

const clinicOf = (id: string) => CLINICS.find((c) => c.id === id)!;

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const IST = 5.5 * 3_600_000;
const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);

/** `hours` from now, on the half hour, moved into opening hours (10:00–19:00 IST) */
export function slotAt(now: number, hours: number) {
  const half = 30 * 60_000;
  let t = Math.ceil((now + hours * 3_600_000) / half) * half;
  const h = new Date(t + IST).getUTCHours();
  if (h >= 19 || h < 10) {
    const day = istDay(h >= 19 ? t + 86_400_000 : t);
    t = Date.parse(`${day}T10:00:00+05:30`);
  }
  return t;
}

function card(r: Row, f: Filters, now: number): ProviderCard {
  const c = clinicOf(r.c);
  return {
    id: r.id,
    name: r.name,
    photo: r.photo ?? "",
    gender: r.g,
    specialty: r.sp,
    experienceYears: r.y,
    languages: r.l,
    services: r.s,
    clinic: { id: c.id, name: c.name, area: c.area, city: c.city },
    distanceKm: f.lat !== undefined && f.lng !== undefined ? Math.round(km(f.lat, f.lng, c.lat, c.lng) * 10) / 10 : null,
    fee: r.fee ? { min: r.fee[0], max: r.fee[1] } : null,
    verification: { status: r.v, checks: CHECK },
    sponsored: r.sponsor ? { sponsor: r.sponsor } : null,
    nextAvailable: openSlots(r.id, now)[0] ?? null,
    demo: true,
  };
}

function suggest(f: Filters): string[] {
  const out: string[] = [];
  if (f.available) out.push("Try any availability: many clinics confirm a time after you ask.");
  if (f.language) out.push(`Try any language instead of ${f.language}.`);
  if (f.specialty && f.specialty !== "General Dentist") out.push(`Try a General Dentist, who can refer you to a ${f.specialty} if needed.`);
  if (f.fee_max) out.push("Try a higher fee limit. Some dentists ask the clinic to confirm their fee.");
  if (f.within) out.push("Try a wider distance.");
  if (f.loc) out.push(`FMD may not list dentists in ${f.loc} yet. FMD Edge can help find one.`);
  if (f.q) out.push("Check the spelling, or describe the problem in a few words, like “bleeding gums”.");
  return out.length ? out : ["Try fewer filters."];
}

/** Pure search over the demo directory; `now` is a parameter so tests can fix the clock. */
export function search(f: Filters, now = Date.now()): SearchResult {
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 80);
  const loc = (f.loc ?? "").trim().toLowerCase();
  const concernTerms = CONCERNS.filter(([re]) => re.test(q)).flatMap(([, t]) => t);
  const valid = <T extends string>(v: string | undefined, list: readonly T[]) => (v && (list as readonly string[]).includes(v) ? v : undefined);
  const specialty = valid(f.specialty, SPECIALTIES);
  const service = valid(f.service, SERVICES);
  const language = valid(f.language, LANGUAGES);
  const page = Math.max(1, Math.min(50, Math.floor(f.page ?? 1)));
  const sort: Sort = f.sort === "distance" && f.lat !== undefined ? "distance" : f.sort === "soonest" ? "soonest" : "relevance";

  const scored = ROWS.map((r) => {
    const c = clinicOf(r.c);
    const hay = [r.name, r.sp, c.name, c.area, ...r.s].map((x) => x.toLowerCase());
    const direct = q && hay.some((h) => h.includes(q));
    const concern = concernTerms.some((t) => t === r.sp || r.s.includes(t));
    if (q && !direct && !concern) return null;
    if (loc && !c.city.toLowerCase().includes(loc) && !c.area.toLowerCase().includes(loc) && !loc.includes(c.area.toLowerCase())) return null;
    if (specialty && r.sp !== specialty) return null;
    if (service && !r.s.includes(service)) return null;
    if (language && !r.l.includes(language)) return null;
    if (f.gender && r.g !== f.gender) return null;
    if (f.fee_max && (!r.fee || r.fee[0] > f.fee_max)) return null;
    const p = card(r, f, now);
    if (f.within && f.lat !== undefined && (p.distanceKm ?? Infinity) > f.within) return null;
    if (f.available === "today" && (!p.nextAvailable || istDay(p.nextAvailable) !== istDay(now))) return null;
    if (f.available === "week" && (!p.nextAvailable || p.nextAvailable - now > 7 * 86_400_000)) return null;
    const verified = r.v === "verified" ? 2 : r.v === "pending" ? 1 : 0;
    const match = q && r.name.toLowerCase().includes(q) ? 3 : direct ? 2 : concern ? 1 : 0;
    return { p, score: verified + match };
  }).filter((x): x is { p: ProviderCard; score: number } => x !== null);

  scored.sort((a, b) =>
    sort === "distance"
      ? a.p.distanceKm! - b.p.distanceKm! || b.score - a.score
      : sort === "soonest"
        ? (a.p.nextAvailable ?? Infinity) - (b.p.nextAvailable ?? Infinity) || b.score - a.score
        : b.score - a.score || a.p.name.localeCompare(b.p.name),
  );

  const all = scored.map((x) => x.p);
  const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const onPage = new Set(items.map((p) => p.id));
  const ad = all.find((p) => p.sponsored && !onPage.has(p.id));
  return {
    items,
    sponsored: ad ? [ad] : [],
    total: all.length,
    page,
    pages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)),
    suggestions: all.length ? [] : suggest(f),
  };
}

export async function searchProviders(f: Filters): Promise<SearchResult> {
  return search(f);
}

/** places to suggest in the location box */
export const PLACES = [...new Set([...CITIES, ...CLINICS.map((c) => c.area)])];

/* ---------------- booking rules and open times ---------------- */

/** Demo booking rules, the same at every clinic (PDR §4.5: clinic-controlled rules and buffers). */
export const POLICY = { minNoticeHours: 2, freeCancelHours: 4, slotMinutes: 30, open: 10, close: 19 } as const;
export const CANCEL_TERMS = `Free to cancel or change up to ${POLICY.freeCancelHours} hours before. After that, the clinic may charge a late-cancellation fee. (Demo terms.)`;

const rowOf = (id: string) => ROWS.find((r) => r.id === id);
export function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** The next opening time (10:00 IST, skipping Sundays) for a time outside opening hours. */
function nextOpening(t: number) {
  const late = new Date(t + IST).getUTCHours() >= POLICY.close;
  let o = Date.parse(`${istDay(late ? t + 86_400_000 : t)}T${String(POLICY.open).padStart(2, "0")}:00:00+05:30`);
  while (new Date(o + IST).getUTCDay() === 0) o += 86_400_000;
  return o;
}

/**
 * Open half-hour slots for a dentist whose clinic has a connected schedule: inside opening hours, never on Sunday,
 * from the dentist's next free time and at least POLICY.minNoticeHours ahead. About a third are already taken.
 * `booked` removes times this person already holds.
 */
export function openSlots(dentistId: string, now = Date.now(), days = 7, booked: ReadonlySet<number> = new Set()): number[] {
  const r = rowOf(dentistId);
  if (!r || !clinicOf(r.c).live || r.next === undefined) return [];
  const step = POLICY.slotMinutes * 60_000;
  const end = now + days * 86_400_000;
  const out: number[] = [];
  let t = slotAt(now, Math.max(r.next, POLICY.minNoticeHours));
  while (t < end && out.length < 300) {
    const d = new Date(t + IST);
    if (d.getUTCHours() < POLICY.open || d.getUTCHours() >= POLICY.close || d.getUTCDay() === 0) {
      t = nextOpening(t);
      continue;
    }
    if (hash(`${dentistId}:${t}`) % 3 !== 0 && !booked.has(t)) out.push(t);
    t += step;
  }
  return out;
}

export type Part = "morning" | "afternoon" | "evening";
export const PARTS: Record<Part, { label: string; from: number; to: number }> = {
  morning: { label: "Morning, 10 am – 1 pm", from: 10, to: 13 },
  afternoon: { label: "Afternoon, 1 – 4 pm", from: 13, to: 16 },
  evening: { label: "Evening, 4 – 7 pm", from: 16, to: 19 },
};
export type Window = { date: string; part: Part };

/** For clinics without a connected schedule: the patient asks for a part of a day, and the clinic confirms a time. */
export function requestWindows(now = Date.now(), days = 7): Window[] {
  const out: Window[] = [];
  for (let i = 0; i < days; i++) {
    const date = istDay(now + i * 86_400_000);
    if (new Date(`${date}T12:00:00+05:30`).getUTCDay() === 0) continue;
    for (const part of Object.keys(PARTS) as Part[]) {
      if (Date.parse(`${date}T${String(PARTS[part].from).padStart(2, "0")}:00:00+05:30`) - now >= POLICY.minNoticeHours * 3_600_000) out.push({ date, part });
    }
  }
  return out;
}

export type Availability = { mode: "live"; slots: number[] } | { mode: "request"; windows: Window[] };
export function availability(dentistId: string, now = Date.now(), booked?: ReadonlySet<number>): Availability {
  const r = rowOf(dentistId);
  return r && clinicOf(r.c).live ? { mode: "live", slots: openSlots(dentistId, now, 7, booked) } : { mode: "request", windows: requestWindows(now) };
}

/* ---------------- profiles and clinics ---------------- */

/** Typical ranges for a demo clinic. Always shown as estimates: the dentist confirms the cost after an examination. */
export const SERVICE_FEES: Record<string, [number, number]> = {
  "Teeth Cleaning": [800, 1500],
  Fillings: [1000, 2500],
  "Root Canal Treatment": [4000, 8000],
  Braces: [35000, 80000],
  "Clear Aligners": [80000, 200000],
  "Dental Implants": [25000, 50000],
  Extraction: [800, 3000],
  "Crowns & Bridges": [5000, 15000],
  Dentures: [10000, 40000],
  "Gum Treatment": [2000, 8000],
  "Teeth Whitening": [5000, 15000],
  Veneers: [8000, 20000],
  "Smile Design": [30000, 100000],
  "Kids Dentistry": [500, 2000],
};

const FACILITIES: Record<string, string[]> = {
  kor: ["Wheelchair access", "Digital X-ray", "Card and UPI payments"],
  hsr: ["Parking", "Card and UPI payments"],
  jay: ["Wheelchair access", "3D scan (CBCT)", "Parking", "Card and UPI payments"],
  ind: ["Card and UPI payments"],
  whf: ["Wheelchair access", "Kids' play area", "Parking"],
  bnd: ["Wheelchair access", "Digital X-ray", "Card and UPI payments"],
  bjh: ["Parking", "Digital X-ray", "Card and UPI payments"],
  skt: ["Wheelchair access", "Card and UPI payments"],
};

export type ProviderProfile = ProviderCard & {
  qualifications: string[];
  bio: string;
  claimed: boolean;
  clinicDetails: Clinic & { facilities: string[]; mapUrl: string };
  serviceFees: { service: string; min: number; max: number }[];
};

const bioOf = (r: Row) =>
  `${r.name} is a ${r.sp.toLowerCase()} with ${r.y} years of experience, mainly treating ${r.s
    .filter((s) => s !== "Consultation")
    .slice(0, 2)
    .join(" and ")
    .toLowerCase()}. Explains options in plain language before any treatment. (Demo profile.)`;

export const mapUrl = (c: Clinic) => `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;

export async function getProvider(id: string, now = Date.now()): Promise<ProviderProfile | null> {
  const r = rowOf(id);
  if (!r) return null;
  const c = clinicOf(r.c);
  return {
    ...card(r, {}, now),
    qualifications: r.q,
    bio: bioOf(r),
    // a dentist who hasn't claimed their profile can't have been verified through it
    claimed: r.v !== "unverified",
    clinicDetails: { ...c, facilities: FACILITIES[c.id] ?? [], mapUrl: mapUrl(c) },
    serviceFees: r.s.filter((s) => SERVICE_FEES[s]).map((s) => ({ service: s, min: SERVICE_FEES[s][0], max: SERVICE_FEES[s][1] })),
  };
}

export type ClinicPage = Clinic & { facilities: string[]; mapUrl: string; dentists: ProviderCard[]; services: string[] };
export async function getClinicPage(id: string, now = Date.now()): Promise<ClinicPage | null> {
  const c = CLINICS.find((x) => x.id === id);
  if (!c) return null;
  const rows = ROWS.filter((r) => r.c === id);
  return {
    ...c,
    facilities: FACILITIES[id] ?? [],
    mapUrl: mapUrl(c),
    dentists: rows.map((r) => card(r, {}, now)),
    services: [...new Set(rows.flatMap((r) => r.s))].sort(),
  };
}

/* ---------------- claim a profile ---------------- */

export type Claim = { provider_id: string; status: "pending"; submitted_at: string; doc_name: string };
const claimKey = (userId: string) => `fmd-demo:claims:${userId}`;

export async function getClaims(userId: string): Promise<Claim[]> {
  return read<Claim[]>(claimKey(userId)) ?? [];
}

export async function submitClaim(
  userId: string,
  providerId: string,
  c: { full_name: string; council: string; registration_no: string; confirm: boolean },
  doc: { name: string; type: string; size: number } | null,
): Promise<Claim> {
  if (!rowOf(providerId)) throw new Error("That profile doesn't exist.");
  if (!c.full_name.trim() || c.council.trim().length < 2 || !c.registration_no.trim()) throw new Error("Enter your name, dental council and registration number.");
  if (!doc) throw new Error("Upload your registration certificate.");
  const bad = checkDocument(doc);
  if (bad) throw new Error(bad);
  if (!c.confirm) throw new Error("Confirm that this is your profile.");
  const all = await getClaims(userId);
  if (all.some((x) => x.provider_id === providerId)) throw new Error("You've already asked to claim this profile. FMD is reviewing it.");
  const claim: Claim = { provider_id: providerId, status: "pending", submitted_at: new Date().toISOString(), doc_name: doc.name };
  write(claimKey(userId), [...all, claim]);
  return claim;
}

/** GET /providers/{id}/availability, minus times this person already holds */
export async function getAvailability(dentistId: string, booked?: ReadonlySet<number>): Promise<Availability> {
  return availability(dentistId, Date.now(), booked);
}
