/**
 * The sample patient roster behind past appointments: about 2,200 patients at the main branch and 800 at Koramangala,
 * each with an age band, gender, language, pincode, family group, how they first came, and first and last visit dates
 * relative to today (regulars still coming have no last date). Past days in clinic.ts draw their patients from here,
 * so a patient never has a visit outside their first..last dates and "lapsed" lists stay true. Only counts and actionable lists reach the reports.
 */

export const AGE_BANDS = ["0–17", "18–29", "30–44", "45–59", "60+"] as const;
export const GENDERS = ["Female", "Male", "Other or not said"] as const;
export const LANGUAGES = ["Kannada", "English", "Hindi", "Tamil"] as const;
/** Where a patient first came from. FMD channels fill in by themselves; the rest are picked at the first visit. */
export const SOURCES = ["FMD Main search", "FMD Main profile", "Concierge", "Walk-in", "Phone", "Patient referral", "Dentist referral", "Google", "Social", "Camp"] as const;
export type Source = (typeof SOURCES)[number];
export const FMD_SOURCES: readonly Source[] = ["FMD Main search", "FMD Main profile", "Concierge"];

export type Person = {
  id: string;
  branchId: string;
  name: string;
  ageBand: (typeof AGE_BANDS)[number];
  gender: (typeof GENDERS)[number];
  language: (typeof LANGUAGES)[number];
  pincode: string;
  familyId: string | null;
  source: Source;
  referredBy?: string;
  /** first attended visit, YYYY-MM-DD (never a Sunday, always before today) */
  first: string;
  /** last attended visit, or null for regulars who are still coming */
  last: string | null;
  /** misses appointments far more often than most */
  flaky: boolean;
};

/** A stable, well-mixed number from a string (murmur3 finaliser), so different tags on one id don't move together. */
export function hash(s: string) {
  let h = [...s].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 0x01000193), 0x811c9dc5);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Pick by weight: `weights` are relative and line up with `items`. */
export function pick<T>(items: readonly T[], weights: number[], h: number): T {
  let r = h % weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) return items[i];
  return items[items.length - 1];
}

const FIRST = [
  "Aarav", "Aditi", "Akash", "Amrita", "Ananya", "Anil", "Anjali", "Arun", "Bhavana", "Chetan", "Deepa", "Deepak", "Gayatri", "Ganesh", "Harish",
  "Hema", "Isha", "Jagdish", "Jyoti", "Kavitha", "Karthik", "Keerthi", "Kishore", "Lata", "Mahesh", "Manjula", "Manoj", "Nandini", "Naveen", "Nisha",
  "Pallavi", "Prakash", "Pramod", "Rachana", "Rajesh", "Ramya", "Ranjit", "Rekha", "Sachin", "Sandhya", "Sanjay", "Savitha", "Shilpa", "Shreyas",
  "Smita", "Srinivas", "Sudha", "Sunil", "Swati", "Tanvi", "Tejas", "Uday", "Usha", "Varun", "Vasudha", "Vidya", "Vinay", "Yamini", "Yash", "Zoya",
  "Abhishek", "Bindu", "Charan", "Divakar", "Esha", "Farhan", "Girish", "Ishaan", "Kiran", "Leela",
];
const LAST = [
  "Acharya", "Bhat", "Chandra", "Das", "D'Souza", "Gowda", "Hegde", "Iyengar", "Jain", "Joshi", "Kamath", "Kapoor", "Kumar", "Malhotra", "Menon",
  "Mishra", "Murthy", "Nadig", "Naik", "Nair", "Pai", "Pandey", "Patil", "Prasad", "Rai", "Ramesh", "Rangan", "Reddy", "Saxena", "Sen", "Shenoy",
  "Shetty", "Sinha", "Srinivasan", "Subramanian", "Thomas", "Upadhyay", "Varma", "Venkatesh", "Yadav", "Ahmed", "Banerjee", "Fernandes", "Gupta", "Kulkarni",
];
/** Names the day plan uses for today and future visits; the roster never reuses them. */
const TAKEN = new Set(["Rohan Gupta", "Anita Desai", "Suresh Babu", "Lakshmi Narayan", "Priya Sharma", "Arjun Mehta", "Neha Kulkarni", "Vikram Patel", "Sana Qureshi", "Rahul Verma", "Divya Pillai", "Imran Khan", "Pooja Reddy", "Kiran Rao", "Aditya Singh", "Farah Sheikh", "Gopal Krishnan", "Meghna Bose", "Nikhil Jain", "Ritu Agarwal"]);

/** Every first × last name once, in a fixed shuffled order. */
const NAMES = (() => {
  const n = FIRST.length * LAST.length;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = (i * 1009) % n; // 1009 is prime and doesn't divide n, so this visits every name once
    const name = `${FIRST[k % FIRST.length]} ${LAST[Math.floor(k / FIRST.length)]}`;
    if (!TAKEN.has(name)) out.push(name);
  }
  return out;
})();
const SIZES: Record<string, [offset: number, count: number]> = { main: [0, 2200], kora: [2200, 800] };
/** Names after both rosters: patients who booked once and never came (so they're nobody's "first visit"). */
const NEVER_CAME = NAMES.slice(3000);

const PINCODES: Record<string, [string[], number[]]> = {
  main: [["560038", "560008", "560075", "560017", "560093", "560071"], [30, 18, 15, 13, 12, 12]],
  kora: [["560034", "560095", "560047", "560068", "560102"], [32, 22, 18, 14, 14]],
};
const DENTIST_REFERRERS = ["Dr. Meenakshi, Ortho Care", "Dr. Farooq, City Smiles", "Dr. Lalitha, Kids Dental"];

/** A date `offset` days before today, moved off Sundays to the Saturday before. */
const pastDay = (today: string, offset: number) => {
  const d = addDays(today, -offset);
  return new Date(`${d}T00:00:00Z`).getUTCDay() === 0 ? addDays(d, -1) : d;
};

const cache = new Map<string, Person[]>();

export function roster(branchId: string, today: string): Person[] {
  const key = `${branchId}|${today}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [from, count] = SIZES[branchId] ?? [0, 0];
  const people: Person[] = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[from + i];
    const h = (s: string) => hash(`${name}-${s}`);
    // first visits spread evenly over ~7 years; half the returning patients are regulars who are still coming
    const firstOffset = 2 + (h("f") % 2500);
    const oneTime = h("one") % 4 === 0;
    const regular = !oneTime && h("reg") % 2 === 0;
    const lastOffset = oneTime ? firstOffset : 1 + (h("l") % firstOffset);
    const source = pick(SOURCES, [22, 12, 3, 13, 9, 19, 4, 11, 4, 3], h("src"));
    people.push({
      id: `${branchId}-p${i}`,
      branchId,
      name,
      ageBand: pick(AGE_BANDS, [14, 22, 28, 21, 15], h("age")),
      gender: pick(GENDERS, [54, 45, 1], h("g")),
      language: pick(LANGUAGES, [41, 33, 18, 8], h("lang")),
      pincode: pick(PINCODES[branchId][0], PINCODES[branchId][1], h("pin")),
      familyId: h("fam") % 10 < 4 ? `${branchId}-f${Math.floor(i / 3)}` : null,
      source,
      first: pastDay(today, firstOffset),
      last: regular ? null : pastDay(today, lastOffset),
      flaky: h("flaky") % 25 === 0,
    });
  }
  // a referral names someone who was already a patient at the time (or a dentist elsewhere)
  for (const p of people) {
    if (p.source === "Patient referral") {
      const earlier = people.filter((q) => q.first < p.first);
      // ponytail: a handful of loyal patients refer most friends, like real clinics; a referral graph needs real data
      const loyal = earlier.filter((q) => hash(q.name) % 40 === 0);
      const pool = loyal.length && hash(`${p.name}-loyal`) % 3 ? loyal : earlier;
      if (pool.length) p.referredBy = pool[hash(`${p.name}-ref`) % pool.length].name;
      else p.source = "Walk-in";
    }
    if (p.source === "Dentist referral") p.referredBy = DENTIST_REFERRERS[hash(`${p.name}-ref`) % DENTIST_REFERRERS.length];
  }
  cache.set(key, people);
  return people;
}

/** A roster patient, or someone outside it: a new patient who booked and never came (`noShow`), or a one-off name. */
export type Visitor = { person: Person } | { name: string; noShow: boolean };

/**
 * Who sits in each of a past day's slots. Patients whose first or last visit is this day come first (so those visits
 * are real); the rest are patients whose first and last visits are either side of it. A small share are bookings
 * by new patients who never came.
 */
export function visitorsFor(branchId: string, date: string, slotIds: string[], today: string): Visitor[] {
  const people = roster(branchId, today);
  const due = people.filter((p) => p.first === date || p.last === date);
  return slotIds.map((id, k): Visitor => {
    if (k < due.length) return { person: due[k] };
    if (hash(`${id}-never`) % 100 < 1) return { name: NEVER_CAME[hash(id) % NEVER_CAME.length], noShow: true };
    for (let j = 0; j < 60; j++) {
      const p = people[hash(`${id}-p${j}`) % people.length];
      if (p && p.first < date && (p.last === null || date < p.last)) return { person: p };
    }
    // ponytail: very old dates have few patients spanning them; fall back to a one-off name outside the roster
    return { name: NEVER_CAME[hash(`${id}-x`) % NEVER_CAME.length], noShow: false };
  });
}
