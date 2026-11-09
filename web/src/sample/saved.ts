/**
 * Saved dentists, posts and jobs (plan parts 2.2 and 5.4): sample data until the backend has it.
 * Proposed API: GET /me/saves?type=dentist|post|job → string[] · POST /saves {type, id} · DELETE /saves/{type}/{id}
 */
import { read, write } from "./store.ts";

export type SavedKind = "dentist" | "post" | "job";
const key = (userId: string, kind: SavedKind) => `fmd-demo:saved-${kind}:${userId}`;

export async function getSaved(userId: string, kind: SavedKind): Promise<string[]> {
  return read<string[]>(key(userId, kind)) ?? [];
}

/** returns whether it's saved now */
export async function toggleSaved(userId: string, kind: SavedKind, id: string): Promise<boolean> {
  const list = await getSaved(userId, kind);
  const on = !list.includes(id);
  write(key(userId, kind), on ? [...list, id] : list.filter((x) => x !== id));
  return on;
}
