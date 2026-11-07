"use client";

import { useEffect, useState } from "react";

/** A clinic in the FastAPI service the user belongs to, and this app's workspace for it (null: not set up yet). */
export type Workspace = { clinic_id: string; clinic_name: string; role: ApiClinicRole; workspace_id: string | null };
export type ApiClinicRole = "owner" | "dentist" | "receptionist" | "finance" | "assistant";
export const CLINIC_ROLE_LABELS: Record<ApiClinicRole, string> = { owner: "Owner", dentist: "Dentist", receptionist: "Front desk", finance: "Finance", assistant: "Assistant" };
export type DentistProfile = {
  council: string;
  registration_no: string;
  qualifications?: string | null;
  specialisation?: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
};

/** This app's view of the signed-in user plus the FastAPI account's (GET /api/me). */
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
  emailVerified: boolean;
  /** an email added but not yet verified */
  pendingEmail: string | null;
  mfaEnabled: boolean;
  city: string | null;
  dentistProfile: DentistProfile | null;
  workspaces: Workspace[];
};

/** The human message in any of the error shapes: this app's {message}, FastAPI's {error:{message}} and its 422 {detail}. */
function errorText(data: Record<string, unknown>): string | null {
  if (typeof data.message === "string") return data.message;
  const e = data.error as { message?: string } | undefined;
  if (e?.message) return e.message;
  if (typeof data.detail === "string") return data.detail;
  const d = Array.isArray(data.detail) ? (data.detail[0] as { loc?: unknown[]; msg?: string }) : null;
  if (d?.msg) {
    const field = String(d.loc?.at(-1) ?? "").replace(/_/g, " ");
    const msg = d.msg.replace(/^Value error, /, "");
    return field && field !== "body" ? `${field[0].toUpperCase()}${field.slice(1)}: ${msg}` : msg;
  }
  return null;
}

/**
 * JSON fetch that surfaces the server's human-readable message on failure. Paths under /api/v1 go to the FastAPI
 * service (proxied by next.config.ts); the rest are this app's own routes.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorText(data) ?? (res.status === 429 ? "Too many attempts. Please wait a little and try again." : "Something went wrong. Please try again."));
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

/** Tell every useMe() the account changed. */
export const authChanged = () => window.dispatchEvent(new Event("fmd:auth"));

/**
 * After signing in or changing the account in FastAPI (email, two-step sign-in, dentist profile, clinics): bring this
 * app's copy up to date now, then tell every useMe().
 */
export async function accountChanged() {
  await api("/api/me?fresh=1").catch(() => null);
  authChanged();
}

export async function signOut() {
  await api("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
  authChanged();
}
