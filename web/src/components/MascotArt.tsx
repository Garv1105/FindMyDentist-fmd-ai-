"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MascotModel = dynamic(() => import("./MascotModel"), { ssr: false });

/**
 * The 3D model standing in for each mascot artwork. Sources: model/mascot/compressed → public/models/mascots (as given);
 * the site loads public/models/rig: porcelain, rigged and meshopt + WebP (model/blender/mascots/build_rig.sh; their
 * motions are MascotModel's MOTIONS). public/models/compressed holds the same models unrigged (build_porcelain.sh).
 */
// bump ?v= whenever the models are rebuilt, or browsers keep the cached old ones
const M = (name: string) => `/models/rig/${name}.glb?v=3`;
type Art = { model: string; overlay?: { src: string; style: React.CSSProperties } };
const MODELS: Record<string, Art> = {
  "/img/mascots/mascot-guide-1024.webp": { model: M("guide") },
  "/img/mascots/mascot-laptop-1024.webp": { model: M("laptop") },
  "/img/mascots/mascot-read-1024.webp": { model: M("reading") },
  "/img/mascots/mascot-scholar-1024.webp": { model: M("scholar") },
  "/img/mascots/mascot-vault-1024.webp": { model: M("vault") },
  "/img/mascots/mascot-edge-1024.webp": { model: M("butler") },
  "/img/mascots/mascot-pin-1024.webp": { model: M("pin") },
  "/img/mascots/mascot-shield-1024.webp": { model: M("heart") },
  "/img/walkthrough/care-core-v2.webp": { model: M("tooth") },
  // the guide presenting a glass shield (the artwork's shield, redrawn as SVG), beside his open hand
  "/img/mascots/mascot-trust-1024.webp": {
    model: M("guide"),
    overlay: { src: "/img/mascots/shield.svg", style: { left: "56%", top: "26%", width: "40%" } },
  },
};

/** every model the page can show (and the walkthrough's mirrored guide): the loading screen fetches them up front */
export const MODEL_URLS = [...new Set([...Object.values(MODELS).map((a) => a.model), M("guide-left")])];

/**
 * Live canvases: once a model has appeared its canvas stays (paused while off screen), so coming back to it is instant.
 * Browsers cap a page at ~16 WebGL contexts (the hero takes some), so past LIVE the canvas scrolled away from longest ago
 * is released; its box then shows a snapshot of its own last frame until it is needed again (no visible change).
 */
const LIVE = 9;
const live = new Map<number, { seen: number; visible: boolean; key: string; release: () => void }>();
const snapshots = new Map<string, string>();
let nextId = 0;

function claim(id: number, key: string, visible: boolean, release: () => void) {
  live.set(id, { seen: performance.now(), visible, key, release });
  if (live.size <= LIVE) return;
  // only a canvas whose snapshot exists can go: its box keeps showing that picture
  let oldest: [number, number] | null = null;
  for (const [k, v] of live) if (!v.visible && snapshots.has(v.key) && (!oldest || v.seen < oldest[1])) oldest = [k, v.seen];
  if (oldest) {
    live.get(oldest[0])!.release();
    live.delete(oldest[0]);
  }
}

/*
 * Warm-up, behind the loading screen: every box creates its canvas in turn (one at a time: canvases are heavy to set
 * up), renders its first frames and keeps a snapshot, so no model is set up while the visitor scrolls. Hidden boxes
 * (another breakpoint's layout) and models already snapped elsewhere are skipped; a box that never renders is given
 * up on after WARM_STEP.
 */
const WARM_STEP = 6000;
const queue: (() => void)[] = [];
let warming = false;
let warmTotal = 0;
let warmDone = 0;
let waiters: ((fraction: number) => void)[] = [];
let ended: (() => void)[] = [];
function warmNext() {
  const next = queue.shift();
  if (next) {
    warming = true;
    next();
    return;
  }
  warming = false;
  ended.forEach((f) => f());
  ended = [];
  waiters = [];
}
function warmStep() {
  warmDone += 1;
  waiters.forEach((f) => f(warmDone / Math.max(warmTotal, 1)));
}
/** Resolves once every box on the page has its model set up (or skipped); reports the fraction done. */
export function warmedUp(onProgress: (fraction: number) => void = () => {}) {
  return new Promise<void>((resolve) => {
    if (!warming && !queue.length) return resolve();
    waiters.push(onProgress);
    ended.push(resolve);
  });
}

type Props = {
  /** the artwork; it shows until the model has loaded, and stays for artwork that has no model */
  src: string;
  /** a specific model instead of the artwork's own (e.g. a mirrored pose) */
  model?: string;
  sizes?: string;
  className?: string;
  /** "bottom" stands the model on the box's floor (like object-bottom); "center" centres it */
  align?: "bottom" | "center";
};

/**
 * Drop-in for `<Image fill>` mascot artwork: a slowly swaying 3D model in the same box. The artwork shows only until the
 * model's first frame; after that the model (or, if its canvas was released, a snapshot of it) is always there.
 */
export default function MascotArt({ src, model, sizes, className = "object-contain object-bottom", align = "bottom" }: Props) {
  const art = MODELS[src];
  const url = model ?? art?.model;
  const key = `${url}|${align}`;
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState<string | null>(null);
  const [, snapped] = useState(0); // re-render once a snapshot exists
  const warmTurn = useRef<(() => void) | null>(null); // set while this box is the one warming up

  useEffect(() => {
    if (!url || !box.current) return;
    const id = nextId++;
    const el = box.current;
    let alive = true;
    const release = () => {
      setMounted(false);
      setReady(null);
    };
    // the warm-up turn: mount the canvas off screen (paused), move on once its snapshot is taken
    warmTotal += 1;
    queue.push(() => {
      const done = () => {
        if (warmTurn.current !== done) return;
        warmTurn.current = null;
        warmStep();
        requestAnimationFrame(warmNext);
      };
      if (!alive || live.has(id) || snapshots.has(key) || el.getBoundingClientRect().width === 0) {
        warmStep();
        return warmNext();
      }
      warmTurn.current = done;
      setMounted(true);
      claim(id, key, false, release);
      setTimeout(done, WARM_STEP);
    });
    if (!warming) warmNext();
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        const entry = live.get(id);
        if (e.isIntersecting) {
          if (entry) {
            entry.visible = true;
            entry.seen = performance.now();
          } else {
            setMounted(true);
            claim(id, key, true, release);
          }
        } else if (entry) {
          entry.visible = false;
          entry.seen = performance.now();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
      live.delete(id);
      warmTurn.current?.();
    };
  }, [url, key]);

  const shown = ready === url;
  const still = snapshots.get(key); // this model's own frame, once it has rendered
  return (
    <div ref={box} className="absolute inset-0">
      {still && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL snapshot of the canvas
        <img src={still} alt="" className={`absolute inset-0 size-full ${shown ? "opacity-0" : "opacity-100"}`} />
      ) : (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          className={`${className} transition-opacity duration-500 ${url && shown ? "opacity-0" : "opacity-100"}`}
        />
      )}
      {url && mounted && (
        <div className={`absolute inset-0 ${still ? "" : "transition-opacity duration-500"} ${shown ? "opacity-100" : "opacity-0"}`}>
          <MascotModel
            url={url}
            align={align}
            active={visible}
            onReady={() => setReady(url)}
            onSnapshot={(d) => {
              snapshots.set(key, d);
              snapped((n) => n + 1);
              warmTurn.current?.();
            }}
          />
          {art?.overlay && !model && (
            // eslint-disable-next-line @next/next/no-img-element -- a small SVG, nothing to optimise
            <img src={art.overlay.src} alt="" className="mascot-float absolute h-auto" style={art.overlay.style} />
          )}
        </div>
      )}
      {art?.overlay && !model && !mounted && still && (
        // eslint-disable-next-line @next/next/no-img-element -- same prop over the snapshot
        <img src={art.overlay.src} alt="" className="mascot-float absolute h-auto" style={art.overlay.style} />
      )}
    </div>
  );
}
