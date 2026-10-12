"use client";

import Image from "next/image";
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useTransform,
  useMotionValue,
  type MotionValue,
} from "motion/react";
import { ArrowUp, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Container } from "../ui";
import { openAssistant } from "./Assistant";
import { MASCOT_KEYS, MASCOT_OPACITY, PHASES, REVEAL } from "./phases";
import SearchBar from "./SearchBar";

/**
 * Cinematic hero: one scroll timeline (0 → 1) drives every layer, so the sequence
 * scrubs identically in both directions. No timers, no per-frame React state.
 *
 * Earth geometry comes from the supplied reference (public/img/hero/earth.webp, 1280×172 crop):
 * the rim is a circle arc, apex 27px below the crop top, y = 27 + 0.0002·dx² (image px).
 */
const IMG_W = 1280;
const IMG_H = 172;
const APEX = 27;
const CURVE = 0.0002;

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
  return (
    <>
      {reduced ? <StaticHero /> : <CinematicHero />}
      <section aria-label="Search dentists" className="relative z-10">
        <Container className="pb-16 pt-10 sm:pb-20 sm:pt-14">
          <SearchBar />
        </Container>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------------- */

function CinematicHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // A — headline and centre light
  const titleOpacity = useTransform(p, PHASES.title, [1, 0]);
  const titleY = useTransform(p, PHASES.title, [0, -70]);
  const cueOpacity = useTransform(p, [0, 0.03], [1, 0]);
  const sky = useTransform(p, PHASES.core, [1, 0.45]);
  const core = useTransform(p, [0, PHASES.core[1], PHASES.spread[1]], [0.55, 1, 0.9]);
  const coreScale = useTransform(p, [0, PHASES.core[1]], [0.8, 1.15]);

  // A→B — light travels; 0.06 = the focused starting span, 1 = full rim
  const spread = useTransform(p, PHASES.spread, [0.06, 1]);

  // C/D/E — mascot. y is % of its own height: 106% = hidden below the horizon line.
  const [m0, m1] = PHASES.mascotOut;
  const [b0, b1] = PHASES.mascotBack;
  const mascotY = useTransform(p, MASCOT_KEYS, ["106%", "106%", "-25%", "-21%", "-21%", "-23%", "-23%", "-21%", "106%", "106%"]);
  const rotY = useTransform(p, MASCOT_KEYS, [-38, -38, 0, 0, 0, 0, 0, 0, -38, -38]);
  const rotX = useTransform(p, MASCOT_KEYS, [12, 12, 0, 0, 0, 0, 0, 0, 12, 12]);
  const mScale = useTransform(p, MASCOT_KEYS, [0.9, 0.9, 1, 1, 1, 0.94, 0.94, 1, 0.9, 0.9]);
  const mOpacity = useTransform(p, MASCOT_KEYS, MASCOT_OPACITY);
  const mascotGlow = useTransform(p, [REVEAL, PHASES.rise, m0, m1, b0, b1, PHASES.descend], [0, 1, 1, 0, 0, 1, 0]);

  // D — assistant stage (never overlaps the mascot: mascot is 0 between m1 and b0)
  const [a0, a1, a2, a3] = PHASES.ai;
  const aiOpacity = useTransform(p, [a0, a1, a2, a3], [0, 1, 1, 0]);
  const aiY = useTransform(p, [a0, a1, a2, a3], [40, 0, 0, -30]);
  const [aiActive, setAiActive] = useState(false);
  useMotionValueEvent(p, "change", (v) => {
    const on = v > a0 + 0.02 && v < a3 - 0.01;
    if (on !== aiActive) setAiActive(on); // flips only at the two thresholds
  });

  return (
    <section
      id="top"
      ref={ref}
      aria-label="FindMyDentist introduction"
      className="relative h-[340vh] md:h-[520vh]"
    >
      <div
        className="sticky top-0 h-svh overflow-hidden"
        style={{ "--ew": "max(100vw, 1100px)" } as CSSProperties}
      >
        {/* faint atmosphere above the planet; dims as the light gathers */}
        <motion.div aria-hidden style={{ opacity: sky }} className="hero-sky pointer-events-none absolute inset-0" />

        <Earth spread={spread} core={core} coreScale={coreScale} />

        {/* the mascot rises from behind the horizon: the clip box ends exactly on the rim apex */}
        <div aria-hidden className="hero-mascot-clip pointer-events-none absolute left-1/2 -translate-x-1/2">
          <motion.div
            style={{ y: mascotY, rotateY: rotY, rotateX: rotX, scale: mScale, opacity: mOpacity }}
            className="absolute inset-x-0 bottom-0 mx-auto h-[var(--mh)] w-[calc(var(--mh)*0.9375)] origin-bottom will-change-transform"
          >
            <motion.div style={{ opacity: mascotGlow }} className="hero-mascot-halo absolute inset-[-20%]" />
            <div className="hero-float relative size-full">
              <Image
                src="/img/hero/mascot.webp"
                alt=""
                fill
                sizes="380px"
                className="hero-mascot-img object-contain"
              />
            </div>
          </motion.div>
        </div>

        {/* thin rim glow in front of the mascot, so it emerges from the light rather than a hard edge */}
        <motion.div aria-hidden style={{ opacity: core }} className="hero-rimfront pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-1/2" />

        {/* A — headline */}
        <motion.div
          style={{ opacity: titleOpacity, y: titleY }}
          className="absolute inset-x-0 top-[17svh] z-10 px-4 text-center sm:top-[19svh]"
        >
          <p className="eyebrow">AI-Powered Dental Care</p>
          <h1 className="mx-auto mt-5 max-w-[900px] text-[clamp(44px,7vw,104px)] font-extralight leading-[0.98] tracking-[-0.045em]">
            <span className="headline-silver">Better Oral Health</span>
            <br />
            <span className="headline-silver">Starts </span>
            <span className="font-normal" style={{ color: "var(--headline-accent)", textShadow: "0 0 40px var(--accent-glow)" }}>
              Here.
            </span>
          </h1>
        </motion.div>

        <motion.p
          aria-hidden
          style={{ opacity: cueOpacity }}
          className="absolute inset-x-0 bottom-[calc(var(--ew)*0.134+20px)] z-10 text-center text-[11px] uppercase tracking-[0.4em] text-ink-4"
        >
          Scroll
        </motion.p>

        {/* D — the assistant, its own state */}
        <motion.div
          style={{ opacity: aiOpacity, y: aiY }}
          inert={!aiActive}
          aria-hidden={!aiActive}
          className="absolute inset-x-0 top-[12svh] z-20 px-4 sm:top-[14svh]"
        >
          <HeroAssistantStage />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function Earth({
  spread,
  core,
  coreScale,
}: {
  spread: MotionValue<number>;
  core: MotionValue<number>;
  coreScale: MotionValue<number>;
}) {
  // lit span (% of band width either side of centre) → soft-edged horizontal mask
  const lo = useTransform(spread, (v) => 50 - v * 50 - 6);
  const lo2 = useTransform(spread, (v) => 50 - v * 50 + 2);
  const hi2 = useTransform(spread, (v) => 50 + v * 50 - 2);
  const hi = useTransform(spread, (v) => 50 + v * 50 + 6);
  const mask = useMotionTemplate`linear-gradient(90deg, transparent ${lo}%, #000 ${lo2}%, #000 ${hi2}%, transparent ${hi}%)`;
  // travelling glints ride the measured rim curve
  const side = useTransform(spread, (v) => `${50 - v * 50}%`);
  const top = useTransform(spread, (v) => `${rimY(v)}%`);
  const glint = useTransform(spread, [0.1, 0.16, 0.97, 1], [0, 1, 1, 0]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-1/2 w-[var(--ew)] -translate-x-1/2"
      style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}
    >
      {/* unlit planet */}
      <Image src="/img/hero/earth.webp" alt="" fill sizes="(max-width: 1100px) 1100px, 100vw" priority className="hero-earth opacity-[0.38]" />
      {/* lit planet, revealed outward from the centre */}
      <motion.div className="absolute inset-0" style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <Image src="/img/hero/earth.webp" alt="" fill sizes="(max-width: 1100px) 1100px, 100vw" loading="eager" className="hero-earth" />
      </motion.div>
      {/* centre light source, attached to the apex */}
      <motion.div
        style={{ opacity: core, scale: coreScale, top: `${(APEX / IMG_H) * 100}%` }}
        className="hero-core absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <motion.span style={{ left: side, top, opacity: glint }} className="hero-glint absolute -translate-x-1/2 -translate-y-1/2" />
      <motion.span style={{ right: side, top, opacity: glint }} className="hero-glint absolute translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

/** Rim height (% of band height) at a spread fraction 0..1 from the centre. */
function rimY(f: number) {
  const dx = f * (IMG_W / 2);
  return ((APEX + CURVE * dx * dx) / IMG_H) * 100;
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
    <div className="mx-auto flex max-w-[680px] flex-col items-center text-center">
      <span className="icon-tile size-12">
        <Sparkles className="size-5" strokeWidth={1.3} />
      </span>
      <p className="eyebrow mt-6">FMD AI</p>
      <h2 className="mt-4 text-[clamp(28px,4.2vw,48px)] font-extralight leading-[1.08] tracking-[-0.035em] text-ink">
        Hi, I&apos;m FMD AI.
        <br />
        <span className="text-ink-3">How can I help with your dental care?</span>
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="glass mt-8 flex w-full items-center gap-2 rounded-full p-1.5 pl-5 focus-within:shadow-[inset_0_1px_0_var(--inner-hi),0_0_0_1px_rgb(var(--accent-rgb)/0.18),0_0_60px_-10px_var(--accent-glow)]"
      >
        <label htmlFor="hero-ai" className="sr-only">
          Ask FMD AI
        </label>
        <input
          id="hero-ai"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe a symptom or ask a question…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-4 sm:h-12"
        />
        {voice && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Speak your question"}
            className={`grid size-11 shrink-0 place-items-center rounded-full border transition-colors sm:size-12 ${
              listening ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-transparent text-ink-3 hover:text-ink"
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
          <button key={q} type="button" onClick={() => send(q)} className="glass glass-interactive rounded-full px-4 py-2 text-[13px] text-ink-2">
            {q}
          </button>
        ))}
      </div>

      <p className="mt-6 flex max-w-[520px] items-start gap-2 text-left text-[12px] leading-snug text-ink-4">
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
      <div className="relative h-svh min-h-[620px] overflow-hidden" style={{ "--ew": "max(100vw, 1100px)" } as CSSProperties}>
        <div aria-hidden className="hero-sky absolute inset-0 opacity-60" />
        <Earth spread={full} core={full} coreScale={full} />
        <div aria-hidden className="hero-mascot-clip pointer-events-none absolute left-1/2 -translate-x-1/2">
          <div className="absolute inset-x-0 bottom-0 mx-auto h-[var(--mh)] w-[calc(var(--mh)*0.9375)] -translate-y-[21%]">
            <div className="hero-mascot-halo absolute inset-[-20%]" />
            <Image src="/img/hero/mascot.webp" alt="" fill sizes="380px" priority className="hero-mascot-img object-contain" />
          </div>
        </div>
        <div aria-hidden className="hero-rimfront absolute left-1/2 -translate-x-1/2 translate-y-1/2" />
        <div className="absolute inset-x-0 top-[12svh] z-10 px-4 text-center">
          <p className="eyebrow">AI-Powered Dental Care</p>
          <h1 className="mx-auto mt-4 text-[clamp(40px,6vw,84px)] font-extralight leading-[0.98] tracking-[-0.045em]">
            <span className="headline-silver">Better Oral Health</span>
            <br />
            <span className="headline-silver">Starts </span>
            <span className="font-normal" style={{ color: "var(--headline-accent)" }}>
              Here.
            </span>
          </h1>
        </div>
      </div>
      <div className="py-16">
        <HeroAssistantStage />
      </div>
    </section>
  );
}
