"use client";

import { Bookmark, CalendarDays, CircleHelp, LogIn, LogOut, Sparkles, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useDismiss } from "@/components/clinic/dismiss";
import { fmtPhone, initials } from "@/lib/fmd";
import { useT } from "@/lib/i18n";
import { logout, useMe } from "@/lib/me";

const itemCls = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-ink-2 hover:bg-[var(--surface-glass)] hover:text-ink";

/**
 * A profile button: signed out, it opens Log in / Create account / Try a demo account; signed in, an avatar that opens
 * the account menu. Used by the homepage navbar and the app shell.
 */
export function AccountMenu({ loginClassName = "" }: { loginClassName?: string }) {
  const me = useMe();
  const { t } = useT();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box, btn);

  if (me === undefined) return <span className="size-10 shrink-0" aria-hidden />; // holds the space while loading
  if (me === null) {
    const next = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return (
      <div className={`relative ${loginClassName}`}>
        <button
          ref={btn}
          type="button"
          aria-label={t("menu.profile")}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-[var(--surface-glass)] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          <UserRound className="size-5" strokeWidth={1.5} />
        </button>
        {open && (
          // phones: across the screen under the bar (anchored to the button it would run off the left edge)
          <div ref={box} role="menu" className="app-panel app-solid absolute right-0 top-[calc(100%+8px)] z-50 w-[240px] p-1.5 max-sm:fixed max-sm:inset-x-3 max-sm:top-[84px] max-sm:w-auto">
            <Link href={`/login${next}`} onClick={close} role="menuitem" className={itemCls}>
              <LogIn className="size-4" strokeWidth={1.5} /> {t("menu.login")}
            </Link>
            <Link href={`/register${next}`} onClick={close} role="menuitem" className={itemCls}>
              <UserPlus className="size-4" strokeWidth={1.5} /> {t("menu.signup")}
            </Link>
            <div className="mx-3 my-1 border-t border-line" />
            {/* the demo people work without the backend, so this is the way in on the preview site */}
            <Link href={`/demo${next}`} onClick={close} role="menuitem" className={itemCls}>
              <Sparkles className="size-4" strokeWidth={1.5} /> {t("menu.demo")}
            </Link>
          </div>
        )}
      </div>
    );
  }

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
              <CalendarDays className="size-4" strokeWidth={1.5} /> {t("menu.appointments")}
            </Link>
            <Link href="/concierge/enquiries" onClick={close} className={itemCls}>
              <Sparkles className="size-4" strokeWidth={1.5} /> {t("menu.edge")}
            </Link>
            <Link href="/saved" onClick={close} className={itemCls}>
              <Bookmark className="size-4" strokeWidth={1.5} /> {t("menu.saved")}
            </Link>
            <Link href="/account" onClick={close} className={itemCls}>
              <UserRound className="size-4" strokeWidth={1.5} /> {t("menu.account")}
            </Link>
            <Link href="/help" onClick={close} className={itemCls}>
              <CircleHelp className="size-4" strokeWidth={1.5} /> {t("menu.help")}
            </Link>
            <button type="button" onClick={signOut} className={itemCls}>
              <LogOut className="size-4" strokeWidth={1.5} /> {t("menu.logout")}
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
