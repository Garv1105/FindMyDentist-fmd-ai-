"use client";

import { Bookmark, CalendarDays, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useDismiss } from "@/components/clinic/dismiss";
import { fmtPhone, initials } from "@/lib/fmd";
import { logout, useMe } from "@/lib/me";

const itemCls = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-ink-2 hover:bg-[var(--surface-glass)] hover:text-ink";

/** "Log in" when signed out, else an avatar that opens the account menu. Used by the homepage navbar and the app shell. */
export function AccountMenu({ loginClassName = "" }: { loginClassName?: string }) {
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box, btn);

  if (me === undefined) return <span className="size-10 shrink-0" aria-hidden />; // holds the space while loading
  if (me === null)
    return (
      <Link
        href={path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`}
        className={`h-10 items-center rounded-full border border-line bg-[var(--surface-glass)] px-4 text-[13.5px] font-medium text-ink hover:border-line-strong ${loginClassName || "inline-flex"}`}
      >
        Log in
      </Link>
    );

  const signOut = async () => {
    setErr(null);
    try {
      await logout();
      setOpen(false);
      router.push("/");
    } catch {
      setErr("Couldn't log out. Check your connection and try again.");
    }
  };

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-label={`Account menu for ${me.full_name}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[13px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
      >
        {initials(me.full_name)}
      </button>
      {open && (
        <div ref={box} className="app-panel app-solid absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] p-1.5">
          <div className="border-b border-line px-3 pb-2.5 pt-2">
            <p className="truncate text-[14.5px] font-medium text-ink">{me.full_name}</p>
            <p className="text-[13px] text-ink-3">{fmtPhone(me.phone)}</p>
          </div>
          <div className="pt-1.5">
            <Link href="/appointments" onClick={close} className={itemCls}>
              <CalendarDays className="size-4" strokeWidth={1.5} /> My appointments
            </Link>
            <Link href="/saved" onClick={close} className={itemCls}>
              <Bookmark className="size-4" strokeWidth={1.5} /> Saved
            </Link>
            <Link href="/account" onClick={close} className={itemCls}>
              <UserRound className="size-4" strokeWidth={1.5} /> Account
            </Link>
            <button type="button" onClick={signOut} className={itemCls}>
              <LogOut className="size-4" strokeWidth={1.5} /> Log out
            </button>
          </div>
          {err && (
            <p role="alert" className="px-3 pb-2 pt-1 text-[12.5px] text-ink-2">
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
