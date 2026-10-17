"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, EyeOff, History, LockKeyhole, Pause, Play, Scale, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Container, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

const STEPS = [
  {
    icon: ShieldCheck,
    title: "AI Guardrails",
    line: "Information, not diagnosis",
    eyebrow: "AI safety protocols",
    heading: "Strict clinical boundaries for FMD AI.",
    body: "Our AI is engineered with hardcoded guardrails. It provides plain-language education and next steps, but it never diagnoses, prescribes, or replaces a verified dentist.",
    cta: "Read AI Disclaimer",
    href: "/help",
    img: "/img/mascots/mascot-trust-1024.webp",
  },
  {
    icon: BadgeCheck,
    title: "Verification",
    line: "Primary-source checks",
    eyebrow: "Doctor authentication",
    heading: "Primary-source credential verification.",
    body: "Every dentist on FMD undergoes rigorous manual and technical checks. We verify state dental council registrations and clinical qualifications before issuing the Verified badge.",
    cta: "How Verification Works",
    href: "/help",
    img: "/img/mascots/mascot-scholar-1024.webp",
  },
  {
    icon: Scale,
    title: "Fair Ranking",
    line: "Algorithmic transparency",
    eyebrow: "Search integrity",
    heading: "Algorithmic transparency in search.",
    body: "Our ranking algorithm prioritizes verified status, clinical rating, distance, and live availability. Sponsored placements are strictly capped and explicitly labeled. You cannot buy organic rank.",
    cta: "View Search Policy",
    href: "#dentists",
    img: "/img/mascots/mascot-guide-1024.webp",
  },
  {
    icon: LockKeyhole,
    title: "Zero-Trust",
    line: "Encrypted private vault",
    eyebrow: "Data architecture",
    heading: "Zero-trust architecture for patient data.",
    body: "Your Private Vault uses explicit, revokable sharing. You grant temporary, encrypted access to a specific verified dentist for a specific timeframe. You retain ultimate control.",
    cta: "Explore Private Vault",
    href: "#records",
    img: "/img/mascots/mascot-vault-1024.webp",
  },
  {
    icon: History,
    title: "Audit Trails",
    line: "Visible access history",
    eyebrow: "System transparency",
    heading: "Patient-visible cryptographic audit trails.",
    body: "Transparency isn't just a policy; it's a feature. Your account includes a real-time history showing exactly who accessed your reports, X-rays, or prescriptions, and precisely when.",
    cta: "View Privacy Promise",
    href: "/records",
    img: "/img/mascots/mascot-laptop-1024.webp",
  },
  {
    icon: EyeOff,
    title: "Anonymization",
    line: "Strict PHI redaction",
    eyebrow: "Privacy compliance",
    heading: "Clinical-grade data sanitization.",
    body: "We enforce strict data sanitization protocols. No identifiable patient cases are ever used, displayed, or fed into AI models without documented consent and rigorous clinical review.",
    cta: "Read Security Specs",
    href: "/help",
    img: "/img/mascots/mascot-trust-1024.webp",
  },
];

/*
 * The orbit, in a 1000 × 540 box that scales with the width. The hub sits on the bottom edge at C; three rings arc over
 * it (the box clips everything below C). The six nodes sit on the middle ring at 155°…25° (maths angles, 0° = right,
 * counter-clockwise). The wheel carrying them turns a few degrees per step, so selecting a later step rolls it left;
 * each node counter-rotates, so labels stay upright. Extremes (170° / 10°) keep every node clear of the bottom edge.
 */
const W = 1000;
const H = 540;
const C = { x: 500, y: 540 };
const R_OUTER = 470;
const R_NODE = 380;
const R_INNER = 290;
const BASE = STEPS.map((_, i) => 155 - i * 26);
const TURN = 6; // degrees the wheel turns per step
const offset = (i: number) => (i - (STEPS.length - 1) / 2) * TURN;
const rad = (deg: number) => (deg * Math.PI) / 180;
// rounded: server and browser format long floats differently, which breaks hydration
const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (r: number, deg: number) => ({ x: r2(C.x + r * Math.cos(rad(deg))), y: r2(C.y - r * Math.sin(rad(deg))) });
// clockwise arc on the node ring, from 200° (under the horizon, clipped) over the top to 20°
const TRACK = (() => {
  const [a, b] = [at(R_NODE, 200), at(R_NODE, 20)];
  return `M ${a.x} ${a.y} A ${R_NODE} ${R_NODE} 0 0 1 ${b.x} ${b.y}`;
})();
const progress = (i: number) => (200 - BASE[i]) / 180;
const TICKS = Array.from({ length: 24 }, (_, k) => at(R_OUTER, k * 15));
const ORIGIN = `${(C.x / W) * 100}% ${(C.y / H) * 100}%`;
const pct = (n: number, of: number) => `${(n / of) * 100}%`;
const pad2 = (n: number) => String(n).padStart(2, "0");
const CYCLE_MS = 2500;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Section 06: the FMD Trust Standard. Six safeguards on a slowly turning orbit around the guide; pick one to read it in
 * the panel below. Autoplay advances every 2.5s while the section is on screen; picking a node (click or arrows) jumps
 * there and the timer restarts from it. Hovering (mouse only) holds it, the pause button stops it;
 * reduced motion never autoplays.
 */
export default function Journey() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const step = STEPS[active];
  const turn = reduced ? { duration: 0 } : { duration: 0.9, ease: EASE };

  // a fresh timeout per step: any change of `active`, auto or picked, restarts the 2.5s count
  useEffect(() => {
    if (reduced || paused || hovered || !inView) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), CYCLE_MS);
    return () => clearTimeout(t);
  }, [active, reduced, paused, hovered, inView]);

  const onKeys = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (active + (e.key === "ArrowRight" ? 1 : STEPS.length - 1)) % STEPS.length;
    setActive(n);
    document.getElementById(`ts-tab-${n}`)?.focus();
  };

  return (
    <section className="relative isolate pt-28 sm:pt-40">
      <Atmosphere scene="journey" />
      <Container>
        <Reveal className="max-w-3xl">
          <p className="eyebrow mb-4">The FMD Trust Standard</p>
          <h2 className="type-h2-lg text-ink">
            Engineered for <span className="bg-[linear-gradient(90deg,#9db8ff,#5b8cff)] bg-clip-text text-transparent">absolute clinical safety.</span>
          </h2>
          <p className="type-lede mt-5 max-w-xl">
            From strict AI guardrails to zero-trust data architecture, discover the technical infrastructure that protects your privacy and ensures verified care.
          </p>
        </Reveal>

        {/* mouse only: a touch fires pointerenter but often no pointerleave, which would hold it for good */}
        <div
          ref={ref}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          {/* the orbit */}
          <div className="relative mx-auto mt-10 max-w-[1000px] overflow-hidden md:mt-4" style={{ aspectRatio: `${W} / ${H}` }}>
            {/* a pool of sapphire under the hub */}
            <div
              aria-hidden
              className="absolute -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.22),transparent)]"
              style={{ left: pct(C.x, W), top: pct(C.y - 340, H), width: pct(680, W), aspectRatio: "1" }}
            />

            {/* static rings: outer and inner hairlines, the node ring as a dim track */}
            <svg aria-hidden className="absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} fill="none">
              <defs>
                <linearGradient id="ts-ring" x1="0" x2="1">
                  <stop offset="0" stopColor="#5b8cff" stopOpacity="0.15" />
                  <stop offset="0.5" stopColor="#9db8ff" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#5b8cff" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              <circle cx={C.x} cy={C.y} r={R_OUTER} stroke="url(#ts-ring)" strokeWidth={1} />
              <circle cx={C.x} cy={C.y} r={R_INNER} stroke="#9db8ff" strokeOpacity={0.12} strokeWidth={1} />
              <circle cx={C.x} cy={C.y} r={R_NODE} stroke="#3B82F6" strokeOpacity={0.18} strokeWidth={6} />
              <circle cx={C.x} cy={C.y} r={R_NODE} stroke="#60A5FA" strokeOpacity={0.35} strokeWidth={1} />
            </svg>

            {/* tick dots drifting round the outer ring on their own slow clock */}
            <motion.div
              aria-hidden
              className="absolute inset-0"
              style={{ transformOrigin: ORIGIN }}
              animate={reduced ? undefined : { rotate: 360 }}
              transition={{ duration: 160, ease: "linear", repeat: Infinity }}
            >
              <svg className="size-full" viewBox={`0 0 ${W} ${H}`} fill="none">
                {TICKS.map((p, k) => (
                  <circle key={k} cx={p.x} cy={p.y} r={k % 3 ? 1.4 : 2.4} fill="#9db8ff" fillOpacity={k % 3 ? 0.35 : 0.8} />
                ))}
              </svg>
            </motion.div>

            {/* the hub: the guide in this step's pose (all mounted up front, the selected one crossfades in), then the anchor line */}
            <div aria-hidden className="absolute -translate-x-1/2" style={{ left: pct(C.x, W), top: pct(262, H), width: pct(230, W), aspectRatio: "1" }}>
              {STEPS.map((s, i) => (
                <Image
                  key={i}
                  src={s.img}
                  alt=""
                  fill
                  sizes="(min-width:1000px) 230px, 23vw"
                  className={`object-contain object-bottom transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-0"}`}
                />
              ))}
            </div>
            <p className="absolute inset-x-0 bottom-[2%] text-center text-[13px] font-semibold tracking-[-0.01em] text-ink sm:text-[18px] md:text-[24px]">
              6 safeguards, one standard
            </p>

            {/* the wheel: progress arc and nodes turn together around C */}
            <motion.div className="absolute inset-0" style={{ transformOrigin: ORIGIN }} initial={false} animate={{ rotate: -offset(active) }} transition={turn}>
              <svg aria-hidden className="absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} fill="none">
                <motion.path
                  d={TRACK}
                  stroke="#60A5FA"
                  strokeOpacity={0.5}
                  strokeWidth={7}
                  strokeLinecap="round"
                  className="blur-[3px]"
                  initial={false}
                  animate={{ pathLength: progress(active) }}
                  transition={turn}
                />
                <motion.path d={TRACK} stroke="#BFDBFE" strokeWidth={1.5} strokeLinecap="round" initial={false} animate={{ pathLength: progress(active) }} transition={turn} />
              </svg>

              {/* a tablist, so arrow keys and screen readers work like any tab set */}
              <div role="tablist" aria-label="The FMD Trust Standard" className="absolute inset-0" onKeyDown={onKeys}>
                {STEPS.map((s, i) => {
                  const on = i === active;
                  const p = at(R_NODE, BASE[i]);
                  return (
                    <button
                      key={s.title}
                      id={`ts-tab-${i}`}
                      role="tab"
                      aria-selected={on}
                      aria-controls="ts-panel"
                      tabIndex={on ? 0 : -1}
                      onClick={() => setActive(i)}
                      className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0B101E]"
                      style={{ left: pct(p.x, W), top: pct(p.y, H) }}
                    >
                      {/* counter-rotates against the wheel, so the node and its label stay upright */}
                      <motion.span className="relative block" initial={false} animate={{ rotate: offset(active) }} transition={turn}>
                        {on && !reduced && (
                          <motion.span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-blue-400"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 1.9, opacity: 0 }}
                            transition={{ duration: 1.8, ease: "easeOut", repeat: Infinity }}
                          />
                        )}
                        <span
                          aria-hidden
                          className={`relative flex size-10 items-center justify-center rounded-full border backdrop-blur-xl transition-[transform,background-color,border-color,box-shadow,color] duration-300 md:size-12 ${
                            on
                              ? "scale-110 border-blue-400 bg-blue-500/25 text-white shadow-[0_0_0_6px_rgba(59,130,246,0.14),0_0_36px_rgba(59,130,246,0.65)]"
                              : "border-white/10 bg-white/[0.03] text-slate-400 group-hover:border-white/25 group-hover:text-slate-200"
                          }`}
                        >
                          <s.icon className="size-4 md:size-5" strokeWidth={1.5} />
                        </span>
                        {/* label above the node (md+); below md the title stays for screen readers only */}
                        <span className="sr-only md:not-sr-only md:absolute md:bottom-full md:left-1/2 md:mb-4 md:block md:w-[140px] md:-translate-x-1/2 md:text-center">
                          <span className={`block text-[14px] font-medium leading-tight ${on ? "text-white" : "text-slate-300"}`}>{s.title}</span>
                          <span className={`mt-1 block text-[11px] tabular-nums tracking-[0.2em] ${on ? "text-blue-400" : "text-slate-500"}`}>{pad2(i + 1)}</span>
                        </span>
                      </motion.span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* auto-advancing content needs a way to stop it (WCAG 2.2.2) */}
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play rotation" : "Pause rotation"}
              className="absolute bottom-[3%] right-[1%] grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
            >
              {paused ? <Play className="size-3.5" strokeWidth={1.75} /> : <Pause className="size-3.5" strokeWidth={1.75} />}
            </button>
          </div>

          {/* the selected safeguard */}
          <div
            id="ts-panel"
            role="tabpanel"
            aria-labelledby="ts-panel-title"
            className="mx-auto mt-6 max-w-[880px] rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl md:mt-8"
          >
            <div className="flex min-w-0 flex-col items-start justify-between p-6 sm:p-8 md:flex-row md:items-center md:gap-8">
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
                    Step {active + 1} • {step.eyebrow}
                  </p>
                  <h3 id="ts-panel-title" className="mb-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[28px]">
                    {step.heading}
                  </h3>
                  <p className="max-w-lg text-[14px] leading-relaxed text-slate-400">{step.body}</p>
                </motion.div>
              </AnimatePresence>
              <a
                href={step.href}
                className="group mt-6 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-blue-500 bg-blue-500/10 px-6 py-3 text-[14px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B101E] md:mt-0"
              >
                {step.cta} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
