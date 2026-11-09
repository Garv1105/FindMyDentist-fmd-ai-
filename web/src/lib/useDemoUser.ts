"use client";

import { useMemo, useSyncExternalStore } from "react";
import { readStored, type DemoUser } from "./demo";

const KEY = "fmd-demo-user";
/** accounts created on this device, so signing out and back in finds them again */
const ACCOUNTS = "fmd-demo-accounts";
let memoryAccounts: string | null = null;

function readAccounts(): string | null {
  try {
    return localStorage.getItem(ACCOUNTS);
  } catch {
    return memoryAccounts;
  }
}

function parseAccounts(raw: string | null | undefined): DemoUser[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map((u) => readStored(JSON.stringify(u))).filter((u): u is DemoUser => u !== null) : [];
  } catch {
    return [];
  }
}

function remember(user: DemoUser) {
  const list = [...parseAccounts(readAccounts()).filter((u) => u.id !== user.id), user];
  memoryAccounts = JSON.stringify(list);
  try {
    localStorage.setItem(ACCOUNTS, memoryAccounts);
  } catch {
    // memory holds it for this tab
  }
}
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
  const onStorage = (e: StorageEvent) => (e.key === KEY || e.key === ACCOUNTS) && onChange(); // other tabs
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
export function useDemoUser(): { user: DemoUser | null | undefined; accounts: DemoUser[]; signIn: (who: string | DemoUser) => void; signOut: () => void } {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined);
  const rawAccounts = useSyncExternalStore<string | null | undefined>(subscribe, readAccounts, () => undefined);
  const user = useMemo(() => (raw === undefined ? undefined : readStored(raw)), [raw]);
  const accounts = useMemo(() => parseAccounts(rawAccounts), [rawAccounts]);
  return {
    user,
    accounts,
    signIn: (who) => {
      if (typeof who !== "string") remember(who);
      write(typeof who === "string" ? who : JSON.stringify(who));
    },
    signOut: () => write(null),
  };
}
