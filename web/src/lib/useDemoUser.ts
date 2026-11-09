"use client";

import { useSyncExternalStore } from "react";
import { findDemoUser, type DemoUser } from "./demo";

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

function write(id: string | null) {
  memory = id;
  try {
    if (id) localStorage.setItem(KEY, id);
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

/** The demo person (null = nobody chosen, undefined = not read yet, e.g. during server render). */
export function useDemoUser(): { user: DemoUser | null | undefined; signIn: (id: string) => void; signOut: () => void } {
  const id = useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined);
  return {
    user: id === undefined ? undefined : findDemoUser(id),
    signIn: (next) => write(next),
    signOut: () => write(null),
  };
}
