"use client";

import { ArrowRight, BadgeCheck, Bot, Building2, CalendarDays, CreditCard, GraduationCap, HeartPulse, LayoutDashboard, Search, Sparkles, Stethoscope, UsersRound } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import MascotArt from "@/components/MascotArt";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SPECIALTIES } from "@/lib/catalog";
import { Container, Reveal, SectionHeader } from "../ui";
import { Atmosphere } from "./LowerWorld";

// Only routes that exist: Scholar access is part of the student membership (sign-in), there is no Scholar page yet.
const PRODUCTS = [
  {
    id: "main",
    icon: HeartPulse,
    tag: "For patients",
    name: "FMD Main",
    body: "The patient ecosystem: FMD AI guidance, verified dentist discovery, appointments, records and FMD Edge concierge.",
    points: ["FMD AI in five languages", "Verified vs sponsored, always labelled", "Consent-first dental records"],
    cta: { label: "Find a dentist", href: "/#dentists" },
  },
  {
    id: "clinics",
    icon: Stethoscope,
    tag: "For clinics",
    name: "FMD Clinic OS",
    body: "Clinic management with an AI clinic manager that prepares work for your approval.",
    points: ["Runs on authorised actions only", "Separate subscription from dentist membership"],
    cta: { label: "Open Clinic OS", href: "/clinic" },
  },
  {
    id: "students",
    icon: GraduationCap,
    tag: "For students",
    name: "FMD Scholar",
    body: "A dentistry-focused academic AI workspace for doubts, viva, seminars and research.",
    points: ["Included with an active student membership", "Monthly usage limits apply"],
    cta: { label: "Join as a student", href: "/signin" },
  },
];
type Product = (typeof PRODUCTS)[number];

/*
 * Interface previews are drawn in HTML from labels the product really has (search placeholder, catalog specialties,
 * Clinic OS menu, Scholar's four uses). Content areas are neutral bars: no names, records, figures or invented features.
 * Swap for real captures when they exist.
 */
const bar = (w: string, o = 0.3) => <span className="block h-[4px] rounded-full bg-[var(--text-faint)]" style={{ width: w, opacity: o }} />;

/** FMD Main: the patient app on a phone. */
function Phone() {
  return (
    <div className="w-[248px] rounded-[38px] border border-[var(--fmd-border-strong)] bg-[#03060c] p-2 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),0_0_0_6px_rgba(142,179,229,0.04)]">
      <div className="relative overflow-hidden rounded-[31px] bg-[linear-gradient(180deg,var(--fmd-deep),var(--fmd-midnight)_55%)] px-4 pb-6 pt-3">
        <div className="mx-auto h-[18px] w-20 rounded-full bg-black" />
        <p className="mt-4 text-[15px] font-medium tracking-[-0.01em] text-ink">FMD</p>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-[var(--fmd-border)] bg-white/[0.03] px-3 py-2 text-[10.5px] text-ink-4">
          <Search className="size-3 shrink-0" strokeWidth={1.6} />
          <span className="truncate">Search dentists, treatments or clinics…</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SPECIALTIES.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full border border-[var(--fmd-border)] px-2 py-1 text-[9.5px] text-ink-3">
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-[18px] border border-[var(--fmd-border-strong)] bg-[var(--fmd-sapphire)] p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink">
            <Sparkles className="size-3.5" strokeWidth={1.6} /> Ask FMD AI
          </p>
          <p className="mt-1.5 text-[9.5px] text-ink-3">English · हिन्दी · ಕನ್ನಡ · తెలుగు · தமிழ்</p>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="mt-2.5 flex items-center gap-2.5 rounded-[14px] bg-white/[0.03] p-2.5">
            <span className="size-8 shrink-0 rounded-full bg-[var(--fmd-sapphire)]" />
            <span className="flex-1 space-y-1.5">
              {bar(i ? "55%" : "65%", 0.45)}
              {bar(i ? "75%" : "40%")}
            </span>
            <BadgeCheck className="size-3.5 text-ink-3" strokeWidth={1.6} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Clinic OS: the dashboard, with the real menu. */
function ClinicWindow() {
  const nav: [string, typeof Bot][] = [
    ["Dashboard", LayoutDashboard],
    ["Calendar", CalendarDays],
    ["Patients", UsersRound],
    ["Billing", CreditCard],
    ["AI manager", Bot],
  ];
  return (
    <div className="overflow-hidden rounded-[var(--sf-r-md)] fmd-surface">
      <div className="flex items-center gap-1.5 border-b border-[var(--fmd-border)] px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full bg-white/10" />
        ))}
        <span className="ml-2 text-[10px] text-ink-4">FMD Clinic OS</span>
      </div>
      <div className="grid grid-cols-[104px_1fr]">
        <ul className="space-y-0.5 border-r border-[var(--fmd-border)] p-2">
          {nav.map(([label, Icon], i) => (
            <li key={label} className={`flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[10px] ${i === 0 ? "bg-[var(--fmd-sapphire)] text-ink" : "text-ink-4"}`}>
              <Icon className="size-3 shrink-0" strokeWidth={1.6} /> {label}
            </li>
          ))}
        </ul>
        <div className="space-y-2 p-3">
          <p className="text-[11px] text-ink-2">Dashboard</p>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5 rounded-[10px] bg-white/[0.03] p-2">
                {bar("45%")}
                {bar("70%", 0.5)}
              </div>
            ))}
          </div>
          {[80, 62, 72].map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-[10px] bg-white/[0.03] px-2 py-2">
              <span className="size-4 shrink-0 rounded-full bg-[var(--fmd-sapphire)]" />
              <span className="flex-1">{bar(`${w}%`)}</span>
              <span className="h-2.5 w-8 rounded-full border border-[var(--fmd-border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Scholar: a study workspace, tabbed by what the product says it's for. */
function ScholarWindow() {
  return (
    <div className="overflow-hidden rounded-[var(--sf-r-md)] fmd-surface">
      <div className="flex gap-1 border-b border-[var(--fmd-border)] px-2 py-2">
        {["Doubts", "Viva", "Seminars", "Research"].map((t, i) => (
          <span key={t} className={`rounded-full px-2.5 py-1 text-[10px] ${i === 0 ? "bg-[var(--fmd-sapphire)] text-ink" : "text-ink-4"}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5 p-3">
        <div className="space-y-2 rounded-[10px] bg-white/[0.03] p-3">
          {bar("50%", 0.55)}
          {bar("95%")}
          {bar("88%")}
          {bar("92%")}
          {bar("60%")}
          {bar("85%")}
          {bar("40%")}
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-1 flex-col justify-center gap-2 rounded-[10px] bg-[var(--fmd-sapphire)] p-3">
            {bar("80%", 0.55)}
            {bar("55%", 0.4)}
          </div>
          <div className="space-y-1.5 rounded-[10px] bg-white/[0.03] p-3">
            {bar("70%")}
            {bar("45%")}
          </div>
        </div>
      </div>
    </div>
  );
}

function Copy({ p: { icon: Icon, tag, name, body, points, cta } }: { p: Product }) {
  return (
    <>
      <span className="icon-tile relative size-11">
        <Icon className="size-[18px]" strokeWidth={1.3} />
      </span>
      <p className="relative mt-6 type-label text-ink-4">{tag}</p>
      <h3 className="relative mt-2 text-[24px] font-normal tracking-[-0.02em] text-ink">{name}</h3>
      <p className="relative mt-2 max-w-md text-[14px] leading-relaxed text-ink-3">{body}</p>
      <ul className="relative mt-5 max-w-md space-y-2 border-t border-[var(--fmd-border)] pt-5">
        {points.map((pt) => (
          <li key={pt} className="flex items-start gap-2.5 text-[13px] text-ink-3">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-[rgb(var(--horizon-rgb)/0.6)]" />
            {pt}
          </li>
        ))}
      </ul>
      <Link href={cta.href} className="group relative mt-7 inline-flex w-fit items-center gap-2 text-[13.5px] text-ink-2 transition-colors hover:text-ink">
        {cta.label} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.5} />
      </Link>
    </>
  );
}

/** A product + its working scene: the interface, with the guide in front of it doing that product's job. */
function Scene({ mascot, children }: { mascot: string; children: ReactNode }) {
  return (
    <div aria-hidden className="relative mt-auto pt-8 sm:pr-[22%] lg:pr-[26%] xl:pr-[18%]">
      {/* sm+: the guide stands in front of the window's lower-right corner, at work in the product. That corner holds only neutral
          bars; the real labels (menu, tabs) sit top-left and stay clear. 200px box (sm–lg) / 240px (xl) → ~170 / ~204px visible,
          and the window gives up more width at lg (two panels side by side, ~320px windows) so the guide covers a corner, not
          a third of the product. Phones: above the window. */}
      <div className="relative z-10 -mb-6 ml-auto size-[170px] sm:absolute sm:-bottom-3 sm:-right-5 sm:mb-0 sm:size-[200px] xl:size-[240px]">
        <div className="absolute left-1/2 top-[10%] h-[75%] w-[90%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--bg-glow-focus),transparent_72%)]" />
        <div className="absolute bottom-[3%] left-1/2 h-5 w-[80%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(var(--horizon-rgb)/0.2),transparent)]" />
        <MascotArt src={mascot} sizes="(min-width:1280px) 240px, (min-width:640px) 200px, 170px" />
      </div>
      {children}
    </div>
  );
}

const panel = "relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-[var(--sf-r-lg)] p-7 sm:p-9";
const HEADER = { eyebrow: "One ecosystem", title: "Different FMD, one standard of care", description: "Three products built on the same verification, consent and AI boundaries." };

/*
 * The Holographic Nexus (lg+, motion allowed): a sticky stage pinned for 375px of scrolling. The guide floats at the
 * centre on a lit pedestal inside a turning orbit; each product's device swings in beside him, tilted toward him, with
 * its card on the other side, then makes way for the next.
 * One switch per 1.25 scrolls: the 375px are three 125px stretches, a wheel notch and a quarter each (a notch is ~100px)
 * so a notch never crosses two boundaries. Crossing one plays the whole change as one timed, overdamped
 * spring: the outgoing product recedes while the incoming one swings in, at the same pace however fast the page was
 * scrolled. Nothing is scrubbed by the wheel, so a product is never left half-arrived.
 */
// the middle of each product's stretch, for the nav's /#main, /#clinics, /#students links
const ANCHORS = ["62px", "187px", "312px"];
const LG_MOTION = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
const subscribeLg = (cb: () => void) => {
  const m = matchMedia(LG_MOTION);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** A tablet frame for Scholar. */
function Tablet() {
  return (
    <div className="w-[440px] rounded-[30px] border border-white/15 bg-[#03060c] p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),0_0_0_6px_rgba(142,179,229,0.04)]">
      <ScholarWindow />
    </div>
  );
}

/** One product's layer: its device on one side of the guide, its card on the other. `at`: where this product stands
 * relative to the one on stage (-1 already passed, 0 on stage, +1 still to come). */
// side: the device on the left (-1) or right (+1) of the guide; its card goes on the other side
function NexusLayer({ at, product, side: s, children }: { at: -1 | 0 | 1; product: Product; side: number; children: ReactNode }) {
  // on stage it settles almost face-on (exactly scale 1, a slight 8° turn, so text renders crisp); still to come it waits
  // turned away beside the guide; once passed it has receded back and away
  const states = {
    1: { opacity: 0, scale: 0.88, rotateY: s * -30, x: s * 90, y: 28, cardX: s * -40 },
    0: { opacity: 1, scale: 1, rotateY: s * -8, x: 0, y: 0, cardX: 0 },
    [-1]: { opacity: 0, scale: 0.9, rotateY: s * 6, x: s * -36, y: -24, cardX: s * 24 },
  }[at];
  const { cardX, ...device } = states;
  const on = at === 0;
  // the outgoing product leaves a beat sooner than the incoming one arrives, so the two pass rather than overlap
  const transition = { type: "spring" as const, stiffness: 120, damping: 26, mass: 1, delay: on ? 0.12 : 0, opacity: { duration: on ? 0.55 : 0.35, delay: on ? 0.15 : 0, ease: "easeOut" as const } };
  // device and card zones either side of the guide, closer in on narrower screens
  const zone = (side: number) => ({ left: `calc(50% + ${side} * min(30vw, 400px))` });
  return (
    <>
      <motion.div aria-hidden className="absolute top-[58%] -translate-x-1/2 -translate-y-1/2 [transform-style:flat]" style={zone(s)} initial={false} animate={device} transition={transition}>
        {/* the device's own light: a holographic pool beneath it */}
        <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.22),transparent)]" />
        {/* smaller screens: sized down by layout (zoom), not by a scale transform, so the interface stays sharp */}
        <div className="lg:[zoom:0.82] xl:[zoom:1]">{children}</div>
      </motion.div>
      <motion.article
        inert={!on}
        aria-hidden={!on}
        className="absolute top-[58%] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/[0.02] p-7 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_30px_60px_-30px_rgb(0_0_0/0.8)] backdrop-blur-xl"
        style={zone(-s)}
        initial={false}
        animate={{ opacity: device.opacity, x: cardX }}
        transition={transition}
      >
        <Copy p={product} />
      </motion.article>
    </>
  );
}

function Nexus() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // which product is on stage: the track's three equal stretches
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const n = v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2;
    setActive((a) => (a === n ? a : n));
  });
  const at = (i: number) => (i < active ? -1 : i > active ? 1 : 0) as -1 | 0 | 1;
  const [main, clinics, students] = PRODUCTS;
  return (
    <div ref={ref} className="relative h-[calc(100vh+375px)]">
      {PRODUCTS.map((pr, i) => (
        <span key={pr.id} id={pr.id} aria-hidden className="absolute left-0 h-px w-px" style={{ top: ANCHORS[i] }} />
      ))}
      <div className="sticky top-0 h-screen overflow-hidden [perspective:1400px]">
        <div className="absolute inset-x-0 top-[13%]">
          <Container>
            <SectionHeader center {...HEADER} />
          </Container>
        </div>
        {/* the word behind the stage */}
        <p aria-hidden className="pointer-events-none absolute inset-x-0 top-[34%] select-none whitespace-nowrap bg-gradient-to-b from-white/[0.22] to-white/[0.07] bg-clip-text text-center text-[clamp(72px,11vw,190px)] font-bold leading-none tracking-[-0.015em] text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.1)]">
          ONE ECOSYSTEM
        </p>

        {/* the guide: on a lit pedestal, inside a turning orbit, floating gently */}
        <div aria-hidden className="absolute left-1/2 top-[60%] size-[360px] -translate-x-1/2 -translate-y-1/2 xl:size-[400px]">
          {/* the orbit: true circles in a square box, turning, then flattened as one into level ellipses round the pedestal
              (a rotating circle stays a circle; a rotating ellipse would tilt) */}
          <div className="absolute left-1/2 top-[91%] aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 [transform:scaleY(0.2)]">
            <div className="fmd-spin absolute inset-0 rounded-full border-2 border-dashed border-blue-300/25" />
            <div className="fmd-spin-rev absolute inset-[14%] rounded-full border-2 border-blue-400/20" />
          </div>
          <div className="absolute inset-x-[8%] bottom-0 h-[14%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(147_197_253/0.45),rgb(59_130_246/0.18)_55%,transparent)] shadow-[0_0_60px_rgb(59_130_246/0.25)]" />
          <div className="absolute inset-x-[16%] bottom-[3%] h-[8%] rounded-[50%] border border-blue-300/40" />
          <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgb(59_130_246/0.2),transparent_68%)]" />
          <motion.div className="absolute inset-0" animate={{ y: [0, -12, 0] }} transition={{ duration: 5.5, ease: "easeInOut", repeat: Infinity }}>
            <MascotArt src="/img/mascots/mascot-guide-1024.webp" sizes="400px" />
          </motion.div>
        </div>

        <NexusLayer at={at(0)} side={-1} product={main}>
          <Phone />
        </NexusLayer>
        <NexusLayer at={at(1)} side={1} product={clinics}>
          {/* a solid dark-glass frame: a backdrop blur inside a 3D-turned layer renders soft */}
          <div className="w-[480px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgb(16_26_44/0.95),rgb(7_12_22/0.97))] p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_40px_rgb(59_130_246/0.18),0_40px_90px_-30px_rgb(0_0_0/0.9)]">
            <ClinicWindow />
          </div>
        </NexusLayer>
        <NexusLayer at={at(2)} side={-1} product={students}>
          <Tablet />
        </NexusLayer>

        {/* where you are in the three */}
        <div aria-hidden className="absolute inset-x-0 bottom-[5%] flex justify-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em]">
          {PRODUCTS.map((pr, i) => (
            <span key={pr.id} className={`flex items-center gap-2 transition-colors duration-500 ${i === active ? "text-blue-200" : "text-ink-4"}`}>
              <span className={`size-1.5 rounded-full transition-[background-color,box-shadow] duration-500 ${i === active ? "bg-blue-400 shadow-[0_0_8px_2px_rgb(96_165_250/0.6)]" : "bg-white/20"}`} />
              {pr.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Section 11: the FMD product family. lg+ with motion allowed: the Holographic Nexus. Otherwise (and on the server and the
 * first browser render, which can't know the screen) the showcase below. The section sits far below the fold, so the
 * switch after load is never seen. Only one is ever rendered, so the product ids stay unique. */
export default function Products() {
  const cinematic = useSyncExternalStore(subscribeLg, () => matchMedia(LG_MOTION).matches, () => false);
  return (
    <section className="relative isolate pt-28 sm:pt-40">
      <Atmosphere scene="os" />
      {cinematic ? <Nexus /> : <Bento />}
      <Container>
        <p id="companies" className="mt-6 flex scroll-mt-28 items-center justify-center gap-2 text-center text-[12.5px] text-ink-4">
          <Building2 className="size-3.5" strokeWidth={1.5} /> FMD for Companies: a verified corporate presence within the dental ecosystem.
        </p>
      </Container>
    </section>
  );
}

/** The showcase: the patient app full width, the two professional products side by side. */
function Bento() {
  const [main, clinics, students] = PRODUCTS;
  return (
    <>
      <Container>
        <SectionHeader center {...HEADER} />

        <Reveal>
          <article id={main.id} className={`${panel} fmd-surface-raised md:flex-row md:items-center md:justify-between md:gap-10 md:pb-0`}>
            <div aria-hidden className="pointer-events-none absolute -right-24 top-0 size-[420px] rounded-full bg-[radial-gradient(closest-side,var(--fmd-glow-strong),transparent)]" />
            <div className="relative md:pb-9">
              <Copy p={main} />
            </div>
            {/* the phone rises out of the panel's bottom edge. The panel clips ~100px of it, which would otherwise slice through a
                list row; instead the lower screen dissolves into the edge (fade 64% → 80% of the phone's ~414px), keeping the
                search, specialties and Ask FMD AI card whole */}
            <div aria-hidden className="relative mx-auto -mb-28 mt-10 shrink-0 [mask-image:linear-gradient(180deg,#000_64%,transparent_80%)] md:mx-0 md:-mb-24 md:mr-6 md:mt-0 md:pt-2">
              <Phone />
            </div>
          </article>
        </Reveal>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Reveal delay={0.06}>
            <article id={clinics.id} className={`${panel} fmd-surface`}>
              <Copy p={clinics} />
              <Scene mascot="/img/mascots/mascot-laptop-1024.webp">
                <ClinicWindow />
              </Scene>
            </article>
          </Reveal>
          <Reveal delay={0.12}>
            <article id={students.id} className={`${panel} fmd-surface`}>
              <Copy p={students} />
              <Scene mascot="/img/mascots/mascot-scholar-1024.webp">
                <ScholarWindow />
              </Scene>
            </article>
          </Reveal>
        </div>
      </Container>
    </>
  );
}
