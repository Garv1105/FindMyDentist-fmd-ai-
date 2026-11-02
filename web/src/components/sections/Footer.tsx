import Link from "next/link";
import { Logo } from "../nav/Navbar";

// Only destinations that exist. Clinic OS, Scholar and legal pages are added when they ship.
const COLS = [
  {
    title: "Patients",
    links: [
      ["Find dentists", "/#dentists"],
      ["FMD AI", "/#assistant"],
      ["My appointments", "/appointments"],
      ["Dental records", "/records"],
      ["FMD Edge", "/#concierge"],
    ],
  },
  {
    title: "Professionals",
    links: [
      ["Create a dentist account", "/signin"],
      ["Explore", "/explore"],
      ["Jobs", "/jobs"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help centre", "/help"],
      ["Contact support", "mailto:support@findmydentist.io"],
      ["Your account", "/account"],
    ],
  },
];

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/findmydentist",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
        <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.25h4.56V23H.22V8.25zM8.34 8.25h4.37v2.02h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 6.99V23h-4.56v-6.94c0-1.66-.03-3.79-2.31-3.79-2.31 0-2.66 1.8-2.66 3.67V23H8.34V8.25z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/findmydentist.io",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-4 w-4">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/findmydentist.io",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
        <path d="M18.244 2H21.5l-7.36 8.41L22.75 22h-6.79l-5.32-6.96L4.53 22H1.27l7.87-9L1.25 2h6.96l4.81 6.36L18.244 2zm-1.19 18h1.88L7.03 3.9H5.02l12.034 16.1z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/findmydentist",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.9h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:support@findmydentist.io",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-4 w-4">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Phone",
    href: "tel:+910000000000",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-4 w-4">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer
      id="footer"
      className="relative w-full overflow-hidden bg-[linear-gradient(180deg,#03050f,var(--bg-near-black))]"
    >
      {/* Horizon afterglow, fully inside the footer */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-4 h-48 w-[60%] -translate-x-1/2 rounded-[50%] opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, var(--horizon-glow), transparent)",
        }}
      />

      {/* FULL-WIDTH inner wrapper — replaces <Container> */}
      <div className="relative mx-auto w-full px-6 py-16 sm:px-10 sm:py-20 lg:px-16">
        {/* Top: brand + columns */}
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-ink-3">
              A dentistry-focused ecosystem connecting patients, dentists, clinics, students and
              dental companies.
            </p>

            {/* Social row */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  title={s.label}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/[0.02] text-ink-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <p className="type-label text-ink-4">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([l, href]) => (
                  <li key={l}>
                    <Link
                      href={href}
                      className="text-[14px] text-ink-3 transition-colors hover:text-ink"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact strip */}
        <div className="mt-14 grid gap-4 rounded-2xl border border-line bg-white/[0.02] p-5 sm:grid-cols-3">
          <a
            href="mailto:support@findmydentist.io"
            className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
          >
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-ink-3 transition-colors group-hover:text-ink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-ink-4">Email</span>
              <span className="block text-[14px] text-ink-3 group-hover:text-ink">
                support@findmydentist.io
              </span>
            </span>
          </a>

          <a
            href="tel:+910000000000"
            className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
          >
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-ink-3 transition-colors group-hover:text-ink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-ink-4">Phone</span>
              <span className="block text-[14px] text-ink-3 group-hover:text-ink">
                +91 00000 00000
              </span>
            </span>
          </a>

          <a
            href="https://www.linkedin.com/company/findmydentist"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
          >
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-ink-3 transition-colors group-hover:text-ink">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.25h4.56V23H.22V8.25zM8.34 8.25h4.37v2.02h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 6.99V23h-4.56v-6.94c0-1.66-.03-3.79-2.31-3.79-2.31 0-2.66 1.8-2.66 3.67V23H8.34V8.25z" />
              </svg>
            </span>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-ink-4">LinkedIn</span>
              <span className="block text-[14px] text-ink-3 group-hover:text-ink">
                /company/findmydentist
              </span>
            </span>
          </a>
        </div>

        {/* Legal */}
        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-8 text-[12px] leading-relaxed text-ink-4 md:flex-row md:items-start md:justify-between">
          <p>
            © 2026 FindMyDentist. Pre-release: dentists, clinics and posts marked “demo” are not
            real. Privacy notice and terms are drafts pending legal review.
          </p>
          <p className="max-w-xl md:text-right">
            FMD AI provides educational information and is not a substitute for a registered dental
            professional. FMD does not provide clinical treatment; care is delivered by qualified
            providers.
          </p>
        </div>
      </div>
    </footer>
  );
}