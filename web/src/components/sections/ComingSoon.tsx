"use client";

import { ArrowRight, Bell, Crown, Mail, Users } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { Reveal } from "../ui";

const PERKS = [
  { icon: Crown, label: "Early access" },
  { icon: Bell, label: "Product updates" },
  { icon: Users, label: "Exclusive insights" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/*
 * The orbit around the title: one tilted ellipse in a 1280 × 520 box (centre 640, 250), brightest across the top and
 * fading where it passes behind the form, with light nodes riding it. Node positions are computed once and rounded, so
 * server and client markup match.
 */
const ORBIT = { cx: 640, cy: 250, rx: 610, ry: 220, tilt: -5 };
const NODES = [196, 232, 292, 318, 348, 14].map((deg) => {
  const t = (deg * Math.PI) / 180;
  const a = (ORBIT.tilt * Math.PI) / 180;
  const x = ORBIT.rx * Math.cos(t);
  const y = ORBIT.ry * Math.sin(t);
  return {
    x: Math.round((ORBIT.cx + x * Math.cos(a) - y * Math.sin(a)) * 10) / 10,
    y: Math.round((ORBIT.cy + x * Math.sin(a) + y * Math.cos(a)) * 10) / 10,
    big: deg === 232 || deg === 318,
  };
});

// a static star field: three tiled layers of tiny dots at fixed spots (no random numbers)
const STARS = [
  "radial-gradient(1px 1px at 20px 30px, rgb(255 255 255 / 0.8), transparent)",
  "radial-gradient(1px 1px at 140px 90px, rgb(200 215 255 / 0.7), transparent)",
  "radial-gradient(1.5px 1.5px at 90px 160px, rgb(255 255 255 / 0.9), transparent)",
  "radial-gradient(1px 1px at 210px 200px, rgb(170 195 255 / 0.6), transparent)",
  "radial-gradient(1px 1px at 60px 230px, rgb(255 255 255 / 0.5), transparent)",
].join(",");

/*
 * Closing scene: the title inside a glowing orbit in a starry sky, above the Earth's rim where the guide sits facing away
 * (coming-soon-scene.webp: the clean lower band of the approved artwork). Self-contained dark palette, so it reads the
 * same in any theme.
 * ponytail: no waitlist backend yet - a valid submit shows an honest "not saved" notice.
 * Wire `onSubmit` to a real endpoint and swap the "pending" state for "sent" when one exists.
 */
export default function ComingSoon() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "pending">("idle");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState(EMAIL_RE.test(email.trim()) ? "pending" : "invalid");
  }

  return (
    <section
      id="coming-soon"
      aria-labelledby={`${id}-h`}
      className="relative isolate mt-20 overflow-hidden bg-[#03050f] text-[#eef2ff] sm:mt-28"
    >
      {/* the sky: deep navy deepening upward, blue haze on either side, stars mostly toward the edges, and the horizon's glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        {/* lightest behind the Earth's rim, back to the footer's own #03050f at the very bottom, so the two meet without a line */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#03050f_0%,#060b1c_40%,#0a1428_68%,#08101f_86%,#03050f_100%)]" />
        <div className="absolute -left-[10%] top-[20%] h-[60%] w-[45%] rounded-full bg-[radial-gradient(closest-side,rgb(40_80_170/0.22),transparent)] blur-2xl" />
        <div className="absolute -right-[10%] top-[5%] h-[60%] w-[45%] rounded-full bg-[radial-gradient(closest-side,rgb(40_80_170/0.2),transparent)] blur-2xl" />
        <div
          className="absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_45%_55%_at_50%_40%,transparent_40%,#000_100%)]"
          style={{ backgroundImage: STARS, backgroundSize: "260px 260px" }}
        />
        <div
          className="absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_45%_55%_at_50%_40%,transparent_50%,#000_100%)]"
          style={{ backgroundImage: STARS, backgroundSize: "410px 410px", backgroundPosition: "130px 70px" }}
        />
        {/* the top eases in from the page's own background, so the section has no starting edge */}
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,var(--background),transparent)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-[1320px] flex-col items-center px-5 pt-20 text-center sm:px-6 sm:pt-24">
        {/* the orbit, centred on the title block */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-6 -z-10 aspect-[1280/520] w-[min(1280px,135vw)] -translate-x-1/2 sm:top-8">
          <svg viewBox="0 0 1280 520" className="absolute inset-0 size-full overflow-visible" fill="none">
            <defs>
              <linearGradient id={`${id}-orbit`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9ec0ff" stopOpacity="0.9" />
                <stop offset="0.55" stopColor="#5b8cff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#3b6cff" stopOpacity="0.08" />
              </linearGradient>
              <radialGradient id={`${id}-node`}>
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.25" stopColor="#bcd3ff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#5b8cff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`rotate(${ORBIT.tilt} ${ORBIT.cx} ${ORBIT.cy})`}>
              {/* glow under a crisp line, then a slow glint travelling round it */}
              <ellipse cx={ORBIT.cx} cy={ORBIT.cy} rx={ORBIT.rx} ry={ORBIT.ry} stroke={`url(#${id}-orbit)`} strokeWidth={6} opacity={0.35} className="blur-[6px]" />
              <ellipse cx={ORBIT.cx} cy={ORBIT.cy} rx={ORBIT.rx} ry={ORBIT.ry} stroke={`url(#${id}-orbit)`} strokeWidth={1.4} />
              <ellipse
                cx={ORBIT.cx}
                cy={ORBIT.cy}
                rx={ORBIT.rx}
                ry={ORBIT.ry}
                pathLength={1000}
                stroke="#dbe7ff"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="60 940"
                className="cs-orbit-glint"
              />
            </g>
            {NODES.map((n, i) => (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r={n.big ? 16 : 10} fill={`url(#${id}-node)`} />
                <circle cx={n.x} cy={n.y} r={n.big ? 2.6 : 1.8} fill="#ffffff" />
              </g>
            ))}
          </svg>
        </div>

        <Reveal>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.5em] text-[#b7c2e0] sm:text-[13px]">Find My Dentist</p>
          <span aria-hidden className="mx-auto mt-5 block w-16 border-t border-dashed border-white/35" />
          <h2
            id={`${id}-h`}
            className="mt-5 bg-[linear-gradient(180deg,#ffffff_8%,#e3eaff_40%,#9fb2e0_78%,#c6d3f7_100%)] bg-clip-text pb-[0.14em] text-[clamp(52px,9.5vw,128px)] font-normal leading-[1.02] tracking-[-0.03em] text-transparent [filter:drop-shadow(0_0_28px_rgb(110_150_255/0.35))]"
          >
            Coming Soon
          </h2>
          <p className="mx-auto mt-[max(0.375rem,calc(1.5rem-1.33vw))] max-w-[34ch] text-[12px] font-medium uppercase leading-[2] tracking-[0.42em] text-[#c3cce6] sm:max-w-[38ch] sm:text-[14.5px]">
            A healthier, happier world through better dental care.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="w-full max-w-[660px]">
          <form onSubmit={onSubmit} noValidate className="mt-9">
            <label htmlFor={`${id}-email`} className="sr-only">
              Email address
            </label>
            <div className="flex flex-col gap-2 rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgb(18_28_62/0.75),rgb(8_13_40/0.8))] p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_60px_-18px_rgb(110_135_255/0.55)] backdrop-blur-md transition-colors has-[input:focus-visible]:border-[#7f9cff]/80 sm:flex-row sm:items-center sm:rounded-full">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
                <Mail className="size-[18px] shrink-0 text-[#aab6d8]" strokeWidth={1.4} />
                <input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state !== "idle") setState("idle");
                  }}
                  placeholder="Enter your email address"
                  aria-invalid={state === "invalid"}
                  aria-describedby={`${id}-msg`}
                  className="h-12 w-full min-w-0 bg-transparent text-[15px] text-[#eef2ff] outline-none placeholder:text-[#7c88ab]"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-[#0b1230] shadow-[0_8px_24px_-10px_rgb(180_200_255/0.7)] transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-[0_10px_30px_-8px_rgb(180_200_255/0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7f9cff]"
              >
                Join Waitlist <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
              </button>
            </div>
            <p id={`${id}-msg`} role="status" aria-live="polite" className="mt-3 min-h-5 px-4 text-[13px] text-[#c3cce6]">
              {state === "invalid" && <span className="text-[#ffb4a8]">Please enter a valid email address.</span>}
              {state === "pending" && "The waitlist isn't open yet, so your email hasn't been saved. Please check back soon."}
            </p>
          </form>
        </Reveal>

        <Reveal delay={0.2}>
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-[14px] text-[#d3daf0] sm:gap-x-5">
            {PERKS.map(({ icon: Icon, label }, i) => (
              <Fragment key={label}>
                {i > 0 && <li aria-hidden className="hidden h-6 w-px bg-white/15 sm:block" />}
                <li className="flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-4">
                  <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-[#0a1030]/80">
                    <Icon className="size-4 text-[#c3cce6]" strokeWidth={1.4} />
                  </span>
                  {label}
                </li>
              </Fragment>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* the Earth's rim and the guide, facing away: the artwork's own lower band. Nothing fades over the image (his head is
          only ~6% below its top edge, so any fade would shade him). Instead a strip of sky above it carries the image's own
          top-row colours, left to right (near-black at the edges, lighter in the middle; sampled from the file), rising out
          of the CSS sky, so the image's edge meets its own shade and no line shows. Below md the image is cropped to its
          middle, so the strip is that middle's colour. Only the image's bottom dissolves, into the footer below */}
      <div aria-hidden className="relative -z-10 mt-2 md:mt-0">
        <div className="absolute inset-x-0 bottom-full h-48 bg-[#0b1626] [mask-image:linear-gradient(180deg,transparent,#000)] md:bg-[linear-gradient(90deg,#03040a_0%,#01050b_5%,#03050f_10%,#050a16_15%,#040b19_20%,#040b19_25%,#050d19_30%,#060d1b_35%,#091322_40%,#091526_45%,#0b1526_50%,#0b1828_55%,#0a1727_60%,#091626_65%,#0a1727_70%,#0a1526_75%,#0b1728_80%,#091525_85%,#081525_90%,#081323_95%,#07101f_100%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/coming-soon-scene.webp"
          alt=""
          loading="lazy"
          className="relative h-[240px] w-full object-cover object-[50%_100%] [mask-image:linear-gradient(180deg,#000_74%,transparent)] sm:h-[300px] md:h-auto"
        />
      </div>
    </section>
  );
}
