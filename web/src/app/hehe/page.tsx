"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Play, Pause, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 150;
const FRAME_PATH = (idx: number) => `/frames/frame_${String(idx).padStart(4, "0")}.png`;

const FRAME_SCALE = 0.6;
const RISE_PHASE = 0.25;

const FLOAT_AMPLITUDE = 8;
const FLOAT_SPEED = 0.002;
const FLOAT_RESUME_DELAY = 220;

const DIALOGUE_TRIGGER_FRAME = 95;
const DIALOGUE_TEXT = "let me take over";

const EARTH_AWAKEN_START = 6;

export default function HehePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const loadedSetRef = useRef<Set<number>>(new Set());

  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const animFrameIdRef = useRef<number | null>(null);
  const targetFrameRef = useRef<number>(1);
  const frameYRef = useRef<number>(0);

  const floatAnimIdRef = useRef<number | null>(null);
  const floatStartRef = useRef<number>(0);
  const floatOffsetRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const scrollEndTimerRef = useRef<number | null>(null);
  const phaseAccumRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  // Mat visibility — flips on the first scroll, then never turns off
  const [matVisible, setMatVisible] = useState<boolean>(false);
  const hasScrolledRef = useRef<boolean>(false);

  const [dialogueVisible, setDialogueVisible] = useState<boolean>(false);
  const [typedText, setTypedText] = useState<string>("");
  const typingTimerRef = useRef<number | null>(null);

  const earthWrapperRef = useRef<HTMLDivElement | null>(null);

  const drawFrame = useCallback((frameIdx: number, floatOffset: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let img = imagesRef.current[frameIdx - 1];
    if (!img || !img.complete || img.naturalWidth === 0) {
      let fallbackImg: HTMLImageElement | null = null;
      for (let i = frameIdx - 1; i >= 1; i--) {
        const candidate = imagesRef.current[i - 1];
        if (candidate && candidate.complete && candidate.naturalWidth > 0) {
          fallbackImg = candidate;
          break;
        }
      }
      if (!fallbackImg) {
        for (let i = frameIdx + 1; i <= TOTAL_FRAMES; i++) {
          const candidate = imagesRef.current[i - 1];
          if (candidate && candidate.complete && candidate.naturalWidth > 0) {
            fallbackImg = candidate;
            break;
          }
        }
      }
      img = fallbackImg;
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    const maxW = cw * FRAME_SCALE;
    const maxH = ch * FRAME_SCALE;

    const imgAspect = iw / ih;
    let drawW = maxW;
    let drawH = drawW / imgAspect;

    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * imgAspect;
    }

    const nx = (cw - drawW) / 2;
    const centeredY = (ch - drawH) / 2;
    const bottomY = ch - drawH;
    const baseY = bottomY + (centeredY - bottomY) * frameYRef.current;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ny = baseY + floatOffset * dpr;

    ctx.drawImage(img, nx, ny, drawW, drawH);
  }, []);

  // Earth reveal progress → CSS vars (saturation, brightness, glow)
  useEffect(() => {
    const range = TOTAL_FRAMES - EARTH_AWAKEN_START;
    const raw = (currentFrame - EARTH_AWAKEN_START) / range;
    const reveal = Math.max(0, Math.min(1, raw));

    const el = earthWrapperRef.current;
    if (!el) return;

    el.style.setProperty("--reveal", String(reveal));
    el.style.setProperty("--sat", String(reveal));
    el.style.setProperty("--bri", String(0.3 + reveal * 0.7));
    const glow = reveal <= 0 ? 0 : Math.sin(reveal * Math.PI) * 0.9;
    el.style.setProperty("--glow", String(glow));
    el.style.setProperty("--glow-size", String(15 + reveal * 90));
  }, [currentFrame]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    drawFrame(targetFrameRef.current, floatOffsetRef.current);
  }, [drawFrame]);

  useEffect(() => {
    imagesRef.current = new Array(TOTAL_FRAMES).fill(null);
    let isCancelled = false;

    const firstImg = new window.Image();
    firstImg.src = FRAME_PATH(1);
    imagesRef.current[0] = firstImg;
    firstImg.onload = () => {
      if (isCancelled) return;
      loadedSetRef.current.add(1);
      setLoadedCount(loadedSetRef.current.size);
      handleResize();
      drawFrame(1, 0);
    };

    let nextIdxToLoad = 2;
    const concurrency = 6;

    const loadNext = () => {
      if (isCancelled || nextIdxToLoad > TOTAL_FRAMES) return;
      const idx = nextIdxToLoad++;
      const img = new window.Image();
      img.src = FRAME_PATH(idx);
      imagesRef.current[idx - 1] = img;

      img.onload = () => {
        if (isCancelled) return;
        loadedSetRef.current.add(idx);
        setLoadedCount(loadedSetRef.current.size);
        if (targetFrameRef.current === idx) {
          drawFrame(idx, floatOffsetRef.current);
        }
        loadNext();
      };

      img.onerror = () => {
        if (isCancelled) return;
        loadNext();
      };
    };

    for (let c = 0; c < concurrency; c++) {
      loadNext();
    }

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      isCancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, [drawFrame, handleResize]);

  useEffect(() => {
    floatStartRef.current = performance.now();
    lastTickRef.current = performance.now();
    phaseAccumRef.current = 0;

    const loop = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (!isScrollingRef.current) {
        phaseAccumRef.current += delta * FLOAT_SPEED;
        const offset = Math.sin(phaseAccumRef.current) * FLOAT_AMPLITUDE;
        floatOffsetRef.current = offset;
        drawFrame(targetFrameRef.current, offset);
      } else {
        floatOffsetRef.current = 0;
      }

      floatAnimIdRef.current = requestAnimationFrame(loop);
    };

    floatAnimIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (floatAnimIdRef.current) cancelAnimationFrame(floatAnimIdRef.current);
    };
  }, [drawFrame]);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      // First scroll → reveal the mat (once)
      if (!hasScrolledRef.current) {
        hasScrolledRef.current = true;
        setMatVisible(true);
      }

      isScrollingRef.current = true;
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
      scrollEndTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
      }, FLOAT_RESUME_DELAY);

      if (isPlaying) return;
      if (!ticking) {
        requestAnimationFrame(() => {
          ticking = false;
          const scrollY = window.scrollY || window.pageYOffset;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

          const riseProgress = Math.min(1, progress / RISE_PHASE);
          const newY = riseProgress;

          const framesProgress = Math.max(0, (progress - RISE_PHASE) / (1 - RISE_PHASE));
          const target = Math.min(
            TOTAL_FRAMES,
            Math.max(1, Math.round(framesProgress * (TOTAL_FRAMES - 1)) + 1)
          );

          if (Math.abs(newY - frameYRef.current) > 0.001) {
            frameYRef.current = newY;
          }

          if (target !== targetFrameRef.current) {
            targetFrameRef.current = target;
            setCurrentFrame(target);
          }

          drawFrame(target, 0);
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    };
  }, [drawFrame, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      return;
    }

    let lastTime = performance.now();
    const fps = 24;
    const interval = 1000 / fps;

    const loop = (currentTime: number) => {
      const delta = currentTime - lastTime;
      if (delta >= interval) {
        lastTime = currentTime - (delta % interval);
        const next = targetFrameRef.current >= TOTAL_FRAMES ? 1 : targetFrameRef.current + 1;
        targetFrameRef.current = next;
        setCurrentFrame(next);

        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = RISE_PHASE + ((next - 1) / (TOTAL_FRAMES - 1)) * (1 - RISE_PHASE);
        window.scrollTo({ top: progress * maxScroll, behavior: "auto" });
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Space toggles play — also counts as "user started" so reveal the mat
      if (e.key === " ") {
        e.preventDefault();
        if (!hasScrolledRef.current) {
          hasScrolledRef.current = true;
          setMatVisible(true);
        }
        setIsPlaying((p) => !p);
        return;
      }

      if (!hasScrolledRef.current) {
        hasScrolledRef.current = true;
        setMatVisible(true);
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        const next = Math.min(TOTAL_FRAMES, targetFrameRef.current + 1);
        targetFrameRef.current = next;
        setCurrentFrame(next);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        const prev = Math.max(1, targetFrameRef.current - 1);
        targetFrameRef.current = prev;
        setCurrentFrame(prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const shouldShow = currentFrame >= DIALOGUE_TRIGGER_FRAME;

    if (shouldShow && !dialogueVisible) {
      setDialogueVisible(true);
      setTypedText("");
      let i = 0;
      const tick = () => {
        i++;
        setTypedText(DIALOGUE_TEXT.slice(0, i));
        if (i < DIALOGUE_TEXT.length) {
          typingTimerRef.current = window.setTimeout(tick, 70);
        }
      };
      typingTimerRef.current = window.setTimeout(tick, 250);
    } else if (!shouldShow && dialogueVisible) {
      setDialogueVisible(false);
      setTypedText("");
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }
  }, [currentFrame, dialogueVisible]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const progressPercent = Math.round(((currentFrame - 1) / (TOTAL_FRAMES - 1)) * 100);

  return (
    <div
      ref={containerRef}
      className="relative min-h-[550vh] bg-[#050505] text-[#f5f5f5] selection:bg-white/20 selection:text-white"
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="fixed inset-0 z-0 h-full w-full pointer-events-none"
        style={{ background: "#050505" }}
      />

      <div
        aria-hidden
        className="fixed inset-0 z-1 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,transparent_45%,rgba(5,5,5,0.85)_90%)]"
      />

      {/* Earth wrapper */}
      <div
        ref={earthWrapperRef}
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-1/2 z-10 w-[max(100vw,1200px)] -translate-x-1/2"
        style={{
          aspectRatio: "1280 / 172",
          ["--reveal" as string]: 0,
          ["--sat" as string]: 0,
          ["--bri" as string]: 0.3,
          ["--glow" as string]: 0,
          ["--glow-size" as string]: 15,
        }}
      >
        {/* Inner clipping layer for the earth image */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 earth-img-layer">
            <Image
              src="/earth.webp"
              alt="Earth"
              fill
              priority
              sizes="100vw"
              className="hero-earth object-cover"
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 earth-top-fade" />

          <div className="pointer-events-none absolute earth-glow-layer" />

          <div className="pointer-events-none absolute left-1/2 top-[30%] h-12 w-3/4 -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(214,226,245,0.35)_0%,transparent_70%)] blur-md earth-apex" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#050505] to-transparent" />
        </div>

        {/* 
          Mat — revealed on first scroll with a beautiful entrance:
          fades in, scales up from 0.6, and drifts upward into place.
        */}
        <div
          className={`pointer-events-none absolute left-1/2 earth-mat-wrapper ${
            matVisible ? "mat-visible" : ""
          }`}
        >
          <Image
            src="/mat.png"
            alt="Mat"
            width={320}
            height={90}
            priority
            className="earth-mat object-contain"
          />
        </div>
      </div>

      <style jsx>{`
        .earth-img-layer {
          filter: saturate(var(--sat)) brightness(var(--bri));
          transition: filter 220ms linear;
        }

        /* 
          Colored reveal — now anchored at the CENTER of the earth and
          expanding outward to left, right, and downward. Ellipse grows
          symmetrically from the middle. Origin at 50% horizontal, and
          vertically at ~65% so it starts at the visual center of the
          earth's curve and blooms outward.
        */
        .earth-img-layer::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("/earth.webp");
          background-size: cover;
          background-position: center;
          filter: none;
          -webkit-mask-image: radial-gradient(
            ellipse 80% 90% at 50% 65%,
            #000 0%,
            #000 calc(var(--reveal) * 145% - 25%),
            transparent calc(var(--reveal) * 145% + 10%)
          );
          mask-image: radial-gradient(
            ellipse 80% 90% at 50% 65%,
            #000 0%,
            #000 calc(var(--reveal) * 145% - 25%),
            transparent calc(var(--reveal) * 145% + 10%)
          );
          transition: -webkit-mask-image 220ms linear, mask-image 220ms linear;
        }

        .earth-top-fade {
          height: 55%;
          background: linear-gradient(
            to bottom,
            #050505 0%,
            rgba(5, 5, 5, 0.95) 12%,
            rgba(5, 5, 5, 0.75) 30%,
            rgba(5, 5, 5, 0.45) 50%,
            rgba(5, 5, 5, 0.18) 70%,
            rgba(5, 5, 5, 0.05) 85%,
            transparent 100%
          );
          z-index: 3;
          pointer-events: none;
        }

        /* Mat wrapper — base (hidden) state */
        .earth-mat-wrapper {
          top: 50px;
          z-index: 20;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.6);
          filter: saturate(var(--sat)) brightness(var(--bri))
                  drop-shadow(0 0 24px rgba(180, 210, 255, 0))
                  drop-shadow(0 0 6px rgba(255, 240, 210, 0));
          transition:
            opacity 900ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 1100ms cubic-bezier(0.16, 1, 0.3, 1),
            filter 800ms ease-out;
        }

        /* Revealed state — fades in, scales up, settles into position */
        .earth-mat-wrapper.mat-visible {
          opacity: 1;
          transform: translate(-50%, -85%) scale(1);
          filter: saturate(var(--sat)) brightness(var(--bri))
                  drop-shadow(0 0 24px rgba(180, 210, 255, 0.35))
                  drop-shadow(0 0 6px rgba(255, 240, 210, 0.25));
          animation: mat-breathe 5.5s ease-in-out infinite;
          animation-delay: 1100ms;
        }

        .earth-mat {
          width: clamp(180px, 26vw, 360px);
          height: auto;
        }

        @keyframes mat-breathe {
          0%, 100% {
            transform: translate(-50%, -85%) scale(1);
          }
          50% {
            transform: translate(-50%, -88%) scale(1.02);
          }
        }

        .earth-glow-layer {
          position: absolute;
          top: 0;
          left: 50%;
          width: calc(var(--glow-size) * 1%);
          height: calc(var(--glow-size) * 1%);
          transform: translate(-50%, 10%);
          border-radius: 9999px;
          background: radial-gradient(
            circle at center,
            rgba(255, 240, 210, calc(var(--glow) * 0.55)) 0%,
            rgba(255, 200, 140, calc(var(--glow) * 0.3)) 40%,
            rgba(120, 200, 255, calc(var(--glow) * 0.15)) 65%,
            transparent 85%
          );
          filter: blur(24px);
          transition: width 200ms linear, height 200ms linear, background 200ms linear;
          pointer-events: none;
          z-index: 4;
        }

        .earth-apex {
          opacity: calc(0.05 + var(--reveal) * 0.35);
          transition: opacity 220ms linear;
          z-index: 5;
        }
      `}</style>

      {/* Dialogue */}
      <div
        className={`pointer-events-none fixed top-[12%] left-1/2 transition-all duration-700 ease-out ${
          dialogueVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
        style={{ zIndex: 25, transform: "translateX(-50%)" }}
        aria-live="polite"
      >
        <div className="relative max-w-md">
          <div className="relative rounded-2xl border border-white/20 bg-gradient-to-br from-white/[0.12] to-white/[0.04] px-6 py-4 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(120,200,255,0.5)]">
            <p className="text-lg sm:text-2xl font-light italic text-white/95 leading-snug">
              &ldquo;{typedText}
              <span
                className="ml-0.5 inline-block w-[2px] animate-pulse bg-cyan-300 align-middle"
                style={{ height: "1em" }}
              />
              &rdquo;
            </p>
          </div>
          <div className="absolute left-1/2 -bottom-2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/20 bg-white/[0.08] backdrop-blur-xl" />
        </div>
      </div>

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-4 sm:px-8 backdrop-blur-md bg-[#050505]/40 border-b border-white/[0.08]">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/80 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>FindMyDentist</span>
        </Link>

        <div className="hidden sm:flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 backdrop-blur-md text-[11px] font-mono tracking-wider text-white/70">
          <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>FRAME</span>
          <span className="text-white font-semibold">
            {String(currentFrame).padStart(4, "0")}
          </span>
          <span className="text-white/30">/</span>
          <span className="text-white/50">{TOTAL_FRAMES}</span>
          <span className="text-white/20">|</span>
          <span className="text-white/60">{progressPercent}%</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/[0.12] hover:border-white/20 active:scale-95"
          >
            {isPlaying ? (
              <>
                <Pause className="size-3 text-amber-300" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3 text-emerald-400 fill-emerald-400" />
                <span className="hidden sm:inline">Play</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            title="Reset to frame 1"
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-all hover:bg-white/[0.1] hover:text-white"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Scrubber */}
      <div className="fixed bottom-12 inset-x-0 z-30 pointer-events-none flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/15 bg-black/70 px-4 py-2 backdrop-blur-xl shadow-2xl">
          <span className="text-[11px] font-mono text-white/60 uppercase tracking-wider">
            Scrub
          </span>
          <input
            type="range"
            min={1}
            max={TOTAL_FRAMES}
            value={currentFrame}
            onChange={(e) => {
              const val = Number(e.target.value);
              setIsPlaying(false);
              if (!hasScrolledRef.current) {
                hasScrolledRef.current = true;
                setMatVisible(true);
              }
              targetFrameRef.current = val;
              setCurrentFrame(val);
              frameYRef.current = 1;
              const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
              const progress = RISE_PHASE + ((val - 1) / (TOTAL_FRAMES - 1)) * (1 - RISE_PHASE);
              window.scrollTo({ top: progress * maxScroll, behavior: "auto" });
            }}
            className="h-1.5 w-32 sm:w-48 cursor-pointer appearance-none rounded-lg bg-white/20 accent-white outline-none"
          />
          <span className="text-[11px] font-mono text-white font-medium min-w-[50px] text-right">
            {currentFrame} / {TOTAL_FRAMES}
          </span>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-30 pointer-events-none hidden md:block">
        <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-mono text-white/40 backdrop-blur-md">
          {loadedCount === TOTAL_FRAMES
            ? "ALL 150 FRAMES BUFFERED"
            : `BUFFERING: ${loadedCount}/${TOTAL_FRAMES}`}
        </div>
      </div>
    </div>
  );
}