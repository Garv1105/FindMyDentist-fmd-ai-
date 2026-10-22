"use client";

import { AnimatePresence, motion, useAnimate, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { ArrowRight, Check, Info, Mail, MapPin, MessageCircle, Phone, Sparkles } from "lucide-react";
import MascotArt from "@/components/MascotArt";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, useMe } from "@/lib/me";
import { Container, Reveal } from "../ui";
import { Atmosphere } from "./LowerWorld";

const FLOW = [
  { title: "You share what you need", body: "Your care need, area, timing and how you'd like us to reach you." },
  { title: "A coordinator follows up personally", body: "A person from the FMD team contacts you to understand your situation." },
  { title: "We coordinate options", body: "We work with participating clinics on suitable providers, timing and fees." },
  { title: "You confirm before anything is arranged", body: "No clinic, time or fee is final until you've reviewed and agreed to it." },
];

type Config = {
  serviceAreas: string[];
  responseCommitment: string | null;
  fees: string;
  needs: string[];
  timings: string[];
  contactMethods: ("phone" | "whatsapp" | "email")[];
};
const METHOD_LABEL = { phone: "Phone", whatsapp: "WhatsApp", email: "Email" } as const;
const METHOD_ICON = { phone: Phone, whatsapp: MessageCircle, email: Mail } as const;

// dark, sunken fields with a faint hairline; focus lights a soft gold ring
const field =
  "w-full rounded-[14px] border border-white/10 bg-black/35 px-4 py-3 text-[13.5px] text-ink shadow-[inset_0_1px_3px_rgb(0_0_0/0.45)] outline-none transition-[border-color,box-shadow] placeholder:text-ink-4 focus-visible:border-[rgb(var(--edge-gold-rgb)/0.4)] focus-visible:shadow-[inset_0_1px_3px_rgb(0_0_0/0.45),0_0_0_3px_rgb(var(--edge-gold-rgb)/0.4)] [&>option]:bg-[var(--edge-espresso)]";

/*
 * The lounge (edge-bg.webp, 2330 × 1696): its pedestal's top surface is centred at 48.3% across, 75% down. The image is
 * anchored on exactly that point (object-position), so at any panel shape the pedestal stays put and the concierge,
 * placed by the same percentages, stands on it. Mascot art: feet 6.5% up from the bottom of its square box, so the box
 * is dropped by 6.5% of its own height.
 */
const PEDESTAL = { x: "48.3%", y: "75%" };
const BG = "/img/walkthrough/edge-bg.webp";
// the room's layers fade to nothing over their outer ~7% sideways and ~10% top and bottom (two gradient masks, kept where
// both are opaque: Tailwind adds the -webkit- form itself), so the lounge dissolves into the page instead of ending on an edge
const DISSOLVE =
  "[mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent),linear-gradient(180deg,transparent,#000_10%,#000_90%,transparent)] [mask-composite:intersect]";
// static fractal-noise tile (SVG feTurbulence, fixed seed): identical on server and client
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/*
 * The room around the lounge: concentric gold arcs centred near the card's top-right corner, sweeping across the empty
 * space above and beside it, and slow out-of-focus bokeh drifting upward like studio dust. All fixed values (no random
 * numbers), so server and client markup match. The card itself never reacts to the cursor; these background layers
 * do, shifting slightly opposite to the mouse (near orbs most, arcs least) for depth.
 */
// eight 2px rings, solid and dashed alternating (0.8× the first pass: present, never loud), spaced a little wider as they grow; outer rings fade slightly
const RINGS = [
  { r: 240, dash: undefined, o: 0.16 },
  { r: 340, dash: "3 12", o: 0.176 },
  { r: 450, dash: undefined, o: 0.136 },
  { r: 570, dash: "2 14", o: 0.16 },
  { r: 700, dash: undefined, o: 0.12 },
  { r: 840, dash: "3 16", o: 0.136 },
  { r: 990, dash: undefined, o: 0.096 },
  { r: 1150, dash: "2 18", o: 0.112 },
];
// x/y: % of the section; s: diameter px; b: blur; d: drift seconds; dx/dy: sway and rise px; tone: amber or deep gold
const BOKEH = [
  { x: 4, y: 12, s: 10, b: "blur-sm", d: 14, dx: 10, dy: 40, tone: 0 },
  { x: 9, y: 38, s: 46, b: "blur-2xl", d: 19, dx: -16, dy: 60, tone: 1 },
  { x: 2, y: 66, s: 22, b: "blur-xl", d: 16, dx: 12, dy: 50, tone: 0 },
  { x: 12, y: 86, s: 8, b: "blur-[2px]", d: 11, dx: -8, dy: 36, tone: 0 },
  { x: 6, y: 52, s: 12, b: "blur-[3px]", d: 13, dx: 9, dy: 38, tone: 0 },
  { x: 22, y: 4, s: 30, b: "blur-xl", d: 18, dx: 14, dy: 44, tone: 1 },
  { x: 38, y: 9, s: 12, b: "blur-sm", d: 12, dx: -10, dy: 30, tone: 0 },
  { x: 47, y: 2, s: 18, b: "blur-lg", d: 15, dx: 10, dy: 40, tone: 0 },
  { x: 57, y: 3, s: 44, b: "blur-3xl", d: 20, dx: 18, dy: 56, tone: 1 },
  { x: 73, y: 10, s: 9, b: "blur-[2px]", d: 13, dx: 8, dy: 34, tone: 0 },
  { x: 88, y: 6, s: 26, b: "blur-xl", d: 17, dx: -14, dy: 48, tone: 0 },
  { x: 95, y: 30, s: 14, b: "blur-md", d: 15, dx: 10, dy: 42, tone: 0 },
  { x: 91, y: 55, s: 48, b: "blur-3xl", d: 20, dx: -18, dy: 64, tone: 1 },
  { x: 97, y: 78, s: 10, b: "blur-sm", d: 12, dx: -8, dy: 38, tone: 0 },
  { x: 86, y: 92, s: 20, b: "blur-lg", d: 16, dx: 12, dy: 46, tone: 1 },
  { x: 93, y: 44, s: 8, b: "blur-[2px]", d: 11, dx: -7, dy: 32, tone: 0 },
];
// small specks need more strength than large orbs to survive their blur on near-black
const orbTone = (p: (typeof BOKEH)[number]) => (p.s < 16 ? "bg-amber-400/36" : p.tone ? "bg-yellow-600/10" : "bg-amber-500/14");

/** One depth plane: shifts by `depth` px at the section's edges, opposite to the mouse (mx/my run −1…1, already sprung). */
function Plane({ mx, my, depth, children }: { mx: MotionValue<number>; my: MotionValue<number>; depth: number; children: ReactNode }) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth * 0.7);
  return (
    <motion.div className="absolute inset-0" style={{ x, y }}>
      {children}
    </motion.div>
  );
}

function Ambience({ reduced, mx, my }: { reduced: boolean | null; mx: MotionValue<number>; my: MotionValue<number> }) {
  const orb = (p: (typeof BOKEH)[number], i: number) => (
    <motion.div
      key={i}
      className={`absolute rounded-full ${p.b} ${orbTone(p)}`}
      style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s }}
      animate={reduced ? undefined : { x: [0, p.dx], y: [0, -p.dy] }}
      transition={{ duration: p.d, ease: "easeInOut", repeat: Infinity, repeatType: "mirror", delay: (i % 5) * 1.2 }}
    />
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(180deg,transparent,#000_14%,#000_86%,transparent)]"
    >
      {/* arcs (farthest plane): one 2400px square centred on the card's top-right corner (container edge, top of the panel) */}
      <Plane mx={mx} my={my} depth={14}>
        <motion.svg
          viewBox="-1200 -1200 2400 2400"
          className="absolute size-[2400px] -translate-x-1/2 -translate-y-1/2 left-[calc(50%+min(600px,46vw))] top-28 sm:top-40"
          fill="none"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 240, ease: "linear", repeat: Infinity }}
        >
          {RINGS.map((g) => (
            <circle key={g.r} r={g.r} stroke={`rgba(218,165,32,${g.o})`} strokeWidth={2} strokeDasharray={g.dash} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </motion.svg>
      </Plane>
      {/* far orbs (the small specks) drift a little more, near orbs (large, soft) the most */}
      <Plane mx={mx} my={my} depth={24}>
        {BOKEH.map((p, i) => (p.s < 24 ? orb(p, i) : null))}
      </Plane>
      <Plane mx={mx} my={my} depth={40}>
        {BOKEH.map((p, i) => (p.s >= 24 ? orb(p, i) : null))}
      </Plane>
    </div>
  );
}

export default function Concierge() {
  const me = useMe();
  const reduced = useReducedMotion();
  // background parallax: the pointer's place in the section (−1…1 each way, inverted so layers move against it), sprung
  // so the layers glide rather than track; mouse only, still under reduced motion, back to centre when the pointer leaves
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const mx = useSpring(px, { stiffness: 50, damping: 20 });
  const my = useSpring(py, { stiffness: 50, damping: 20 });
  const parallax = (e: { pointerType: string; clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(-((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(-((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const recentre = () => {
    px.set(0);
    py.set(0);
  };
  // the concierge's "attention" bob (y −4 → 0) when a mouse comes onto the form; nothing at all under reduced motion
  const [panel, animateMascot] = useAnimate<HTMLDivElement>();
  const attend = (e: { pointerType: string }) => {
    if (reduced || e.pointerType !== "mouse") return;
    // both stages (lg and narrow) carry him; only the visible one shows the bob
    animateMascot("[data-attend]", { y: [0, -4, 0] }, { duration: 0.7, ease: [0.37, 0, 0.63, 1] });
  };
  // hovering him directly: a small "tap the bell" dip
  const tap = reduced ? undefined : { y: [-2, 1, -1, 0], transition: { duration: 0.5, ease: "easeInOut" as const } };
  const [cfg, setCfg] = useState<Config | null>(null);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // name/contactValue stay null until typed, so they fall back to the signed-in account's details
  const [f, setF] = useState({ name: null as string | null, contactMethod: "phone" as Config["contactMethods"][number], contactValue: null as string | null, need: "", area: "", timing: "This week", notes: "", consent: false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api<Config>("/api/concierge/config").then(setCfg).catch(() => setErr("FMD Edge is temporarily unavailable. Please try again shortly."));
  }, []);

  const name = f.name ?? me?.name ?? "";
  const contactValue = f.contactValue ?? (f.contactMethod === "email" ? me?.email : me?.phone?.replace("+91", "")) ?? "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      setDone(await api<{ reference: string }>("/api/concierge/enquiries", { method: "POST", body: { ...f, name, contactValue } }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // the concierge on the pedestal; `box` is his square box's width as a share of the stage's width
  const concierge = (box: string, sizes: string) => (
    // no entrance of his own: the panel's Reveal brings him in with everything else
    <div className="absolute" style={{ left: PEDESTAL.x, top: PEDESTAL.y, width: box, aspectRatio: "1", translate: "-50% -93.5%" }}>
      {/* grounding on the pedestal: a soft gold glow and a tight contact shadow at the feet */}
      <div aria-hidden className="absolute bottom-[1%] left-1/2 h-[14%] w-[62%] -translate-x-1/2 scale-y-50 rounded-full bg-[rgb(255_215_0/0.08)] blur-md" />
      <div aria-hidden className="absolute bottom-[5%] left-1/2 h-[4%] w-[32%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.7),transparent)] blur-[3px]" />
      <motion.div whileHover={tap} className="absolute inset-0">
        <motion.div data-attend="" className="absolute inset-0">
          <MascotArt src="/img/mascots/mascot-edge-1024.webp" sizes={sizes} />
        </motion.div>
      </motion.div>
    </div>
  );

  return (
    <section
      id="concierge"
      data-no-tilt=""
      onPointerMove={parallax}
      onPointerLeave={recentre}
      className="relative isolate scroll-mt-24 pt-28 sm:pt-40"
    >
      {/* data-no-tilt: the site-wide cursor tilt (CursorFx) leaves this whole section still */}
      <Atmosphere scene="edge" />
      <Ambience reduced={reduced} mx={mx} my={my} />
      {/* film grain so the black around the lounge isn't perfectly flat; strongest behind the card, dissolving to nothing
          at the section's edges so it never shows as a box */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.045] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_55%,#000_30%,transparent_80%)]"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />
      <Container>
        <Reveal y={30} className="relative">
          {/* ambient aura: a large, very soft amber orb behind the card, blurred until it's only warmth in the air */}
          <div aria-hidden className="pointer-events-none absolute inset-x-[12%] inset-y-[8%] -z-20 rounded-full bg-[radial-gradient(circle_at_center,rgb(245_158_11/0.1),transparent_70%)] blur-[120px]" />
          {/* no outline: the room dissolves into the page on every side (see DISSOLVE). Around it only diffuse warmth: a wide,
              soft golden bloom and a warm glow from below, no rim (box-shadow, painted once, nothing animated), plus the soft
              lamp-light above the top edge */}
          {/* the glow's source sits well inside the room (inset 12%) with no spread: a shadow drawn from the panel's own edge
              would start at full strength right on that edge and redraw the outline we are dissolving */}
          <div aria-hidden className="pointer-events-none absolute inset-[12%] -z-10 rounded-[40%] shadow-[0_0_180px_60px_rgb(218_165_32/0.12),0_60px_160px_0_rgba(218,165,32,0.12)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-[22%] -top-3 -z-10 h-6 rounded-[50%] bg-[radial-gradient(closest-side,rgb(var(--edge-gold-rgb)/0.14),transparent)] blur-md" />
          {/* the lounge: on lg the whole panel is the room, at least the image's shape (an invisible spacer shares the content's grid
              cell, so whichever is taller sets the height); below lg the room is a stage under the introduction. The panel
              keeps the edge-panel class for its scoped focus colour, but paints nothing itself: its espresso backdrop and the
              room image are layers below that fade out toward every edge, so there is no border, only the room thinning into
              the dark. The copy and the request form sit above those layers, untouched by the fade */}
          <div ref={panel} className="edge-panel relative isolate overflow-hidden rounded-3xl bg-none! shadow-none! lg:grid lg:grid-cols-[minmax(0,1fr)]">
            <div aria-hidden className={`edge-panel absolute inset-0 -z-20 shadow-none! ${DISSOLVE}`} />
            <div aria-hidden className="hidden lg:col-start-1 lg:row-start-1 lg:block lg:aspect-[2330/1696]" />
            <div aria-hidden className={`absolute inset-0 -z-10 hidden lg:block ${DISSOLVE}`}>
              <Image src={BG} alt="" fill sizes="(min-width:1320px) 1240px, 100vw" className="object-cover" style={{ objectPosition: `${PEDESTAL.x} ${PEDESTAL.y}` }} />
              {/* readability: dark behind the copy on the left and under the form on the right, the stage left open */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_7_10/0.9)_0%,rgb(8_7_10/0.78)_30%,rgb(8_7_10/0.45)_37%,rgb(8_7_10/0.06)_46%,rgb(8_7_10/0.08)_56%,rgb(8_7_10/0.5)_75%,rgb(8_7_10/0.6)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_7_10/0.35),transparent_25%,transparent_80%,rgb(8_7_10/0.55))]" />
              {concierge("28%", "(min-width:1320px) 350px, 28vw")}
            </div>

            {/* columns: copy · the stage (left open for him) · the request. pointer-events pass through the gap to the concierge */}
            <div className="pointer-events-none relative grid gap-10 p-6 sm:p-10 lg:col-start-1 lg:row-start-1 lg:grid-cols-[34fr_25fr_37fr] lg:items-center lg:gap-0 lg:px-[3%] lg:py-12">
              <div className="pointer-events-auto">
                <p className="eyebrow mb-5 flex items-center gap-2.5 !text-[13.5px] !font-semibold sm:!text-[15px]">
                  <Sparkles aria-hidden className="size-[18px] shrink-0 text-[var(--edge-gold)] drop-shadow-[0_0_8px_rgb(var(--edge-gold-rgb)/0.55)] sm:size-5" strokeWidth={1.75} />
                  <span className="edge-shimmer">FMD Edge</span>
                </p>
                <h2 className="type-h2-lg !font-normal !leading-[1.08] !text-[#FFF8E7] lg:!text-[clamp(32px,3vw,42px)]">
                  Your Private Dental
                  <br />
                  Concierge Service.
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-3">
                  From finding the right specialist to navigating your next steps, our team helps make your dental-care journey simpler.
                </p>

                {/* below lg: the stage */}
                <div aria-hidden className="relative -mx-6 mt-8 aspect-[4/3] overflow-hidden sm:-mx-10 lg:hidden">
                  <Image src={BG} alt="" fill sizes="100vw" className="object-cover" style={{ objectPosition: `${PEDESTAL.x} ${PEDESTAL.y}` }} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--edge-black),transparent_22%,transparent_78%,var(--edge-black))]" />
                  {concierge("56%", "60vw")}
                </div>

                <ol className="mt-9 lg:mt-10">
                  {FLOW.map((s, i) => (
                    <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < FLOW.length - 1 && <span aria-hidden className="absolute left-[13.5px] top-7 h-[calc(100%-28px)] w-px bg-gradient-to-b from-[#D4AF37]/40 to-transparent" />}
                      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#120F09]/80 text-xs font-semibold tabular-nums text-[#D4AF37]">{i + 1}</span>
                      <div>
                        <h3 className="text-[15px] text-[#E8EAEE]">{s.title}</h3>
                        <p className="mt-0.5 text-[13.5px] leading-relaxed text-[rgb(var(--edge-champagne-rgb)/0.85)]">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <dl className="mt-8 space-y-3 border-t border-[rgb(var(--edge-gold-rgb)/0.14)] pt-5 text-[13px]">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[rgb(var(--edge-champagne-rgb)/0.7)]" strokeWidth={1.5} />
                    <div>
                      <dt className="text-ink-2">Where we can help</dt>
                      <dd className="text-ink-4">
                        {cfg?.serviceAreas.length
                          ? cfg.serviceAreas.join(", ")
                          : "Service areas are being finalised. Tell us your area and we'll let you know honestly whether we can help."}
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-[rgb(var(--edge-champagne-rgb)/0.7)]" strokeWidth={1.5} />
                    <div>
                      <dt className="text-ink-2">What to expect</dt>
                      <dd className="text-ink-4">
                        {cfg?.responseCommitment ?? "A coordinator will contact you using your preferred method. This is not a 24/7 or emergency service."}{" "}
                        {cfg?.fees}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div aria-hidden className="hidden lg:block" />

              {/* warm glass card, dark enough that the fields read first; a mouse coming onto it catches the concierge's attention */}
              <div
                onPointerEnter={attend}
                className="fmd-glass-pane edge-glass pointer-events-auto relative rounded-[26px] border border-[#D4AF37]/20 bg-[#0E0B08]/80 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-7"
              >
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center py-10 text-center" role="status">
                      <span className="icon-tile size-14 !rounded-full">
                        <Check className="size-6" strokeWidth={1.5} />
                      </span>
                      <h3 className="mt-6 text-[22px] font-light tracking-[-0.02em] text-ink">Request received</h3>
                      <p className="mt-2 text-[13px] text-ink-3">
                        Reference <span className="font-mono text-ink">{done.reference}</span>
                      </p>
                      <p className="mt-4 max-w-[340px] text-[14px] leading-relaxed text-ink-4">
                        We&apos;ve received your request. This is not a confirmed appointment, provider or price. An FMD coordinator will contact you to discuss next steps.
                      </p>
                      {me ? (
                        <Link href="/account" className="btn-ghost mt-7 h-10 px-5 text-[13px]">
                          Track it in your account
                        </Link>
                      ) : (
                        <p className="mt-6 text-[12px] text-ink-4">Keep this reference to ask about your request.</p>
                      )}
                      <button onClick={() => setDone(null)} className="mt-3 text-[12.5px] text-ink-3 underline underline-offset-4 hover:text-ink">
                        Submit another request
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="space-y-3.5">
                      <h3 className="text-[18px] text-[#FFF8E7]">Request FMD Edge assistance</h3>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] text-ink-3">What do you need help with?</span>
                        <select required value={f.need} onChange={(e) => set("need", e.target.value)} className={field}>
                          <option value="" disabled>
                            Choose a care need
                          </option>
                          {cfg?.needs.map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-[12px] text-ink-3">Your name</span>
                          <input required value={name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={field} />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[12px] text-ink-3">Area or locality</span>
                          <input required value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Indiranagar, Bengaluru" className={field} />
                        </label>
                      </div>
                      <fieldset>
                        <legend className="mb-1.5 text-[12px] text-ink-3">Contact me by</legend>
                        <div className="grid grid-cols-3 gap-2">
                          {(cfg?.contactMethods ?? ["phone", "whatsapp", "email"]).map((c) => {
                            const Icon = METHOD_ICON[c];
                            return (
                              <label key={c} className="cursor-pointer">
                                <input type="radio" name="contact" checked={f.contactMethod === c} onChange={() => set("contactMethod", c)} className="peer sr-only" />
                                <span className="flex items-center justify-center gap-1.5 rounded-[12px] border border-white/10 bg-black/25 py-2.5 text-[12.5px] text-ink-3 transition-[border-color,background-color,color,box-shadow] hover:border-[rgb(var(--edge-gold-rgb)/0.3)] hover:text-ink-2 peer-checked:border-[rgb(var(--edge-gold-rgb)/0.55)] peer-checked:bg-[rgb(var(--edge-gold-rgb)/0.1)] peer-checked:text-[#FFF8E7] peer-checked:shadow-[0_0_16px_-4px_rgb(var(--edge-gold-rgb)/0.5)] peer-focus-visible:shadow-[0_0_0_3px_rgb(var(--edge-gold-rgb)/0.35)]">
                                  <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.6} />
                                  {METHOD_LABEL[c]}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-[12px] text-ink-3">{f.contactMethod === "email" ? "Email address" : "Mobile number"}</span>
                          <input
                            required
                            value={contactValue}
                            onChange={(e) => set("contactValue", e.target.value)}
                            inputMode={f.contactMethod === "email" ? "email" : "tel"}
                            autoComplete={f.contactMethod === "email" ? "email" : "tel-national"}
                            className={field}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[12px] text-ink-3">Preferred timing</span>
                          <select value={f.timing} onChange={(e) => set("timing", e.target.value)} className={field}>
                            {cfg?.timings.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] text-ink-3">Notes (optional)</span>
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={f.notes}
                          onChange={(e) => set("notes", e.target.value)}
                          placeholder="Only share what's needed to understand your request. You don't need to include medical details."
                          className={`${field} resize-none`}
                        />
                      </label>
                      <label className="flex items-start gap-3 text-[12.5px] leading-relaxed text-ink-2">
                        {/* required: the button stays live and inviting; pressing it without consent, the browser points to this box */}
                        <input type="checkbox" required checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1 accent-[var(--edge-gold)]" />
                        <span>
                          I agree that the FMD Edge team may contact me about this request using the method above. My details are used only to coordinate
                          this request and are shared with a clinic only after I agree.
                        </span>
                      </label>
                      <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-4">
                        <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
                        Not an emergency service. For severe pain, swelling or bleeding, contact a dentist or emergency care directly.
                      </p>
                      {err && (
                        <p role="alert" className="rounded-[12px] border border-line-strong px-3 py-2 text-[12.5px] text-ink">
                          <span className="font-medium">Error:</span> {err}
                        </p>
                      )}
                      <button
                        disabled={busy || !cfg}
                        className="edge-cta group h-[52px] w-full px-6 text-[14.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0B08]"
                      >
                        {busy ? "Sending…" : "Request FMD Edge assistance"} <ArrowRight className="arrow-nudge size-4" strokeWidth={2} />
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
