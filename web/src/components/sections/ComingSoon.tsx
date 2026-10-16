"use client";

import { ArrowRight, Bell, Crown, Mail, Users } from "lucide-react";
import { useId, useState } from "react";
import { api } from "@/lib/me";
import { Reveal } from "../ui";

const PERKS = [
  { icon: Crown, label: "Early access" },
  { icon: Bell, label: "Product updates" },
  { icon: Users, label: "Exclusive insights" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/*
 * Closing scene: centred title over a night horizon, mascot facing away.
 * Self-contained dark palette so it reads the same in any theme.
 * The general product-updates list (POST /api/leads, kind "waitlist"); clinics and other audiences have their own paths above.
 */
export default function ComingSoon() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "busy" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setState("invalid");
    setState("busy");
    try {
      // the notice under the field is the consent: joining is the explicit action it describes
      await api("/api/leads", { method: "POST", body: { kind: "waitlist", email, consent: true } });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <section
      id="coming-soon"
      aria-labelledby={`${id}-h`}
      className="relative isolate mt-20 overflow-hidden bg-[#03050f] text-[#eef2ff] sm:mt-28"
    >
      {/* copy sits in the empty sky; a soft navy pool keeps it legible over the artwork */}
      <div className="relative z-10 mx-auto flex max-w-[1320px] flex-col items-center px-5 pb-10 pt-20 text-center sm:px-6 sm:pt-24 md:pb-0">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-4 -z-10 h-[420px] w-[min(900px,100%)] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(3,5,15,0.9),rgba(3,5,15,0.6)_55%,transparent)]"
        />
        <Reveal>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.32em] text-[#b7c2e0]">Find My Dentist</p>
          <span aria-hidden className="mx-auto mt-5 block h-px w-14 bg-white/30" />
          <h2
            id={`${id}-h`}
            className="mt-6 bg-[linear-gradient(180deg,#ffffff_10%,#aebbe0_90%)] bg-clip-text text-[clamp(48px,9vw,112px)] font-light leading-[1] tracking-[-0.035em] text-transparent"
          >
            Coming Soon
          </h2>
          <p className="mx-auto mt-6 max-w-[520px] text-[12.5px] font-medium uppercase leading-[2] tracking-[0.22em] text-[#c3cce6] sm:text-[13.5px]">
            A healthier, happier world through better dental care.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="w-full max-w-[560px]">
          <form onSubmit={onSubmit} noValidate className="mt-9">
            <label htmlFor={`${id}-email`} className="sr-only">
              Email address
            </label>
            <div className="flex flex-col gap-2 rounded-[22px] border border-white/15 bg-[#080d28]/75 p-2 shadow-[0_0_60px_-20px_rgba(110,135,255,0.5)] backdrop-blur-md sm:flex-row sm:items-center sm:rounded-full">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
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
                disabled={state === "busy" || state === "sent"}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-[14.5px] font-medium text-[#0b1230] transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7f9cff]"
              >
                {state === "busy" ? "Joining…" : state === "sent" ? "You're on the list" : "Join Waitlist"} <ArrowRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <p id={`${id}-msg`} role="status" aria-live="polite" className="mt-3 min-h-5 px-4 text-[13px] text-[#c3cce6]">
              {state === "invalid" && <span className="text-[#ffb4a8]">Please enter a valid email address.</span>}
              {state === "error" && <span className="text-[#ffb4a8]">We couldn&apos;t add you just now. Please try again.</span>}
              {state === "sent" && "Thanks — we'll email you FMD product updates and early-access news."}
              {(state === "idle" || state === "busy") &&
                "Product updates and early-access news only. Your email is used for nothing else — to be removed, email support@findmydentist.io."}
            </p>
          </form>
        </Reveal>

        <Reveal delay={0.2}>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13.5px] text-[#d3daf0]">
            {PERKS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-[#0a1030]/70">
                  <Icon className="size-4 text-[#c3cce6]" strokeWidth={1.4} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* scene: pulled up so its clear sky sits behind the copy; fades into the section colour */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/img/coming-soon-night.webp"
        alt=""
        aria-hidden
        loading="lazy"
        className="relative -z-10 -mt-6 h-[320px] w-full object-cover object-[50%_100%] [mask-image:linear-gradient(180deg,transparent,#000_22%)] md:-mt-[calc(23.7vw-24px)] md:h-auto"
      />
    </section>
  );
}
