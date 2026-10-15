import Link from "next/link";
import { Logo } from "../nav/Navbar";
import { Container } from "../ui";

// Only destinations that exist. Clinic OS, Scholar and legal pages are added when they ship.
const COLS = [
  { title: "Patients", links: [["Find dentists", "/#dentists"], ["FMD AI", "/#assistant"], ["My appointments", "/appointments"], ["Dental records", "/records"], ["FMD Edge", "/#concierge"]] },
  { title: "Professionals", links: [["Create a dentist account", "/signin"], ["Explore", "/explore"], ["Jobs", "/jobs"]] },
  { title: "Support", links: [["Help centre", "/help"], ["Contact support", "/help"], ["Your account", "/account"]] },
];

export default function Footer() {
  return (
    <footer id="footer" className="relative overflow-hidden border-t border-[var(--fmd-border)] bg-[linear-gradient(180deg,#03050f,var(--bg-near-black))]">
      {/* the horizon returns, quietly */}
      <div aria-hidden className="pointer-events-none absolute -top-px left-1/2 h-px w-[70%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.5),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[60%] -translate-x-1/2 rounded-[50%] opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--horizon-glow), transparent)" }} />
      <Container className="relative py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-ink-3">
              A dentistry-focused ecosystem connecting patients, dentists, clinics, students and dental companies.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
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
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 text-[12px] leading-relaxed text-ink-4 md:flex-row md:items-start md:justify-between">
          <p>© 2026 FindMyDentist. Pre-release: dentists, clinics and posts marked “demo” are not real. Privacy notice and terms are drafts pending legal review.</p>
          <p className="max-w-xl md:text-right">
            FMD AI provides educational information and is not a substitute for a registered dental professional. FMD does not provide clinical treatment; care is delivered by qualified providers.
          </p>
        </div>
      </Container>
    </footer>
  );
}
