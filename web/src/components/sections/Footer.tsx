import { Logo } from "../nav/Navbar";

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/findmydentist-io",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
        <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.25h4.56V23H.22V8.25zM8.34 8.25h4.37v2.02h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 6.99V23h-4.56v-6.94c0-1.66-.03-3.79-2.31-3.79-2.31 0-2.66 1.8-2.66 3.67V23H8.34V8.25z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/findmydentist.io",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-5 w-5">
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
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
        <path d="M18.244 2H21.5l-7.36 8.41L22.75 22h-6.79l-5.32-6.96L4.53 22H1.27l7.87-9L1.25 2h6.96l4.81 6.36L18.244 2zm-1.19 18h1.88L7.03 3.9H5.02l12.034 16.1z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/findmydentist.io",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.9h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:support@findmydentist.io",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-5 w-5">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Phone",
    href: "tel:+919553562838",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="h-5 w-5">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const CONTACTS = [
  { label: "Email", text: "support@findmydentist.io", href: "mailto:support@findmydentist.io" },
  { label: "Phone", text: "+91 95535 62838", href: "tel:+919553562838" },
  { label: "LinkedIn", text: "/company/findmydentist-io", href: "https://www.linkedin.com/company/findmydentist-io/" },
];

export default function Footer() {
  return (
    <footer
      id="footer"
      className="relative w-full overflow-hidden bg-[#03050f] text-[#eef2ff] px-6 pt-24 pb-14 sm:px-12 sm:pt-32 sm:pb-16 lg:px-20"
    >
      {/* oversized wordmark, sitting behind the card so the glass blurs it; the lower part peeks out below */}
      {/* <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none overflow-hidden text-center text-[clamp(64px,17vw,230px)] font-semibold leading-[0.9] tracking-[-0.04em] text-transparent"
      >
        <span className="bg-[linear-gradient(180deg,rgb(170_195_255/0.5),rgb(170_195_255/0.08))] bg-clip-text">FindMyDentist</span>
      </div> */}

      {/* content, no card */}
      <div className="relative z-10 w-full">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-6 text-[15px] leading-relaxed text-[#aab6d8]">
              A dentistry-focused ecosystem connecting patients, dentists, clinics, students and
              dental companies.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  title={s.label}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0a1030]/60 text-[#aab6d8] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:text-[#eef2ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* contacts */}
          <div className="flex flex-col gap-3">
            {CONTACTS.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-4 rounded-full border border-white/10 bg-[#0a1030]/60 py-2 pl-2 pr-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7f9cff]/60 hover:bg-[#0a1030] hover:shadow-[0_0_30px_-8px_rgb(110_135_255/0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7f9cff]/70"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-[#0a1030]/80 text-[#c3cce6] transition-colors group-hover:text-white">
                  {SOCIALS.find((x) => x.label === c.label)?.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#7c88ab]">{c.label}</span>
                  <span className="block truncate text-[15px] text-[#eef2ff]">{c.text}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        <p className="mt-16 border-t border-white/10 pt-7 text-center text-[13px] text-[#7c88ab]">
          Copyright © 2026 FindMyDentist. All rights reserved.
        </p>
      </div>

    </footer>
  );
}
