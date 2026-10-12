"use client";

import { useEffect, useState } from "react";

export type Me = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  accountType: "patient" | "dentist" | "student" | "company";
  language: string;
  status: string;
  roles: string[];
  consents: Record<"terms" | "privacy" | "comms_appointments" | "comms_marketing" | "ai_history", boolean>;
};

/** JSON fetch that surfaces the server's human-readable message on failure. */
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

/** The signed-in user (null = signed out, undefined = still loading). Refreshes on "fmd:auth". */
export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const load = () =>
      api<{ user: Me | null }>("/api/me")
        .then((r) => live && setMe(r.user))
        .catch(() => live && setMe(null));
    load();
    window.addEventListener("fmd:auth", load);
    return () => {
      live = false;
      window.removeEventListener("fmd:auth", load);
    };
  }, []);
  return me;
}

export const authChanged = () => window.dispatchEvent(new Event("fmd:auth"));
