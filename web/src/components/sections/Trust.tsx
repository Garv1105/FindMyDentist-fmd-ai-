"use client";

import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, BarChart3, Fingerprint, History, Orbit, Timer, UserCheck, type LucideIcon } from "lucide-react";
import MascotArt from "@/components/MascotArt";
import type { ReactNode } from "react";
import { Container, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

// Counts are published only once they come from the live system; until then the slot says so instead of guessing.
// Set a value (string) here when a verified figure exists.
const STATS: { value: string | null; label: string }[] = [
  { value: null, label: "Verified dentists" },
  { value: null, label: "Patients guided" },
  { value: "5", label: "Languages in FMD AI" },
  { value: "Always", label: "Sponsored placements labelled" },
];

// the vault's consent controls, in the patient's words
const CONSENT = [
  { icon: UserCheck, text: "You choose which dentist sees what" },
  { icon: Timer, text: "Sharing expires; revoke it anytime" },
  { icon: History, text: "See every time a record was opened" },
];

const PILLARS = [
  { icon: BadgeCheck, title: "Verification ≠ advertising", body: "Verified means credentials were checked. Paid placements are labelled separately - always." },
  { icon: Fingerprint, title: "Consent-first records", body: "Least-privilege access, explicit sharing and an audit trail for sensitive data." },
  { icon: Orbit, title: "AI with boundaries", body: "Educational and navigational. Clinical decisions stay with registered dentists." },
];

/*
 * Section 10: trust as proof. Section 06 (Journey, "The FMD Trust Standard") explains the safeguards one by one; this
 * section is the evidence wall: the guide stands at the centre on a pedestal, the three commitments and the platform's
 * honest numbers flank him. Its own look (indigo arc of light, pedestal, no orbit lines) so the two never read as one.
 */
export default function Trust() {
  const reduced = useReducedMotion();

  return (
    <section className="relative isolate overflow-x-clip pt-28 sm:pt-40">
      <Atmosphere scene="trust" />
      <Container>
        <div className="relative">
          {/* the word itself, behind everything: brushed silver, brightest at the centre and dissolving toward both sides, and
              fading downward into the scene (the gradient is clipped to the letters). On lg it sits high, above the arc's glow, and
              the heading is lifted clear of it instead */}
          <p
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[9.5rem] -z-10 select-none bg-[linear-gradient(90deg,rgb(203_213_225/0)_6%,rgb(203_213_225/0.17)_28%,rgb(226_232_240/0.36)_42%,rgb(248_250_252/0.52)_50%,rgb(226_232_240/0.36)_58%,rgb(203_213_225/0.17)_72%,rgb(203_213_225/0)_94%)] bg-clip-text text-center text-[26vw] font-black leading-none tracking-wider text-transparent [mask-image:linear-gradient(180deg,#000_35%,transparent_95%)] lg:top-3 lg:text-[15rem]"
          >
            TRUST
          </p>

          <Reveal className="relative mx-auto max-w-3xl text-center lg:-translate-y-28">
            {/* a soft pool of the page's own dark behind the heading, so it always reads clearly over the lettering and glow */}
            <div aria-hidden className="absolute -inset-x-16 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,rgb(7_10_17/0.85),rgb(7_10_17/0.5)_60%,transparent)]" />
            <p className="eyebrow mb-4">Trust</p>
            <h2 className="type-h2-lg headline-silver">Built for care that deserves trust</h2>
          </Reveal>

          {/* the arc of light bridging the flanks (lg): a blurred band under a crisp rim, indigo into violet; its legs fade out
              toward the floor, so the blur never meets a hard edge (120 units of headroom above the rim keep its glow inside the mask) */}
          <div aria-hidden className="pointer-events-none absolute inset-x-[-6%] bottom-[4%] -z-10 hidden aspect-[1000/420] [mask-image:linear-gradient(180deg,#000_58%,transparent_94%)] lg:block">
            <svg viewBox="0 -120 1000 420" className="absolute inset-0 size-full overflow-visible blur-2xl" fill="none" preserveAspectRatio="none">
              <path d="M0 300 A500 280 0 0 1 1000 300" stroke="url(#tr-arc)" strokeWidth={90} opacity={0.45} />
            </svg>
            <svg viewBox="0 -120 1000 420" className="absolute inset-0 size-full overflow-visible" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="tr-arc" x1="0" x2="1">
                  <stop offset="0" stopColor="#4f46e5" stopOpacity="0" />
                  <stop offset="0.25" stopColor="#6366f1" />
                  <stop offset="0.5" stopColor="#a5b4fc" />
                  <stop offset="0.75" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 300 A500 280 0 0 1 1000 300" stroke="url(#tr-arc)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
            {/* light falling inward from the rim, fading before the centre */}
            <div className="absolute inset-x-[8%] top-[8%] bottom-0 rounded-t-[50%] bg-[radial-gradient(ellipse_50%_100%_at_50%_100%,transparent_55%,rgb(99_102_241/0.1)_85%,transparent)]" />
          </div>

          {/* a mirrored 2 × 3 grid: the guide spans both rows in the centre; each row's left and right card share one top and one
              height, so the two flanks match exactly. Below lg: the guide first, then the cards in order */}
          <div className="mt-14 grid gap-x-8 gap-y-14 sm:max-lg:grid-cols-2 sm:max-lg:gap-x-6 lg:mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto]">
            <Guardian reduced={reduced} />
            <Card n={1} icon={PILLARS[0].icon} side="left" className="lg:col-start-1 lg:row-start-1">
              <Pillar {...PILLARS[0]} />
            </Card>
            <Card n={2} icon={PILLARS[1].icon} side="left" className="lg:col-start-1 lg:row-start-2">
              <Pillar {...PILLARS[1]} />
              {/* what consent-first means in the records vault today (built and tested: per-dentist time-limited sharing with revoke,
                  and a patient-visible access history) */}
              <ul className="mx-auto mt-5 w-full max-w-[300px] space-y-2 border-t border-white/[0.07] pt-5">
                {CONSENT.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[13px] text-ink-2">
                    <Icon aria-hidden className="size-4 shrink-0 text-indigo-300" strokeWidth={1.6} />
                    {text}
                  </li>
                ))}
              </ul>
            </Card>
            <Card n={3} icon={PILLARS[2].icon} side="right" className="lg:col-start-3 lg:row-start-1">
              <Pillar {...PILLARS[2]} />
            </Card>
            <Card n={4} icon={BarChart3} side="right" className="lg:col-start-3 lg:row-start-2">
              <h3 className="text-center text-[18px] font-medium tracking-[-0.01em] text-ink">Platform integrity</h3>
              <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5">
                {STATS.map((s) => (
                  <div key={s.label} className="text-center">
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      {s.value ? (
                        <span className="headline-silver block text-[34px] font-light leading-none tracking-[-0.03em] tabular-nums">{s.value}</span>
                      ) : (
                        <span className="block text-[26px] font-light leading-none text-[var(--fmd-text-disabled)]">
                          <span aria-hidden>-</span>
                          <span className="mt-1.5 block text-[9.5px] uppercase tracking-[0.16em] text-ink-4">Published at launch</span>
                        </span>
                      )}
                      <span aria-hidden className="mt-2 block text-[12.5px] leading-snug text-ink-3">{s.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 border-t border-white/[0.07] pt-4 text-center text-[11px] text-ink-4">Platform counts are published at launch, from live data only.</p>
            </Card>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h3 className="text-center text-[18px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2.5 text-center text-[14px] leading-relaxed text-ink-3">{body}</p>
    </>
  );
}

/** A glass card with a glowing round badge riding its top edge and its number in the outer corner. */
function Card({ n, icon: Icon, side, className = "", children }: { n: number; icon: LucideIcon; side: "left" | "right"; className?: string; children: ReactNode }) {
  const inner = side === "left" ? "right" : "left";
  return (
    <Reveal delay={(n - 1) * 0.08} className={className}>
      <article className="group relative flex h-full flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-7 pt-12 shadow-2xl backdrop-blur-xl transition-[border-color,box-shadow] duration-300 hover:border-indigo-400/40 hover:shadow-[0_0_0_1px_rgb(129_140_248/0.2),0_0_50px_-10px_rgb(99_102_241/0.55),0_25px_50px_-12px_rgb(0_0_0/0.6)] sm:p-8 sm:pt-12">
        {/* connector (lg): a hairline from the card's inner edge toward the guide, ending in a lit node; mirrored on each side */}
        <span
          aria-hidden
          className={`absolute top-1/2 hidden h-px w-8 lg:block ${inner === "right" ? "left-full bg-gradient-to-r" : "right-full bg-gradient-to-l"} from-indigo-300/50 to-transparent`}
        >
          <span className={`absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-indigo-300 shadow-[0_0_8px_rgb(165_180_252/0.9)] ${inner === "right" ? "-left-[3px]" : "-right-[3px]"}`} />
        </span>
        {/* a fine lit edge along the top, brighter on hover */}
        <span aria-hidden className="absolute inset-x-[18%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(165_180_252/0.45),transparent)] opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
        <span
          aria-hidden
          className={`absolute top-4 text-[26px] font-light tabular-nums tracking-[-0.02em] text-white/30 transition-colors duration-300 group-hover:text-white/55 ${side === "left" ? "left-6" : "right-6"}`}
        >
          {String(n).padStart(2, "0")}
        </span>
        {/* the badge: a glowing sapphire coin that lifts toward you on hover */}
        <span
          aria-hidden
          className="absolute -top-8 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full border border-indigo-300/30 bg-[radial-gradient(circle_at_35%_30%,#3b5bdb,#1e2a6e_60%,#0c1230)] text-white shadow-[0_0_28px_rgb(99_102_241/0.5),inset_0_1px_0_rgb(255_255_255/0.25)] transition-[translate,scale,box-shadow] duration-300 group-hover:-translate-y-1.5 group-hover:scale-105 group-hover:shadow-[0_0_40px_rgb(99_102_241/0.75),inset_0_1px_0_rgb(255_255_255/0.35)]"
        >
          <Icon className="size-7 drop-shadow-[0_0_6px_rgb(165_180_252/0.8)]" strokeWidth={1.6} />
        </span>
        {children}
      </article>
    </Reveal>
  );
}

/** The guide on a holographic pedestal: a slow breath, a radar sweep across the disc, light rising from it. */
function Guardian({ reduced }: { reduced: boolean | null }) {
  return (
    <div aria-hidden className="relative mx-auto aspect-[5/6] w-full max-w-[440px] self-center max-lg:max-w-[340px] sm:max-lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      {/* glow behind (and, below lg, standing in for the arc) */}
      <div className="absolute inset-x-[-10%] top-[18%] bottom-[8%] rounded-full bg-[radial-gradient(closest-side,rgb(99_102_241/0.18),rgb(139_92_246/0.06)_55%,transparent)]" />

      {/* pedestal: a squashed disc (concentric rims), its centre 12% up from the bottom */}
      <div className="absolute bottom-[12%] left-1/2 aspect-square w-[80%] -translate-x-1/2 translate-y-1/2 [transform:scaleY(0.26)]">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-300/50 bg-[radial-gradient(circle,rgb(56_189_248/0.22),rgb(15_23_42/0.92)_70%)] shadow-[0_0_60px_rgb(56_189_248/0.45),inset_0_0_40px_rgb(56_189_248/0.3)]" />
        <div className="absolute inset-[13%] rounded-full border border-cyan-300/35" />
        <div className="absolute inset-[28%] rounded-full border border-dashed border-cyan-200/30" />
        <motion.div
          className="absolute inset-[3%] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgb(103_232_249/0.35)_36deg,transparent_80deg)]"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 6, ease: "linear", repeat: Infinity }}
        />
      </div>
      {/* light rising from the disc */}
      <div className="absolute bottom-[12%] left-1/2 h-[46%] w-[58%] -translate-x-1/2 bg-[linear-gradient(0deg,rgb(103_232_249/0.16),transparent)] [mask-image:linear-gradient(90deg,transparent,#000_25%,#000_75%,transparent)]" />

      {/* the guide, hand on heart; his feet (4% up in the art) on the disc's centre, breathing slowly */}
      <motion.div
        className="absolute bottom-[12%] left-1/2 aspect-square w-[86%] -translate-x-1/2 translate-y-[4%]"
        animate={reduced ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
      >
        <MascotArt src="/img/mascots/mascot-shield-1024.webp" sizes="(min-width:1024px) 380px, 300px" />
      </motion.div>
    </div>
  );
}
