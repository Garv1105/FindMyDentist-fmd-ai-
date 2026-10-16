"use client";

import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  ClipboardList,
  FileHeart,
  LayoutDashboard,
  ReceiptIndianRupee,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/me";
import { Container, Reveal, StatusTag, type Availability } from "../ui";

const FEATURES: { icon: typeof CalendarDays; title: string; body: string; s: Availability }[] = [
  { icon: CalendarDays, title: "Appointment management", body: "Manage clinic schedules and appointment-related workflows in one place.", s: "available" },
  { icon: FileHeart, title: "Digital patient records", body: "Organise patient information and records behind role-based access controls.", s: "available" },
  { icon: ReceiptIndianRupee, title: "Billing and payments", body: "Invoices, payment and refund recording, and a daily payments sheet.", s: "available" },
  { icon: BellRing, title: "Recalls and follow-ups", body: "See who is due for recall and manage reminders and continuity tasks.", s: "available" },
  { icon: Bot, title: "AI-assisted clinic workflows", body: "An AI clinic manager that prepares and assists with authorised administrative tasks.", s: "beta" },
  { icon: ShieldCheck, title: "Human oversight", body: "Sensitive actions follow the clinic's configured permissions and approval requirements.", s: "available" },
];

/** Brief §06: Clinic OS as a substantial, first-class product section with a real conversion path. */
type Kind = "clinic_demo" | "clinic_early_access";

export default function ClinicOS() {
  const [kind, setKind] = useState<Kind>("clinic_demo");
  return (
    <section id="clinic-os" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container>
        <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <p className="eyebrow mb-5">Built for modern dental clinics</p>
            <h2 className="type-h2-lg">
              <span className="headline-silver">Run your clinic with greater clarity.</span>{" "}
              <span className="bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-transparent">Build toward smarter workflows.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="type-lede">
              FMD Clinic OS brings essential clinic-management activities into one connected workspace, with AI-assisted administrative workflows
              as part of its broader vision.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#clinic-os-demo" onClick={() => setKind("clinic_demo")} className="btn-primary group h-11 px-5 text-[13.5px]">
                Book a demo <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
              </a>
              <a href="#clinic-os-demo" onClick={() => setKind("clinic_early_access")} className="btn-ghost h-11 px-5 text-[13.5px]">
                Join early access
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal y={30} className="mt-14">
          <DashboardPreview />
        </Reveal>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, s }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.06}>
              <div className="glass h-full rounded-[24px] p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="icon-tile size-11">
                    <Icon className="size-[18px]" strokeWidth={1.3} />
                  </span>
                  <StatusTag s={s} />
                </div>
                <h3 className="type-h3 mt-5">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14">
          <LeadForm kind={kind} setKind={setKind} />
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- dashboard preview: an illustration of real Clinic OS modules, labelled as such ---------------- */

const SCHEDULE = [
  { t: "09:00", who: "Demo patient · Scaling", s: "Confirmed" },
  { t: "10:30", who: "Demo patient · Root canal (2/3)", s: "Confirmed" },
  { t: "12:00", who: "Demo patient · Consultation", s: "Unconfirmed" },
  { t: "15:30", who: "Demo patient · Aligner review", s: "Confirmed" },
];

function DashboardPreview() {
  return (
    <figure className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -inset-y-10 -z-10 bg-[radial-gradient(50%_50%_at_50%_50%,rgb(var(--accent-rgb)/0.18),transparent_70%)] sm:-inset-x-6" />
      <div aria-hidden className="glass overflow-hidden rounded-[30px]">
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-white/15" />
            ))}
          </span>
          <span className="text-[12.5px] text-ink-2">FMD Clinic OS · Demo Dental Studio</span>
          <span className="ml-auto hidden text-[11.5px] text-ink-4 sm:block">Tue, 14 Oct</span>
        </div>
        <div className="grid md:grid-cols-[190px_1fr]">
          <nav className="hidden border-r border-line p-3 md:block">
            {[
              [LayoutDashboard, "Overview"],
              [CalendarDays, "Calendar"],
              [Users, "Patients"],
              [ReceiptIndianRupee, "Billing"],
              [ClipboardList, "Tasks"],
              [Bot, "AI manager"],
            ].map(([Icon, l], i) => {
              const I = Icon as typeof Users;
              return (
                <p key={l as string} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] ${i === 0 ? "bg-white/[0.07] text-ink" : "text-ink-3"}`}>
                  <I className="size-3.5" strokeWidth={1.5} /> {l as string}
                </p>
              );
            })}
          </nav>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Appointments today", "18"],
                ["Unconfirmed", "3"],
                ["Recalls due", "12"],
                ["Collected today", "₹42,600"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[18px] border border-line bg-white/[0.03] p-4">
                  <p className="text-[11.5px] text-ink-4">{k}</p>
                  <p className="mt-1.5 text-[22px] font-light tracking-[-0.02em] text-ink tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[18px] border border-line bg-white/[0.02] p-4">
                <p className="text-[12.5px] text-ink-2">Today&apos;s schedule</p>
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {SCHEDULE.map((a) => (
                    <li key={a.t} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                      <span className="w-11 tabular-nums text-ink-4">{a.t}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-2">{a.who}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] ${
                          a.s === "Confirmed" ? "bg-[rgba(74,222,160,0.12)] text-[#8ef0c2]" : "bg-[rgba(250,204,21,0.12)] text-[#f5d76e]"
                        }`}
                      >
                        {a.s}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="rounded-[18px] border border-line bg-white/[0.02] p-4">
                  <p className="text-[12.5px] text-ink-2">Billing this week</p>
                  <div className="mt-3 flex h-16 items-end gap-1.5">
                    {[40, 62, 48, 75, 58, 88, 30].map((h, i) => (
                      <span key={i} className="flex-1 rounded-t-md bg-[linear-gradient(180deg,#6fa4ff,#2f6bff)] opacity-80" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
                  <p className="flex items-center gap-2 text-[12.5px] text-ink">
                    <Bot className="size-3.5" strokeWidth={1.5} /> AI manager
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">3 tasks prepared · 1 recall batch awaiting your approval</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-3 text-center text-[12px] text-ink-4">
        <StatusTag s="concept" />
        Illustration of Clinic OS modules with demo data — not a live clinic.
        <Link href="/clinic" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          Already a customer? Open Clinic OS
        </Link>
      </figcaption>
    </figure>
  );
}

/* ---------------- demo / early access form: only what's needed to reply ---------------- */

const field =
  "h-12 w-full rounded-[14px] border border-line bg-[var(--surface-glass)] px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-[rgb(var(--accent-rgb)/0.6)] focus:ring-4 focus:ring-[rgb(var(--accent-rgb)/0.15)]";

function LeadForm({ kind, setKind }: { kind: Kind; setKind: (k: Kind) => void }) {
  const [f, setF] = useState({ name: "", clinicName: "", city: "", phone: "", email: "", website: "", consent: false });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setState("busy");
    try {
      await api("/api/leads", { method: "POST", body: { kind, ...f } });
      setState("done");
    } catch (er) {
      setErr((er as Error).message);
      setState("idle");
    }
  };

  return (
    <div id="clinic-os-demo" className="glass grid scroll-mt-28 gap-8 rounded-[32px] p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
      <div>
        <p className="type-label text-ink-4">For clinic owners and teams</p>
        <h3 className="mt-3 text-[28px] font-light leading-tight tracking-[-0.025em] text-ink">See Clinic OS with your own workflow in mind.</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-3">
          Book a guided demo, or join early access to hear first as new Clinic OS capabilities open up. We ask only for what we need to reply.
        </p>
        <ul className="mt-6 space-y-2.5 text-[13.5px] text-ink-2">
          {["A walkthrough of scheduling, records and billing", "How the AI clinic manager prepares work for approval", "No commitment — nothing is set up without you"].map(
            (t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[#8ef0c2]" strokeWidth={1.75} /> {t}
              </li>
            ),
          )}
        </ul>
      </div>

      {state === "done" ? (
        <div role="status" className="flex flex-col items-center justify-center rounded-[24px] border border-line bg-black/20 p-8 text-center">
          <span className="icon-tile size-14 !rounded-full">
            <Check className="size-6" strokeWidth={1.5} />
          </span>
          <p className="mt-5 text-[20px] font-light tracking-[-0.02em] text-ink">Request received</p>
          <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-3">
            {kind === "clinic_demo"
              ? "The FMD team will contact you to arrange a demo. Nothing has been scheduled yet."
              : "You're on the Clinic OS early-access list. We'll email you when there's something new to try."}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          <div role="radiogroup" aria-label="What would you like?" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-black/20 p-1">
            {(
              [
                ["clinic_demo", "Book a demo"],
                ["clinic_early_access", "Join early access"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`h-10 rounded-full text-[13px] transition-colors ${kind === k ? "bg-white text-[#1d4fd8]" : "text-ink-3 hover:text-ink"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-ink-3">Your name</span>
              <input required value={f.name} onChange={set("name")} autoComplete="name" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-ink-3">Clinic name</span>
              <input required value={f.clinicName} onChange={set("clinicName")} autoComplete="organization" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-ink-3">City</span>
              <input required value={f.city} onChange={set("city")} autoComplete="address-level2" placeholder="e.g. Bengaluru" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-ink-3">Mobile number</span>
              <input required value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel-national" className={field} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-ink-3">Work email</span>
            <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={field} />
          </label>
          {/* honeypot: hidden from people and assistive tech, bots fill it */}
          <input tabIndex={-1} autoComplete="off" aria-hidden value={f.website} onChange={set("website")} className="absolute -left-[9999px] size-px opacity-0" />
          <label className="flex items-start gap-3 text-[12.5px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={f.consent} onChange={set("consent")} className="mt-1 accent-[var(--accent)]" />
            <span>
              I agree that FMD may contact me about Clinic OS using these details. They are used only for this request and are never sold. See the{" "}
              <Link href="/legal#privacy" className="underline underline-offset-4">
                privacy notice
              </Link>
              .
            </span>
          </label>
          {err && (
            <p role="alert" className="rounded-[12px] border border-line-strong px-3 py-2 text-[12.5px] text-ink">
              <span className="font-medium">Error:</span> {err}
            </p>
          )}
          <button disabled={state === "busy" || !f.consent} className="btn-primary group h-12 w-full text-[14px] disabled:opacity-50">
            {state === "busy" ? "Sending…" : kind === "clinic_demo" ? "Request a demo" : "Join early access"}
            <ArrowRight className="arrow-nudge size-4" strokeWidth={1.75} />
          </button>
        </form>
      )}
    </div>
  );
}
