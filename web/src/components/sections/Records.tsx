"use client";

import { CircleCheck, Clock3, FileText, History, Image as ImageIcon, KeyRound, Lock, Pill, ScanLine, Share2, ClipboardList } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

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

/*
 * Ambient cold-storage particles: energy motes rising through the vault room, each with a bright core and a wide
 * sapphire bloom, drifting side to side on its own slower rhythm (like embers or bubbles) and flickering in and out as
 * it climbs. 30 fixed configs (generated once with a seeded script and written out here: no Math.random), so every
 * render is identical; weighted toward the left, where the guide and the vault stand.
 * left/top: % of the section · size: px (2–6) · dur: s per rise (5–12) · delay: s · rise: px · drift: px either side
 * · driftDur: s per sway · peak: brightest opacity.
 */
const PARTICLES = [
  { left: 39.9, top: 44.5, size: 5.4, dur: 11.3, delay: 3.7, rise: 197, drift: 15, driftDur: 4.7, peak: 0.74 },
  { left: 43.5, top: 94.1, size: 4, dur: 7.2, delay: 5.2, rise: 129, drift: -22, driftDur: 6.9, peak: 0.83 },
  { left: 92.5, top: 46.7, size: 5.1, dur: 10.8, delay: 0.5, rise: 216, drift: 16, driftDur: 5.5, peak: 0.88 },
  { left: 30.7, top: 85.9, size: 5.8, dur: 11.4, delay: 6.4, rise: 150, drift: -20, driftDur: 3.5, peak: 0.65 },
  { left: 13.4, top: 67.1, size: 3.8, dur: 7.2, delay: 3.5, rise: 166, drift: -15, driftDur: 3.2, peak: 0.69 },
  { left: 81.9, top: 67, size: 4.9, dur: 5.9, delay: 5.2, rise: 248, drift: -16, driftDur: 4.1, peak: 0.65 },
  { left: 3.6, top: 45.6, size: 2.9, dur: 5.9, delay: 3.9, rise: 133, drift: -9, driftDur: 5, peak: 0.9 },
  { left: 40.8, top: 57, size: 4.7, dur: 9.2, delay: 1.1, rise: 199, drift: -10, driftDur: 6.5, peak: 0.94 },
  { left: 46, top: 48, size: 5.6, dur: 9.8, delay: 6, rise: 250, drift: 18, driftDur: 5, peak: 0.59 },
  { left: 40.8, top: 78.4, size: 5.7, dur: 6.1, delay: 6.7, rise: 177, drift: 18, driftDur: 4.7, peak: 0.79 },
  { left: 90.5, top: 48.9, size: 2.4, dur: 5.6, delay: 6.3, rise: 143, drift: -9, driftDur: 3.2, peak: 0.63 },
  { left: 26.7, top: 65.1, size: 5.4, dur: 8.8, delay: 2.7, rise: 178, drift: -16, driftDur: 4.8, peak: 0.58 },
  { left: 90.2, top: 95, size: 5.9, dur: 9.4, delay: 1.5, rise: 185, drift: 12, driftDur: 3.7, peak: 0.93 },
  { left: 7.5, top: 57.5, size: 5.8, dur: 7.7, delay: 1, rise: 190, drift: -22, driftDur: 3.6, peak: 0.9 },
  { left: 15.9, top: 92.9, size: 5.4, dur: 11.8, delay: 4.5, rise: 187, drift: 10, driftDur: 6.4, peak: 0.87 },
  { left: 13.8, top: 91.3, size: 4.1, dur: 9, delay: 1.5, rise: 163, drift: 20, driftDur: 5.7, peak: 0.93 },
  { left: 66, top: 76.6, size: 4.5, dur: 10.9, delay: 4.6, rise: 168, drift: -9, driftDur: 3.3, peak: 0.76 },
  { left: 86.8, top: 78.2, size: 5.1, dur: 6.8, delay: 7.9, rise: 201, drift: -14, driftDur: 4.4, peak: 0.63 },
  { left: 22.3, top: 66, size: 4.5, dur: 5.2, delay: 5.1, rise: 246, drift: -21, driftDur: 4.6, peak: 0.99 },
  { left: 88.2, top: 58.1, size: 4.2, dur: 11.2, delay: 7.3, rise: 200, drift: -16, driftDur: 3.9, peak: 0.83 },
  { left: 17.6, top: 58.3, size: 2, dur: 9.8, delay: 6.1, rise: 135, drift: -8, driftDur: 4.3, peak: 0.62 },
  { left: 31.9, top: 49.2, size: 2.2, dur: 9.3, delay: 4.5, rise: 189, drift: -11, driftDur: 3.9, peak: 0.7 },
  { left: 36, top: 42, size: 4.5, dur: 10.5, delay: 8, rise: 202, drift: 16, driftDur: 6.6, peak: 0.73 },
  { left: 41, top: 95.7, size: 3.4, dur: 7.5, delay: 3.7, rise: 209, drift: 16, driftDur: 5, peak: 0.66 },
  { left: 14.2, top: 86.5, size: 4.7, dur: 11.2, delay: 3.3, rise: 144, drift: 11, driftDur: 3.9, peak: 0.74 },
  { left: 5.1, top: 52.5, size: 5.8, dur: 9.2, delay: 3.1, rise: 163, drift: 14, driftDur: 6, peak: 0.71 },
  { left: 41.4, top: 82.2, size: 5.1, dur: 7.5, delay: 7.3, rise: 124, drift: 19, driftDur: 3.5, peak: 0.77 },
  { left: 61.2, top: 60.7, size: 3, dur: 7.6, delay: 0.4, rise: 142, drift: 18, driftDur: 5.5, peak: 0.65 },
  { left: 60.2, top: 61.3, size: 2.5, dur: 6.6, delay: 3.7, rise: 121, drift: -17, driftDur: 6.6, peak: 0.57 },
  { left: 36.8, top: 54.5, size: 5.4, dur: 7.1, delay: 0.3, rise: 179, drift: 11, driftDur: 6.3, peak: 0.74 },
];
// every rise and sway runs 15% slower than its listed duration: an easy, unhurried drift
const SLOW = 1.15;
// bloom scaled to the mote: a tight pale halo on the core, then a wide sapphire glow
const bloom = (s: number) =>
  `0 0 ${(s * 1.2).toFixed(1)}px ${(s * 0.4).toFixed(1)}px rgb(191 219 254 / 0.75), 0 0 ${(s * 2.4 + 4).toFixed(1)}px ${(s * 0.7 + 2).toFixed(1)}px rgb(59 130 246 / 0.55)`;

/**
 * Behind everything in the section: above its Atmosphere light (z -10), below all content, never catches the pointer.
 * Mounts only after hydration, then renders nothing at all under reduced motion: the server can't know that preference,
 * so deciding it on the first render would make the server and browser markup differ.
 */
/*
 * The guide's HUD (lg+): three small glass panes circling the top of the guide's head on a flat ellipse, like an
 * analyst's dashboard turning slowly. It sits in the open space above him, left of the taller vault card: centred 41%
 * across his 270px box, its right-most pane ends ~15px short of the card. On the front half of the orbit a pane passes
 * in front of him, a touch larger and brighter; on the back half it slips behind, smaller and dimmer. Hovering a vault item
 * lights the pane it relates to and the speech bubble names the item. Bubble lines restate what each tile already shows.
 * Orbit points are computed once here (no randomness), so server and browser markup match.
 */
const HUD = [
  { icon: KeyRound, label: "Private" },
  { icon: Share2, label: "Shared link" },
  { icon: CircleCheck, label: "Verified" },
];
const VERIFIED = 2;
// per vault item (DOCS order): the pane it lights and what the guide says
const HUD_FOR = [
  { pane: 1, say: "X-ray shared for 7 days." },
  { pane: 0, say: "Consultation report, ready to share." },
  { pane: 0, say: "4 intra-oral photos, private to you." },
  { pane: 0, say: "Treatment plan: 3 phases." },
  { pane: VERIFIED, say: "Verified prescription." },
  { pane: 0, say: "Dental history since 2019." },
];
const IDLE_SAY = "Your vault, private to you.";
const ORBIT = { rx: 80, ry: 22, steps: 12, seconds: 26 };
const r1 = (n: number) => Math.round(n * 10) / 10;
const ORBIT_PATH = Array.from({ length: ORBIT.steps + 1 }, (_, k) => {
  const a = (k / ORBIT.steps) * 2 * Math.PI;
  const s = Math.sin(a); // > 0: the front half, nearer the viewer
  return { x: r1(ORBIT.rx * Math.cos(a)), y: r1(ORBIT.ry * s), scale: Math.round((1 + 0.07 * s) * 100) / 100, opacity: r1(0.78 + 0.22 * s), z: s > 0 ? 3 : 1 };
});
// each pane starts a third of the way round from the last
const orbitFrom = (start: number) => {
  const pts = [...ORBIT_PATH.slice(start, -1), ...ORBIT_PATH.slice(0, start), ORBIT_PATH[start]];
  return { x: pts.map((p) => p.x), y: pts.map((p) => p.y), scale: pts.map((p) => p.scale), opacity: pts.map((p) => p.opacity), zIndex: pts.map((p) => p.z) };
};
// start points (in 30° steps): Private front-right (30°), Shared link front-left (150°), Verified top-centre (270°), so
// that even when nothing moves (reduced motion) every pane is in view and none sits behind his head
const PANE_START = [1, 5, 9];

function GuideHud({ hot }: { hot: number | null }) {
  const reduced = useReducedMotion();
  const lit = hot === null ? null : HUD_FOR[hot].pane;
  const say = hot === null ? IDLE_SAY : HUD_FOR[hot].say;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {/* the speech bubble, just above his head (positioned by the wrapper: .fmd-glass-pane sets its own position) */}
      <div className="absolute bottom-[112%] left-[41%] z-[4] -translate-x-1/2">
      <div className="fmd-glass-pane w-max max-w-[200px] rounded-[12px] px-3 py-1.5 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={say}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="text-[11.5px] font-medium leading-snug text-ink"
          >
            {say}
          </motion.p>
        </AnimatePresence>
        <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-white/10 bg-[#0f1a2e]" />
      </div>
      </div>
      {/* the orbit, round the top of his head */}
      <div className="absolute left-[41%] top-[10%]">
        {HUD.map((h, i) => {
          const on = lit === i;
          const verified = on && i === VERIFIED;
          const o = orbitFrom(PANE_START[i]);
          return (
            <motion.div
              key={h.label}
              className="absolute left-0 top-0"
              initial={false}
              animate={o}
              transition={reduced ? { duration: 0 } : { duration: ORBIT.seconds, ease: "linear", repeat: Infinity }}
            >
              <span
                className={`fmd-glass-pane flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 py-1 text-[10.5px] font-medium transition-[box-shadow,color] duration-300 ${
                  on ? "text-white shadow-[0_0_0_1px_rgb(96_165_250/0.6),0_0_18px_rgb(59_130_246/0.45)]" : "text-ink-3"
                }`}
              >
                <h.icon className={`size-3 shrink-0 transition-colors duration-300 ${verified ? "text-green-400" : on ? "text-[var(--sapphire-hi)]" : "text-slate-400"}`} strokeWidth={1.8} />
                {h.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const noSubscribe = () => () => {};

function AmbientParticles() {
  const reduced = useReducedMotion();
  // false on the server and while hydrating, true in the browser after: React switches over without an effect
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!mounted || reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-[5] overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-blue-100"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, boxShadow: bloom(p.size) }}
          initial={{ y: 0, x: -p.drift, opacity: 0 }}
          animate={{ y: -p.rise, x: [-p.drift, p.drift, -p.drift], opacity: [0, p.peak, p.peak * 0.5, p.peak * 0.9, 0] }}
          transition={{
            y: { duration: p.dur * SLOW, delay: p.delay, ease: "linear", repeat: Infinity },
            opacity: { duration: p.dur * SLOW, delay: p.delay, times: [0, 0.15, 0.45, 0.75, 1], ease: "easeInOut", repeat: Infinity },
            x: { duration: p.driftDur * SLOW, delay: p.delay, ease: "easeInOut", repeat: Infinity },
          }}
        />
      ))}
    </div>
  );
}

export default function Records() {
  // the vault item under the pointer, which the guide's HUD answers (lg+)
  const [hot, setHot] = useState<number | null>(null);
  return (
    <section id="records" className="relative isolate scroll-mt-24 overflow-x-clip pt-28 sm:pt-40">
      <Atmosphere scene="vault" />
      <AmbientParticles />
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-14">
          {/* lg: one staged scene: the guide on its own spot beside the vault, both standing on the same lit floor */}
          <Reveal y={30} className="relative order-2 flex flex-col items-start gap-2 lg:order-1 lg:flex-row lg:items-end lg:gap-5">
            <div aria-hidden className="pointer-events-none absolute -bottom-10 left-[-4%] right-[-4%] hidden h-16 rounded-[50%] bg-[radial-gradient(closest-side,rgb(var(--horizon-rgb)/0.1),transparent)] lg:block" />
            {/* 270px square box (lg) → ~221px tall, ~145px wide visible (9% top/bottom, 23% side padding). Negative margins trim the
                transparent sides, so the figure (x 62–207 in its box) ends ~40px before the panel. */}
            <div aria-hidden className="relative size-[180px] shrink-0 lg:-mb-6 lg:-ml-14 lg:-mr-10 lg:size-[270px]">
              <div className="fmd-breathe absolute left-1/2 top-[8%] h-[70%] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--bg-glow-focus),transparent_72%)]" />
              <div className="absolute bottom-[6%] left-1/2 h-5 w-[60%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(var(--horizon-rgb)/0.2),transparent)]" />
              <Image src="/img/mascots/mascot-vault-1024.webp" alt="" fill sizes="(min-width:1024px) 270px, 180px" className="z-[2] object-contain object-bottom" />
              <GuideHud hot={hot} />
            </div>
            <div className="relative w-full min-w-0 flex-1">
              <div aria-hidden className="fmd-breathe absolute -inset-x-3 -inset-y-10 -z-30 bg-[radial-gradient(50%_50%_at_50%_50%,var(--bg-glow-focus),transparent_70%)] sm:-inset-x-6 lg:-inset-x-10" />
            <div className="rounded-[var(--sf-r-lg)] fmd-surface-raised p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[13px] text-ink">
                  <Lock className="size-3.5" strokeWidth={1.5} /> My dental vault
                </p>
                <p className="text-[11px] text-ink-4">6 items · demo</p>
              </div>
              {/* two columns beside the guide on desktop, so tiles keep a readable width */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
                {DOCS.map(({ icon: Icon, name, meta, thumb }, i) => (
                  <div
                    key={name}
                    onPointerEnter={() => setHot(i)}
                    onPointerLeave={() => setHot((h) => (h === i ? null : h))}
                    className="group relative rounded-[16px] bg-white/[0.025] p-2 transition-colors hover:bg-white/[0.045]"
                  >
                    <div className="h-[84px] overflow-hidden rounded-[var(--sf-r-sm)] bg-[#050a14]">{thumb}</div>
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
                <span className="text-ink-3">in one private vault.</span>
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
