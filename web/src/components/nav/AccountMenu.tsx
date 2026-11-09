"use client";

import { ArrowLeftRight, LogIn, LogOut, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { useDismiss } from "@/components/clinic/dismiss";
import { areasFor, ROLES } from "@/lib/demo";
import { useDemoUser } from "@/lib/useDemoUser";

const item = "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-ink transition-colors hover:bg-[var(--accent-soft)]";

/**
 * The homepage's profile button. Signed out: sign in, create an account, or try FMD as any role. Signed in: who you are,
 * every part of FMD your role can open, switch role, sign out. A dropdown on laptops, a sheet from the bottom on phones.
 */
export default function AccountMenu() {
  const { user, signOut } = useDemoUser();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box, button);

  if (user === undefined) return <span className="size-11 shrink-0" aria-hidden />; // not read yet: hold the space, no flicker
  const next = path && path !== "/" ? `?next=${encodeURIComponent(path)}` : "";
  const roleLabel = user ? (ROLES.find((r) => r.role === user.role)?.label ?? user.title) : "";

  return (
    <div className="relative">
      {user ? (
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Your account: ${user.name}`}
          onClick={() => setOpen((o) => !o)}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] transition-colors hover:bg-white/[0.08]"
        >
          {user.initials}
        </button>
      ) : (
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label="Sign in"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] text-[13.5px] text-ink transition-colors hover:bg-white/[0.08] lg:w-auto lg:px-4"
        >
          <UserRound className="size-[18px]" strokeWidth={1.5} />
          <span className="hidden lg:inline">Sign in</span>
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" aria-hidden />
          <div
            ref={box}
            id={id}
            className="app-panel app-solid fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-b-none p-2.5 lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-[calc(100%+12px)] lg:w-[330px] lg:rounded-b-[22px]"
          >
            {user ? (
              <>
                <div className="flex items-center gap-3 border-b border-line px-2.5 pb-3 pt-1.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[14px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]">
                    {user.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{user.name}</span>
                    <span className="block truncate text-[13.5px] text-ink-3">
                      {roleLabel}
                      {user.clinicId ? " · Smile Studio Dental" : ""}
                    </span>
                  </span>
                </div>
                {areasFor(user).map((g) => (
                  <div key={g.title} className="px-1 pt-2">
                    <p className="px-2 pb-1 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">{g.title}</p>
                    {g.items.map((i) =>
                      i.href ? (
                        <Link key={i.label} href={i.href} onClick={close} className={item}>
                          {i.label}
                          {i.note && <span className="text-[12.5px] text-ink-3">{i.note}</span>}
                        </Link>
                      ) : (
                        <p key={i.label} className={`${item} text-ink-3 hover:bg-transparent`}>
                          <span className="min-w-0">{i.label}</span>
                          {i.note && <span className="shrink-0 text-[12.5px]">{i.note}</span>}
                        </p>
                      ),
                    )}
                  </div>
                ))}
                <div className="mt-2 border-t border-line px-1 pt-2">
                  <Link href={`/demo${next}`} onClick={close} className={item}>
                    <span className="inline-flex items-center gap-2.5">
                      <ArrowLeftRight className="size-4" strokeWidth={1.75} />
                      Switch role
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      signOut();
                      if (path?.startsWith("/clinic")) router.push("/");
                    }}
                    className={`${item} w-full`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <LogOut className="size-4" strokeWidth={1.75} />
                      Sign out
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="px-1 py-1">
                <p className="px-2 pb-2 pt-1 text-[14px] text-ink-3">FMD is in preview: no password needed.</p>
                <Link href={`/signin${next}`} onClick={close} className={item}>
                  <span className="inline-flex items-center gap-2.5">
                    <LogIn className="size-4" strokeWidth={1.75} />
                    Sign in
                  </span>
                </Link>
                <Link href={`/signin?mode=signup${next ? `&${next.slice(1)}` : ""}`} onClick={close} className={item}>
                  <span className="inline-flex items-center gap-2.5">
                    <UserPlus className="size-4" strokeWidth={1.75} />
                    Create an account
                  </span>
                </Link>
                <Link href={`/demo${next}`} onClick={close} className={item}>
                  <span className="inline-flex items-center gap-2.5">
                    <ArrowLeftRight className="size-4" strokeWidth={1.75} />
                    Try FMD as any role
                  </span>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
