"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useTransform,
  useMotionValue,
  type MotionValue,
} from "motion/react";
import { ArrowUp, Mic, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { openAssistant } from "./Assistant";
import { MASCOT_KEYS, MASCOT_OPACITY, PHASES } from "./phases";
import { RIM, RIM_APEX, RIM_H, RIM_W, rimPath, rimYAt } from "./rim";

/**
 * Cinematic hero: one scroll timeline (0 → 1) drives every layer, so the sequence
 * scrubs identically in both directions. No timers, no per-frame React state.
 *
 * Earth geometry is measured from public/img/hero/earth-4320.webp (see ./rim.ts). The horizon light and the
 * mascot's clip both live in that image's own coordinate space, so they stay on the planet's edge at any size.
 */
const IMG_W = RIM_W;
const IMG_H = RIM_H;
const APEX = RIM_APEX[1];
const MID = RIM_APEX[0];

/** Region above the limb, as a clip-path in % of the Earth band: the mascot is only visible above the planet. */
const pct = (v: number, t: number) => `${((v / t) * 100).toFixed(2)}%`;
const MASCOT_CLIP = `polygon(-20% -500%, 120% -500%, 120% ${pct(RIM[RIM.length - 1][1], IMG_H)}, ${[...RIM]
  .reverse()
  .map(([x, y]) => `${pct(x, IMG_W)} ${pct(y, IMG_H)}`)
  .join(", ")}, -20% ${pct(RIM[0][1], IMG_H)})`;

/**
 * Stage coordinates. The nav is fixed (68px) and overlays the top of the pinned hero, so the animation lives in the
 * "stage" below it. The horizon apex sits at 27% of the stage height above the bottom; the band is as wide as
 * needed to cover the viewport and is pushed down (--eb < 0) so only the lower 27% of the stage shows planet.
 */
const NAV = 68;
const APEX_UP = (IMG_H - APEX) / IMG_W; // apex height above the band's bottom edge, in band widths
const stageVars = (height: string) =>
  ({
    "--stage": `calc(${height} - ${NAV}px)`,
    "--ew": "max(100vw, calc(var(--stage) * 1.345))",
    "--apex-up": "calc(var(--stage) * 0.27)",
    "--eb": `calc(var(--apex-up) - var(--ew) * ${APEX_UP.toFixed(4)})`,
  }) as CSSProperties;

// WebGL can't render on the server; the sprite stays visible until the model has loaded
const Mascot3D = dynamic(() => import("./Mascot3D"), { ssr: false });

const noop = () => () => {};
function useReducedMotionSafe() {
  // server snapshot = false so hydration always matches; client re-renders if reduced
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export default function Hero() {
  const reduced = useReducedMotionSafe();
  return reduced ? <StaticHero /> : <CinematicHero />;
}

/* ------------------------------------------------------------------------- */

function CinematicHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const [a0, a1] = PHASES.ai;
  const [c0, c1] = PHASES.core;

  // A - headline and centre light; both dim once the assistant takes over
  const titleOpacity = useTransform(p, PHASES.title, [1, 0]);
  const titleY = useTransform(p, PHASES.title, [0, -70]);
  // the CTAs fade with the headline; stop catching clicks once they are mostly gone
  const titlePointer = useTransform(titleOpacity, (o) => (o > 0.25 ? "auto" : "none"));
  const sky = useTransform(p, [c0, c1, a0, a1], [1, 0.45, 0.45, 0.02]);
  const earthFade = useTransform(p, [a0, a1], [1, 0.06]);
  const stageNavy = useTransform(p, [a0, a1], [0, 1]);
  const core = useTransform(p, [0, c1, PHASES.spread[1], a0, a1], [0.55, 1, 0.9, 0.9, 0.05]);
  const coreScale = useTransform(p, [0, c1], [0.8, 1.15]);

  // A→C - light travels along the rim; 0.06 = the focused starting span, 1 = full rim
  const spread = useTransform(p, PHASES.spread, [0.12, 1]);

  // C/D/E - mascot. y is % of its own height, measured up from the rim apex: positive = below the horizon.
  // Settled at -22% of --mh (≈9–10% of the stage height above the horizon); --mh is capped in globals.css so the
  // head stays below the nav at every viewport height.
  // It starts tiny and mostly behind the limb, rises out of the light while growing, then settles; it exits once.
  const mascotY = useTransform(p, MASCOT_KEYS, ["14%", "14%", "4%", "-8%", "-17%", "-22%", "-22%", "-16%", "-16%"]);
  const mScale = useTransform(p, MASCOT_KEYS, [0.14, 0.14, 0.29, 0.53, 0.75, 0.85, 0.85, 0.8, 0.8]);
  // two full turns while rising, slowing to face-on as it arrives
  const rotY = useTransform(p, MASCOT_KEYS, [-720, -720, -470, -230, -60, 0, 0, 0, 0]);
  const mOpacity = useTransform(p, MASCOT_KEYS, MASCOT_OPACITY);

  // F - the assistant fades in and stays until the pin releases, so the page flows straight into the next section
  const aiOpacity = useTransform(p, [a0, a1], [0, 1]);
  const aiY = useTransform(p, [a0, a1], [40, 0]);
  const [aiActive, setAiActive] = useState(false);
  // mascot: superman rise, then settles into meditation once it arrives; WebGL only runs while it is on screen
  const [settled, setSettled] = useState(false);
  // once its spin has finished (facing the viewer, fully risen) it speaks, until it starts to leave
  const [speaking, setSpeaking] = useState(false);
  const [mascotOn, setMascotOn] = useState(false);
  const [mascotReady, setMascotReady] = useState(false);
  const onMascotReady = useCallback(() => setMascotReady(true), []);
  useMotionValueEvent(p, "change", (v) => {
    const on = v > a0 + 0.02;
    if (on !== aiActive) setAiActive(on); // each flag flips only at its own threshold
    const s = v >= PHASES.rise[1] - 0.03;
    if (s !== settled) setSettled(s);
    const sp = v >= PHASES.rise[1] && v < PHASES.mascotOut[0];
    if (sp !== speaking) setSpeaking(sp);
    const m = v > MASCOT_KEYS[1] - 0.02 && v < PHASES.mascotOut[1] + 0.01;
    if (m !== mascotOn) setMascotOn(m);
  });

  return (
    <section
      id="top"
      ref={ref}
      aria-label="FindMyDentist introduction"
      className="relative h-[295vh] md:h-[370vh]"
    >
      <div
        className="sticky top-0 h-svh overflow-hidden"
        style={stageVars("100svh")}
      >
        {/* faint atmosphere above the planet; dims as the light gathers */}
        <motion.div aria-hidden style={{ opacity: sky }} className="hero-sky pointer-events-none absolute inset-0" />

        {/* chat stage: restrained navy that the Earth crossfades into */}
        <motion.div aria-hidden style={{ opacity: stageNavy }} className="hero-ai-stage pointer-events-none absolute inset-0" />

        <Earth spread={spread} core={core} coreScale={coreScale} fade={earthFade} />

        {/* the mascot rises from behind the limb: clipped to the measured rim, so it emerges from the planet's edge */}
        <MascotStage>
          <motion.div
            style={{ y: mascotY, scale: mScale, opacity: mOpacity }}
            className="absolute inset-x-0 bottom-0 mx-auto h-[var(--mh)] w-[var(--mh)] origin-bottom will-change-transform"
          >
            <div className="relative size-full">
              <Image
                src="/img/hero/mascot.webp"
                alt=""
                fill
                sizes="380px"
                className={`object-contain transition-opacity duration-500 ${mascotReady ? "opacity-0" : ""}`}
              />
              {/* wider than the sprite box: room for the arms */}
              <div className="absolute inset-y-0 left-1/2 w-[170%] -translate-x-1/2">
                <Mascot3D active={mascotOn} base={settled ? "Meditate" : "Fly"} rotY={rotY} onReady={onMascotReady} />
              </div>
              <SpeechBubble show={speaking} text="Let me take over…" />
            </div>
          </motion.div>
        </MascotStage>

        {/* thin rim glow in front of the mascot, so it emerges from the light rather than a hard edge */}
        <motion.div aria-hidden style={{ opacity: core }} className="hero-rimfront pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-1/2" />

        {/* A - headline */}
        <motion.div
          style={{ opacity: titleOpacity, y: titleY, pointerEvents: titlePointer }}
          className="absolute inset-x-0 top-[calc(68px+var(--stage)*0.1)] z-10 px-4 text-center"
        >
          <p className="eyebrow mx-auto max-w-[640px] text-balance leading-relaxed">The World&apos;s First Dental Ecosystem Where AI Doesn&apos;t Just Answer. It Acts.</p>
          <RotatingHeadline
            glow
            className="mx-auto mt-5 max-w-[1000px] text-[clamp(36px,min(5.6vw,8.5svh),88px)] font-light leading-[1.02] tracking-[-0.045em]"
          />
          <p aria-hidden className="mt-7 type-label tracking-[0.3em] text-ink-4">
            Scroll
          </p>
        </motion.div>

        {/* D - the assistant, its own state */}
        <motion.div
          style={{ opacity: aiOpacity, y: aiY }}
          inert={!aiActive}
          aria-hidden={!aiActive}
          className="absolute inset-x-0 top-[calc(68px+var(--stage)*0.03)] z-20 px-4"
        >
          <HeroAssistantStage />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** [silver lead, accent tail] */
const HEADLINES: [string, string][] = [
  ["Intelligence That Moves Dentistry", "Forward"],
  ["One Ecosystem. A New Era of", "Dentistry"],
  ["Connected Care and Autonomous Clinic", "Workflows."],
];
const HEADLINE_HOLD_MS = 3000;
const HEADLINE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Cycles HEADLINES with a crossfade. Every line sits in one grid cell (invisible copies reserve the tallest
 * height), so the switch never shifts the layout. `still` = reduced motion: opacity only, no drift or blur.
 */
function RotatingHeadline({ className, glow, still }: { className: string; glow?: boolean; still?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % HEADLINES.length), HEADLINE_HOLD_MS);
    return () => clearInterval(t);
  }, []);

  const line = ([lead, accent]: [string, string]) => (
    <>
      <span className="headline-silver">{lead} </span>
      <span
        className="font-normal"
        style={{ color: "var(--headline-accent)", textShadow: glow ? "0 0 40px var(--accent-glow)" : undefined }}
      >
        {accent}
      </span>
    </>
  );
  const hidden = still ? { opacity: 0 } : { opacity: 0, filter: "blur(10px)" };

  return (
    <h1 className={`grid text-balance ${className}`}>
      <span className="sr-only">{HEADLINES.map((h) => h.join(" ")).join(". ")}</span>
      {HEADLINES.map((h, n) => (
        <span key={n} aria-hidden className="invisible [grid-area:1/1]">
          {line(h)}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={i}
          aria-hidden
          className="[grid-area:1/1] self-center"
          initial={{ ...hidden, y: still ? 0 : 18 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ ...hidden, y: still ? 0 : -18 }}
          transition={{ duration: 0.46, ease: HEADLINE_EASE }}
        >
          {line(HEADLINES[i])}
        </motion.span>
      </AnimatePresence>
    </h1>
  );
}

/** The Earth band's own box (aspect = source image) with the mascot's limb-shaped clip. */
/** The mascot's line, in a bubble beside its head: typed out letter by letter, gone when it leaves. */
function SpeechBubble({ show, text }: { show: boolean; text: string }) {
  const still = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="absolute left-[74%] top-[-6%] origin-bottom-left whitespace-nowrap rounded-2xl rounded-bl-md border border-white/70 bg-white px-5 py-3 text-[17px] font-semibold tracking-[-0.01em] text-[#0b1630] shadow-[0_10px_30px_-8px_rgb(59_130_246/0.55)] sm:text-[19px]"
        >
          {[...text].map((ch, i) => (
            <motion.span
              key={i}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.045, duration: 0.05 }}
            >
              {ch}
            </motion.span>
          ))}
          {/* the tail, pointing down at the mouth */}
          <span aria-hidden className="absolute -bottom-1.5 left-2 size-3 rotate-45 border-b border-r border-white/70 bg-white" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MascotStage({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="hero-mascot-clip pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}`, clipPath: MASCOT_CLIP, bottom: "var(--eb)" }}
    >
      {/* anchor at the apex: children's bottom edge sits exactly on the brightest point of the rim */}
      <div className="absolute inset-x-0" style={{ bottom: `${(1 - APEX / IMG_H) * 100}%`, height: 0 }}>
        {children}
      </div>
    </div>
  );
}

function Earth({
  spread,
  core,
  coreScale,
  fade,
}: {
  spread: MotionValue<number>;
  core: MotionValue<number>;
  coreScale: MotionValue<number>;
  fade?: MotionValue<number>;
}) {
  // lit span (% of band width either side of centre) → soft-edged horizontal mask; it reveals the lit planet
  // and the SVG limb together, so the light spreads outward from the emergence point along the curve
  const lo = useTransform(spread, (v) => 50 - v * 50 - 18);
  const lo2 = useTransform(spread, (v) => 50 - v * 50 + 4);
  const hi2 = useTransform(spread, (v) => 50 + v * 50 - 4);
  const hi = useTransform(spread, (v) => 50 + v * 50 + 18);
  const mask = useMotionTemplate`linear-gradient(90deg, transparent ${lo}%, #000 ${lo2}%, #000 ${hi2}%, transparent ${hi}%)`;
  // the travelling glints sit on the measured rim (SVG user units = source-image px)
  const reach = useTransform(spread, (v) => v * (IMG_W / 2));
  const rx = useTransform(reach, (r) => MID + r);
  const lx = useTransform(reach, (r) => MID - r);
  const ry = useTransform(rx, (x) => rimYAt(x));
  const ly = useTransform(lx, (x) => rimYAt(x));
  const glint = useTransform(spread, [0.1, 0.16, 0.97, 1], [0, 1, 1, 0]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 w-[var(--ew)] -translate-x-1/2"
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}`, opacity: fade, bottom: "var(--eb)" }}
    >
      {/* unlit planet */}
      <Image src="/img/hero/earth-4320.webp" alt="" fill quality={92} sizes="max(100vw, 135vh)" priority className="hero-earth opacity-[0.38]" />
      {/* lit planet + horizon light, revealed outward from the centre */}
      <motion.div className="absolute inset-0" style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <Image src="/img/hero/earth-4320.webp" alt="" fill quality={92} sizes="max(100vw, 135vh)" loading="eager" className="hero-earth" />
        <motion.svg
          viewBox={`0 0 ${IMG_W} ${IMG_H}`}
          className="absolute inset-0 size-full"
          style={{ opacity: core }}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* two symmetric segments from the emergence point outward; soft halo first, restrained core last */}
          {[rimPath(MID, 0), rimPath(MID, IMG_W)].map((d, i) => (
            <g key={i}>
              <path d={d} style={{ stroke: "rgb(var(--horizon-rgb) / 0.05)" }} strokeWidth={22} />
              <path d={d} style={{ stroke: "rgb(var(--horizon-rgb) / 0.12)" }} strokeWidth={10} />
              <path d={d} style={{ stroke: "rgb(var(--horizon-rgb) / 0.85)" }} strokeWidth={2.2} />
            </g>
          ))}
        </motion.svg>
      </motion.div>
      {/* centre light source, attached to the apex */}
      <motion.div
        style={{ opacity: core, scale: coreScale, top: `${(APEX / IMG_H) * 100}%` }}
        className="hero-core absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      {/* travelling glints: SVG transforms in source px, so no layout work per frame */}
      <svg viewBox={`0 0 ${IMG_W} ${IMG_H}`} className="absolute inset-0 size-full" fill="none">
        <defs>
          <radialGradient id="rim-glint">
            <stop offset="0" stopColor="rgb(244 247 252)" stopOpacity="1" />
            <stop offset="0.45" stopColor="rgb(244 247 252)" stopOpacity="0.35" />
            <stop offset="1" stopColor="rgb(244 247 252)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.ellipse rx={64} ry={9} fill="url(#rim-glint)" style={{ x: lx, y: ly, opacity: glint }} />
        <motion.ellipse rx={64} ry={9} fill="url(#rim-glint)" style={{ x: rx, y: ry, opacity: glint }} />
      </svg>
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */

const PROMPTS = [
  "Find a dentist near me",
  "My tooth hurts with cold drinks",
  "Braces or aligners?",
  "Prepare for my appointment",
];

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
function getSpeech(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function HeroAssistantStage() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const rec = useRef<InstanceType<SpeechCtor> | null>(null);
  const voice = useSyncExternalStore(noop, () => getSpeech() !== null, () => false);

  const send = (q: string) => {
    if (!q.trim()) return;
    openAssistant(q.trim());
    setText("");
  };

  const toggleVoice = () => {
    const Ctor = getSpeech();
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = document.documentElement.lang || "en-IN";
    r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results, (res) => res[0].transcript).join(" "));
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="relative mx-auto flex max-w-[680px] flex-col items-center text-center">
      <span className="icon-tile size-12">
        {/* tooth from the brand logo, used as a mask so it takes the tile's text colour like the icon it replaced */}
        <span aria-hidden className="size-6 bg-current [mask:url(/img/hero/tooth-mask.png)_center/contain_no-repeat]" />
      </span>
      <p className="eyebrow mt-6" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6)" }}>FMD AI</p>
      <h2
        className="mt-4 text-[clamp(28px,4.2vw,48px)] font-light leading-[1.08] tracking-[-0.035em] text-ink"
        style={{ textShadow: "0 2px 20px rgba(0,0,0,0.95), 0 0 60px rgba(0,0,0,0.7)" }}
      >
        Hi, I&apos;m FMD AI.
        <br />
        <span className="text-ink-2">How can I help with your dental care?</span>
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="glass mt-8 flex w-full items-center gap-2 rounded-full border border-line-strong p-1.5 pl-5 shadow-[inset_0_1px_0_var(--inner-hi),0_8px_32px_-8px_rgba(0,0,0,0.55)] focus-within:border-[rgba(255,255,255,0.22)] focus-within:shadow-[inset_0_1px_0_var(--inner-hi),0_0_0_1px_rgb(var(--accent-rgb)/0.18),0_0_60px_-10px_var(--accent-glow)]"
      >
        <label htmlFor="hero-ai" className="sr-only">
          Ask FMD AI
        </label>
        <input
          id="hero-ai"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hi! I’m almost ready. FMD AI is coming soon…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 sm:h-12"
        />
        {voice && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Speak your question"}
            className={`grid size-11 shrink-0 place-items-center rounded-full border transition-colors sm:size-12 ${
              listening ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            <Mic className="size-[18px]" strokeWidth={1.5} />
            {listening && <span className="sr-only">Listening</span>}
          </button>
        )}
        <button type="submit" aria-label="Send" disabled={!text.trim()} className="btn-primary size-11 shrink-0 disabled:opacity-50 sm:size-12">
          <ArrowUp className="size-[18px]" strokeWidth={1.75} />
        </button>
      </form>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            className="glass glass-interactive rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)] transition-colors hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>

      <p
        className="mt-6 flex max-w-[520px] items-start gap-2 text-left text-[12.5px] leading-snug text-ink-3"
        style={{ textShadow: "0 1px 10px rgba(0,0,0,0.9)" }}
      >
        <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
        Guidance, not diagnosis. FMD AI explains and suggests; it never books, contacts clinics or pays on your behalf.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** Reduced motion: the same story as a still composition, no pinning. */
function StaticHero() {
  const full = useMotionValue(1);
  return (
    <section id="top" aria-label="FindMyDentist introduction" className="relative">
      <div className="relative h-svh min-h-[620px] overflow-hidden" style={stageVars("max(100svh, 620px)")}>
        <div aria-hidden className="hero-sky absolute inset-0 opacity-60" />
        <Earth spread={full} core={full} coreScale={full} />
        <MascotStage>
          <div className="absolute inset-x-0 bottom-0 mx-auto [--mh:clamp(150px,26svh,260px)] h-[var(--mh)] w-[var(--mh)] -translate-y-[8%]">
            <Image src="/img/hero/mascot.webp" alt="" fill sizes="380px" priority className="object-contain" />
          </div>
        </MascotStage>
        <div aria-hidden className="hero-rimfront absolute left-1/2 -translate-x-1/2 translate-y-1/2" />
        <div className="absolute inset-x-0 top-[calc(68px+var(--stage)*0.06)] z-10 px-4 text-center">
          <p className="eyebrow mx-auto max-w-[640px] text-balance leading-relaxed">The World&apos;s First Dental Ecosystem Where AI Doesn&apos;t Just Answer. It Acts.</p>
          <RotatingHeadline
            still
            className="mx-auto mt-4 max-w-[1000px] text-[clamp(30px,min(5vw,7.5svh),72px)] font-light leading-[1.02] tracking-[-0.045em]"
          />
        </div>
      </div>
      <div className="py-16">
        <HeroAssistantStage />
      </div>
    </section>
  );
}
