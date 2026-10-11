"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Clock, GraduationCap, Languages, MapPin, Navigation, Phone, Star, Wallet, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Dentist } from "@/data/demo";
import { Chip, SponsoredBadge, VerifiedBadge } from "../ui";

const DEMO_SLOTS = ["Today · 5:30 PM", "Today · 6:15 PM", "Tomorrow · 10:00 AM", "Tomorrow · 12:30 PM"];

type Step = "profile" | "review" | "sent";

export default function ProfileDrawer({ dentist, onClose }: { dentist: Dentist | null; onClose: () => void }) {
  // keyed by dentist so the booking flow starts fresh for each profile
  return <AnimatePresence>{dentist && <Drawer key={dentist.id} d={dentist} onClose={onClose} />}</AnimatePresence>;
}

function Drawer({ d, onClose }: { d: Dentist; onClose: () => void }) {
  const [step, setStep] = useState<Step>("profile");
  const [slot, setSlot] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  const when = slot ?? "Time to be confirmed by clinic";

  return (
    <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_55%,transparent)] backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${d.name} profile`}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass absolute inset-y-2 right-2 flex w-[min(480px,calc(100%-16px))] flex-col overflow-hidden rounded-[28px]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          {step === "review" ? (
            <button onClick={() => setStep("profile")} className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
              <ArrowLeft className="size-4" strokeWidth={1.5} /> Back to profile
            </button>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.2em] text-ink-4">Demo profile · not a real practitioner</span>
          )}
          <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "profile" && (
            <>
              <div className="flex gap-4">
                <div className="relative h-[124px] w-[100px] shrink-0 overflow-hidden rounded-[18px] border border-line">
                  <Image src={d.photo} alt="" fill sizes="100px" className="object-cover" />
                </div>
                <div className="pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {d.verified ? (
                      <VerifiedBadge />
                    ) : (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-4">Verification pending</span>
                    )}
                    {d.sponsored && <SponsoredBadge />}
                  </div>
                  <h3 className="mt-2 text-[22px] font-light tracking-[-0.02em] text-ink">{d.name}</h3>
                  <p className="text-[13.5px] text-ink-3">{d.specialty}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                    <Star className="size-3.5" fill="var(--star)" stroke="none" /> {d.rating} · {d.reviews} reviews
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-[var(--border)]">
                {[
                  [GraduationCap, "Qualifications", d.qualifications.join(", ")],
                  [Clock, "Experience", `${d.experienceYears} years`],
                  [MapPin, "Clinic", d.clinic],
                  [Clock, "Hours", d.hours],
                  [Languages, "Languages", d.languages.join(", ")],
                  [Wallet, "Consultation", d.fee],
                ].map(([Icon, k, v]) => {
                  const I = Icon as typeof Clock;
                  return (
                    <div key={k as string} className="bg-[var(--surface)] p-3.5">
                      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-4">
                        <I className="size-3" strokeWidth={1.5} /> {k as string}
                      </dt>
                      <dd className="mt-1.5 text-[13px] leading-snug text-ink-2">{v as string}</dd>
                    </div>
                  );
                })}
              </dl>

              <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-ink-4">Services</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[...d.services, "Consultation", "X-ray review"].map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>

              <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-ink-4">Clinic photos</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="aspect-[4/3] rounded-[14px] border border-line"
                    style={{
                      background: `radial-gradient(120% 90% at ${20 + i * 30}% 0%, rgb(var(--accent-rgb) / 0.12), transparent 60%), linear-gradient(160deg, var(--surface-elevated), var(--background-secondary))`,
                    }}
                  />
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button className="btn-ghost h-10 text-[13px]">
                  <Phone className="size-3.5" strokeWidth={1.5} /> Call clinic
                </button>
                <button className="btn-ghost h-10 text-[13px]">
                  <Navigation className="size-3.5" strokeWidth={1.5} /> Directions
                </button>
              </div>

              <p className="mt-7 text-[11px] uppercase tracking-[0.2em] text-ink-4">Choose a time</p>
              {d.nextSlot ? (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {DEMO_SLOTS.map((s) => (
                    <button
                      key={s}
                      aria-pressed={slot === s}
                      onClick={() => setSlot(s)}
                      className={`rounded-[14px] border px-3 py-2.5 text-[13px] transition-all ${slot === s ? "border-line-strong bg-[var(--accent-soft)] text-ink shadow-[0_0_24px_-8px_var(--accent-glow)]" : "border-line text-ink-3 hover:border-line-strong"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 rounded-[14px] border border-dashed border-line-strong p-3.5 text-[12.5px] leading-relaxed text-ink-3">
                  This clinic isn&apos;t connected to live scheduling. You can send a request and the clinic will confirm a time.
                </p>
              )}
            </>
          )}

          {step === "review" && (
            <div>
              <h3 className="text-[22px] font-light tracking-[-0.02em] text-ink">Review before you confirm</h3>
              <p className="mt-1.5 text-[13px] text-ink-4">Nothing is sent until you confirm below.</p>
              <dl className="mt-6 divide-y divide-[var(--border)] rounded-[18px] border border-line">
                {[
                  ["Dentist", `${d.name} · ${d.specialty}`],
                  ["Clinic", d.clinic],
                  ["Time", when],
                  ["Fee", d.fee],
                  ["Cancellation", "Free up to 4 hours before (demo terms)"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 px-4 py-3">
                    <dt className="text-[12.5px] text-ink-4">{k}</dt>
                    <dd className="text-right text-[13px] text-ink-2">{v}</dd>
                  </div>
                ))}
              </dl>
              <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-ink-3">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
                I&apos;ve reviewed the details and want to send this request to the clinic.
              </label>
            </div>
          )}

          {step === "sent" && (
            <div className="flex flex-col items-center pt-16 text-center">
              <span className="icon-tile size-14 !rounded-full">
                <Check className="size-6" strokeWidth={1.5} />
              </span>
              <h3 className="mt-6 text-[22px] font-light tracking-[-0.02em] text-ink">Request sent</h3>
              <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-ink-3">
                Status: <span className="text-ink-2">awaiting clinic confirmation</span>. You&apos;ll be notified when the clinic responds. Reference
                FMD-BK-2048 (demo).
              </p>
            </div>
          )}
        </div>

        {step !== "sent" && (
          <footer className="border-t border-line p-4">
            {step === "profile" ? (
              <button disabled={!!d.nextSlot && !slot} onClick={() => setStep("review")} className="btn-primary h-12 w-full text-[14px] disabled:opacity-40">
                {d.nextSlot ? (slot ? `Continue with ${slot}` : "Select a time to continue") : "Request a time"}
              </button>
            ) : (
              <button disabled={!agree} onClick={() => setStep("sent")} className="btn-primary h-12 w-full text-[14px] disabled:opacity-40">
                Confirm request
              </button>
            )}
          </footer>
        )}
      </motion.aside>
    </motion.div>
  );
}
