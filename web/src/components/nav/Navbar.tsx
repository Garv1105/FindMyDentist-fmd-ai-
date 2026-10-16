"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/me";

const LINKS = [
  { label: "Find Dentists", href: "/#dentists" },
  { label: "Treatments", href: "/#treatments" },
  { label: "AI Assistant", href: "/#assistant" },
  { label: "For Clinics", href: "/#clinic-os" },
  // { label: "For Students", href: "/#students" }, // Scholar section hidden
];
const MORE = [
  { label: "Explore", href: "/explore" },
  { label: "My Appointments", href: "/appointments" },
  { label: "Dental Records", href: "/records" },
  // { label: "FMD Edge", href: "/#concierge" }, // FMD Edge section hidden
  { label: "Jobs", href: "/jobs" },
  { label: "Help", href: "/help" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="FindMyDentist home">
      <span className="headline-silver text-[24px] font-semibold leading-none tracking-[-0.06em]">FMD</span>
      <span className="hidden h-4 w-px bg-line-strong sm:block" />
      <span className="hidden text-[15px] font-normal tracking-[-0.012em] text-ink-2 sm:block">FindMyDentist</span>
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

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div
        className={`border-b transition-all duration-700 ${
          scrolled
            ? "border-line bg-[color-mix(in_srgb,var(--background)_72%,transparent)] backdrop-blur-xl"
            : "border-transparent"
        }`}
      >
        <nav className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-6 px-4 sm:px-6 lg:px-10">
          <Logo />

          <ul className="mx-auto hidden items-center gap-0.5 xl:flex">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] text-ink-2 transition-colors hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            <li className="relative" onMouseLeave={() => setMore(false)}>
              <button
                onClick={() => setMore((m) => !m)}
                onMouseEnter={() => setMore(true)}
                aria-expanded={more}
                className="flex items-center gap-1 rounded-full px-3.5 py-2 text-[13.5px] text-ink-2 transition-colors hover:text-ink"
              >
                More <ChevronDown className={`size-3.5 transition-transform duration-300 ${more ? "rotate-180" : ""}`} strokeWidth={1.5} />
              </button>
              <AnimatePresence>
                {more && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="glass absolute left-1/2 top-11 w-48 -translate-x-1/2 rounded-2xl p-1.5"
                    style={{ backgroundColor: "var(--surface)" }}
                  >
                    {MORE.map((m) => (
                      <li key={m.label}>
                        <a href={m.href} className="block rounded-xl px-3 py-2 text-[13px] text-ink-2 hover:bg-[var(--accent-soft)] hover:text-ink">
                          {m.label}
                        </a>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          </ul>

          <div className="ml-auto flex shrink-0 items-center gap-1 xl:ml-0">
            <Link href="/#dentists" aria-label="Search dentists" className="hidden size-9 place-items-center rounded-full text-ink-2 transition-colors hover:text-ink sm:grid">
              <Search className="size-[18px]" strokeWidth={1.5} />
            </Link>
            <Link
              href={account.href}
              aria-label={me ? "Your account" : "Sign in"}
              className="ml-1 hidden items-center gap-2 whitespace-nowrap rounded-full border border-line py-1 pl-1 pr-3.5 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink sm:flex"
            >
              <span className="icon-tile size-7 !rounded-full">
                <UserRound className="size-3.5" strokeWidth={1.5} />
              </span>
              {account.label}
            </Link>
            <button
              aria-label="Open menu"
              onClick={() => setMobile(true)}
              className="grid size-9 place-items-center rounded-full text-ink-2 xl:hidden"
            >
              <Menu className="size-5" strokeWidth={1.5} />
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
