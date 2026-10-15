"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Info, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, useMe } from "@/lib/me";
import { Container, Reveal } from "../ui";

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

const field =
  "w-full rounded-[14px] border border-line bg-[var(--surface-glass)] px-4 py-3 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-line-strong [&>option]:bg-[var(--surface)]";

export default function Concierge() {
  const me = useMe();
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

  return (
    <section id="concierge" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <Reveal y={30}>
          <div className="concierge-card relative overflow-hidden rounded-[36px] p-6 shadow-[0_0_0_1px_rgba(232,205,150,0.16),0_40px_120px_-40px_rgba(232,205,150,0.18)] sm:p-10 lg:p-14">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_100%_0%,rgba(232,205,150,0.10),transparent_70%),radial-gradient(50%_40%_at_0%_100%,rgba(42,100,232,0.08),transparent_70%)]" />
            <div aria-hidden className="concierge-glow pointer-events-none absolute inset-x-0 -top-48 mx-auto h-96 w-[85%] rounded-[50%] blur-3xl" />
            <div className="relative grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <p className="eyebrow mb-5 !text-[#e8cd96]">FMD Edge</p>
                <h2 className="type-h2-lg">
                  <span className="headline-silver">Your Private Dental</span>
                  <br />
                  <span className="headline-silver">Concierge Service.</span>
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-3">
                  From finding the right specialist to navigating your next steps, our team helps make your dental-care journey simpler.
                </p>
                <ol className="mt-9">
                  {FLOW.map((s, i) => (
                    <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < FLOW.length - 1 && <span aria-hidden className="absolute left-[13px] top-8 h-[calc(100%-28px)] w-px bg-line" />}
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[rgba(232,205,150,0.45)] text-[11px] tabular-nums text-[#e8cd96]">{i + 1}</span>
                      <div>
                        <h3 className="text-[14.5px] text-ink">{s.title}</h3>
                        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-4">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <dl className="mt-9 space-y-3 border-t border-line pt-6 text-[13px]">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
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
                    <Info className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
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

              <div className="rounded-[26px] border border-line bg-[var(--glass-tint)] p-5 backdrop-blur-xl sm:p-7">
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
                      <h3 className="text-[16px] text-ink">Request FMD Edge assistance</h3>
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
                          {(cfg?.contactMethods ?? ["phone", "whatsapp", "email"]).map((c) => (
                            <label key={c} className="cursor-pointer">
                              <input type="radio" name="contact" checked={f.contactMethod === c} onChange={() => set("contactMethod", c)} className="peer sr-only" />
                              <span className="block rounded-[12px] border border-line py-2.5 text-center text-[12.5px] text-ink-3 transition-all peer-checked:border-line-strong peer-checked:bg-[var(--accent-soft)] peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-1">
                                {METHOD_LABEL[c]}
                              </span>
                            </label>
                          ))}
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
                        <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1 accent-[var(--accent)]" />
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
                      <button disabled={busy || !cfg || !f.consent} className="btn-primary group h-12 w-full text-[14px] disabled:opacity-50">
                        {busy ? "Sending…" : "Request FMD Edge assistance"} <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
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
