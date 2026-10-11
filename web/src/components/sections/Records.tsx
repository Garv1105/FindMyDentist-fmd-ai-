import { Clock3, FileText, History, Image as ImageIcon, KeyRound, Lock, Pill, ScanLine, Share2, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import { Container, Reveal } from "../ui";

/* Abstract thumbnails — no real patient data is ever depicted. */
const lines = (n: number, w = [90, 70, 82, 55, 76]) => (
  <div className="space-y-1.5 p-3">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="h-[3px] rounded-full bg-[var(--text-faint)] opacity-40" style={{ width: `${w[i % w.length]}%` }} />
    ))}
  </div>
);

const DOCS: { icon: typeof FileText; name: string; meta: string; thumb: ReactNode }[] = [
  {
    icon: ScanLine,
    name: "Panoramic X-ray",
    meta: "Mar 2026 · Demo Clinic",
    thumb: (
      <div
        className="h-full w-full"
        style={{
          background:
            "radial-gradient(14% 30% at 22% 58%, rgb(var(--horizon-rgb)/0.35), transparent), radial-gradient(14% 32% at 40% 55%, rgb(var(--horizon-rgb)/0.3), transparent), radial-gradient(14% 32% at 60% 55%, rgb(var(--horizon-rgb)/0.3), transparent), radial-gradient(14% 30% at 78% 58%, rgb(var(--horizon-rgb)/0.35), transparent), #0b0c0f",
        }}
      />
    ),
  },
  { icon: FileText, name: "Consultation report", meta: "Mar 2026 · PDF", thumb: lines(6) },
  {
    icon: ImageIcon,
    name: "Intra-oral photos",
    meta: "4 images",
    thumb: (
      <div className="grid h-full grid-cols-2 gap-1 p-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md" style={{ background: `linear-gradient(${140 + i * 30}deg, var(--surface-elevated), rgb(var(--accent-rgb)/0.12))` }} />
        ))}
      </div>
    ),
  },
  { icon: ClipboardList, name: "Treatment plan", meta: "3 phases · estimate", thumb: lines(5, [60, 85, 85, 85, 40]) },
  { icon: Pill, name: "Prescription", meta: "Feb 2026", thumb: lines(4, [40, 90, 70, 50]) },
  {
    icon: History,
    name: "Dental history",
    meta: "Since 2019",
    thumb: (
      <div className="flex h-full items-center gap-0 px-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 items-center">
            <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
            {i < 4 && <span className="h-px flex-1 bg-[var(--border-strong)]" />}
          </div>
        ))}
      </div>
    ),
  },
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
            <div className="glass rounded-[30px] p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[13px] text-ink">
                  <Lock className="size-3.5" strokeWidth={1.5} /> My dental vault
                </p>
                <p className="text-[11px] text-ink-4">6 items · demo</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {DOCS.map(({ icon: Icon, name, meta, thumb }) => (
                  <div key={name} className="glass-interactive group relative rounded-[18px] border border-line bg-[var(--surface-glass)] p-2">
                    <div className="h-[84px] overflow-hidden rounded-[12px] border border-line bg-[var(--background-secondary)]">{thumb}</div>
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
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="eyebrow mb-5">Dental records</p>
              <h2 className="text-[32px] font-extralight leading-[1.05] tracking-[-0.035em] text-ink sm:text-[52px]">
                Your dental history,
                <br />
                <span className="text-ink-3">in one private vault.</span>
              </h2>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-3">
                X-rays, reports, photos, treatment plans and prescriptions — organised, encrypted, and ready when your next dentist needs them.
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
          </div>
        </div>
      </Container>
    </section>
  );
}
