"use client";

import { AlertTriangle, ChartColumn, CircleHelp, Heart, Sparkles, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Contain from "@/components/Contain";
import { FEELING_LABEL, type Feeling, type Mood } from "@/lib/expression";
import { usePhone } from "@/lib/phone";
import { stillImg } from "@/lib/stills";

export const GUIDE_STILL = "/models/stills/guide.webp?v=3";
const GUIDE_LOOP = "/models/loops/guide.webp?v=1";

const stillImgEl = (
  // eslint-disable-next-line @next/next/no-img-element -- versioned still, cached forever
  <img {...stillImg(GUIDE_STILL)} alt="" decoding="async" className="absolute inset-0 size-full object-contain object-bottom" />
);

// the homepage's FMD AI model (WebGL, so never on the server); while its code downloads, the still holds the space
const AssistantMascot = dynamic(() => import("@/components/hero/AssistantMascot"), { ssr: false, loading: () => stillImgEl });

/** The sign by its head for each feeling, in the theme's own colours (none when calm). */
const CUES: Record<Exclude<Feeling, "calm">, { Icon: LucideIcon; color: string }> = {
  alert: { Icon: AlertTriangle, color: "var(--tone-bad)" },
  empathy: { Icon: Heart, color: "#e0607e" },
  cheer: { Icon: Sparkles, color: "#d2a23a" },
  focused: { Icon: ChartColumn, color: "rgb(var(--accent-rgb))" },
  curious: { Icon: CircleHelp, color: "rgb(var(--accent-rgb))" },
};

/**
 * FMD AI's mascot, shared by every app: the body clip from `mood`, and the feeling as an aura and a sign by its head
 * (lib/expression.ts decides both). The 3D model on desktop; its pre-rendered loop on phones; `lite` uses the still
 * (for small, always-visible spots like a launcher button, where a WebGL canvas isn't worth it).
 */
export function AiMascot({ mood, feeling = "calm", lite = false, className }: { mood: Mood; feeling?: Feeling; lite?: boolean; className: string }) {
  const phone = usePhone();
  const cue = feeling === "calm" ? null : CUES[feeling];
  return (
    <div className={`relative ${className}`}>
      {cue && (
        <span
          aria-hidden
          className="ai-aura pointer-events-none absolute inset-[6%] -z-0 rounded-full"
          style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${cue.color} 34%, transparent), transparent)` }}
        />
      )}
      <div aria-hidden className="absolute inset-0">
        {lite ? (
          stillImgEl
        ) : phone ? (
          // eslint-disable-next-line @next/next/no-img-element -- an animated WebP, already sized
          <img src={GUIDE_LOOP} alt="" decoding="async" className="absolute inset-0 size-full object-contain object-bottom" />
        ) : (
          // one mascot at a time: the 3D model, or its still if the model can't load (never both, or they overlap)
          <Contain fallback={stillImgEl}>
            <AssistantMascot mood={mood} active />
          </Contain>
        )}
      </div>
      {cue && (
        <span
          key={feeling}
          aria-hidden
          className="ai-cue absolute right-[4%] top-[2%] grid size-[clamp(18px,24%,34px)] place-items-center rounded-full border bg-[var(--surface-elevated)] shadow-md"
          style={{ color: cue.color, borderColor: `color-mix(in srgb, ${cue.color} 45%, transparent)` }}
        >
          <cue.Icon className="size-[58%]" strokeWidth={2} />
        </span>
      )}
      {cue && <span className="sr-only">{FEELING_LABEL[feeling]}</span>}
    </div>
  );
}
