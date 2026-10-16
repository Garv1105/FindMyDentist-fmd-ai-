import { Clock3, FileText, History, Image as ImageIcon, KeyRound, Lock, Pill, ScanLine, Share2, ClipboardList } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Container, Reveal } from "../ui";

/* Demo documents for a fictitious clinic and patient (public/img/records) — no real patient data is depicted. */
const DOCS: { icon: typeof FileText; name: string; meta: string; img: string; pos: string }[] = [
  { icon: ScanLine, name: "Panoramic X-ray", meta: "Mar 2026 · Demo Clinic", img: "/img/records/xray.webp", pos: "50% 55%" },
  { icon: FileText, name: "Consultation report", meta: "Mar 2026 · PDF", img: "/img/records/consultation.webp", pos: "50% 0%" },
  { icon: ImageIcon, name: "Intra-oral photos", meta: "4 images", img: "/img/records/intraoral.webp", pos: "50% 30%" },
  { icon: ClipboardList, name: "Treatment plan", meta: "3 phases · estimate", img: "/img/records/treatment-plan.webp", pos: "50% 0%" },
  { icon: Pill, name: "Prescription", meta: "Feb 2026", img: "/img/records/prescription.webp", pos: "50% 8%" },
  { icon: History, name: "Dental history", meta: "Since 2019", img: "/img/records/history.webp", pos: "0% 40%" },
];

const POINTS = [
  { icon: KeyRound, text: "Patient-controlled — you decide what's stored and who sees it." },
  { icon: Share2, text: "Share explicitly with a chosen provider through expiring links." },
  { icon: Clock3, text: "Organised by date, clinic, provider and treatment episode." },
];

export default function Records() {
  return (
    <section id="records" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <Reveal y={30} className="order-2 lg:order-1">
            <div className="relative">
              {/* stacked layers behind the vault give it depth */}
              <div aria-hidden className="absolute inset-x-6 -bottom-4 top-6 -z-10 rounded-[30px] border border-white/[0.06] bg-[#0b1030]/60" />
              <div aria-hidden className="absolute inset-x-12 -bottom-8 top-12 -z-20 rounded-[30px] border border-white/[0.04] bg-[#0b1030]/40" />
              <div aria-hidden className="absolute -inset-x-3 -inset-y-10 -z-30 bg-[radial-gradient(50%_50%_at_50%_50%,var(--bg-glow-focus),transparent_70%)] sm:-inset-x-6 lg:-inset-x-10" />
            <div className="glass rounded-[30px] p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[13px] text-ink">
                  <Lock className="size-3.5" strokeWidth={1.5} /> My dental vault
                </p>
                <p className="text-[11px] text-ink-4">6 items · demo</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {DOCS.map(({ icon: Icon, name, meta, img, pos }) => (
                  <div key={name} className="glass-interactive group relative rounded-[18px] border border-line bg-[var(--surface-glass)] p-2">
                    <div className="relative h-[104px] overflow-hidden rounded-[12px] border border-line bg-[var(--background-secondary)]">
                      <Image
                        src={img}
                        alt={`${name} (demo)`}
                        fill
                        sizes="(min-width: 1024px) 200px, 45vw"
                        className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                        style={{ objectPosition: pos }}
                      />
                      {/* soft vignette keeps the bright documents sitting inside the dark glass */}
                      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(2,4,9,0.45))]" />
                    </div>
                    <div className="flex items-start gap-2 px-1 pb-1 pt-2.5">
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-3" strokeWidth={1.5} />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] text-ink-2">{name}</p>
                        <p className="truncate text-[11px] text-ink-4">{meta}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-dashed border-line-strong px-4 py-3">
                <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
                  <Share2 className="size-3.5" strokeWidth={1.5} />
                  X-ray shared with <span className="text-ink-2">Demo Dental Studio</span>
                </p>
                <p className="text-[11px] text-ink-4">Expires in 7 days · Revoke</p>
              </div>
            </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="eyebrow mb-5">Dental records</p>
              <h2 className="type-h2-lg text-ink">
                Your dental history,
                <br />
                <span className="bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-transparent">in one private vault.</span>
              </h2>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-3">
                X-rays, reports, photos, treatment plans and prescriptions — organised, private to you, and ready when your next dentist needs them.
              </p>
            </Reveal>
            <ul className="mt-9 space-y-4">
              {POINTS.map(({ icon: Icon, text }, i) => (
                <Reveal key={text} delay={i * 0.07}>
                  <li className="flex items-start gap-3.5 text-[14px] leading-relaxed text-ink-2">
                    <Icon className="mt-1 size-4 shrink-0 text-ink-3" strokeWidth={1.4} />
                    {text}
                  </li>
                </Reveal>
              ))}
            </ul>
            <Link href="/records" className="btn-primary mt-9 h-11 px-6 text-[13.5px]">
              Open your records
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
