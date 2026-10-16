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
import { ArrowRight, ArrowUp, Mic, ShieldCheck, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { api } from "@/lib/me";
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
// what it shouts while spinning up: [word, sideways drift (px) as it floats off]; one word every SHOUT_GAP seconds
const SHOUT: [string, number][] = [["Woo!", -70], ["Whoo!", 75], ["Woohoo!", -20]];
const SHOUT_GAP = 0.6;

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
  // the dentist search (section 02) is its own component now: sections/Search.tsx
  return reduced ? <StaticHero /> : <CinematicHero />;
}

/* ------------------------------------------------------------------------- */

function CinematicHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const [a0, a1] = PHASES.ai;
  const [c0, c1] = PHASES.core;

  // A — headline and centre light; both dim once the assistant takes over
  const titleOpacity = useTransform(p, PHASES.title, [1, 0]);
  const titleY = useTransform(p, PHASES.title, [0, -70]);
  // the CTAs fade with the headline; stop catching clicks once they are mostly gone
  const titlePointer = useTransform(titleOpacity, (o) => (o > 0.25 ? "auto" : "none"));
  const sky = useTransform(p, [c0, c1, a0, a1], [1, 0.45, 0.45, 0.02]);
  const earthFade = useTransform(p, [a0, a1], [1, 0.06]);
  const stageNavy = useTransform(p, [a0, a1], [0, 1]);
  const core = useTransform(p, [0, c1, PHASES.spread[1], a0, a1], [0.55, 1, 0.9, 0.9, 0.05]);
  const coreScale = useTransform(p, [0, c1], [0.8, 1.15]);

  // A→C — light travels along the rim; 0.06 = the focused starting span, 1 = full rim
  const spread = useTransform(p, PHASES.spread, [0.12, 1]);

  // C/D/E — mascot. y is % of its own height, measured up from the rim apex: positive = below the horizon.
  // Settled at -22% of --mh (≈9–10% of the stage height above the horizon); --mh is capped in globals.css so the
  // head stays below the nav at every viewport height.
  // It starts tiny and mostly behind the limb, rises out of the light while growing, then settles; it exits once.
  const mascotY = useTransform(p, MASCOT_KEYS, ["14%", "14%", "4%", "-8%", "-17%", "-22%", "-22%", "-16%", "-16%"]);
  const mScale = useTransform(p, MASCOT_KEYS, [0.14, 0.14, 0.29, 0.53, 0.75, 0.85, 0.85, 0.8, 0.8]);
  // two full turns while rising, slowing to face-on as it arrives
  const rotY = useTransform(p, MASCOT_KEYS, [-720, -720, -470, -230, -60, 0, 0, 0, 0]);
  const mOpacity = useTransform(p, MASCOT_KEYS, MASCOT_OPACITY);
  // C — a "woohoo" shout while it spins up out of the light; counter-scaled so it stays readable while the mascot is tiny
  const [r0, r1] = PHASES.rise;
  const shoutOpacity = useTransform(p, [r0 + 0.015, r0 + 0.035, r1 - 0.035, r1 - 0.01], [0, 1, 1, 0]);
  const shoutScale = useTransform(mScale, (s) => Math.min(0.9 / s, 3));
  // D — its line, popped in once it has settled in the middle
  const [s0, s1] = PHASES.say;
  const sayOpacity = useTransform(p, [s0, s0 + 0.025, s1 - 0.025, s1], [0, 1, 1, 0]);
  const sayScale = useTransform(p, [s0, s0 + 0.025], [0.6, 1]);

  // F — the assistant fades in and stays until the pin releases, so the page flows straight into the next section
  const aiOpacity = useTransform(p, [a0, a1], [0, 1]);
  const aiY = useTransform(p, [a0, a1], [40, 0]);
  const [aiActive, setAiActive] = useState(false);
  // mascot: superman rise, then settles into meditation once it arrives; WebGL only runs while it is on screen
  const [settled, setSettled] = useState(false);
  const [mascotOn, setMascotOn] = useState(false);
  const [mascotReady, setMascotReady] = useState(false);
  const mouthAnchor = useRef<HTMLDivElement>(null);
  const onMouth = useCallback((left: number, top: number, facing: number) => {
    const el = mouthAnchor.current;
    if (!el) return;
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
    el.style.opacity = String(facing);
  }, []);
  const onMascotReady = useCallback(() => setMascotReady(true), []);
  useMotionValueEvent(p, "change", (v) => {
    const on = v > a0 + 0.02;
    if (on !== aiActive) setAiActive(on); // each flag flips only at its own threshold
    const s = v >= PHASES.rise[1] - 0.03;
    if (s !== settled) setSettled(s);
    const m = v > MASCOT_KEYS[1] - 0.02 && v < PHASES.mascotOut[1] + 0.01;
    if (m !== mascotOn) setMascotOn(m);
  });

  return (
    <section
      id="top"
      ref={ref}
      aria-label="FindMyDentist introduction"
      className="relative h-[330vh] bg-black md:h-[420vh]"
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
              {/* thought bubble above-left of the head, trailing dots pointing at it; inside the scaled box so it rides
                  along with the mascot */}
              <motion.div
                style={{ opacity: sayOpacity, scale: sayScale }}
                className="absolute -left-[42%] -top-[16%] z-10 origin-bottom-right"
              >
                <p className="whitespace-nowrap rounded-[999px] bg-white px-[1.3em] py-[0.8em] text-[clamp(13px,2.1svh,20px)] font-bold text-slate-900 shadow-[0_0_0_3px_rgba(255,255,255,0.25),0_10px_40px_rgba(120,160,255,0.45)]">
                  I will take over!
                </p>
                <span className="absolute -bottom-[0.9em] right-[0.6em] size-[0.95em] rounded-full bg-white text-[clamp(13px,2.1svh,20px)]" />
                <span className="absolute -bottom-[1.8em] -right-[0.1em] size-[0.55em] rounded-full bg-white text-[clamp(13px,2.1svh,20px)]" />
              </motion.div>
              {/* wider than the sprite box: room for the waving / pointing arms */}
              <div className="absolute inset-y-0 left-1/2 w-[170%] -translate-x-1/2">
                <Mascot3D active={mascotOn} base={settled ? "Meditate" : "Fly"} rotY={rotY} onReady={onMascotReady} onMouth={onMouth} />
                {/* the shout: words pop out of its mouth one after another and float off; the anchor is moved onto the
                    mouth every frame by Mascot3D and hidden while the mascot faces away */}
                <div ref={mouthAnchor} aria-hidden className="pointer-events-none absolute z-10 size-0">
                  <motion.div style={{ opacity: shoutOpacity, scale: shoutScale }} className="size-0">
                {SHOUT.map(([word, dx], i) => (
                      <motion.span
                        key={word}
                        className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[clamp(16px,2.6svh,26px)] font-black italic tracking-wide text-white [text-shadow:0_0_18px_rgba(120,170,255,0.9),0_2px_0_#1d4ed8]"
                        initial={{ opacity: 0, scale: 0.15 }}
                        animate={{
                          opacity: [0, 1, 1, 0],
                          scale: [0.15, 1.15, 1, 1.1],
                          x: [0, 0, dx * 0.35, dx],
                          y: [0, -8, -40, -120],
                          rotate: [0, 0, -4, 4],
                        }}
                        transition={{
                          duration: SHOUT.length * SHOUT_GAP,
                          times: [0, 0.14, 0.3, 1],
                          ease: "easeOut",
                          repeat: Infinity,
                          delay: i * SHOUT_GAP,
                        }}
                      >
                        {word}
                      </motion.span>
                    ))}
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </MascotStage>

        {/* thin rim glow in front of the mascot, so it emerges from the light rather than a hard edge */}
        <motion.div aria-hidden style={{ opacity: core }} className="hero-rimfront pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-1/2" />

        {/* A — headline */}
        <motion.div
          style={{ opacity: titleOpacity, y: titleY, pointerEvents: titlePointer }}
          className="absolute inset-x-0 top-[calc(68px+var(--stage)*0.1)] z-10 px-4 text-center"
        >
          <p className="eyebrow">Redefining Dental Intelligence</p>
          <h1 className="mx-auto mt-5 max-w-[900px] text-[clamp(40px,min(7vw,10.5svh),104px)] font-light leading-[0.98] tracking-[-0.045em]">
            <span className="headline-silver">Dentistry,</span>
            <br />
            <span className="headline-silver">Reimagined </span>
            <span className="font-normal" style={{ color: "var(--headline-accent)", textShadow: "0 0 40px var(--accent-glow)" }}>
              with AI.
            </span>
          </h1>
          <HeroCtas />
        </motion.div>

        {/* D — the assistant, its own state */}
        <motion.div
          style={{ opacity: aiOpacity, y: aiY }}
          inert={!aiActive}
          aria-hidden={!aiActive}
          className="absolute inset-x-0 top-[calc(68px+var(--stage)*0.03)] z-20 px-4"
        >
          <HeroAssistantStage active={aiActive} />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** The Earth band's own box (aspect = source image) with the mascot's limb-shaped clip. */
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

type ChatReply = { urgent: boolean; reply: { text: string } };
type ChatMsg = { role: "user" | "assistant"; text: string; urgent?: boolean };
const ANSWER_MS = 5000; // every reply takes this long, so the mascot gets its moment to think
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The hero's search: answers appear above the bar (replacing the greeting) and the mascot beside the bar acts it
 * out — waves when the section comes into view, meditates while nothing happens, opens its eyes and smiles while
 * you type, thinks (hand at chin) while the answer is on its way, then talks and presents with its hand while the
 * answer types out letter by letter.
 */
function HeroAssistantStage({ active = true, still = false }: { active?: boolean; still?: boolean }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "answering" | "done">("idle");
  // the conversation, WhatsApp-style: the newest assistant message types out while phase === "answering"
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [shown, setShown] = useState(0);
  const [offer, setOffer] = useState(false); // "Need more help..?", 2 s after an answer finishes
  const ask = useRef(0); // id of the latest question; closing the chat or asking again drops older replies
  const list = useRef<HTMLDivElement>(null);
  const rec = useRef<InstanceType<SpeechCtor> | null>(null);
  const voice = useSyncExternalStore(noop, () => getSpeech() !== null, () => false);
  const last = msgs[msgs.length - 1];

  // wave each time the section comes into view (a fresh object each time `active` turns true replays it)
  const wave = useMemo(() => (active ? { name: "Wave", id: 1 } : null), [active]);

  // type the newest answer out letter by letter (long answers speed up so it never drags past ~6 s)
  useEffect(() => {
    if (phase !== "answering" || last?.role !== "assistant") return;
    const len = last.text.length;
    const step = Math.max(1, Math.ceil(len / 240));
    const t = setInterval(() => {
      setShown((n) => {
        const next = Math.min(len, n + step);
        if (next >= len) setPhase("done");
        return next;
      });
    }, 25);
    return () => clearInterval(t);
  }, [phase, last]);

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setOffer(true), 2000);
    return () => clearTimeout(t);
  }, [phase]);

  // keep the newest message in view
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs, shown, phase]);

  const close = () => {
    ask.current++;
    setPhase("idle");
    setMsgs([]);
    setShown(0);
    setOffer(false);
  };

  const send = async (q: string) => {
    const message = q.trim();
    if (!message || phase === "thinking" || phase === "answering") return;
    const id = ++ask.current;
    const history = msgs.slice(-10).map(({ role, text }) => ({ role, text }));
    setText("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setShown(0);
    setOffer(false);
    setPhase("thinking");
    const wait = sleep(ANSWER_MS);
    let reply: ChatMsg = { role: "assistant", text: "Sorry, I couldn't reach FMD AI just now. Please try again in a moment." };
    try {
      const r = await api<ChatReply>("/api/assistant", { method: "POST", body: { message, conversationId: null, history } });
      reply = { role: "assistant", text: r.reply.text, urgent: r.urgent };
    } catch {
      // keep the apology; the wait below still applies
    }
    await wait;
    if (id !== ask.current) return; // closed or replaced meanwhile
    setMsgs((m) => [...m, reply]);
    setPhase("answering");
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

  const mood =
    phase === "thinking" ? "Think" : phase === "answering" ? "Explain" : offer || focused || text || listening ? "Idle" : "Meditate";
  const hasAnswer = msgs.length > 0;

  return (
    // chat mode: the chat box fills the screen down to the bar (bar, suggestions and note stay at the bottom)
    <div
      className={`relative mx-auto flex max-w-[760px] flex-col items-center text-center ${
        hasAnswer ? "h-[calc(var(--stage)*0.97-24px)]" : ""
      }`}
    >
      {hasAnswer ? (
        <motion.div
          layout
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 170, damping: 24 }}
          className="glass relative flex min-h-0 w-full flex-1 flex-col rounded-3xl border border-line-strong text-left shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12.5px] text-ink-3">
            <Sparkles className="size-3.5 shrink-0" strokeWidth={1.5} />
            FMD AI
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="ml-auto grid size-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/10 hover:text-ink"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          {/* WhatsApp-style: your questions on the right, FMD AI's replies on the left */}
          <div ref={list} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            {msgs.map((msg, i) => {
              const typing = phase === "answering" && i === msgs.length - 1;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  className={`max-w-[85%] whitespace-pre-line px-3.5 py-2 text-[14.5px] leading-relaxed shadow-[0_4px_14px_-6px_rgba(0,0,0,0.6)] ${
                    msg.role === "user"
                      ? "self-end rounded-2xl rounded-br-md bg-[#2f6bff] text-white"
                      : "self-start rounded-2xl rounded-bl-md border border-line bg-white/10 text-ink"
                  }`}
                >
                  {msg.urgent && <p className="mb-1 text-[12.5px] font-medium text-[#ffb4a8]">This may need prompt care — please contact a dentist soon.</p>}
                  {typing ? msg.text.slice(0, shown) : msg.text}
                  {typing && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-ink" />}
                  {msg.role === "assistant" && phase === "done" && i === msgs.length - 1 && (
                    <button
                      type="button"
                      onClick={() => openAssistant(msgs[i - 1]?.text)}
                      className="mt-1.5 block text-[12.5px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                    >
                      Continue in chat →
                    </button>
                  )}
                </motion.div>
              );
            })}
            {phase === "thinking" && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                aria-label="FMD AI is thinking"
                className="flex gap-1 self-start rounded-2xl rounded-bl-md border border-line bg-white/10 px-3.5 py-3"
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-ink-2"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      ) : (
        <>
          <span className="icon-tile size-12">
            <Sparkles className="size-5" strokeWidth={1.3} />
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
        </>
      )}

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 170, damping: 24 }}
        className={`flex w-full items-end gap-2 sm:gap-4 ${hasAnswer ? "mt-4" : "mt-8"}`}
      >
        {!still && (
          // the mascot beside the bar; its canvas is wider than the box so the presenting arm has room
          <div className="relative h-[64px] w-[48px] shrink-0 sm:h-[84px] sm:w-[64px]">
            <div aria-hidden className="absolute inset-y-0 left-1/2 w-[170%] -translate-x-1/2">
              <Mascot3D active={active} base={mood} gesture={wave} />
            </div>
            {/* beside its head: thinking dots while it works, then an offer of more help after every answer */}
            {phase === "thinking" && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-3 left-[78%] flex origin-bottom-left items-center gap-1 rounded-full bg-white px-2.5 py-2 shadow-[0_6px_24px_rgba(120,160,255,0.35)]"
              >
                {[0, 1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-slate-700"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            )}
            {offer && phase === "done" && !text && (
              <motion.p
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="absolute -top-4 left-[78%] origin-bottom-left whitespace-nowrap rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-900 shadow-[0_6px_24px_rgba(120,160,255,0.35)]"
              >
                Need more help..?
              </motion.p>
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="glass flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line-strong p-1.5 pl-5 shadow-[inset_0_1px_0_var(--inner-hi),0_8px_32px_-8px_rgba(0,0,0,0.55)] focus-within:border-[rgba(255,255,255,0.22)] focus-within:shadow-[inset_0_1px_0_var(--inner-hi),0_0_0_1px_rgb(var(--accent-rgb)/0.18),0_0_60px_-10px_var(--accent-glow)]"
        >
          <label htmlFor="hero-ai" className="sr-only">
            Ask FMD AI
          </label>
          <input
            id="hero-ai"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Describe a symptom or ask a question…"
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
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || phase === "thinking" || phase === "answering"}
            className="btn-primary size-11 shrink-0 disabled:opacity-50 sm:size-12"
          >
            <ArrowUp className="size-[18px]" strokeWidth={1.75} />
          </button>
        </form>
      </motion.div>

      <div className={`flex flex-wrap justify-center gap-2 ${hasAnswer ? "mt-3" : "mt-5"}`}>
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

      <motion.p
        layout="position"
        transition={{ type: "spring", stiffness: 170, damping: 24 }}
        className={`flex max-w-[520px] items-start gap-2 text-left text-[12.5px] leading-snug text-ink-3 ${hasAnswer ? "mt-3" : "mt-6"}`}
        style={{ textShadow: "0 1px 10px rgba(0,0,0,0.9)" }}
      >
        <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
        Guidance, not diagnosis. FMD AI explains and suggests; it never books, contacts clinics or pays on your behalf.
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** Reduced motion: the same story as a still composition, no pinning. */
/** PDF §1: a short introduction to FMD's vision and the two hero calls to action. */
function HeroCtas() {
  return (
    <>
      <p className="mx-auto mt-6 max-w-[560px] text-[clamp(15px,1.15vw,17.5px)] leading-relaxed text-ink-2 [text-shadow:0_1px_14px_rgba(0,0,0,0.9)]">
        An AI-first dental technology ecosystem connecting patients, dentists and dental clinics — for clearer care and smarter clinics.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <a href="#ecosystem" className="btn-primary group h-12 px-6 text-[14px]">
          Explore FMD <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
        </a>
        <a href="#clinic-os" className="btn-ghost h-12 px-6 text-[14px] backdrop-blur-md">
          For Dental Clinics
        </a>
      </div>
    </>
  );
}

function StaticHero() {
  const full = useMotionValue(1);
  return (
    <section id="top" aria-label="FindMyDentist introduction" className="relative bg-black">
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
          <p className="eyebrow">Redefining Dental Intelligence</p>
          <h1 className="mx-auto mt-4 text-[clamp(34px,min(6vw,8.5svh),84px)] font-light leading-[0.98] tracking-[-0.045em]">
            <span className="headline-silver">Dentistry,</span>
            <br />
            <span className="headline-silver">Reimagined </span>
            <span className="font-normal" style={{ color: "var(--headline-accent)" }}>
              with AI.
            </span>
          </h1>
          <HeroCtas />
        </div>
      </div>
      <div className="py-16">
        <HeroAssistantStage still />
      </div>
    </section>
  );
}
