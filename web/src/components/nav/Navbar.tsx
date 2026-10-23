"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** The brand mark: public/logo.png (fmd + the meditating mascot + FindMyDentist), trimmed to public/img/logo-fmd.webp */
export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="FindMyDentist home">
      <Image src="/img/logo-fmd.webp" alt="FindMyDentist" width={337} height={180} priority className="h-[52px] w-auto" />
    </Link>
  );
}

// the homepage's sections, in the order they appear on the page
const LINKS = [
  { label: "AI Assistant", href: "/#assistant" },
  { label: "Treatments", href: "/#treatments" },
  { label: "Explore", href: "/#explore" },
  { label: "Safety", href: "/#safety" },
  { label: "Records", href: "/#records" },
  { label: "FMD Edge", href: "/#concierge" },
  { label: "Dentists", href: "/#dentists" },
  { label: "Trust", href: "/#trust" },
  { label: "Products", href: "/#products" },
];

/** The site bar: the logo, the homepage's sections in page order, and the early-access waitlist. Below xl the sections
 *  fold into a menu. */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          scrolled || open
            ? "border-line bg-[color-mix(in_srgb,var(--background)_72%,transparent)] backdrop-blur-xl"
            : "border-transparent"
        }`}
      >
        <nav className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Logo />
          <ul className="hidden items-center xl:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="whitespace-nowrap rounded-full px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link
              href="/#coming-soon"
              onClick={() => setOpen(false)}
              className="btn-primary cta-pulse h-10 gap-1.5 whitespace-nowrap pl-5 pr-4 text-[13.5px]"
            >
              Early access <ArrowRight className="cta-arrow size-4" strokeWidth={2} />
            </Link>
            <button
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="grid size-10 place-items-center rounded-full text-ink-2 hover:text-ink xl:hidden"
            >
              {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
            </button>
          </div>
        </nav>
        {open && (
          <ul className="mx-auto max-w-[1320px] px-4 pb-4 sm:px-6 xl:hidden">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block border-b border-line py-3 text-[17px] text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
