"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Container, Reveal } from "../ui";

const FLOW = [
  { title: "You submit a request", body: "Tell us what you need, where, and how you'd like to be contacted." },
  { title: "Our team follows up", body: "An FMD coordinator reaches out personally to understand your needs." },
  { title: "Options are coordinated", body: "We work with participating clinics on providers, timing and fees." },
  { title: "You confirm the final plan", body: "Nothing is arranged until you have reviewed and agreed to it." },
];

const field =
  "w-full rounded-[14px] border border-line bg-[var(--surface-glass)] px-4 py-3 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-line-strong [&>option]:bg-[var(--surface)]";

export default function Concierge() {
  const [ref, setRef] = useState<string | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRef(`FMD-CQ-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  return (
    <section id="concierge" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <Reveal y={30}>
          <div className="glass relative overflow-hidden rounded-[34px] p-6 sm:p-10 lg:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-[50%] opacity-80 blur-3xl"
              style={{ background: "radial-gradient(closest-side, rgb(var(--horizon-rgb)/0.1), transparent)" }}
            />
            <div className="relative grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <p className="eyebrow mb-5">FMD Concierge</p>
                <h2 className="text-[30px] font-extralight leading-[1.08] tracking-[-0.035em] text-ink sm:text-[46px]">
                  Need help navigating your dental care?
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-3">
                  A human coordination service inside FMD. Share your request and our team will personally help you find a way forward.
                </p>
                <ol className="mt-9 space-y-0">
                  {FLOW.map((s, i) => (
                    <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < FLOW.length - 1 && <span aria-hidden className="absolute left-[13px] top-8 h-[calc(100%-28px)] w-px bg-line" />}
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] tabular-nums text-ink-2">{i + 1}</span>
                      <div>
                        <h3 className="text-[14.5px] text-ink">{s.title}</h3>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-4">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-[26px] border border-line bg-[var(--surface-glass)] p-5 sm:p-7">
                <AnimatePresence mode="wait">
                  {ref ? (
                    <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center py-10 text-center">
                      <span className="icon-tile size-14 !rounded-full">
                        <Check className="size-6" strokeWidth={1.5} />
                      </span>
                      <h3 className="mt-6 text-[22px] font-light tracking-[-0.02em] text-ink">Request received</h3>
                      <p className="mt-2 text-[13px] text-ink-3">
                        Reference <span className="font-mono text-ink-2">{ref}</span>
                      </p>
                      <p className="mt-4 max-w-[320px] text-[13px] leading-relaxed text-ink-4">
                        This is not a confirmed appointment. An FMD coordinator will contact you during working hours to discuss next steps.
                      </p>
                      <button onClick={() => setRef(null)} className="btn-ghost mt-7 h-10 px-5 text-[13px]">
                        Submit another request
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="space-y-3.5">
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] text-ink-3">What do you need help with?</span>
                        <select required defaultValue="" className={field}>
                          <option value="" disabled>
                            Choose a care need
                          </option>
                          <option>Finding the right specialist</option>
                          <option>Second opinion on a treatment plan</option>
                          <option>Planning a complex treatment</option>
                          <option>Care for a family member</option>
                          <option>Something else</option>
                        </select>
                      </label>
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-[12px] text-ink-3">Area</span>
                          <input required placeholder="e.g. Indiranagar" className={field} />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[12px] text-ink-3">Preferred timing</span>
                          <select className={field} defaultValue="This week">
                            <option>This week</option>
                            <option>Next 2 weeks</option>
                            <option>Flexible</option>
                          </select>
                        </label>
                      </div>
                      <fieldset>
                        <legend className="mb-1.5 text-[12px] text-ink-3">Contact me by</legend>
                        <div className="grid grid-cols-3 gap-2">
                          {["Phone", "WhatsApp", "Email"].map((c, i) => (
                            <label key={c} className="cursor-pointer">
                              <input type="radio" name="contact" defaultChecked={i === 0} className="peer sr-only" />
                              <span className="block rounded-[12px] border border-line py-2.5 text-center text-[12.5px] text-ink-3 transition-all peer-checked:border-line-strong peer-checked:bg-[var(--accent-soft)] peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-1">
                                {c}
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] text-ink-3">Notes (optional)</span>
                        <textarea rows={3} placeholder="Only share what's needed to help us understand your request." className={`${field} resize-none`} />
                      </label>
                      <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-4">
                        <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
                        Used only to coordinate your request. Not an emergency service — for urgent symptoms, contact a dentist or emergency care directly.
                      </p>
                      <button className="btn-primary group h-12 w-full text-[14px]">
                        Submit request <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
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
