"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { auth, type Me } from "./fmd";

export type { Me };

/** JSON fetch for this site's own /api routes (assistant, concierge, waitlist); the FastAPI backend goes through lib/fmd. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Something went wrong. Please try again.");
  return data as T;
}

/* The signed-in user, fetched once and shared by every component that asks (navbar, shell, assistant, concierge). */
let current: Me | null | undefined; // undefined = not loaded yet
let gen = 0;
let loading = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function load() {
  const g = ++gen; // a newer load (after login or logout) wins over an older one still in flight
  loading = true;
  auth
    .me()
    .catch(() => null)
    .then((u) => {
      if (g !== gen) return;
      loading = false;
      current = u;
      notify();
    });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (current === undefined && !loading) load();
  return () => void listeners.delete(onChange);
}

/** null = signed out, undefined = still loading (and always during server render). */
export const useMe = () => useSyncExternalStore(subscribe, () => current, () => undefined);

/** Call after logging in or out, or after changing account details. */
export const authChanged = () => load();

/**
 * Ends this device's session, or every session with `everywhere`. Throws if the backend can't be reached: the HttpOnly
 * cookies can only be cleared by it.
 */
export async function logout(everywhere = false) {
  await (everywhere ? auth.logoutAll() : auth.logout());
  gen++;
  loading = false;
  current = null;
  notify();
}

/** For signed-in pages: sends signed-out visitors to /login and back here afterwards. undefined until a user is known. */
export function useRequireMe() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me === null) router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  }, [me, router]);
  return me ?? undefined;
}
