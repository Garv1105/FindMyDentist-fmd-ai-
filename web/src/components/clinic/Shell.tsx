"use client";

import { BarChart3, Boxes, Bot, CalendarDays, CreditCard, LayoutDashboard, ListChecks, Settings, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import Navbar from "../nav/Navbar";
import { Notice } from "../Page";
import { api, useMe } from "@/lib/me";

export type Workspace = {
  clinic: { id: string; name: string; city: string; area: string; demo: boolean };
  status: "setup" | "active" | "suspended";
  roles: string[];
  permissions: string[];
};

type Ctx = {
  clinicId: string;
  ws: Workspace;
  can: (perm: string) => boolean;
  /** Clinic API call: path relative to /api/clinic/[clinicId]/ */
  call: <T>(path: string, method?: "GET" | "POST", body?: unknown) => Promise<T>;
  refresh: () => void;
};
const ClinicCtx = createContext<Ctx | null>(null);
export function useClinic() {
  const c = use(ClinicCtx);
  if (!c) throw new Error("useClinic outside ClinicShell");
  return c;
}

const NAV: [string, string, typeof Users, string][] = [
  ["", "Dashboard", LayoutDashboard, "tasks.use"],
  ["calendar", "Calendar", CalendarDays, "appointments.read"],
  ["patients", "Patients", UsersRound, "patients.read"],
  ["billing", "Billing", CreditCard, "billing.read"],
  ["inventory", "Inventory", Boxes, "inventory.read"],
  ["tasks", "Tasks & handover", ListChecks, "tasks.use"],
  ["ai", "AI manager", Bot, "ai.use"],
  ["reports", "Reports", BarChart3, "reports.read"],
  ["team", "Team", Users, "tasks.use"],
  ["settings", "Settings", Settings, "appointments.read"],
];

export function ClinicShell({ children }: { children: ReactNode }) {
  const { clinicId } = useParams<{ clinicId: string }>();
  const path = usePathname();
  const me = useMe();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [err, setErr] = useState("");
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!me) return;
    api<Workspace>(`/api/clinic/${clinicId}`).then(setWs).catch((e) => setErr(e.message));
  }, [clinicId, me, v]);
  const call = useCallback(<T,>(p: string, method: "GET" | "POST" = "GET", body?: unknown) => api<T>(`/api/clinic/${clinicId}/${p}`, { method, body: method === "POST" ? (body ?? {}) : undefined }), [clinicId]);

  const base = `/clinic/${clinicId}`;
  const section = path.slice(base.length + 1).split("/")[0] ?? "";
  return (
    <>
      <Navbar />
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-24 sm:px-6">
        {me === null && (
          <Notice kind="info">
            <Link href={`/signin?next=${base}`} className="underline">Sign in</Link> to open Clinic OS.
          </Notice>
        )}
        {err && <Notice kind="error">{err}</Notice>}
        {ws && (
          <ClinicCtx value={{ clinicId, ws, can: (p) => ws.permissions.includes(p), call, refresh: () => setV((x) => x + 1) }}>
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <Link href="/clinic" className="text-[12px] text-ink-4 hover:text-ink">
                  ← All clinics
                </Link>
                <p className="mt-2 text-[17px] font-light text-ink">{ws.clinic.name}</p>
                <p className="text-[12px] text-ink-4">
                  {ws.clinic.area}, {ws.clinic.city} · {ws.roles.join(", ")}
                </p>
                {ws.status !== "active" && (
                  <p className="mt-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-[11.5px] text-ink-3">
                    Setup mode: FMD activates the workspace after verification. Until then, online booking can&apos;t be published.
                  </p>
                )}
                <nav aria-label="Clinic sections" className="no-scrollbar mt-4 flex gap-1 overflow-x-auto lg:flex-col">
                  {NAV.filter(([, , , perm]) => ws.permissions.includes(perm)).map(([slug, label, Icon]) => (
                    <Link
                      key={slug}
                      href={slug ? `${base}/${slug}` : base}
                      aria-current={section === slug ? "page" : undefined}
                      className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] ${section === slug ? "bg-[var(--accent-soft)] text-ink" : "text-ink-3 hover:text-ink"}`}
                    >
                      <Icon className="size-4" strokeWidth={1.5} /> {label}
                    </Link>
                  ))}
                </nav>
              </aside>
              <main className="min-w-0">{children}</main>
            </div>
          </ClinicCtx>
        )}
      </div>
    </>
  );
}

/** Section heading used by every clinic page. */
export function H({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-extralight tracking-[-0.03em] text-ink">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-[13px] text-ink-4">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const when = (t: number) => new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
export const time = (t: number) => new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
/** "YYYY-MM-DDTHH:mm" (IST) ↔ epoch ms, for datetime-local inputs. */
export const toLocal = (t: number) => new Date(t + 5.5 * 3600_000).toISOString().slice(0, 16);
export const fromLocal = (s: string) => new Date(`${s}:00+05:30`).getTime();
