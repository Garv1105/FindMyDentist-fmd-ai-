/**
 * Browser storage for FMD Main demo data, so a demo survives a reload. Guarded: private mode or blocked storage just
 * means the data lives in memory for this tab. Keys are "fmd-demo:<what>:<userId>".
 */
const mem = new Map<string, string>();

export function read<T>(key: string): T | null {
  let v: string | null | undefined;
  try {
    v = globalThis.localStorage?.getItem(key);
  } catch {
    // storage blocked
  }
  v ??= mem.get(key) ?? null;
  return v ? (JSON.parse(v) as T) : null;
}

export function write(key: string, value: unknown) {
  const v = JSON.stringify(value);
  mem.set(key, v);
  try {
    globalThis.localStorage?.setItem(key, v);
  } catch {
    // kept in memory for this tab
  }
}
