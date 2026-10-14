"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Play, Pause, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 150;
const FRAME_PATH = (idx: number) => `/frames/frame_${String(idx).padStart(4, "0")}.png`;

/** Max share of the viewport (width and height) the frame sequence may fill. */
const FRAME_SCALE = 0.45;
const RISE_PHASE = 0.25;

const FLOAT_AMPLITUDE = 8;
const FLOAT_SPEED = 0.002;
const FLOAT_RESUME_DELAY = 220;

const DIALOGUE_TRIGGER_FRAME = 95;
const DIALOGUE_TEXT = "let me take over";

/**
 * The mat appears when the section has been scrolled into at least this
 * fraction of its scrollable height, and disappears when progress falls
 * back below this threshold (i.e. user scrolled back to the very top).
 */
const MAT_SHOW_THRESHOLD = 0.02;

export interface HeroSectionProps {
  scrollHeightVh?: number;
  brandLabel?: string;
  brandHref?: string;
  dialogueText?: string;
  className?: string;
  showHeader?: boolean;
}

export default function HeroSection({
  scrollHeightVh = 550,
  brandLabel = "FindMyDentist",
  brandHref = "/",
  dialogueText = DIALOGUE_TEXT,
  className = "",
  showHeader = true,
}: HeroSectionProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const loadedSetRef = useRef<Set<number>>(new Set());

  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [inView, setInView] = useState<boolean>(true);
  const [matVisible, setMatVisible] = useState<boolean>(false);
  const [dialogueVisible, setDialogueVisible] = useState<boolean>(false);
  const [typedText, setTypedText] = useState<string>("");
  const [headingOpacity, setHeadingOpacity] = useState<number>(1);

  const animFrameIdRef = useRef<number | null>(null);
  const floatAnimIdRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<number | null>(null);

  const targetFrameRef = useRef<number>(1);
  const frameYRef = useRef<number>(0);

  const floatStartRef = useRef<number>(0);
  const floatOffsetRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const phaseAccumRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  const hasScrolledRef = useRef<boolean>(false);
  const inViewRef = useRef<boolean>(true);

  // ---------------------------------------------------------------------------
  // Section-relative scroll progress
  // ---------------------------------------------------------------------------
  const getSectionProgress = useCallback(() => {
    const section = containerRef.current;
    if (!section) return 0;
    const rect = section.getBoundingClientRect();
    const scrolledInto = -rect.top;
    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return Math.min(1, Math.max(0, scrolledInto / scrollable));
  }, []);

  const scrollToSectionProgress = useCallback((progress: number) => {
    const section = containerRef.current;
    if (!section) return;
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.offsetTop + progress * scrollable;
    window.scrollTo({ top, behavior: "auto" });
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas drawing
  // ---------------------------------------------------------------------------
  const drawFrame = useCallback((frameIdx: number, floatOffset: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000000";
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

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Preload frames
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Float animation loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    floatStartRef.current = performance.now();
    lastTickRef.current = performance.now();
    phaseAccumRef.current = 0;

    const loop = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (!inViewRef.current) {
        floatAnimIdRef.current = requestAnimationFrame(loop);
        return;
      }

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

  // ---------------------------------------------------------------------------
  // IntersectionObserver
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const section = containerRef.current;
    if (!section) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        setInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!hasScrolledRef.current) {
        hasScrolledRef.current = true;
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
          const progress = getSectionProgress();

          if (progress > MAT_SHOW_THRESHOLD) {
            if (!matVisible) setMatVisible(true);
          } else {
            if (matVisible) setMatVisible(false);
          }

          const HERO_HEADING_FADE_END = 0.15;
          const headingT = Math.min(1, Math.max(0, progress / HERO_HEADING_FADE_END));
          setHeadingOpacity(1 - headingT);

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
  }, [drawFrame, isPlaying, getSectionProgress, matVisible]);

  // ---------------------------------------------------------------------------
  // Autoplay
  // ---------------------------------------------------------------------------
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

        const progress = RISE_PHASE + ((next - 1) / (TOTAL_FRAMES - 1)) * (1 - RISE_PHASE);
        scrollToSectionProgress(progress);
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, scrollToSectionProgress]);

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!inViewRef.current) return;

      if (e.key === " ") {
        e.preventDefault();
        if (!hasScrolledRef.current) {
          hasScrolledRef.current = true;
        }
        setIsPlaying((p) => !p);
        return;
      }

      if (!hasScrolledRef.current) {
        hasScrolledRef.current = true;
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

  // ---------------------------------------------------------------------------
  // Dialogue
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const shouldShow = currentFrame >= DIALOGUE_TRIGGER_FRAME;

    if (shouldShow && !dialogueVisible) {
      setDialogueVisible(true);
      setTypedText("");
      let i = 0;
      const tick = () => {
        i++;
        setTypedText(dialogueText.slice(0, i));
        if (i < dialogueText.length) {
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
  }, [currentFrame, dialogueVisible, dialogueText]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const progressPercent = Math.round(((currentFrame - 1) / (TOTAL_FRAMES - 1)) * 100);

  const headingInteractive = headingOpacity > 0.5;

  return (
    <section
      ref={containerRef}
      className={`relative bg-black text-[#f5f5f5] selection:bg-white/20 selection:text-white ${className}`}
      style={{ height: `${scrollHeightVh}vh` }}
      data-in-view={inView ? "true" : "false"}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Frame canvas */}
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 z-0 h-full w-full pointer-events-none"
          style={{ background: "#000000" }}
        />

        {/* Vignette */}
        <div
          aria-hidden
          className="absolute inset-0 z-1 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,transparent_45%,rgba(0,0,0,0.85)_90%)]"
        />

        {/* HERO HEADING */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-[8%] z-20 flex flex-col items-center px-6 text-center transition-opacity duration-300 ${
            headingInteractive ? "" : "pointer-events-none"
          }`}
          style={{
            opacity: headingOpacity,
            transform: `translateY(${(1 - headingOpacity) * -16}px)`,
          }}
          aria-hidden={!headingInteractive}
        >
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md">
            <span className="inline-block size-1.5 rounded-full bg-[#8CBFFF] shadow-[0_0_12px_rgba(140,191,255,0.9)]" />
            <span className="text-[10.5px] font-mono uppercase tracking-[0.32em] text-[#8CBFFF]/85">
              FindMyDentist
            </span>
          </div>

          <h1 className="max-w-4xl text-[34px] font-extralight leading-[1.05] tracking-[-0.035em] text-white sm:text-[56px] md:text-[68px]">
            <span className="block">Better care.</span>
            <span className="block">Smarter clinics.</span>
            <span
              className="block bg-gradient-to-r from-[#8CBFFF] via-[#F4F7FF] to-[#8CBFFF] bg-clip-text text-transparent"
              style={{ textShadow: "0 0 60px rgba(140,191,255,0.35)" }}
            >
              Brighter smiles.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-[13.5px] leading-relaxed text-white/55 sm:text-[15px]">
            One platform for patients and dental professionals — clearer
            answers, vetted clinics, and better outcomes.
          </p>

          <div className="mt-10 flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.28em] text-white/35">
            <span className="block h-px w-8 bg-white/25" />
            <span>Scroll to begin</span>
            <span className="block h-px w-8 bg-white/25" />
          </div>
        </div>

        {/* Earth + mat */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 w-[max(100vw,1200px)] -translate-x-1/2"
          style={{
            aspectRatio: "1280 / 172",
            // Static, fully-lit earth — no scroll-driven brightening or glow burst
            ["--reveal" as string]: 1,
            ["--sat" as string]: 1,
            ["--bri" as string]: 1,
            ["--glow" as string]: 0,
            ["--glow-size" as string]: 15,
          }}
        >
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

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent" />
          </div>

          {/* <div
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
          </div> */}
        </div>
        {/* ------------------------------------------------------------------
            DIALOGUE — thinking cloud with typewriter text on top
        ------------------------------------------------------------------ */}
        <div
        className={`hero-chrome pointer-events-none absolute top-[8%] left-[35%] transition-all duration-700 ease-out ${
            dialogueVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
        style={{ zIndex: 25, transform: "translateX(-50%)" }}
        aria-live="polite"
        >
        <div className="relative w-[320px] sm:w-[280px]">
            {/* Thinking cloud background */}
            <Image
            src="/thinking-cloud-image-png.webp"
            alt=""
            width={280}
            height={175}
            priority
            className="select-none object-contain"
            style={{ width: "100%", height: "auto" }}
            draggable={false}
            />

            {/* Typewriter text — positioned inside the cloud's body */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[8%] pb-[26%] pr-[22%]">
            <p className="text-center text-[15px] font-light italic leading-snug text-[#0B1428] sm:text-[18px]">
                &ldquo;{typedText}
                <span
                className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-[#0B1428]/70 align-middle"
                />
                &rdquo;
            </p>
            </div>
        </div>
        </div>

        {/* Optional header */}
        {showHeader && (
          <header className="hero-chrome absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-4 sm:px-8 backdrop-blur-md bg-black/40 border-b border-white/[0.08]">
            <Link
              href={brandHref}
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/80 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>{brandLabel}</span>
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
                  scrollToSectionProgress(0);
                }}
                title="Reset to frame 1"
                className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-all hover:bg-white/[0.1] hover:text-white"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          </header>
        )}

        {/* Scrubber */}
        <div className="hero-chrome absolute bottom-12 inset-x-0 z-30 pointer-events-none flex justify-center px-4">
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
                }
                targetFrameRef.current = val;
                setCurrentFrame(val);
                frameYRef.current = 1;
                const progress = RISE_PHASE + ((val - 1) / (TOTAL_FRAMES - 1)) * (1 - RISE_PHASE);
                scrollToSectionProgress(progress);
              }}
              className="h-1.5 w-32 sm:w-48 cursor-pointer appearance-none rounded-lg bg-white/20 accent-white outline-none"
            />
            <span className="text-[11px] font-mono text-white font-medium min-w-[50px] text-right">
              {currentFrame} / {TOTAL_FRAMES}
            </span>
          </div>
        </div>

        {/* Buffer badge */}
        <div className="hero-chrome absolute bottom-4 right-4 z-30 pointer-events-none hidden md:block">
          <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-mono text-white/40 backdrop-blur-md">
            {loadedCount === TOTAL_FRAMES
              ? "ALL 150 FRAMES BUFFERED"
              : `BUFFERING: ${loadedCount}/${TOTAL_FRAMES}`}
          </div>
        </div>

        <style jsx>{`
          .earth-img-layer {
            filter: saturate(var(--sat)) brightness(var(--bri));
            transition: filter 220ms linear;
          }

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
              #000000 0%,
              rgba(0, 0, 0, 0.95) 12%,
              rgba(0, 0, 0, 0.75) 30%,
              rgba(0, 0, 0, 0.45) 50%,
              rgba(0, 0, 0, 0.18) 70%,
              rgba(0, 0, 0, 0.05) 85%,
              transparent 100%
            );
            z-index: 3;
            pointer-events: none;
          }

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
      </div>
    </section>
  );
}