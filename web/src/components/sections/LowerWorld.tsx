import type { ReactNode } from "react";

/**
 * The environment behind sections 03–11, in two layers:
 *  1. here, one shared foundation (.fmd-depth): obsidian drifting very slowly between near-black and midnight navy;
 *  2. in each section, an <Atmosphere scene> light field: that section's own lighting, defined once in globals.css.
 * Scoped to this wrapper (own stacking context) so nothing reaches the hero. Pure CSS, nothing animated.
 */
export default function LowerWorld({ children }: { children: ReactNode }) {
  return (
    <div className="fmd-world relative isolate pb-10">
      <div
        aria-hidden
        className="fmd-depth pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,transparent,#000_2%,#000_98%,transparent)]"
      />
      {children}
    </div>
  );
}

/**
 * The homepage's lighting scenes, one per section (see the `.fmd-atmosphere[data-scene]` rules in globals.css for what
 * each one is). Cool and quiet near the top; darker veils where a section needs to stand apart (journey, vault, edge);
 * precise local light for discovery and trust; three product pools for FMD OS.
 */
export type Scene = "search" | "assistant" | "walkthrough" | "learn" | "journey" | "vault" | "edge" | "discovery" | "trust" | "os";

/**
 * A section's light field. Sits behind the section's content (the section must be `relative isolate`) and reaches
 * 6rem past its top and bottom so it fades into the neighbouring sections instead of ending on a hard line.
 * Never intercepts pointer events; spans the section's width only, so it can't cause sideways overflow.
 */
export function Atmosphere({ scene }: { scene: Scene }) {
  return <div aria-hidden className="fmd-atmosphere" data-scene={scene} />;
}
