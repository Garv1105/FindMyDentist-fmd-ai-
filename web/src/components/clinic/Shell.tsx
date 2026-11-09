"use client";

import {
  BarChart3, CalendarDays, Check, ChevronDown, CreditCard, House, ListChecks, LogOut, MapPin, Menu,
  Settings, Sparkles, Users, UsersRound, X, type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ButtonLink, IconButton, Panel } from "@/components/app/kit";
import { canOpenClinic, type DemoUser } from "@/lib/demo";
import { useDemoUser } from "@/lib/useDemoUser";
import { cleanBranch, cleanDate, getClinic, getClinicHome, type Clinic } from "@/sample/clinic";
import { useDismiss } from "./dismiss";
import { Notifications } from "./Notifications";

/* ---------------- dates (IST) ---------------- */

const IST = 5.5 * 3600_000;
export const todayIst = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const longDate = (date: string) =>
  new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
function dateLabel(date: string) {
  const t = todayIst();
  if (date === t) return "Today";
  if (date === shift(t, -1)) return "Yesterday";
  if (date === shift(t, 1)) return "Tomorrow";
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/* ---------------- context ---------------- */

type ClinicCtx = {
  clinic: Clinic;
  user: DemoUser;
  base: string;
  branchId: string;
  setBranchId: (id: string) => void;
  date: string;
  setDate: (d: string) => void;
};
const Ctx = createContext<ClinicCtx | null>(null);
export function useClinic() {
  const c = use(Ctx);
  if (!c) throw new Error("useClinic outside ClinicShell");
  return c;
}

/* ---------------- navigation ---------------- */

type NavKey = "calendar" | "tasks" | "ai";
const NAV: [slug: string, label: string, Icon: LucideIcon, count?: NavKey][] = [
  ["", "Home", House],
  ["calendar", "Calendar", CalendarDays, "calendar"],
  ["patients", "Patients", UsersRound],
  ["billing", "Billing", CreditCard],
  ["tasks", "Tasks", ListChecks, "tasks"],
  ["reports", "Reports", BarChart3],
  ["ai", "AI manager", Sparkles, "ai"],
  ["team", "Team", Users],
  ["settings", "Settings", Settings],
];
export const SECTION_TITLES = Object.fromEntries(NAV.map(([slug, label]) => [slug, label]));

function SideNav({ ctx, section, counts, onPick }: { ctx: ClinicCtx; section: string; counts: Partial<Record<NavKey, number>>; onPick?: () => void }) {
  const { clinic, user, base, branchId, date } = ctx;
  // keep the chosen day and branch when moving between sections
  const keep = new URLSearchParams({ ...(date !== todayIst() && { date }), ...(branchId !== "main" && { branch: branchId }) }).toString();
  const to = (slug: string) => `${slug ? `${base}/${slug}` : base}${keep ? `?${keep}` : ""}`;
  const { signOut } = useDemoUser();
  const router = useRouter();
  const branch = clinic.branches.find((b) => b.id === branchId);
  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center gap-2.5 px-2 pb-3">
        <Link href={to("")} onClick={onPick} aria-label="FMD Clinic home">
          <Image src="/img/logo-fmd.webp" alt="FindMyDentist" width={337} height={180} className="h-9 w-auto" />
        </Link>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Clinic</span>
      </div>
      <div className="mx-1 mb-3 rounded-2xl border border-line bg-[var(--surface-glass)] px-3 py-2.5">
        <p className="text-[14.5px] font-medium text-ink">{clinic.name}</p>
        <p className="text-[13px] text-ink-3">{branch ? `${branch.area} · ${branch.name}` : "All branches"}</p>
      </div>
      <nav aria-label="Clinic sections" className="flex flex-col gap-0.5">
        {NAV.map(([slug, label, Icon, key]) => {
          const on = section === slug;
          const n = key ? counts[key] : undefined;
          return (
            <Link
              key={slug}
              href={to(slug)}
              onClick={onPick}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors ${
                on ? "bg-[var(--accent-soft)] text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)]" : "text-ink-2 hover:bg-[var(--surface-glass)] hover:text-ink"
              }`}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.5} />
              {label}
              {n ? (
                <span className={`ml-auto text-[12.5px] ${key === "ai" ? "font-medium text-[var(--headline-accent)]" : "text-ink-3"}`}>
                  {key === "ai" ? `${n} to review` : n}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-3 border-t border-line px-2 pt-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[13px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]">
          {user.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">{user.name}</span>
          <span className="block text-[13px] text-ink-3">{user.title}</span>
        </span>
        <IconButton
          label="Sign out"
          className="size-9"
          onClick={() => {
            signOut();
            router.push("/demo");
          }}
        >
          <LogOut className="size-4" strokeWidth={1.5} />
        </IconButton>
      </div>
    </div>
  );
}

/* ---------------- top bar pickers ---------------- */

type Choice = { key: string; label: string; on: boolean; select: () => void };

function Picker({ label, icon: Icon, choices, footer }: { label: string; icon: LucideIcon; choices: Choice[]; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [alignLeft, setAlignLeft] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box, btn);
  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          // the 220px menu hangs from the button's right edge unless that would push it off the left of the screen
          setAlignLeft(e.currentTarget.getBoundingClientRect().right < 236);
          setOpen((o) => !o);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-[var(--surface-glass)] px-3.5 text-[14px] text-ink hover:border-line-strong"
      >
        <Icon className="size-4 text-ink-2" strokeWidth={1.5} />
        {label}
        <ChevronDown className="size-3.5 text-ink-3" strokeWidth={1.75} />
      </button>
      {open && (
        <div ref={box} data-picker-menu className={`app-panel app-solid absolute top-[calc(100%+8px)] z-40 w-[220px] p-1.5 ${alignLeft ? "left-0" : "right-0"}`}>
          {choices.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                c.select();
                setOpen(false);
                btn.current?.focus();
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] ${c.on ? "bg-[var(--accent-soft)] text-ink" : "text-ink-2 hover:bg-[var(--surface-glass)] hover:text-ink"}`}
            >
              {c.label}
              {c.on && <Check className="size-4" strokeWidth={1.75} />}
            </button>
          ))}
          {footer}
        </div>
      )}
    </div>
  );
}

function TopBar({ ctx, section, onMenu, menuBtn }: { ctx: ClinicCtx; section: string; onMenu: () => void; menuBtn: RefObject<HTMLButtonElement | null> }) {
  const { clinic, date, setDate, branchId, setBranchId, base } = ctx;
  const t = todayIst();
  const branchName = branchId === "all" ? "All branches" : (clinic.branches.find((b) => b.id === branchId)?.name ?? "Branch");
  return (
    <header className="flex flex-wrap items-center gap-2.5">
      <IconButton ref={menuBtn} label="Open menu" className="lg:hidden" onClick={onMenu}>
        <Menu className="size-[18px]" strokeWidth={1.5} />
      </IconButton>
      <h1 className="mr-auto text-[17px] font-medium text-ink">
        {SECTION_TITLES[section] ?? "FMD Clinic"}
        <span className="ml-2 hidden text-[14.5px] font-normal text-ink-3 sm:inline">{longDate(date)}</span>
      </h1>
      <Picker
        label={dateLabel(date)}
        icon={CalendarDays}
        choices={[shift(t, -1), t, shift(t, 1)].map((d) => ({ key: d, label: dateLabel(d), on: d === date, select: () => setDate(d) }))}
        footer={
          <label className="mt-1 flex items-center justify-between gap-2 border-t border-line px-3 pb-1.5 pt-2.5 text-[13.5px] text-ink-3">
            Pick a date
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-[13.5px] text-ink [color-scheme:dark]"
            />
          </label>
        }
      />
      <Picker
        label={branchName}
        icon={MapPin}
        choices={[...clinic.branches.map((b) => ({ key: b.id, label: b.name })), { key: "all", label: "All branches" }].map((b) => ({
          ...b,
          on: b.key === branchId,
          select: () => setBranchId(b.key),
        }))}
      />
      <Notifications clinicId={clinic.id} base={base} />
    </header>
  );
}

/* ---------------- states ---------------- */

function Centered({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Panel className="w-full max-w-[460px] p-7 text-center">
        <h1 className="text-[20px] font-medium text-ink">{title}</h1>
        <p className="mt-2 text-[15px] text-ink-3">{text}</p>
        <div className="mt-5">{action}</div>
      </Panel>
    </div>
  );
}

export function ChooseDemo({ next }: { next: string }) {
  return (
    <Centered
      title="Choose a demo account to open FMD Clinic"
      text="FMD is in preview. Pick the clinic owner or the front desk; no password needed."
      action={<ButtonLink href={`/demo?next=${encodeURIComponent(next)}`}>Choose a demo account</ButtonLink>}
    />
  );
}

/* ---------------- shell ---------------- */

export function ClinicShell({ children }: { children: ReactNode }) {
  const { clinicId } = useParams<{ clinicId: string }>();
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useDemoUser();
  const [clinic, setClinic] = useState<Clinic | null | undefined>(undefined);
  const [counts, setCounts] = useState<Partial<Record<NavKey, number>>>({});
  const [menu, setMenu] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  useDismiss(menu, closeMenu, drawer, menuBtn);
  useEffect(() => {
    if (!menu) return;
    drawer.current?.querySelector<HTMLElement>("button")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  const date = cleanDate(params.get("date"), todayIst());
  const setParam = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(params);
      p.set(key, value);
      router.replace(`${path}?${p}`, { scroll: false });
    },
    [params, path, router],
  );

  useEffect(() => {
    getClinic(clinicId).then(setClinic);
  }, [clinicId]);

  const allowed = canOpenClinic(user ?? null, clinicId);
  const branchId = clinic ? cleanBranch(params.get("branch"), clinic) : "main";
  useEffect(() => {
    if (!clinic || !allowed) return;
    getClinicHome(clinic.id, { date: todayIst(), branchId }).then((h) =>
      setCounts({
        calendar: h.counts.total,
        tasks: h.followUps.filter((f) => !f.done).length,
        ai: h.tasks.filter((t) => t.needsApproval && t.status === "proposed").length,
      }),
    );
  }, [clinic, allowed, branchId, path]);

  if (user === undefined || clinic === undefined) return <div className="min-h-dvh" aria-busy />;
  if (clinic === null)
    return <Centered title="Clinic not found" text="This link doesn't match a clinic you can open." action={<ButtonLink href="/clinic" variant="secondary">Back to your clinics</ButtonLink>} />;
  if (!user || !allowed) return <ChooseDemo next={path} />;

  const base = `/clinic/${clinic.id}`;
  const section = path.slice(base.length + 1).split("/")[0] ?? "";
  const ctx: ClinicCtx = { clinic, user, base, branchId, setBranchId: (v) => setParam("branch", v), date, setDate: (v) => setParam("date", v) };

  return (
    <Ctx value={ctx}>
      <div className="app-glow min-h-dvh">
        <div className="mx-auto grid max-w-[1480px] gap-5 p-4 lg:grid-cols-[256px_minmax(0,1fr)] lg:p-5">
          <aside className="app-panel sticky top-5 hidden h-[calc(100dvh-40px)] self-start p-3 lg:block">
            <SideNav ctx={ctx} section={section} counts={counts} />
          </aside>
          <div className="flex min-w-0 flex-col gap-4">
            <TopBar ctx={ctx} section={section} onMenu={() => setMenu(true)} menuBtn={menuBtn} />
            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
      {menu && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/60" aria-hidden />
          <div ref={drawer} role="dialog" aria-label="Menu" className="app-panel fixed inset-y-0 left-0 z-50 w-[288px] max-w-[85vw] rounded-l-none p-3">
            <IconButton label="Close menu" className="absolute right-3 top-3 size-9" onClick={() => (closeMenu(), menuBtn.current?.focus())}>
              <X className="size-4" strokeWidth={1.5} />
            </IconButton>
            <SideNav ctx={ctx} section={section} counts={counts} onPick={closeMenu} />
          </div>
        </div>
      )}
    </Ctx>
  );
}

