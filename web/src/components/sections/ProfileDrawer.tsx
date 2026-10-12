"use client";

import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, GraduationCap, Languages, MapPin, Navigation, Phone, Clock, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import { Avatar, Verification, type ProviderProfile } from "../providers";
import { Chip, SponsoredBadge } from "../ui";

export default function ProfileDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return <AnimatePresence>{id && <Drawer key={id} id={id} onClose={onClose} />}</AnimatePresence>;
}

function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<ProviderProfile | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<ProviderProfile>(`/api/providers/${id}`).then(setP).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_55%,transparent)] backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={p ? `${p.name} profile` : "Dentist profile"}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass absolute inset-y-2 right-2 flex w-[min(480px,calc(100%-16px))] flex-col overflow-hidden rounded-[28px]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-ink-4">{p?.demo ? "Demo profile · not a real practitioner" : "Dentist profile"}</span>
          <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {err && <p role="alert" className="text-[13px] text-ink">{err}</p>}
          {!p && !err && <p className="text-[13px] text-ink-4">Loading profile…</p>}
          {p && <ProfileBody p={p} />}
        </div>
        {p && (
          <footer className="flex gap-2 border-t border-line p-4">
            <Link href={`/dentists/${p.id}`} className="btn-ghost h-12 flex-1 text-[13.5px]">
              Full profile <ExternalLink className="size-3.5" strokeWidth={1.5} />
            </Link>
            <Link href={`/dentists/${p.id}#book`} className="btn-primary h-12 flex-1 text-[13.5px]">
              Request an appointment
            </Link>
          </footer>
        )}
      </motion.aside>
    </motion.div>
  );
}

/** Shared by the drawer and the /dentists/[id] page. */
export function ProfileBody({ p }: { p: ProviderProfile }) {
  const c = p.clinics[0];
  const facts: [typeof Clock, string, string][] = [
    [GraduationCap, "Qualifications", p.qualifications.join(", ") || "Not provided"],
    [Clock, "Experience", p.experienceYears ? `${p.experienceYears} years` : "Not provided"],
    [MapPin, "Clinic", c ? `${c.name}, ${c.area}` : "Not listed"],
    [Clock, "Hours", c?.hours || "Ask the clinic"],
    [Languages, "Languages", p.languages.join(", ") || "Not provided"],
    [Wallet, "Consultation", c?.feeNote || "Fee confirmed by the clinic"],
  ];
  return (
    <>
      <div className="flex gap-4">
        <Avatar p={p} className="h-[124px] w-[100px]" />
        <div className="pt-1">
          <div className="flex flex-wrap gap-1.5">
            <Verification v={p.verification} />
            {p.sponsored && <SponsoredBadge />}
          </div>
          <h2 className="mt-2 text-[22px] font-light tracking-[-0.02em] text-ink">{p.name}</h2>
          <p className="text-[13.5px] text-ink-3">{p.specialty}</p>
          <p className="mt-1.5 text-[12px] text-ink-4">No patient reviews yet</p>
        </div>
      </div>

      {p.verification.status === "verified" && p.verification.checks && (
        <p className="mt-4 rounded-[14px] border border-line px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-3">
          <span className="text-ink-2">What FMD verified:</span> {p.verification.checks}
        </p>
      )}
      {p.sponsored && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-4">Sponsored by {p.sponsored.sponsor}. Paid placement is not a clinical endorsement.</p>
      )}

      {p.bio && <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">{p.bio}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-[var(--border)]">
        {facts.map(([Icon, k, v]) => (
          <div key={k} className="bg-[var(--surface)] p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-4">
              <Icon className="size-3" strokeWidth={1.5} /> {k}
            </dt>
            <dd className="mt-1.5 text-[13px] leading-snug text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-ink-4">Services</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {p.services.map((s) => (
          <Chip key={s}>{s}</Chip>
        ))}
      </div>

      {c && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          {c.phone ? (
            <a href={`tel:${c.phone}`} className="btn-ghost h-10 text-[13px]">
              <Phone className="size-3.5" strokeWidth={1.5} /> Call clinic
            </a>
          ) : (
            <span className="grid h-10 place-items-center rounded-full border border-dashed border-line text-[12px] text-ink-4">No phone listed</span>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.name} ${c.address || c.area}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost h-10 text-[13px]"
          >
            <Navigation className="size-3.5" strokeWidth={1.5} /> Directions
          </a>
        </div>
      )}
    </>
  );
}
