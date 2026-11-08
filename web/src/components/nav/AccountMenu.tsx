"use client";

import { Building2, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CLINIC_ROLE_LABELS, signOut, useMe } from "@/lib/me";

/** Where each FMD staff role can go (the pages check the role themselves; this only decides what to show). */
const ADMIN_LINKS: [href: string, label: string, roles: string[]][] = [
  ["/admin/verification", "Dentist verification", ["fmd_ops", "super_admin"]],
  ["/admin/clinics", "Clinic activation", ["fmd_ops", "super_admin"]],
  ["/admin/concierge", "FMD Edge queue", ["fmd_ops", "super_admin"]],
  ["/admin/support", "Support tickets", ["fmd_ops", "super_admin"]],
  ["/admin/moderation", "Moderation", ["moderator", "fmd_ops", "super_admin"]],
];

const itemCls = "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink";

/**
 * The navbar's account button and its menu: every part of the app this person can use, as links. Signed out: sign in,
 * create an account, register as a dentist. Closes on Escape, a click outside, or choosing a link.
 */
export default function AccountMenu() {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (me === undefined) return null; // not known yet: nothing, so it never flickers
  const close = () => setOpen(false);
  const go = (href: string, label: ReactNode, hint?: string) => (
    <Link key={href} href={href} onClick={close} className={itemCls}>
      <span className="min-w-0 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[11.5px] text-ink-4">{hint}</span>}
    </Link>
  );
  const group = (title: string, items: ReactNode[]) =>
    items.length > 0 && (
      <div className="border-t border-white/[0.06] pt-1.5 first:border-0 first:pt-0">
        <p className="px-3 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-4">{title}</p>
        {items}
      </div>
    );
  const admin = me ? ADMIN_LINKS.filter(([, , roles]) => roles.some((r) => me.roles.includes(r))) : [];

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={me ? `Your account and the app (${me.name})` : "Sign in"}
        className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[14px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        {me?.name.trim()[0]?.toUpperCase() ?? <UserRound className="size-5" strokeWidth={1.5} />}
      </button>

      {open && (
        <div
          id={id}
          // phones: pinned under the bar, full width; larger screens: a dropdown under the button (! because .nav-matte sets
          // position: relative)
          className="nav-matte !fixed inset-x-3 top-[84px] z-50 max-h-[calc(100dvh-100px)] space-y-1.5 sm:!absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[280px] overflow-y-auto rounded-[22px] !bg-[color-mix(in_srgb,var(--surface)_95%,transparent)] p-2"
        >
          {me ? (
            <>
              <div className="px-3 pb-1 pt-2">
                <p className="truncate text-[14px] text-ink">{me.name}</p>
                <p className="truncate text-[12px] text-ink-4">{me.email ?? me.phone}</p>
              </div>
              {group("You", [
                go("/account", "Account & security"),
                go("/appointments", "Appointments"),
                go("/records", "Records vault"),
                go("/explore", "Learn & explore"),
                go("/jobs", "Jobs"),
                go("/help", "Help & support"),
              ])}
              {group("Clinics", [
                ...me.workspaces.map((w) =>
                  go(w.workspace_id ? `/clinic/${w.workspace_id}` : "/clinic", <span className="inline-flex items-center gap-2"><Building2 className="size-3.5 shrink-0" strokeWidth={1.5} />{w.clinic_name}</span>, w.workspace_id ? CLINIC_ROLE_LABELS[w.role] : "set up"),
                ),
                go("/clinic", me.workspaces.length ? "All clinics" : "Create a clinic"),
              ])}
              {me.accountType !== "dentist" && group("For dentists", [go("/dentist/register", "Register as a dentist")])}
              {group("FMD staff", admin.map(([href, label]) => go(href, label)))}
              <div className="border-t border-white/[0.06] pt-1.5">
                <button
                  onClick={async () => {
                    close();
                    await signOut();
                    router.push("/");
                  }}
                  className={`${itemCls} w-full`}
                >
                  <span>Sign out</span>
                  <LogOut className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </>
          ) : (
            group("Your FMD account", [
              go("/signin", "Sign in"),
              go("/signin?mode=signup", "Create an account"),
              go("/dentist/register", "Register as a dentist"),
            ])
          )}
        </div>
      )}
    </div>
  );
}
