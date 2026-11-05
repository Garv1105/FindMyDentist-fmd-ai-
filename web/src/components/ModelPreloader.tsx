"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SEEN = "fmd-models-ready";
const MAX_WAIT = 25000;

/**
 * Home page loading screen: shown (server-rendered) while every 3D model downloads, then while each mascot's canvas is
 * set up and rendered once behind it (MascotArt's warm-up), then fades out, so the mascots are all there as you scroll. Skipped for the rest of the session once everything is cached;
 * never shows for more than MAX_WAIT.
 */
export default function ModelPreloader() {
  const [state, setState] = useState<"loading" | "leaving" | "gone">("loading");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {}
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {}
      setPct(1);
      setState(seen ? "gone" : "leaving");
    };
    if (seen) void Promise.resolve().then(finish); // cached already: drop the screen straight away
    const timer = setTimeout(finish, MAX_WAIT);
    // downloads are the first 80% of the bar, setting up the canvases the rest
    const bar = (f: number) => setPct((p) => Math.max(p, f));
    import("./preloadModels").then(({ preloadModels }) =>
      preloadModels((f) => bar(0.8 * f))
        .then(() => import("./MascotArt"))
        .then(({ warmedUp }) => warmedUp((f) => bar(0.8 + 0.2 * f)))
        .then(finish),
    );
    return () => clearTimeout(timer);
  }, []);

  // no scrolling under the loading screen
  useEffect(() => {
    if (state !== "loading") return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [state]);

  if (state === "gone") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading FindMyDentist"
      onTransitionEnd={() => state === "leaving" && setState("gone")}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
        state === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_45%,rgb(59_130_246/0.22),transparent_70%)]" />
      <div className="mascot-float relative size-[170px]">
        <Image src="/img/mascots/mascot-guide-1024.webp" alt="" fill priority sizes="170px" className="object-contain" />
      </div>
      <p className="relative mt-6 text-[15px] font-semibold tracking-[-0.01em] text-white">
        FMD <span className="font-normal text-white/60">· FindMyDentist</span>
      </p>
      <div className="relative mt-5 h-[3px] w-[200px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#93c5fd] transition-[width] duration-300"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <p className="relative mt-3 text-[12px] tabular-nums text-white/50">Preparing your guide… {Math.round(pct * 100)}%</p>
    </div>
  );
}
