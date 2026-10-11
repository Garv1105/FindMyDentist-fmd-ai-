import { Logo } from "../nav/Navbar";
import { Container } from "../ui";

const COLS = [
  { title: "Patients", links: ["Find dentists", "Treatments", "FMD AI", "Dental records", "Concierge"] },
  { title: "Professionals", links: ["Join as a dentist", "FMD Clinic OS", "FMD Scholar", "Jobs", "Verification"] },
  { title: "Company", links: ["About FMD", "Careers", "Press", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms", "Advertising policy", "AI use policy"] },
];

export default function Footer() {
  return (
    <footer id="footer" className="relative mt-32 overflow-hidden border-t border-line sm:mt-44">
      {/* the horizon returns, quietly */}
      <div aria-hidden className="pointer-events-none absolute -top-px left-1/2 h-px w-[70%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.5),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[60%] -translate-x-1/2 rounded-[50%] opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--horizon-glow), transparent)" }} />
      <Container className="relative py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[13.5px] leading-relaxed text-ink-4">
              A dentistry-focused ecosystem connecting patients, dentists, clinics, students and dental companies.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-4">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#top" className="text-[13.5px] text-ink-3 transition-colors hover:text-ink">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 text-[11.5px] leading-relaxed text-ink-4 md:flex-row md:items-start md:justify-between">
          <p>© 2026 FindMyDentist. Design prototype — all dentists, clinics and figures shown are demo data.</p>
          <p className="max-w-xl md:text-right">
            FMD AI provides educational information and is not a substitute for a registered dental professional. FMD does not provide clinical treatment; care is delivered by qualified providers.
          </p>
        </div>
      </Container>
    </footer>
  );
}
