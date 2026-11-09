"use client";

import { useMemo, useSyncExternalStore } from "react";
import { readStored, type DemoUser } from "./demo";

const KEY = "fmd-demo-user";
const listeners = new Set<() => void>();
/** used when storage is unavailable (private mode, blocked site data) */
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function write(value: string | null) {
  memory = value;
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // memory holds it for this tab
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange(); // other tabs
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The signed-in preview person (null = signed out, undefined = not read yet, e.g. during server render).
 * signIn takes a preview person's id, or an account created on the sign-up screen.
 */
export function useDemoUser(): { user: DemoUser | null | undefined; signIn: (who: string | DemoUser) => void; signOut: () => void } {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined);
  const user = useMemo(() => (raw === undefined ? undefined : readStored(raw)), [raw]);
  return {
    user,
    signIn: (who) => write(typeof who === "string" ? who : JSON.stringify(who)),
    signOut: () => write(null),
  };
}
