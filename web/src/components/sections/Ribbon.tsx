import { BadgeCheck, ConciergeBell, GraduationCap, LockKeyhole, ShieldCheck, Sparkles, Stethoscope, Tag, Wallet, type LucideIcon } from "lucide-react";

// Only what the product already says about itself elsewhere on the page (AI languages, labels, records, the apps).
const POINTS: { icon: LucideIcon; strong: string; rest: string }[] = [
  { icon: Sparkles, strong: "FMD AI", rest: "in five languages" },
  { icon: BadgeCheck, strong: "Verified dentists", rest: "clearly marked" },
  { icon: Tag, strong: "Sponsored", rest: "always labelled" },
  { icon: LockKeyhole, strong: "Consent-first", rest: "dental records" },
  { icon: ConciergeBell, strong: "FMD Edge", rest: "your private care concierge" },
  { icon: Stethoscope, strong: "Clinic OS", rest: "with an AI clinic manager" },
  { icon: GraduationCap, strong: "FMD Scholar", rest: "for dental students" },
  { icon: Wallet, strong: "SaveIN", rest: "treatment in easy EMIs" },
  { icon: ShieldCheck, strong: "Guidance", rest: "never a diagnosis" },
];

function Points({ copy }: { copy?: boolean }) {
  return (
    <ul aria-hidden={copy} className="flex shrink-0 items-center">
      {POINTS.map(({ icon: Icon, strong, rest }) => (
        <li key={strong} className="flex shrink-0 items-center">
          <span className="flex items-center gap-3 whitespace-nowrap px-7 sm:px-9">
            <Icon className="size-[22px] shrink-0 text-[rgb(var(--horizon-rgb)/0.75)]" strokeWidth={1.4} />
            <span className="text-[17px] tracking-[-0.015em] sm:text-[20px]">
              <span className="font-medium text-ink">{strong}</span> <span className="font-light text-ink-3">{rest}</span>
            </span>
          </span>
          {/* a small rotated square of light between points */}
          <span aria-hidden className="size-[5px] rotate-45 bg-[rgb(var(--horizon-rgb)/0.35)] shadow-[0_0_8px_rgb(var(--horizon-rgb)/0.4)]" />
        </li>
      ))}
    </ul>
  );
}

/** Section 02: what FMD stands for, gliding past between the hero and FMD AI. */
export default function Ribbon() {
  return (
    <section aria-labelledby="ribbon-title" className="relative isolate pb-4 pt-24 sm:pb-6 sm:pt-36">
      {/* the hero's last frame ends on a hard edge; this veil, drawn over its bottom, lets it fade into the page */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-40 bg-[linear-gradient(180deg,transparent,var(--background))]" />
      <p id="ribbon-title" className="mx-auto max-w-[680px] px-6 text-center text-[14.5px] leading-relaxed text-ink-3 sm:text-[16px]">
        Built for every dental need: patients, dentists, clinics and students.
      </p>

      {/* no band, no borders: the points sit straight on the page and dissolve into it at both edges, as in the reference;
          the track holds the list twice and slides left by one copy, looping */}
      <div className="fmd-marquee relative mt-6 sm:mt-8">
        <div className="overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]">
          <div className="fmd-marquee-track flex w-max">
            <Points />
            <Points copy />
          </div>
        </div>
      </div>
    </section>
  );
}
