"use client";

import { BadgeCheck, Clock3, ShieldQuestion } from "lucide-react";
import Image from "next/image";

/** Shape returned by /api/providers (see server/providers.ts). */
export type ProviderCard = {
  id: string;
  name: string;
  photo: string;
  specialty: string;
  experienceYears: number | null;
  languages: string[];
  services: string[];
  clinic: { name: string; area: string; city: string } | null;
  verification: { status: "unverified" | "pending" | "verified"; checks: string };
  sponsored: { sponsor: string } | null;
  rating: null;
  /** epoch ms of the earliest open slot from a connected schedule */
  nextAvailable: number | null;
  demo: boolean;
};

export type ProviderProfile = ProviderCard & {
  qualifications: string[];
  bio: string;
  clinics: { id: string; name: string; area: string; city: string; address: string; phone: string; hours: string; feeNote: string }[];
  claimed: boolean;
};

/** Photo, or initials when none — never a stock face standing in for a real person. */
export function Avatar({ p, className = "" }: { p: Pick<ProviderCard, "name" | "photo" | "demo">; className?: string }) {
  const initials = p.name.replace(/^Dr\.?\s*/, "").split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-[16px] border border-line ${className}`}>
      {p.photo ? (
        <Image src={p.photo} alt={`${p.name}${p.demo ? " (demo profile)" : ""}`} fill sizes="120px" className="object-cover" />
      ) : (
        <div aria-hidden className="grid size-full place-items-center bg-[var(--surface-elevated)] text-[22px] font-light text-ink-3">
          {initials}
        </div>
      )}
    </div>
  );
}

/** Verification states use text + icon, never colour alone. Tooltip shows exactly what was checked. */
export function Verification({ v }: { v: ProviderCard["verification"] }) {
  if (v.status === "verified")
    return (
      <span title={v.checks || "Checked by FMD"} className="inline-flex w-fit items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-2">
        <BadgeCheck className="size-3" strokeWidth={1.75} /> Verified
      </span>
    );
  if (v.status === "pending")
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-4">
        <Clock3 className="size-3" strokeWidth={1.5} /> Verification pending
      </span>
    );
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-4">
      <ShieldQuestion className="size-3" strokeWidth={1.5} /> Not verified
    </span>
  );
}
