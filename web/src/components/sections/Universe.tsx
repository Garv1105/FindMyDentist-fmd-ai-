"use client";

import {
  BadgeCheck,
  Check,
  ConciergeBell,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Sparkles,
  Stethoscope,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Container, SectionHeader } from "../ui";
import { usePhone } from "@/lib/phone";
import { Atmosphere } from "./LowerWorld";
import { ClinicWindow, Phone } from "./Products";

/*
 * Section 02b: everything FMD offers, as a bento: 6 columns × 3 rows of 200px on desktop. Each app sits beside the
 * module that lives inside it: FMD ONE (3×2) with FMD AI (2×2) beside it, Scholar over Innovation Hub in the last
 * column; then Clinic OS (3×1) and Flow, and ONE's own Edge and SaveIN.
 *
 * The assembly: as the grid scrolls into view the tiles fly in from scattered places in depth (pushed back, turned,
 * blurred) and lock into the grid one after another; scrolling back takes them apart again. Each tile then keeps a
 * small life of its own (the apps orbit the AI, Scholar's tabs cycle, a voice note becomes a transcript, Edge's steps
 * light in turn, the checkout picks EMIs), a sheen of light crosses the glass now and then, and under the pointer a
 * tile tilts toward it with a light following. Reduced motion: all of it still, the grid simply there.
 */

/** A counter that ticks every `ms` while `on`: the tiles' little loops run off it. */
function useTick(ms: number, on: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms, on]);
  return n;
}

type From = { x: number; y: number; rx: number; ry: number; r: number };

/*
 * One scroll timeline, 0..1, through a soft spring, drives the section's entrance in order, so it plays as one move:
 *   headline   its words rise out of a mask, one after another (its own stretch, as the header comes up the screen)
 *   tiles      fly in and lock into the grid as it comes up the screen
 *   phone      then (desktop) the grid holds still, pinned below the header, and the scroll goes to FMD ONE's phone
 *              alone: it rises straight up into its tile; once it's in, the grid lets go and the page scrolls on
 */
const smooth = (u: number) => u * u * (3 - 2 * u);
const span = (v: number, [a, b]: [number, number]) =>
  smooth(Math.min(1, Math.max(0, (v - a) / (b - a))));

/** One tile: flies in from `from` as `progress` passes its stretch; glass, sheen, pointer light and tilt. */
function Tile({
  i,
  from,
  progress,
  still,
  className,
  children,
}: {
  i: number;
  from: From;
  progress: MotionValue<number>;
  still: boolean;
  className: string;
  children: ReactNode;
}) {
  const start = i * 0.065;
  // how far in this tile is, 0 (scattered) .. 1 (in place), eased out so it lands softly
  const k = useTransform(progress, (v) => {
    return span(v, [start, start + 0.5]); // eased in and out: it lifts off gently and settles gently
  });
  const x = useTransform(k, (v) => (1 - v) * from.x);
  const y = useTransform(k, (v) => (1 - v) * from.y);
  const rotateX = useTransform(k, (v) => (1 - v) * from.rx);
  const rotateY = useTransform(k, (v) => (1 - v) * from.ry);
  const rotate = useTransform(k, (v) => (1 - v) * from.r);
  const scale = useTransform(k, (v) => 0.82 + 0.18 * v);
  const opacity = useTransform(k, [0, 0.6], [0, 1]);
  const filter = useTransform(k, (v) =>
    v > 0.98 ? "none" : `blur(${(1 - v) * 6}px)`,
  ); // none once in: blur is costly
  // phones: no scroll-driven blur at all; a changing blur is repainted on the CPU every scroll frame
  const phone = usePhone();
  const ref = useRef<HTMLDivElement>(null);
  const set = (vars: Record<string, string>) =>
    Object.entries(vars).forEach(([key, val]) =>
      ref.current?.style.setProperty(key, val),
    );
  return (
    <motion.div
      className={`relative ${className}`}
      style={
        still
          ? undefined
          : // "none", not left out: the first render (before the phone is known) has already set a blur, and a
            // style key that disappears is simply no longer updated, so it would stay blurred
            { x, y, rotateX, rotateY, rotate, scale, opacity, filter: phone ? "none" : filter }
      }
    >
      <div
        ref={ref}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          set({
            "--mx": `${px * 100}%`,
            "--my": `${py * 100}%`,
            "--rx": `${(0.5 - py) * 6}deg`,
            "--ry": `${(px - 0.5) * 6}deg`,
          });
        }}
        onPointerLeave={() => set({ "--rx": "0deg", "--ry": "0deg" })}
        className="group relative isolate h-full overflow-hidden rounded-[24px] border border-line bg-[linear-gradient(160deg,var(--surface-elevated),var(--surface)_70%)] shadow-[inset_0_1px_0_var(--inner-hi),0_24px_50px_-30px_rgb(0_0_0/0.9)] transition-[transform,border-color] duration-300 ease-out hover:border-[rgb(var(--horizon-rgb)/0.3)]"
        style={
          {
            transform:
              "perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
            "--sheen-delay": `${i * 0.9}s`,
          } as CSSProperties
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(360px circle at var(--mx, 50%) var(--my, 0%), rgb(var(--accent-rgb) / 0.14), transparent 60%)",
          }}
        />
        <span aria-hidden className="bento-sheen" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[12%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--horizon-rgb)/0.35),transparent)]"
        />
        {children}
      </div>
    </motion.div>
  );
}

/** A tile's words: what kind of thing, its name, a line. */
function Words({
  icon: Icon,
  kicker,
  name,
  line,
  big,
}: {
  icon: LucideIcon;
  kicker: string;
  name: string;
  line?: string;
  big?: boolean;
}) {
  return (
    <div className="relative">
      <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4">
        <Icon
          className="size-3 text-[rgb(var(--horizon-rgb)/0.85)]"
          strokeWidth={1.8}
        />{" "}
        {kicker}
      </p>
      <h3
        className={`mt-2 font-normal tracking-[-0.03em] text-ink ${big ? "text-[clamp(28px,2.6vw,36px)] leading-[1.02]" : "text-[19px] leading-tight"}`}
      >
        {name}
      </h3>
      {line && (
        <p
          className={`mt-2 leading-snug text-ink-3 ${big ? "max-w-[300px] text-[14.5px]" : "text-[12.5px]"}`}
        >
          {line}
        </p>
      )}
    </div>
  );
}

/*
 * FMD AI's graph, after Images/Graph.png: a fine line climbing the tile from its bottom-left edge out through its
 * top-right corner in smooth steps, one per app the AI works inside. Every bend is a cubic whose handles lie flat, so
 * each rise leaves and joins its step with no corner. Each step's label hangs beside a thin stem that drops from a
 * small dot to the line. Scrolling draws it, as in the reference: a bright head leads the line, a soft fill sweeps in
 * under it, and each label rises in as the line reaches its step. 400 × 270 box, spanning the tile edge to edge.
 */
const STEPS_PATH =
  "M -6 258 C 24 258, 30 232, 60 232 L 102 232 C 142 232, 136 164, 176 164 L 218 164 C 258 164, 252 96, 292 96 L 330 96 C 362 96, 378 62, 406 30";
const STEPS = [
  { app: "FMD ONE", what: "Guides patients", x: 60, base: 232, at: 0.17 },
  { app: "Clinic OS", what: "AI clinic manager", x: 176, base: 164, at: 0.47 },
  { app: "Scholar", what: "Study & research", x: 292, base: 96, at: 0.76 },
];
const LABEL_H = 80; // a label's stem, from its dot down to the line, in box units

function Step({
  s,
  progress,
  reduced,
}: {
  s: (typeof STEPS)[number];
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const shown = useTransform(progress, [s.at - 0.05, s.at + 0.07], [0, 1]);
  const y = useTransform(shown, [0, 1], [12, 0]);
  return (
    <motion.div
      className="absolute flex gap-2.5"
      style={{
        left: `${(s.x / 400) * 100}%`,
        top: `${((s.base - LABEL_H) / 270) * 100}%`,
        height: `${(LABEL_H / 270) * 100}%`,
        width: "24%",
        ...(reduced ? {} : { opacity: shown, y }),
      }}
    >
      <span
        aria-hidden
        className="relative -ml-[2.5px] flex w-[5px] shrink-0 flex-col items-center"
      >
        <span className="size-[5px] rounded-full bg-[#93c5fd] shadow-[0_0_8px_#60a5fa]" />
        <span className="w-px flex-1 bg-[linear-gradient(180deg,rgb(var(--horizon-rgb)/0.4),rgb(var(--horizon-rgb)/0.1))]" />
      </span>
      <span className="-mt-1 min-w-0">
        <span className="block text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {s.app}
        </span>
        <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">
          {s.what}
        </span>
      </span>
    </motion.div>
  );
}

function AiSteps({ reduced }: { reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const head = useRef<SVGGElement>(null);
  // the line follows the scroll (through a soft spring, so it glides): drawn from as the graph enters the lower
  // screen, done by the time its top reaches the middle
  const { scrollYProgress } = useScroll({
    target: box,
    offset: ["start 0.95", "start 0.45"],
  });
  const length = useSpring(useTransform(scrollYProgress, [0, 1], [0.02, 1]), {
    stiffness: 70,
    damping: 20,
  });
  const reveal = useTransform(length, (v) => `inset(0 ${(1 - v) * 100}% 0 0)`); // the fill, swept in left to right
  // the bright head rides the tip of the line
  useMotionValueEvent(length, "change", (v) => {
    const p = line.current;
    if (!p || !head.current) return;
    const pt = p.getPointAtLength(v * p.getTotalLength());
    head.current.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    head.current.style.opacity = v > 0.03 && v < 0.985 ? "1" : "0";
  });
  return (
    <div
      ref={box}
      aria-label="FMD AI in FMD ONE, Clinic OS and Scholar"
      className="relative -mx-7 -mb-7 mt-auto aspect-[400/270]"
    >
      <svg
        aria-hidden
        viewBox="0 0 400 270"
        className="absolute inset-0 size-full overflow-visible"
        fill="none"
      >
        <defs>
          <linearGradient
            id="ai-steps"
            x1="0"
            y1="270"
            x2="400"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#1e40af" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#dbeafe" />
          </linearGradient>
          <linearGradient
            id="ai-steps-fill"
            x1="0"
            y1="0"
            x2="0"
            y2="270"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <filter
            id="ai-steps-glow"
            x="-10%"
            y="-40%"
            width="120%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {/* the soft fill under the line */}
        <motion.path
          d={`${STEPS_PATH} L 406 280 L -6 280 Z`}
          fill="url(#ai-steps-fill)"
          style={reduced ? undefined : { clipPath: reveal }}
        />
        {/* the line's glow, and the line */}
        <motion.path
          d={STEPS_PATH}
          stroke="#3b82f6"
          strokeWidth={6}
          strokeOpacity={0.2}
          filter="url(#ai-steps-glow)"
          data-draw=""
          style={reduced ? undefined : { pathLength: length }}
        />
        <motion.path
          ref={line}
          d={STEPS_PATH}
          stroke="url(#ai-steps)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-draw=""
          style={reduced ? undefined : { pathLength: length }}
        />
        {/* its head: a bright point with a halo, leading the line */}
        {!reduced && (
          <g ref={head} style={{ opacity: 0 }}>
            <circle r={9} fill="#60a5fa" opacity={0.18} />
            <circle
              r={3.2}
              fill="#eff6ff"
              style={{ filter: "drop-shadow(0 0 6px #60a5fa)" }}
            />
          </g>
        )}
      </svg>
      {STEPS.map((s) => (
        <Step key={s.app} s={s} progress={length} reduced={reduced} />
      ))}
    </div>
  );
}

const SCHOLAR = ["Doubts", "Viva prep", "Seminars", "MCQs", "Research"];
const EDGE = ["Tell us your need", "We reach out", "You approve"];
// where each tile flies in from: the left column's from the left, the right's from the right, all from depth
const FROM: From[] = [
  { x: -160, y: 60, rx: 14, ry: 22, r: -4 }, // FMD ONE
  { x: 40, y: -120, rx: -24, ry: -8, r: 3 }, // FMD AI
  { x: 180, y: -40, rx: 10, ry: -26, r: 6 }, // Scholar
  { x: 200, y: 80, rx: -12, ry: -24, r: -5 }, // Innovation Hub
  { x: -180, y: 140, rx: 20, ry: 18, r: 3 }, // Clinic OS
  { x: -40, y: 180, rx: 26, ry: 6, r: -6 }, // Flow
  { x: 60, y: 190, rx: 24, ry: -10, r: 5 }, // Edge
  { x: 190, y: 150, rx: 18, ry: -22, r: -4 }, // SaveIN
];

/** The headline, word by word: each rises out of its own mask as the header comes up the screen, a beat apart. */
function Headline({ text, still }: { text: string; still: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { scrollYProgress: raw } = useScroll({
    target: ref,
    offset: ["start 0.95", "start 0.55"],
  });
  const p = useSpring(raw, { stiffness: 60, damping: 18 });
  const words = text.split(" ");
  return (
    <span ref={ref} className="inline-block sm:whitespace-nowrap">
      {words.map((w, i) => (
        <Word key={i} p={p} at={(i / words.length) * 0.5} still={still}>
          {w}
          {i < words.length - 1 ? "\u00a0" : ""}
        </Word>
      ))}
    </span>
  );
}

function Word({
  p,
  at,
  still,
  children,
}: {
  p: MotionValue<number>;
  at: number;
  still: boolean;
  children: ReactNode;
}) {
  const k = useTransform(p, (v) => span(v, [at, at + 0.5]));
  const y = useTransform(k, (v) => `${(1 - v) * 105}%`);
  const rotate = useTransform(k, (v) => (1 - v) * 6);
  const filter = useTransform(k, (v) =>
    v > 0.98 ? "none" : `blur(${(1 - v) * 4}px)`,
  );
  const phone = usePhone(); // phones: rise and turn only, no scroll-driven blur
  return (
    // the mask: a line box with a little room for descenders
    <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        className="inline-block origin-bottom-left"
        style={still ? undefined : { y, rotate, filter: phone ? "none" : filter }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function Universe() {
  const reduced = useReducedMotion() ?? false;
  const grid = useRef<HTMLDivElement>(null);
  const live = useInView(grid, { margin: "-15% 0px" }) && !reduced;
  const tick = useTick(2200, live);
  const stage = useRef<HTMLDivElement>(null);
  // the tiles: from the grid entering the screen to it reaching the pin (its top 90px down, under the header)
  const { scrollYProgress: raw } = useScroll({
    target: stage,
    offset: ["start 1", "start 90px"],
  });
  // the scroll, through a soft spring: the tiles glide after it instead of jumping with each wheel notch
  const scrollYProgress = useSpring(raw, {
    stiffness: 55,
    damping: 18,
    mass: 0.9,
  });
  const t = (i: number) => ({
    i,
    from: FROM[i],
    progress: scrollYProgress,
    still: reduced,
  });
  // the phone: the scroll while the grid is pinned (the stage's extra height), through its own soft spring
  const { scrollYProgress: held } = useScroll({
    target: stage,
    offset: ["start 90px", "end end"],
  });
  const phone = useSpring(
    useTransform(held, (v) => span(v, [0.08, 0.85])),
    { stiffness: 60, damping: 20 },
  );
  const phoneY = useTransform(phone, (v) => (1 - v) * 340);
  const phoneO = useTransform(phone, [0, 0.3], [0, 1]);

  return (
    <section
      id="universe"
      className="relative isolate scroll-mt-24 pt-24 sm:pt-32"
    >
      <Atmosphere scene="os" />
      <Container>
        <SectionHeader
          center
          eyebrow="FMD Universe"
          title={
            <Headline text="Everything dentistry needs." still={reduced} />
          }
          description="The core of FMD: FMD ONE for patients, Clinic OS for clinics, Scholar for students, the tools inside each, one AI running through all three, and easy EMIs."
        />

        {/* the stage: on desktop, as tall as the grid plus the stretch it stays pinned for */}
        <div ref={stage} className="relative overflow-x-clip lg:h-[calc(624px+75vh)]">
          <div className="lg:sticky lg:top-[90px]">
            <div
              ref={grid}
              className="relative grid grid-cols-[minmax(0,1fr)] gap-3 [perspective:1600px] sm:grid-cols-2 lg:auto-rows-[200px] lg:grid-cols-6"
            >
              {/* FMD ONE: the phone, floating, bleeding off the tile */}
              <Tile
                {...t(0)}
                className="min-h-[240px] sm:col-span-2 sm:min-h-[400px] lg:col-span-3 lg:row-span-2 lg:min-h-0"
              >
                <div className="relative flex h-full flex-col justify-between p-7">
                  <Words
                    big
                    icon={HeartPulse}
                    kicker="App · For everyone"
                    name="FMD ONE"
                    line="One ecosystem and one community for every dental need."
                  />
                  <div className="relative flex max-w-[260px] flex-wrap gap-1.5">
                    {[
                      [BadgeCheck, "Verified dentists"],
                      [ConciergeBell, "FMD Edge"],
                      [Wallet, "SaveIN EMIs"],
                      [Sparkles, "FMD AI"],
                    ].map(([Icon, label]) => {
                      const I = Icon as LucideIcon;
                      return (
                        <span
                          key={label as string}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-[var(--surface-glass)] px-2.5 py-1 text-[11.5px] font-medium text-ink-2"
                        >
                          <I className="size-3" strokeWidth={1.7} />{" "}
                          {label as string}
                        </span>
                      );
                    })}
                  </div>
                  {/* the phone: rises into the tile once the grid has assembled */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-24 right-6 pt-6 [mask-image:linear-gradient(180deg,#000_60%,transparent_88%)] max-sm:hidden"
                    style={reduced ? undefined : { y: phoneY, opacity: phoneO }}
                  >
                    <div className="absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.25),transparent)]" />
                    <div className="bento-float [zoom:0.92]">
                      <Phone />
                    </div>
                  </motion.div>
                </div>
              </Tile>

              {/* FMD AI: one AI climbing through the apps, a step for each */}
              <Tile
                {...t(1)}
                className="min-h-[400px] sm:col-span-2 lg:col-span-2 lg:row-span-2 lg:min-h-0"
              >
                <div className="relative flex h-full flex-col p-7">
                  <Words
                    icon={Sparkles}
                    kicker="Inside every app"
                    name="FMD AI"
                    line="One AI, tuned separately for each app."
                  />
                  <AiSteps reduced={reduced} />
                </div>
              </Tile>

              {/* FMD Scholar: what it's for, cycling */}
              <Tile {...t(2)} className="min-h-[200px] lg:min-h-0">
                <div className="flex h-full flex-col p-5">
                  <Words
                    icon={GraduationCap}
                    kicker="App · Learning"
                    name="FMD Scholar"
                  />
                  <div className="mt-auto">
                    <div className="relative h-9 overflow-hidden">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.p
                          key={tick % SCHOLAR.length}
                          initial={{ y: 28, opacity: 0, filter: "blur(4px)" }}
                          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                          exit={{ y: -28, opacity: 0, filter: "blur(4px)" }}
                          transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="absolute inset-x-0 text-[24px] font-light tracking-[-0.03em] text-ink"
                        >
                          {SCHOLAR[tick % SCHOLAR.length]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {SCHOLAR.map((s, i) => (
                        <span
                          key={s}
                          className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i === tick % SCHOLAR.length ? "bg-[rgb(var(--horizon-rgb)/0.85)]" : "bg-white/10"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Tile>

              {/* Innovation Hub: three a year */}
              <Tile {...t(3)} className="min-h-[200px] lg:min-h-0">
                <div className="flex h-full flex-col p-5">
                  <Words
                    icon={Lightbulb}
                    kicker="Inside Scholar"
                    name="Innovation Hub"
                  />
                  <div className="mt-auto flex items-end gap-3">
                    <span className="text-[52px] font-extralight leading-[0.8] tracking-[-0.05em] text-ink">
                      3
                    </span>
                    <span className="pb-0.5 text-[12px] leading-tight text-ink-3">
                      ideas backed
                      <br />
                      each year
                    </span>
                    <span
                      aria-hidden
                      className="relative ml-auto mb-1 grid size-9 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/0.14)]"
                    >
                      <span className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(250_204_21/0.45),transparent)] fmd-breathe" />
                      <Lightbulb
                        className="relative size-4 text-amber-200"
                        strokeWidth={1.6}
                      />
                    </span>
                  </div>
                </div>
              </Tile>

              {/* FMD Clinic OS: the dashboard bleeding off the right, its AI manager checking in */}
              <Tile
                {...t(4)}
                className="min-h-[220px] sm:col-span-2 lg:col-span-3 lg:min-h-0"
              >
                <div className="relative flex h-full p-6">
                  <div className="relative z-10 flex max-w-[210px] flex-col">
                    <Words
                      icon={Stethoscope}
                      kicker="App · For clinics"
                      name="FMD Clinic OS"
                      line="Clinic management, end to end."
                    />
                    <div className="mt-auto h-[46px]">
                      <AnimatePresence>
                        {tick % 2 === 0 && (
                          <motion.p
                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{
                              duration: 0.45,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="flex items-center gap-2 rounded-xl border border-[rgb(var(--horizon-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.1)] px-3 py-2 text-[11.5px] leading-tight text-ink-2"
                          >
                            <Sparkles
                              className="size-3.5 shrink-0 text-[rgb(var(--horizon-rgb)/0.9)]"
                              strokeWidth={1.7}
                            />
                            AI manager: today&apos;s work is ready for your
                            approval
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 top-6 w-[380px] [mask-image:linear-gradient(90deg,#000_70%,transparent),linear-gradient(180deg,#000_75%,transparent)] [mask-composite:intersect] max-sm:hidden lg:-right-16"
                  >
                    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgb(16_26_44/0.95),rgb(7_12_22/0.97))] p-1.5">
                      <ClinicWindow />
                    </div>
                  </div>
                </div>
              </Tile>

              {/* FMD Flow: a voice note becoming a transcript */}
              <Tile {...t(5)} className="min-h-[200px] lg:min-h-0">
                <div className="flex h-full flex-col p-5">
                  <Words
                    icon={Workflow}
                    kicker="Inside Clinic OS"
                    name="FMD Flow"
                  />
                  <div aria-hidden className="mt-auto">
                    <div
                      className={`flex h-7 items-center gap-[3px] ${reduced ? "" : "bento-wave"}`}
                    >
                      {[
                        8, 16, 24, 12, 28, 18, 10, 22, 26, 14, 8, 20, 24, 12,
                      ].map((h, i) => (
                        <span
                          key={i}
                          className="w-[3px] rounded-full bg-[rgb(var(--horizon-rgb)/0.7)]"
                          style={{
                            height: h,
                            animationDelay: `${(i % 7) * 0.12}s`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {["92%", "74%", "56%"].map((w, i) => (
                        <span
                          key={w}
                          className={`block h-[5px] rounded-full bg-[rgb(var(--horizon-rgb)/0.3)] ${reduced ? "" : "bento-type"}`}
                          style={{ width: w, animationDelay: `${i * 0.35}s` }}
                        />
                      ))}
                    </div>
                    <p className="mt-2.5 text-[11px] text-ink-4">
                      Workflows · voice notes to text
                    </p>
                  </div>
                </div>
              </Tile>

              {/* FMD Edge: its three steps, lighting in turn */}
              <Tile {...t(6)} className="min-h-[200px] lg:min-h-0">
                <div className="flex h-full flex-col p-5">
                  <Words
                    icon={ConciergeBell}
                    kicker="Inside FMD ONE"
                    name="FMD Edge"
                  />
                  <ol className="relative mt-auto space-y-2">
                    <span
                      aria-hidden
                      className="absolute bottom-2 left-[5px] top-2 w-px bg-white/10"
                    />
                    {EDGE.map((s, i) => {
                      const on = i <= tick % 3;
                      return (
                        <li
                          key={s}
                          className="relative flex items-center gap-2.5 text-[12px]"
                        >
                          <span
                            className={`relative size-[11px] shrink-0 rounded-full border transition-all duration-500 ${on ? "border-transparent bg-[rgb(var(--horizon-rgb)/0.9)] shadow-[0_0_10px_rgb(147_197_253/0.8)]" : "border-line-strong bg-[var(--surface)]"}`}
                          />
                          <span
                            className={`transition-colors duration-500 ${on ? "text-ink" : "text-ink-4"}`}
                          >
                            {s}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-2.5 text-[11px] text-ink-4">
                    Your private dental concierge
                  </p>
                </div>
              </Tile>

              {/* SaveIN: the checkout, flipping to EMIs */}
              <Tile {...t(7)} className="min-h-[200px] lg:min-h-0">
                <div className="flex h-full flex-col p-5">
                  <Words
                    icon={Wallet}
                    kicker="EMI partner · soon"
                    name="SaveIN"
                  />
                  <div
                    aria-hidden
                    className="mt-auto rounded-xl border border-line-strong bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] p-1"
                  >
                    {(["Pay in full", "Pay in EMIs"] as const).map(
                      (label, i) => {
                        const on = (tick % 3 === 0 ? 0 : 1) === i;
                        return (
                          <div
                            key={label}
                            className="relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px]"
                          >
                            {on && (
                              <motion.span
                                layoutId="savein-pick"
                                className="absolute inset-0 rounded-lg border border-[rgb(var(--horizon-rgb)/0.45)] bg-[rgb(var(--accent-rgb)/0.14)]"
                                transition={{
                                  type: "spring",
                                  stiffness: 380,
                                  damping: 32,
                                }}
                              />
                            )}
                            <span
                              className={`relative grid size-3.5 place-items-center rounded-full border ${on ? "border-transparent bg-[rgb(var(--horizon-rgb)/0.9)] text-[var(--background)]" : "border-line-strong"}`}
                            >
                              {on && (
                                <Check className="size-2" strokeWidth={3.5} />
                              )}
                            </span>
                            <span
                              className={`relative ${on ? "text-ink" : "text-ink-3"}`}
                            >
                              {label}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                  <p className="mt-2.5 text-[11px] text-ink-4">
                    EMIs through partnered NBFCs
                  </p>
                </div>
              </Tile>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
