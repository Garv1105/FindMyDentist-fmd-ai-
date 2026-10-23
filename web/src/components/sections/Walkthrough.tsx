"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, Calendar, CircleHelp, MessageCircleQuestion, Search } from "lucide-react";
import MascotArt from "@/components/MascotArt";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { openAssistant } from "../hero/Assistant";
import { Container, Reveal } from "../ui";
import { wavePath } from "./path";
import { Atmosphere } from "./LowerWorld";

const TREATMENTS = [
  { title: "Teeth Cleaning", img: "/img/tx-cleaning.png", meta: "30–45 min" },
  { title: "Braces & Aligners", img: "/img/tx-aligners.png", meta: "6–24 months" },
  { title: "Dental Implants", img: "/img/tx-implants.png", meta: "Staged treatment" },
  { title: "Teeth Whitening", img: "/img/tx-whitening.png", meta: "1–2 visits" },
];

type Step = { title: string; line: string; detail: string; action: ReactNode };

const ask = (p?: string) => () => openAssistant(p);
const STEPS: Step[] = [
  {
    title: "Ask",
    line: "Start with a question",
    detail: "Describe what you feel or what you want to know, in simple words and in your own language.",
    action: <ActionButton onClick={ask()}>Ask FMD AI</ActionButton>,
  },
  {
    title: "Understand",
    line: "Get clear guidance",
    detail: "FMD AI explains what you would want to know and the kind of specialist you need.",
    action: <ActionButton onClick={ask("What kind of dentist should I see for tooth sensitivity?")}>Try an example</ActionButton>,
  },
  {
    title: "Explore",
    line: "Compare your options",
    detail: "Popular treatments, explained: what happens, how long it takes and what to ask.",
    action: null, // treatment picker below
  },
  {
    title: "Find",
    line: "Choose a dentist",
    detail: "Discover verified Dentists & Explore Trusted Dental Clinics",
    action: <ActionLink href="#dentists">Find dentists</ActionLink>,
  },
  {
    title: "Act",
    line: "Book on your terms",
    detail: "Review your appointment time, clinic details and consultation fees before confirming your booking.",
    action: <ActionLink href="/appointments">My appointments</ActionLink>,
  },
  {
    title: "Follow up",
    line: "Continuity of patient care",
    detail: "Ensure regular follow-ups, update records after each visit and plan the next appointment accordingly.",
    action: <ActionLink href="/records">Dental records</ActionLink>,
  },
];

// The hero's own four suggested prompts, in the blueprint's order; like the hero's they open FMD AI with that question.
// Three are on screen at a time, so there's always a next one to enter.
const EXAMPLES = [
  { icon: CircleHelp, q: "My tooth hurts with cold drinks" },
  { icon: Calendar, q: "Prepare for my appointment" },
  { icon: Search, q: "Find a dentist near me" },
  { icon: MessageCircleQuestion, q: "Braces or aligners?" },
];
// The three resting places: one column of 56px cards, 16px apart. No rotation or scale (those resample the blurred
// glass and soften its edges) and no opacity on a resting card.
const SLOTS = [
  { y: 0, x: 0 },
  { y: 72, x: 0 },
  { y: 144, x: 0 },
];
// Cadence doubled from the original 5000ms interval / 0.7s move (HEAD); the move is halved with it, keeping the same
// share of each cycle in motion (14%): ~2.15s settled to read, 0.35s moving.
const CYCLE_MS = 2500;
const MOVE_S = 0.35;

/**
 * A stream of real questions: every 2.5s the front card rises and fades out, the others move up a place and the next
 * enters from below. Transform (translate only) + opacity. Holds still while pointed at, focused or pressed (so a
 * target never moves under a click or away from keyboard focus) and while off-screen (which includes display: none,
 * so only the copy on screen ever ticks); still under reduced motion. One interval, cleared on every pause change and
 * on unmount. No live region: the rotation isn't announced.
 */
function QuestionStream() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();
  const [head, setHead] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = reduced || hovered || focused || !inView;
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setHead((h) => (h + 1) % EXAMPLES.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [paused]);
  const shown = SLOTS.map((_, k) => EXAMPLES[(head + k) % EXAMPLES.length]);
  const back = SLOTS[SLOTS.length - 1];

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Example questions for FMD AI"
      className="pointer-events-auto relative h-[200px] w-[min(320px,100%)]"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
    >
      <AnimatePresence initial={false}>
        {shown.map(({ icon: Icon, q }, k) => (
          <motion.button
            key={q}
            type="button"
            onClick={() => openAssistant(q)}
            initial={{ y: back.y + 36, x: back.x, opacity: 0 }}
            animate={{ ...SLOTS[k], opacity: 1 }}
            exit={{ y: -36, opacity: 0 }}
            transition={{ duration: reduced ? 0 : MOVE_S, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-0 flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left shadow-2xl outline-none backdrop-blur-xl transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B101E]"
            style={{ zIndex: SLOTS.length - k }}
          >
            {/* one line, never wrapped: the full question is still the button's name */}
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-white">{q}</span>
            <Icon aria-hidden className="size-5 shrink-0 text-slate-400" strokeWidth={1.5} />
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/*
 * The Care Bridge: the questions people bring, on the left, lead to the Care Core (the translucent tooth); the guide on
 * the right presents it with an open hand.
 * Each composition is one box in its own units that scales with the width. Wide (xl+, 1240 × 450, the container's
 * full width at 1440): the heading sits over its top-left in normal flow. Narrow: core and guide only, re-spaced.
 * Art: care-core-v2.webp is the owner's black-background render keyed to alpha (alpha = brightest channel, colour
 * un-premultiplied, so the glass stays see-through). The guide (mascot-guide-1024, mirrored) has its palm at 14.6%,
 * 41.6% of its box, feet at 91.9%.
 */
type Box = { l: number; t: number; w: number; ar: number };
type SceneDef = { W: number; H: number; core: Box; guide: Box };
const CORE_AR = 1000 / 716;
// wide: tooth centred at (760, 247); palm at (926, 222)
const WIDE: SceneDef = {
  W: 1240,
  H: 450,
  core: { l: 551, t: 91, w: 436, ar: CORE_AR },
  guide: { l: 867, t: 56, w: 400, ar: 1 },
};
// the card column: right edge (282 + 320px) well short of the tooth's body at 669
const WIDE_CARDS = { l: 282, t: 171 };
const NARROW: SceneDef = { W: 740, H: 400, core: { l: 91, t: 44, w: 436, ar: CORE_AR }, guide: { l: 456, t: 74, w: 300, ar: 1 } };
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

function Scene({ s, className = "", children }: { s: SceneDef; className?: string; children?: ReactNode }) {
  const at = (b: Box) => ({ left: pct(b.l, s.W), top: pct(b.t, s.H), width: pct(b.w, s.W), aspectRatio: `${b.ar}` });
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${s.W} / ${s.H}` }}>
      <div
        role="img"
        aria-label="People's questions and the FMD guide meeting at one glowing tooth: FMD helps turn a question into a path to the right care."
        className="absolute inset-0"
      >
        {/* a pool of sapphire behind the tooth and a floor for the guide; the art carries the rest */}
        <div
          aria-hidden
          className="absolute rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.22),transparent)]"
          style={{ left: pct(s.core.l + s.core.w * 0.12, s.W), top: pct(s.core.t - 20, s.H), width: pct(s.core.w * 0.76, s.W), aspectRatio: "1" }}
        />
        <div
          aria-hidden
          className="absolute h-[7%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(157_184_255/0.2),transparent)]"
          style={{ left: pct(s.guide.l + s.guide.w * 0.12, s.W), width: pct(s.guide.w * 0.76, s.W), top: pct(s.guide.t + s.guide.w * 0.88, s.H) }}
        />
        <div aria-hidden className="absolute" style={at(s.core)}>
          <MascotArt src="/img/walkthrough/care-core-v2.webp" sizes="(min-width:1280px) 436px, 280px" className="object-contain" align="center" />
        </div>
        {/* the artwork is mirrored to face the Care Core; the model is its own mirrored pose */}
        <div aria-hidden className="absolute" style={at(s.guide)}>
          <MascotArt src="/img/mascots/mascot-guide-1024.webp" model="/models/rig/guide-left.glb?v=4" sizes="(min-width:1280px) 400px, 200px" className="-scale-x-100 object-contain" />
        </div>
      </div>
      {children}
    </div>
  );
}

/*
 * The journey (md+), in a 1240 × 120 box that scales with the width: one true sine wave, a steady rise and fall over
 * one and a half waves (amplitude 22, wavelength 760), drawn as precise Béziers (wavePath) and placed on it by the
 * function itself, so every node sits exactly on the line. The wave runs on past both ends of the container
 * (x -260 → 1500) and a mask fades it in from the dark on the left and back out on the right. Labels hang below each
 * node; measured, the line stays at least 17px clear of them at every width from 768 up.
 * Below md the same wave in a 600 × 64 strip with non-scaling strokes; labels are the titles only.
 */
const W = 1240;
const H = 120;
const NODE_X = STEPS.map((_, i) => 150 + i * 188);
const wave = (x: number) => 60 + 22 * Math.sin((2 * Math.PI * (x - 150)) / 760);
const NODE_Y = NODE_X.map(wave);
const X0 = -260;
const X1 = 1500;
const PATH = wavePath(wave, X0, X1, 48);
const MW = 600;
const MH = 64;
const mwave = (x: number) => 32 + 11 * Math.sin((2 * Math.PI * ((x * W) / MW - 150)) / 760);
const NODE_YM = NODE_X.map((x) => mwave((x / W) * MW));
const MPATH = wavePath(mwave, 0, MW, 24);
const nodeFrac = (i: number) => PATH.frac(NODE_X[i]);

/*
 * The swell: the line itself brightening and thickening as a slow wave of light passes through it, like a sound wave
 * along a string; nothing rides on it. Two copies of the line, a touch brighter and a touch thicker, are each seen
 * only through a soft band (a bell-shaped gradient) that drifts left to right (.wt-swell, ~8s a pass). The thicker
 * copy's band is the narrower, so the swell is fullest at its centre and thins to nothing at its ends; a wide faint
 * copy under them is its glow. Two swells run half a pass apart (PHASES, seconds), so the line is never still for
 * long. All sit under the end fade, so each surfaces out of the dark and goes back into it.
 */
const SWELL = [
  { band: 340, w: 18, c: "#60A5FA", o: 0.42 },
  { band: 260, w: 9, c: "#93C5FD", o: 0.6 },
  { band: 130, w: 5.8, c: "#DBEAFE", o: 0.95 },
  { band: 220, w: 3.8, c: "#FFFFFF", o: 1 },
];
const PHASES = [0, 4];
const swells = PHASES.flatMap((ph) => SWELL.map((s) => ({ ...s, ph, id: `${s.band}-${ph}`, delay: { animationDelay: `${1 - ph}s` } })));
// bell-shaped opacity profile across a band (left edge → right edge)
const BELL = [0, 0.06, 0.25, 0.6, 1, 0.6, 0.25, 0.06, 0];

// the guide's pose for each step in the panel: existing transparent artwork only (typing the question, explaining,
// reading up, holding the pin, setting off, keeping the records)
const POSES = [
  "/img/mascots/mascot-laptop-1024.webp",
  "/img/mascots/mascot-guide-1024.webp",
  "/img/mascots/mascot-read-1024.webp",
  "/img/mascots/mascot-pin-1024.webp",
  "/img/mascots/mascot-walk-512.webp",
  "/img/mascots/mascot-vault-1024.webp",
];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Section 04: what FMD is. A question and the guide meet at the Care Core, then six steps from question to follow-up. */
export default function Walkthrough() {
  const [active, select] = useState(0);
  const step = STEPS[active];
  const reduced = useReducedMotion();

  // the nav's "Treatments" link lands here: open the Explore step
  useEffect(() => {
    const on = () => location.hash === "#treatments" && select(2);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  return (
    <section id="treatments" className="relative isolate scroll-mt-24 overflow-x-clip pt-28 sm:pt-36">
      <Atmosphere scene="walkthrough" />
      <Container>
        {/* xl: one composition, heading over its top-left. Below: heading, then (lg: beside it) the questions, then the scene */}
        <div className="relative xl:aspect-[var(--wt-scene)]" style={{ ["--wt-scene" as string]: `${WIDE.W} / ${WIDE.H}` }}>
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14 xl:block">
            <Reveal className="relative z-10">
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[#64748B]">What is FMD</p>
              <h2 className="mb-4 text-[34px] font-bold leading-[1.1] tracking-[-0.025em] text-white [text-wrap:balance] sm:text-[48px]">
                From a question to <span className="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">the right care</span>
              </h2>
              <p className="max-w-2xl text-[16px] leading-relaxed text-slate-400 [text-wrap:pretty] xl:max-w-[560px]">
                One place to understand a concern, explore treatment and find a dentist. Pick a step to see how it works.
              </p>
            </Reveal>
            <Reveal delay={0.15} className="xl:hidden">
              <QuestionStream />
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-8 lg:mt-6 xl:absolute xl:inset-0 xl:mt-0">
            <Scene s={NARROW} className="mx-auto max-w-[540px] xl:hidden" />
            <Scene s={WIDE} className="hidden xl:block">
              {/* fixed width: an absolute box with none shrinks to fit and squeezed the cards into columns */}
              <div className="absolute z-30 w-[320px]" style={{ left: pct(WIDE_CARDS.l, WIDE.W), top: pct(WIDE_CARDS.t, WIDE.H) }}>
                <QuestionStream />
              </div>
            </Scene>
          </Reveal>
        </div>

        {/* the six steps on the wave */}
        <div className="relative mt-10 pb-14 md:mt-12 md:pb-[88px]">
          <div className="relative h-16 md:h-auto md:aspect-[var(--wt-ar)]" style={{ ["--wt-ar" as string]: `${W} / ${H}` }}>
            <svg aria-hidden className="absolute inset-0 hidden size-full overflow-visible md:block" viewBox={`0 0 ${W} ${H}`} fill="none">
              <defs>
                {/* both ends rise out of the dark and sink back into it: everything on the line sits under this fade */}
                <linearGradient id="wt-fade-g" gradientUnits="userSpaceOnUse" x1={X0} x2={X1}>
                  {/* nothing at the container's edges, full by the first and last nodes, so both ends dissolve in view */}
                  {[
                    [0, 0],
                    [150, 1],
                    [W - 150, 1],
                    [W, 0],
                  ].map(([x, o]) => (
                    <stop key={x} offset={(x - X0) / (X1 - X0)} stopColor="#fff" stopOpacity={o} />
                  ))}
                </linearGradient>
                <mask id="wt-fade" maskUnits="userSpaceOnUse" x={X0} y={-60} width={X1 - X0} height={H + 120}>
                  <rect x={X0} y={-60} width={X1 - X0} height={H + 120} fill="url(#wt-fade-g)" />
                </mask>
                <linearGradient id="wt-core" gradientUnits="userSpaceOnUse" x1={X0} x2={X1}>
                  <stop offset="0" stopColor="#1D4ED8" />
                  <stop offset="0.5" stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#93C5FD" />
                </linearGradient>
                {/* the glow: one static blurred copy (blurred once at paint, never animated) */}
                <filter id="wt-glow" x={X0} y={-60} width={X1 - X0} height={H + 120} filterUnits="userSpaceOnUse">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
                <linearGradient id="wt-bell">
                  {BELL.map((o, i) => (
                    <stop key={i} offset={i / (BELL.length - 1)} stopColor="#fff" stopOpacity={o} />
                  ))}
                </linearGradient>
                {swells.map((s) => (
                  <mask key={s.id} id={`wt-swell-${s.id}`} maskUnits="userSpaceOnUse" x={X0} y={-60} width={X1 - X0} height={H + 120}>
                    <rect className="wt-swell" style={s.delay} x={-s.band / 2} y={-60} width={s.band} height={H + 120} fill="url(#wt-bell)" />
                  </mask>
                ))}
              </defs>
              <g mask="url(#wt-fade)">
                <path d={PATH.d} stroke="#3B82F6" strokeOpacity={0.425} strokeWidth={8} filter="url(#wt-glow)" />
                {/* a hairline of shadow just under the line keeps its lower edge crisp against the glow */}
                <path d={PATH.d} stroke="#02040A" strokeOpacity={0.6} strokeWidth={4.2} transform="translate(0 1.25)" />
                <motion.path
                  data-draw=""
                  d={PATH.d}
                  stroke="url(#wt-core)"
                  strokeWidth={2.6}
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={reduced ? { duration: 0 } : { duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                />
                {/* progress: the same wave, lit brighter up to the selected step, with its own tighter glow */}
                <motion.path
                  d={PATH.d}
                  stroke="#60A5FA"
                  strokeOpacity={0.51}
                  strokeWidth={7}
                  filter="url(#wt-glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: nodeFrac(active) }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.path
                  d={PATH.d}
                  stroke="#93C5FD"
                  strokeWidth={2.8}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: nodeFrac(active) }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
                {/* a fine highlight along the top of the line: the sharp edge */}
                <path d={PATH.d} stroke="#DBEAFE" strokeOpacity={0.35} strokeWidth={0.75} transform="translate(0 -0.6)" />
                {/* the swell passing through the line (see SWELL); reduced motion parks the bands off the line, unseen */}
                {swells.map((s) => (
                  <path key={s.id} d={PATH.d} stroke={s.c} strokeOpacity={s.o} strokeWidth={s.w} mask={`url(#wt-swell-${s.id})`} />
                ))}
              </g>
            </svg>
            {/* below md: the same wave in a strip; it stretches to the width, the strokes don't */}
            <svg aria-hidden className="absolute inset-0 size-full md:hidden" viewBox={`0 0 ${MW} ${MH}`} preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="wt-mfade" x1="0" x2="1">
                  <stop offset="0" stopColor="#3B82F6" stopOpacity="0" />
                  <stop offset="0.12" stopColor="#3B82F6" stopOpacity="0.9" />
                  <stop offset="0.88" stopColor="#60A5FA" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#60A5FA" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={MPATH.d} stroke="url(#wt-mfade)" strokeOpacity={0.25} strokeWidth={6} vectorEffect="non-scaling-stroke" />
              <path d={MPATH.d} stroke="url(#wt-mfade)" strokeWidth={1.9} vectorEffect="non-scaling-stroke" />
              {/* the same swell, its bands scaled to the strip (600 units across) */}
              {swells.map((s) => (
                <mask key={s.id} id={`wt-mswell-${s.id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={MW} height={MH}>
                  <rect className="wt-swell-m" style={s.delay} x={-s.band / 4} y={0} width={s.band / 2} height={MH} fill="url(#wt-bell-m)" />
                </mask>
              ))}
              <linearGradient id="wt-bell-m">
                {BELL.map((o, i) => (
                  <stop key={i} offset={i / (BELL.length - 1)} stopColor="#fff" stopOpacity={o} />
                ))}
              </linearGradient>
              {swells.map((s) => (
                <path
                  key={s.id}
                  d={MPATH.d}
                  stroke={s.c}
                  strokeOpacity={s.o}
                  strokeWidth={Math.min(s.w * 0.8, 6)}
                  vectorEffect="non-scaling-stroke"
                  mask={`url(#wt-mswell-${s.id})`}
                />
              ))}
            </svg>

            {/* a tablist, so arrow keys and screen readers work like any tab set; each tab centred on its node */}
            <div
              role="tablist"
              aria-label="How FMD works"
              className="absolute inset-0"
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const n = (active + (e.key === "ArrowRight" ? 1 : STEPS.length - 1)) % STEPS.length;
                select(n);
                document.getElementById(`wt-tab-${n}`)?.focus();
              }}
            >
              {STEPS.map((s, i) => {
                const on = i === active;
                return (
                  <button
                    key={s.title}
                    id={`wt-tab-${i}`}
                    role="tab"
                    aria-selected={on}
                    aria-controls="wt-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => select(i)}
                    className="group absolute left-[var(--x)] top-[var(--ym)] -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0B101E] md:top-[var(--y)]"
                    style={{ ["--x" as string]: pct(NODE_X[i], W), ["--y" as string]: pct(NODE_Y[i], H), ["--ym" as string]: pct(NODE_YM[i], MH) }}
                  >
                    <span
                      className={`relative z-10 flex size-8 items-center justify-center rounded-full border bg-[#0B101E] text-[12px] font-semibold tabular-nums transition-[border-color,box-shadow,color] duration-300 ${
                        on
                          ? "border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                          : i < active
                            ? "border-blue-500/50 text-slate-300"
                            : "border-slate-600 text-slate-400 group-hover:border-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {pad2(i + 1)}
                    </span>
                    {/* label hangs below the node; still part of the tab, so the whole thing is the target */}
                    {/* below md the labels alternate above and below the line, so neighbours never touch at 320px */}
                    <span
                      className={`absolute left-1/2 w-[64px] -translate-x-1/2 text-center md:bottom-auto md:top-full md:mb-0 md:w-[min(170px,15vw)] ${
                        i % 2 ? "bottom-full mb-2" : "top-full"
                      }`}
                    >
                      <span className={`${i % 2 ? "" : "mt-2"} block text-[10.5px] font-semibold leading-tight md:mt-4 md:text-[14px] ${on ? "text-white" : "text-slate-400"}`}>{s.title}</span>
                      <span className={`mt-0.5 hidden text-[12px] leading-snug md:block ${on ? "text-blue-400" : "text-slate-400"}`}>{s.line}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* the selected step: one glass panel, centred under the journey, the guide on its left in this step's pose */}
        <div className="relative mx-auto max-w-[1040px]">
          {/* light behind the glass, so the frosting has something to frost: sapphire behind the guide, a cooler lift
              behind the text. Static; the panel's own blur does the rest */}
          <div aria-hidden className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10">
            <div className="absolute left-[4%] top-[18%] h-[80%] w-[34%] rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.32),transparent)]" />
            <div className="absolute right-[10%] top-[6%] h-[70%] w-[40%] rounded-full bg-[radial-gradient(closest-side,rgb(147_197_253/0.12),transparent)]" />
            <div className="absolute bottom-0 left-[38%] h-[40%] w-[30%] rounded-full bg-[radial-gradient(closest-side,rgb(99_102_241/0.08),transparent)]" />
          </div>
        <div
          id="wt-panel"
          role="tabpanel"
          aria-labelledby={`wt-tab-${active}`}
          className="relative isolate overflow-hidden rounded-2xl border border-white/[0.1] bg-[linear-gradient(180deg,rgb(255_255_255/0.055),rgb(255_255_255/0.025))] shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_24px_60px_-30px_rgb(0_0_0/0.8)] backdrop-blur-2xl backdrop-saturate-[1.2]"
        >
          {/* frosted, not shiny: a faint lift toward the top and one fine light edge along it */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.035] to-transparent" />
            <div className="absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            {/* the selected step's pose: its 3D model (one live canvas for the panel), the artwork while it loads */}
            <div aria-hidden className="relative h-[168px] shrink-0 sm:h-auto sm:min-h-[190px] sm:w-[220px] sm:border-r sm:border-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_80%,rgb(59_130_246/0.18),transparent_75%)]" />
              <div className="absolute bottom-2 left-1/2 h-5 w-[64%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(157,184,255,0.24),transparent)]" />
              <div className="absolute bottom-0 left-1/2 size-[160px] -translate-x-1/2 sm:size-[176px]">
                <MascotArt src={POSES[active]} sizes="176px" />
              </div>
            </div>
          <div className="flex min-w-0 flex-1 flex-col items-start justify-between p-6 sm:p-8 md:flex-row md:items-center md:gap-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
                className="min-w-0"
              >
                <p className="mb-2 text-[12px] uppercase tracking-widest text-slate-400">
                  Step {active + 1} • {step.line}
                </p>
                <h3 className="mb-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">{step.title}</h3>
                <p className="max-w-md text-[14px] leading-relaxed text-slate-400">{step.detail}</p>
              </motion.div>
            </AnimatePresence>
            {step.action && <div className="mt-6 shrink-0 md:mt-0">{step.action}</div>}
          </div>
          </div>

          {step.title === "Explore" && (
            <div className="mx-6 mb-6 grid grid-cols-1 gap-3 border-t border-white/10 pt-6 sm:mx-8 sm:mb-8 sm:grid-cols-2">
              {TREATMENTS.map((t) => (
                <button
                  key={t.title}
                  onClick={() => openAssistant(`Tell me about ${t.title.toLowerCase()}`)}
                  aria-label={`Ask FMD AI about ${t.title}`}
                  className="group flex items-center gap-4 rounded-xl bg-white/[0.03] p-2.5 pr-4 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                >
                  <span className="relative h-[56px] w-[64px] shrink-0 overflow-hidden rounded-[10px]">
                    <Image src={t.img} alt="" fill sizes="64px" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-white">{t.title}</span>
                    <span className="mt-1 block truncate text-[11.5px] uppercase tracking-[0.14em] text-slate-500">{t.meta}</span>
                  </span>
                  <ArrowRight className="arrow-nudge size-4 shrink-0 text-slate-400 group-hover:text-white" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </Container>
    </section>
  );
}

const CTA =
  "group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-blue-500 bg-blue-500/10 px-6 py-3 text-[14px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B101E]";

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={CTA}>
      {children} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
    </button>
  );
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={CTA}>
      {children} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
    </a>
  );
}
