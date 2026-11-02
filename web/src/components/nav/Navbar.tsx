"use client";

import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/me";
import ThemeSwitcher from "./ThemeSwitcher";

const LINKS = [
  { label: "Find Dentists", href: "/#dentists" },
  { label: "Treatments", href: "/#treatments" },
  { label: "AI Assistant", href: "/#assistant" },
  { label: "For Clinics", href: "/clinic" },
  { label: "For Students", href: "/#students" },
];
const MORE = [
  { label: "Explore", href: "/explore" },
  { label: "My Appointments", href: "/appointments" },
  { label: "Dental Records", href: "/records" },
  { label: "FMD Edge", href: "/#concierge" },
  { label: "Jobs", href: "/jobs" },
  { label: "Help", href: "/help" },
];

/** `bold`: the header's larger, heavier lockup; the footer keeps the quiet one. */
export function Logo({ bold = false }: { bold?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="FindMyDentist home">
      <span className={`headline-silver font-semibold leading-none tracking-[-0.06em] ${bold ? "text-[27px] font-bold" : "text-[24px]"}`}>FMD</span>
      <span className={`hidden w-px bg-line-strong sm:block ${bold ? "h-5" : "h-4"}`} />
      <span
        className={`hidden tracking-[-0.012em] sm:block ${bold ? "text-[16px] font-semibold text-ink" : "text-[15px] font-normal text-ink-2"}`}
      >
        FindMyDentist
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [more, setMore] = useState(false);
  const me = useMe();
  const account = me ? { href: "/account", label: me.name.split(" ")[0] } : { href: "/signin", label: "Sign in" };

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // the round button at the end of the bar (as in the reference): the "More" pages on desktop, the menu below that
  const grid =
    "grid size-12 shrink-0 place-items-center rounded-full bg-ink text-[var(--background)] shadow-[0_0_0_4px_rgb(255_255_255/0.06),0_8px_22px_-6px_rgb(0_0_0/0.7)] transition-transform duration-300 hover:scale-[1.06] active:scale-95";

  return (
    // 12px gap + 64px bar: the hero's stage (laid out under 68px) clears it with room to spare
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5">
      {/* the floating bar, solid like the reference: a dark glass that's a touch lighter at the top, a crisp rim, a
          line of light along its top edge and a shadow that floats it off the page. Once the page scrolls it draws
          in a little and firms up */}
      <div
        className={`relative mx-auto rounded-full border border-line-strong backdrop-blur-2xl transition-[max-width,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          scrolled
            ? "max-w-[1140px] shadow-[inset_0_1px_0_var(--inner-hi),0_22px_48px_-16px_rgb(0_0_0/0.85)]"
            : "max-w-[1400px] shadow-[inset_0_1px_0_var(--inner-hi),0_14px_36px_-18px_rgb(0_0_0/0.7)]"
        }`}
        style={{
          backgroundImage:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-elevated) 92%, transparent), color-mix(in srgb, var(--surface) 88%, transparent))",
        }}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-[12%] -top-px h-px bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.45),transparent)]" />
        {/* long at the top of the page; once it scrolls, it draws in narrower and a little slimmer */}
        <nav className={`flex items-center gap-4 pl-6 pr-2 transition-[height] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:pl-7 ${scrolled ? "h-14" : "h-16"}`}>
          <Logo bold />

          <ul className="ml-auto hidden items-center gap-1 xl:flex">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="whitespace-nowrap rounded-full px-4 py-2.5 text-[14.5px] font-semibold tracking-[-0.01em] text-ink transition-colors hover:bg-[var(--surface-glass)]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 xl:ml-3">
            <Link href="/#dentists" aria-label="Find dentists" className="hidden size-10 place-items-center rounded-full text-ink transition-colors hover:bg-[var(--surface-glass)] sm:grid">
              <Search className="size-[19px]" strokeWidth={1.75} />
            </Link>
            <ThemeSwitcher />
            <Link
              href={account.href}
              aria-label={me ? "Your account" : "Sign in"}
              className="mr-1 hidden items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-[var(--surface-glass)] py-1.5 pl-1.5 pr-4 text-[14px] font-semibold text-ink transition-colors hover:border-[rgb(var(--horizon-rgb)/0.35)] sm:flex"
            >
              <span className="icon-tile size-8 !rounded-full">
                <UserRound className="size-4" strokeWidth={1.75} />
              </span>
              {account.label}
            </Link>

            {/* desktop: the More pages, in a panel under the button */}
            <div className="relative hidden xl:block" onMouseLeave={() => setMore(false)}>
              <button
                onClick={() => setMore((m) => !m)}
                onMouseEnter={() => setMore(true)}
                aria-expanded={more}
                aria-label="More pages"
                className={grid}
              >
                <LayoutGrid className={`size-5 transition-transform duration-500 ${more ? "rotate-90" : ""}`} strokeWidth={1.75} />
              </button>
              <AnimatePresence>
                {more && (
                  <motion.ul
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-[calc(100%+12px)] w-56 origin-top-right rounded-3xl border border-line-strong p-1.5 shadow-[inset_0_1px_0_var(--inner-hi),0_24px_48px_-20px_rgb(0_0_0/0.8)] backdrop-blur-2xl before:absolute before:inset-x-0 before:-top-3 before:h-3"
                    style={{ backgroundImage: "linear-gradient(180deg, var(--surface-elevated), var(--surface))" }}
                  >
                    {MORE.map((m) => (
                      <li key={m.label}>
                        <a href={m.href} className="block rounded-2xl px-3.5 py-2.5 text-[14px] font-medium text-ink-2 transition-colors hover:bg-[var(--accent-soft)] hover:text-ink">
                          {m.label}
                        </a>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* below desktop: the full menu */}
            <button aria-label="Open menu" onClick={() => setMobile(true)} className={`${grid} xl:hidden`}>
              <LayoutGrid className="size-5" strokeWidth={1.9} />
            </button>
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-2xl xl:hidden"
          >
            <div className="flex h-[68px] items-center justify-between px-4 sm:px-6">
              <Logo />
              <button aria-label="Close menu" onClick={() => setMobile(false)} className="grid size-9 place-items-center text-ink-2">
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            <ul className="px-6 pt-6">
              {[...LINKS, ...MORE].map((l, i) => (
                <motion.li
                  key={l.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <a
                    href={l.href}
                    onClick={() => setMobile(false)}
                    className="block border-b border-line py-4 text-[22px] font-light tracking-[-0.02em] text-ink"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="px-6 pt-8">
              <Link href={account.href} onClick={() => setMobile(false)} className="btn-primary h-12 w-full text-sm">
                {me ? "Your account" : "Sign in"}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
