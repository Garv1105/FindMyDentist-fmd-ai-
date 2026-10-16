import { ArrowRight, ArrowUp, LifeBuoy, Mail } from "lucide-react";
import Link from "next/link";
import { Logo } from "../nav/Navbar";
import { Container } from "../ui";

// Only destinations that exist. Legal documents are drafts pending legal review (labelled on /legal).
const COLS = [
  { title: "Products", links: [["FMD Main", "/#ecosystem"], ["FMD Clinic OS", "/#clinic-os"], ["FMD Intelligence", "/#ecosystem"], ["Product showcase", "/#showcase"]] },
  { title: "Patients", links: [["Find dentists", "/#dentists"], ["FMD AI", "/#assistant"], ["My appointments", "/appointments"], ["Dental records", "/records"] /* , ["FMD Edge", "/#concierge"] — section hidden */] },
  {
    title: "Professionals",
    links: [["Create a dentist account", "/signin"], ["Join the FMD Network", "/#for-dentists"], ["Book a Clinic OS demo", "/#clinic-os-demo"] /* , ["Explore FMD Scholar", "/#students"] — section hidden */, ["Dental jobs", "/jobs"]],
  },
  { title: "Company", links: [["About FMD", "/#about"], ["Why FMD", "/#why-fmd"], ["FAQ", "/#faq"], ["Company information", "/legal#company"]] },
  { title: "Support", links: [["Help centre", "/help"], ["Contact support", "mailto:support@findmydentist.io"], ["Your account", "/account"]] },
];

const LEGAL = [
  ["Privacy Policy", "/legal#privacy"],
  ["Terms and Conditions", "/legal#terms"],
  ["AI Disclaimer", "/legal#ai-disclaimer"],
] as const;

// Official profiles only — add { label, href } entries once the accounts are confirmed; the row stays hidden while empty.
const SOCIAL: { label: string; href: string }[] = [];

export default function Footer() {
  return (
    <footer id="footer" className="relative mt-28 overflow-hidden border-t border-[var(--fmd-border)] bg-[linear-gradient(180deg,#03070f,#000000)] sm:mt-40">
      {/* the horizon returns, quietly */}
      <div aria-hidden className="pointer-events-none absolute -top-px left-1/2 h-px w-[70%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.5),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[60%] -translate-x-1/2 rounded-[50%] opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--horizon-glow), transparent)" }} />

      <Container className="relative py-16 sm:py-20">
        {/* closing call to action */}
        <div className="glass flex flex-col gap-6 rounded-[30px] p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="type-label text-ink-4">Redefining dental intelligence</p>
            <p className="mt-3 max-w-xl text-[24px] font-light leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
              <span className="headline-silver">Be part of what&apos;s next in dentistry.</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/#clinic-os-demo" className="btn-primary group h-12 px-6 text-[14px]">
              Book a Clinic OS demo <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
            </Link>
            <Link href="/#ecosystem" className="btn-ghost h-12 px-6 text-[14px]">
              Explore FMD
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.5fr_repeat(5,1fr)] lg:gap-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-ink-3">
              An AI-first dental technology ecosystem connecting patients, dentists and dental clinics.
            </p>
            <address className="mt-6 space-y-2.5 text-[13.5px] not-italic">
              <p className="type-label text-ink-4">FMD PRIVATE LIMITED</p>
              <a href="mailto:support@findmydentist.io" className="flex items-center gap-2.5 text-ink-2 transition-colors hover:text-ink">
                <Mail className="size-4 text-ink-4" strokeWidth={1.5} /> support@findmydentist.io
              </a>
              <Link href="/help" className="flex items-center gap-2.5 text-ink-2 transition-colors hover:text-ink">
                <LifeBuoy className="size-4 text-ink-4" strokeWidth={1.5} /> Help centre
              </Link>
            </address>
            {SOCIAL.length > 0 && (
              <ul aria-label="FMD on social media" className="mt-6 flex flex-wrap gap-2">
                {SOCIAL.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="type-label text-ink-4">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([l, href]) => (
                  <li key={l}>
                    <Link href={href} className="text-[14px] text-ink-3 transition-colors hover:text-ink">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-14 max-w-3xl text-[12.5px] leading-relaxed text-ink-4">
          FMD AI provides educational information and is not a substitute for assessment by a registered dental professional. FMD does not provide
          clinical treatment; care is delivered by qualified providers. Pre-release: dentists, clinics and posts marked “demo” are not real, and features
          marked beta or roadmap are not yet generally available.
        </p>

        <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 text-[12.5px] text-ink-4 md:flex-row md:items-center md:justify-between">
          <p>© 2026 FMD PRIVATE LIMITED · FindMyDentist. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL.map(([l, href]) => (
              <Link key={l} href={href} className="transition-colors hover:text-ink">
                {l}
              </Link>
            ))}
            <span className="text-ink-4/70">Drafts pending legal review</span>
            <a href="#top" aria-label="Back to top" className="grid size-8 place-items-center rounded-full border border-line text-ink-3 transition-colors hover:border-line-strong hover:text-ink">
              <ArrowUp className="size-3.5" strokeWidth={1.75} />
            </a>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
