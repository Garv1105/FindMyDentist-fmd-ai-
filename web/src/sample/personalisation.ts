/**
 * Personalisation controls (plan part 10.2, PDR Annex D): sample data until the backend has it. Proposed API:
 *   GET/PUT /me/interests {topics, concerns} · POST /me/personalisation/reset · and the "personalisation" consent
 * Rules: what people tell us comes first; what they search is used only with the consent; both can be seen, changed
 * and reset; turning the consent off stops all personalisation. Patient records are never used for it.
 */
import { TOPICS } from "../lib/catalog.ts";
import { read, write } from "./store.ts";

export const CONCERNS = ["Sensitivity", "Bleeding gums", "Crooked teeth", "Missing teeth", "Children's teeth", "Whitening", "Bad breath", "Dental anxiety"];
export type Interests = { topics: string[]; concerns: string[] };

const key = (userId: string) => `fmd-demo:interests:${userId}`;
const searchKey = (userId: string) => `fmd-demo:last-search:${userId}`;

export async function getInterests(userId: string): Promise<Interests> {
  return read<Interests>(key(userId)) ?? { topics: [], concerns: [] };
}

export async function saveInterests(userId: string, i: Interests) {
  write(key(userId), { topics: i.topics.filter((t) => (TOPICS as readonly string[]).includes(t)), concerns: i.concerns.filter((c) => CONCERNS.includes(c)) });
}

/** Forgets everything used to personalise: interests and the last search. */
export async function resetPersonalisation(userId: string) {
  write(key(userId), { topics: [], concerns: [] });
  write(searchKey(userId), null);
}

export async function lastSearch(userId: string) {
  return read<string>(searchKey(userId));
}

/** Concerns map to feed topics, so "Bleeding gums" brings up gum health posts. */
export const CONCERN_TOPICS: Record<string, string> = {
  Sensitivity: "Prevention",
  "Bleeding gums": "Gum health",
  "Crooked teeth": "Orthodontics",
  "Missing teeth": "Implants",
  "Children's teeth": "Kids",
  Whitening: "Cosmetic",
  "Bad breath": "Prevention",
  "Dental anxiety": "Prevention",
};
