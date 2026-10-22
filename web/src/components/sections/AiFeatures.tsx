"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpenText, Compass, FileSearch, Route, Sparkles, Stethoscope, UserRound } from "lucide-react";
import MascotArt from "@/components/MascotArt";
import Image from "next/image";
import { openAssistant } from "../hero/Assistant";
import { Container, MOTION, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

// Wording mirrors what the assistant actually does: it explains and navigates, it never diagnoses or books.
const FEATURES = [
  { icon: BookOpenText, title: "Accurate information", body: "Plain-language explanations, with uncertainty stated honestly." },
  { icon: UserRound, title: "Personalised guidance", body: "Shaped by what you describe, in your language." },
  { icon: FileSearch, title: "Symptom insights", body: "Helps you describe what you feel. Never a diagnosis." },
  { icon: Stethoscope, title: "Treatment education", body: "What happens, how long it takes and what to ask." },
  { icon: Compass, title: "Care recommendations", body: "The kind of dentist to see. Matching is informational." },
  { icon: Route, title: "Next steps & referrals", body: "Points you to verified dentists. Nothing is booked without you." },
];

/*
 * The stage (xl and up) is one 1180 × 660 box that scales with the width: the panels, the orbit and the light lines
 * all use its coordinates, so they stay joined at every size. The guide stands centre (400-unit box, feet at y ≈ 564:
 * 8% / 9% transparent padding in the art), inside an orbit whose back half passes behind him and front half in front.
 * Panels sit round the orbit, the middle pair furthest out; each is tied back to the guide by a fine line of light
 * (the right-hand ones to his presenting hand, at about (745, 372)).
 */
const W = 1180;
const H = 660;
const PANEL_W = 300;
const SPOTS = [
  { x: 30, y: 60, to: [455, 262] },
  { x: 0, y: 262, to: [440, 380] },
  { x: 50, y: 464, to: [420, 548] },
  { x: 850, y: 60, to: [722, 262] },
  { x: 880, y: 262, to: [748, 372] },
  { x: 830, y: 464, to: [762, 548] },
];
const ORBIT = { cx: 590, cy: 572, rx: 450, ry: 72 };
const arc = (front: boolean) =>
  `M ${ORBIT.cx - ORBIT.rx} ${ORBIT.cy} A ${ORBIT.rx} ${ORBIT.ry} 0 0 ${front ? 0 : 1} ${ORBIT.cx + ORBIT.rx} ${ORBIT.cy}`;
// a line from a panel's inner edge, level with its icon, curving in to the guide
const link = ({ x, y, to: [tx, ty] }: (typeof SPOTS)[number]) => {
  const left = x < W / 2;
  const sx = left ? x + PANEL_W : x;
  const sy = y + 46;
  return `M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`;
};
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/** Section 03: FMD AI's capabilities as a stage: the guide in the centre, the six capabilities in orbit round him. */
export default function AiFeatures() {
  const reduced = useReducedMotion();
  // decorative lines draw in once; `initial` is the same on server and client, and under reduced motion the
  // [data-draw] rule in globals.css shows them whole from first paint while the transition here becomes instant
  const draw = (delay: number) => ({
    "data-draw": "",
    initial: { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true, margin: "-80px" },
    transition: reduced ? { duration: 0 } : { duration: 1.6, delay, ease: MOTION.ease },
  });

  return (
    <section id="assistant" className="relative isolate scroll-mt-24 pt-28 sm:pt-36">
      <Atmosphere scene="assistant" />
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">FMD AI</p>
          <h2 className="type-h2-lg text-ink">
            An assistant that guides.
            <br />
            <span className="text-ink-3">You make the decisions.</span>
          </h2>
          <p className="type-lede mx-auto mt-5">
            FMD AI explains dental concepts, helps you understand options and points you to the right kind of care. Clinical
            decisions always stay with a registered dentist.
          </p>
        </Reveal>

        {/* Three compositions, not one shrunk: xl+ (≥ 1280) the orbit stage at full size; lg (1024–1279, where the stage would
            scale to 0.8 and the left panels would touch) the guide on the left presenting a 2 × 3 grid with his open hand;
            below lg, the guide above a one/two-column list. */}
        <div className="relative mx-auto mt-10 max-w-[1180px] lg:mt-14" style={{ ["--stage-ar" as string]: `${W} / ${H}` }}>
          <div className="relative lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-center lg:gap-10 xl:block xl:aspect-[var(--stage-ar)]">
            {/* light and orbit, behind everything (xl: the full stage; below: just round the guide) */}
            <svg aria-hidden className="pointer-events-none absolute inset-0 hidden size-full xl:block" viewBox={`0 0 ${W} ${H}`} fill="none">
              <defs>
                <radialGradient id="ai-pool">
                  <stop offset="0" stopColor="#23466F" stopOpacity="0.55" />
                  <stop offset="0.55" stopColor="#23466F" stopOpacity="0.16" />
                  <stop offset="1" stopColor="#23466F" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="ai-floor">
                  <stop offset="0" stopColor="#9db8ff" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#9db8ff" stopOpacity="0" />
                </radialGradient>
                {/* the ring is brightest where it passes nearest the viewer, fading to nothing at its far ends */}
                <linearGradient id="ai-ring" x1={ORBIT.cx - ORBIT.rx} x2={ORBIT.cx + ORBIT.rx} gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#527FB6" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#b9ccf5" stopOpacity="0.75" />
                  <stop offset="1" stopColor="#527FB6" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="ai-link-l" x1="0" x2="1">
                  <stop offset="0" stopColor="#527FB6" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#527FB6" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="ai-link-r" x1="1" x2="0">
                  <stop offset="0" stopColor="#527FB6" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#527FB6" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <circle cx="590" cy="380" r="330" fill="url(#ai-pool)" />
              <ellipse cx={ORBIT.cx} cy={ORBIT.cy} rx="260" ry="65" fill="url(#ai-floor)" />
              <motion.path d={arc(false)} stroke="url(#ai-ring)" strokeWidth={1.2} opacity={0.6} {...draw(0.2)} />
              {SPOTS.map((s, i) => (
                <g key={i}>
                  <motion.path d={link(s)} stroke={`url(#ai-link-${s.x < W / 2 ? "l" : "r"})`} strokeWidth={1} {...draw(0.5 + i * 0.08)} />
                  <circle cx={s.to[0]} cy={s.to[1]} r="2.5" fill="#b9ccf5" opacity="0.5" />
                </g>
              ))}
            </svg>

            {/* the guide: 260 / 300px box below xl; on the stage a 400-unit box (≈ 330px tall visible at 1180 wide) */}
            <div
              aria-hidden
              className="relative mx-auto size-[260px] sm:size-[300px] xl:absolute xl:left-[var(--l)] xl:top-[var(--t)] xl:mx-0 xl:aspect-square xl:h-auto xl:w-[var(--w)]"
              style={{ ["--l" as string]: pct(390, W), ["--t" as string]: pct(200, H), ["--w" as string]: pct(400, W) }}
            >
              <div className="absolute inset-[8%_0_0] rounded-full bg-[radial-gradient(closest-side,rgb(var(--sapphire-light-rgb)/0.5),transparent_75%)] xl:hidden" />
              <div className="relative size-full">
                <MascotArt src="/img/mascots/mascot-guide-1024.webp" sizes="(min-width:1280px) 400px, 300px" />
              </div>
            </div>

            {/* the front half of the orbit, drawn over the guide's feet so he stands inside it */}
            <svg aria-hidden className="pointer-events-none absolute inset-0 hidden size-full xl:block" viewBox={`0 0 ${W} ${H}`} fill="none">
              <motion.path d={arc(true)} stroke="url(#ai-ring)" strokeWidth={1.6} {...draw(0.35)} />
            </svg>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-0 xl:block">
              {FEATURES.map((f, i) => {
                const s = SPOTS[i];
                return (
                  <motion.li
                    key={f.title}
                    data-reveal=""
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={reduced ? { duration: 0 } : { duration: MOTION.reveal, delay: 0.25 + i * 0.08, ease: MOTION.ease }}
                    className="xl:absolute xl:left-[var(--l)] xl:top-[var(--t)] xl:w-[var(--w)]"
                    style={{ ["--l" as string]: pct(s.x, W), ["--t" as string]: pct(s.y, H), ["--w" as string]: pct(PANEL_W, W) }}
                  >
                    {/* glass pane over the stage's two shared light fields. Type: a 600 title in soft white, the description
                        a step down in size and a clear silver (ink-2, not the dim ink-3), so it reads as content, not metadata.
                        At the tightest slot (xl stage at 1280, ~200px of text) a two-line title + three-line body is ~162px,
                        inside the 202px between rows. */}
                    <div className="fmd-glass-pane flex h-full items-start gap-3.5 rounded-[var(--sf-r-md)] p-4 lg:p-5">
                      <span className="icon-tile size-11 shrink-0">
                        <f.icon className="size-[18px]" strokeWidth={1.4} />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <h3 className="text-[16px] font-semibold leading-[1.35] tracking-[-0.012em] text-ink xl:text-[16.5px]">{f.title}</h3>
                        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink-2 sm:text-[14.5px]">{f.body}</p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>

        <Reveal delay={0.2} className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center xl:mt-8">
          <button onClick={() => openAssistant()} className="btn-primary group h-12 px-6 text-[14px]">
            <Sparkles className="size-4" strokeWidth={1.5} /> Explore AI features <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
          </button>
          <p className="text-[12.5px] text-ink-4">English · हिन्दी · ಕನ್ನಡ · తెలుగు · தமிழ்</p>
        </Reveal>
      </Container>
    </section>
  );
}
