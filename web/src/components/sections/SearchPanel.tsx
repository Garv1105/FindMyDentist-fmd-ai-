"use client";

import {
  Sparkles,
  X,
  Mic,
  ArrowUp,
  ShieldCheck,
  ChevronRight,
  MapPin,
  Snowflake,
  Smile,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Sample Q&A data
// ---------------------------------------------------------------------------
interface SampleQA {
  id: string;
  question: string;
  teaser: string;
  answer: string;
}

const SAMPLE_QUESTIONS: SampleQA[] = [
  {
    id: "root-canal",
    question: "What is a root canal?",
    teaser: "A common tooth-saving procedure, explained simply.",
    answer:
      "A root canal removes infected tissue from inside a tooth so the tooth can be saved instead of pulled. It's usually needed when decay or injury has reached the soft inner part of the tooth, allowing bacteria to cause pain, swelling, and infection. During the procedure the dentist numbs the area, cleans out the infected tissue, then seals the tooth — most cases finish in one or two visits. Mild soreness for a few days afterwards is normal, and it's best to avoid very hard foods on that tooth until your dentist says it's fine.",
  },
  {
    id: "whitening",
    question: "Is teeth whitening safe?",
    teaser: "What's safe, what's not, and what to expect.",
    answer:
      "Yes — when done by a dentist or with a dentist-approved kit, whitening is considered safe for most people. The most common side effect is temporary sensitivity to cold, which usually fades within a few days. It's best to skip whitening if you have untreated cavities, gum disease, or very sensitive teeth, and talk to a dentist first. Most people see a noticeable change after one to two weeks, though results vary by starting shade and lifestyle habits like coffee, tea, or smoking.",
  },
  {
    id: "bleeding-gums",
    question: "Why do my gums bleed when brushing?",
    teaser: "The most common causes and what to do first.",
    answer:
      "Bleeding gums usually mean inflammation from plaque buildup, and it's most often an early sign of gum disease. Common causes include not flossing, brushing too hard, using a worn toothbrush, or skipping regular cleanings. In most cases, brushing gently with a soft brush twice a day, flossing daily, and rinsing with warm salt water will help within one to two weeks. If bleeding continues past two weeks, or comes with pain, swelling, or loose teeth, it's worth booking an appointment with a dentist.",
  },
  {
    id: "child-first-visit",
    question: "When should my child first see a dentist?",
    teaser: "Timing, what happens, and how to prepare.",
    answer:
      "A child should see a dentist by their first birthday, or within six months of the first tooth appearing — whichever comes first. Early visits catch problems before they hurt and help your child get comfortable with the dentist. The appointment is usually a short, gentle check where the dentist counts teeth, looks for early decay, and shows you how to clean them. To prepare, keep the visit casual and positive, avoid words like 'pain' or 'shot', and let your child bring a favourite toy.",
  },
  {
    id: "cost",
    question: "How much does a dental check-up cost?",
    teaser: "What affects the price and how to compare.",
    answer:
      "A standard check-up usually costs less than a filling or crown, though prices vary a lot depending on where you are and which clinic you visit. A typical visit includes an exam, a scale and polish, and basic X-rays if needed — some clinics bundle these, others charge separately. Location, clinic size, dentist experience, and whether you're paying privately or through insurance all affect the price. It's a good idea to ask for a written estimate before treatment, and many clinics offer a fixed-price new-patient package.",
  },
];

const QUICK_CHIPS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "find-dentist", label: "Find a dentist near me", icon: MapPin },
  { id: "cold-drinks", label: "My tooth hurts with cold drinks", icon: Snowflake },
  { id: "braces", label: "Braces or aligners?", icon: Smile },
  { id: "appointment", label: "Prepare for my appointment", icon: CalendarCheck },
];

// Video timing constants
const VIDEO_DURATION_MS = 10000;
/** Start streaming the answer this many ms into the video. */
const ANSWER_START_MS = 7000;
/** Box side length in px — used by both the box and the video image sizing. */
const BOX_SIZE = 92;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SearchPanel() {
  const [query, setQuery] = useState<string>("");
  const [submittedQuery, setSubmittedQuery] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [listening, setListening] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Streaming
  const [streamedChars, setStreamedChars] = useState<Record<string, number>>({});
  const streamTimersRef = useRef<number[]>([]);
  const streamCancelledRef = useRef<boolean>(false);

  // Video state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);
  const [videoDone, setVideoDone] = useState<boolean>(false);
  const videoEndTimerRef = useRef<number | null>(null);
  const answerStartTimerRef = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const q = (submittedQuery || query).trim().toLowerCase();
    if (!q) return [];
    return SAMPLE_QUESTIONS.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.teaser.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
    );
  }, [query, submittedQuery]);

  const hasSubmitted = submittedQuery.trim().length > 0;
  const hideGreeting = hasSubmitted;

  // ---------------------------------------------------------------------------
  // Streaming
  // ---------------------------------------------------------------------------
  const cancelStream = useCallback(() => {
    streamCancelledRef.current = true;
    streamTimersRef.current.forEach((t) => clearTimeout(t));
    streamTimersRef.current = [];
  }, []);

  const startStreaming = useCallback(
    (item: SampleQA) => {
      cancelStream();
      setStreamedChars({ [item.id]: 0 });

      const tokens = item.answer.match(/\S+\s*/g) ?? [];
      const PER_WORD_DELAY = 90;
      const KICKOFF_DELAY = 400;

      const kickoff = window.setTimeout(() => {
        streamCancelledRef.current = false;
        let acc = "";
        tokens.forEach((tok, wi) => {
          acc += tok;
          const charsSoFar = acc.length;
          const t = window.setTimeout(() => {
            if (streamCancelledRef.current) return;
            setStreamedChars((prev) => ({ ...prev, [item.id]: charsSoFar }));
          }, wi * PER_WORD_DELAY);
          streamTimersRef.current.push(t);
        });
      }, KICKOFF_DELAY);

      streamTimersRef.current.push(kickoff);
    },
    [cancelStream]
  );

  useEffect(() => {
    return () => cancelStream();
  }, [cancelStream]);

  // ---------------------------------------------------------------------------
  // Video control
  // ---------------------------------------------------------------------------
  const clearVideoTimers = useCallback(() => {
    if (videoEndTimerRef.current !== null) {
      clearTimeout(videoEndTimerRef.current);
      videoEndTimerRef.current = null;
    }
    if (answerStartTimerRef.current !== null) {
      clearTimeout(answerStartTimerRef.current);
      answerStartTimerRef.current = null;
    }
  }, []);

  const finishVideo = useCallback(
    (item: SampleQA) => {
      const video = videoRef.current;
      clearVideoTimers();
      setVideoPlaying(false);
      setVideoDone(true);

      if (video) {
        try {
          video.currentTime = Math.max(0, video.duration - 0.05);
          video.pause();
        } catch {
          /* no-op */
        }
      }

      setStreamedChars((prev) => {
        if (prev[item.id] === undefined) {
          startStreaming(item);
        }
        return prev;
      });
    },
    [clearVideoTimers, startStreaming]
  );

  const playVideoThenStream = useCallback(
    (item: SampleQA) => {
      const video = videoRef.current;
      clearVideoTimers();
      cancelStream();

      setStreamedChars((prev) => ({ ...prev, [item.id]: 0 }));

      if (video) {
        try {
          video.currentTime = 0;
          video.muted = true;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
              finishVideo(item);
              startStreaming(item);
            });
          }
        } catch {
          finishVideo(item);
          startStreaming(item);
          return;
        }
      }

      setVideoPlaying(true);
      setVideoDone(false);

      answerStartTimerRef.current = window.setTimeout(() => {
        startStreaming(item);
      }, ANSWER_START_MS);

      videoEndTimerRef.current = window.setTimeout(() => {
        finishVideo(item);
      }, VIDEO_DURATION_MS + 200);
    },
    [clearVideoTimers, cancelStream, finishVideo, startStreaming]
  );

  const handleVideoEnded = useCallback(() => {
    const item = SAMPLE_QUESTIONS.find((q) => q.id === openId);
    if (item) finishVideo(item);
  }, [openId, finishVideo]);

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------
  const toggleOpen = useCallback(
    (id: string) => {
      const item = SAMPLE_QUESTIONS.find((q) => q.id === id);
      if (!item) return;
      if (openId === id) {
        setOpenId(null);
        cancelStream();
        clearVideoTimers();
        setVideoPlaying(false);
        setVideoDone(false);
        return;
      }
      setOpenId(id);
      playVideoThenStream(item);
    },
    [openId, cancelStream, clearVideoTimers, playVideoThenStream]
  );

  const clearQuery = useCallback(() => {
    const video = videoRef.current;
    setQuery("");
    setSubmittedQuery("");
    setOpenId(null);
    setStreamedChars({});
    cancelStream();
    clearVideoTimers();
    setVideoPlaying(false);
    setVideoDone(false);
    if (video) {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        /* no-op */
      }
    }
    inputRef.current?.focus();
  }, [cancelStream, clearVideoTimers]);

  const handleSubmit = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setSubmittedQuery(q);
    const first = SAMPLE_QUESTIONS.find(
      (item) =>
        item.question.toLowerCase().includes(q.toLowerCase()) ||
        item.teaser.toLowerCase().includes(q.toLowerCase()) ||
        item.answer.toLowerCase().includes(q.toLowerCase())
    );
    if (first) {
      setOpenId(first.id);
      playVideoThenStream(first);
    } else {
      setOpenId(null);
      setStreamedChars({});
      cancelStream();
      clearVideoTimers();
      setVideoPlaying(false);
      setVideoDone(false);
    }
  }, [query, playVideoThenStream, cancelStream, clearVideoTimers]);

  const handleChipClick = useCallback(
    (id: string, label: string) => {
      const chipToQuestion: Record<string, string> = {
        "find-dentist": "check-up",
        "cold-drinks": "root canal",
        braces: "whitening",
        appointment: "cost",
      };
      const mapped = chipToQuestion[id] ?? label;
      setQuery(label);
      setSubmittedQuery(mapped);
      const first = SAMPLE_QUESTIONS.find(
        (item) =>
          item.question.toLowerCase().includes(mapped.toLowerCase()) ||
          item.teaser.toLowerCase().includes(mapped.toLowerCase()) ||
          item.answer.toLowerCase().includes(mapped.toLowerCase())
      );
      if (first) {
        setOpenId(first.id);
        playVideoThenStream(first);
      } else {
        setOpenId(null);
        setStreamedChars({});
        cancelStream();
        clearVideoTimers();
        setVideoPlaying(false);
        setVideoDone(false);
      }
    },
    [playVideoThenStream, cancelStream, clearVideoTimers]
  );

  const handleMicClick = useCallback(() => {
    setListening((v) => !v);
  }, []);

  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(() => setListening(false), 3000);
    return () => clearTimeout(t);
  }, [listening]);

  // Box state flags
  const videoIdle = !videoPlaying && !videoDone;
  const showVideoLayer = videoPlaying || videoDone;
  // Framed only when the video is visible (playing or paused on last frame).
  const showFrame = showVideoLayer;

  return (
    <section className="relative isolate overflow-hidden pb-24 pt-20 text-ink sm:pb-32 sm:pt-24">
      {/* Sits on the page's fixed navy backdrop; the planet arc fades out at the
          bottom so there's no seam into the next section */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,#000_calc(100%-120px),transparent)]">
        {/* Pure black at the top (continues the black hero above), easing into the navy backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#000_0%,#000_22%,rgb(0_0_0/0.85)_42%,rgb(0_0_0/0.45)_68%,transparent_100%)]" />
        {/* Horizon arc */}
        <div className="absolute -bottom-[520px] left-1/2 h-[700px] w-[1800px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_top,#0b1a3f_0%,#040a1c_70%)] shadow-[0_-2px_0_rgb(160_200_255/0.55),0_-30px_120px_rgb(var(--accent-rgb)/0.55)]" />
        <StarField />
      </div>

      <div className="relative mx-auto max-w-3xl px-6">
        <div className="relative grid">
          {/* -------------------- GREETING -------------------- */}
          <div
            className={`col-start-1 row-start-1 text-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              hideGreeting
                ? "pointer-events-none -translate-y-4 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
            aria-hidden={hideGreeting}
          >
            <div className="liquid-glass mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl [box-shadow:var(--glass-shadow),0_0_50px_-8px_rgb(var(--accent-rgb)/0.7)]">
              <Sparkles className="size-6 text-ink" strokeWidth={1.5} />
            </div>

            <div className="eyebrow mb-4">FMD AI</div>

            <h1 className="text-[32px] font-extralight leading-[1.05] tracking-[-0.035em] text-ink sm:text-[52px]">
              Hi, I&apos;m FMD AI.
              <span className="block text-balance bg-gradient-to-r from-[#8fb8ff] to-[#3d7bff] bg-clip-text text-transparent">
                How can I help with your dental care?
              </span>
            </h1>
          </div>

          {/* -------------------- RESULTS -------------------- */}
          <div
            className={`col-start-1 row-start-1 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              hideGreeting
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-6 opacity-0"
            }`}
            aria-hidden={!hideGreeting}
            aria-live="polite"
          >
            <div className="mb-5 text-center">
              <div className="eyebrow mb-3">FMD AI · Answer</div>
              <h2 className="text-[28px] font-light tracking-[-0.03em] text-ink sm:text-[36px]">
                Here&apos;s what we found
              </h2>
              <p className="mt-2 text-xs text-ink-4">
                For &ldquo;{query}&rdquo;
              </p>
            </div>

            {filtered.length === 0 && (
              <div className="liquid-glass rounded-3xl px-6 py-10 text-center">
                <p className="text-sm text-ink-3">
                  No direct match for &ldquo;{query}&rdquo;. Try one of
                  the suggestions below, or rephrase.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {filtered.map((item, idx) => {
                const isOpen = openId === item.id;
                const revealed = streamedChars[item.id] ?? 0;
                const visibleText = item.answer.slice(0, revealed);
                const isStreaming = isOpen && revealed < item.answer.length;
                const showAnswerText = isOpen && revealed > 0;

                return (
                  <div
                    key={item.id}
                    className={`liquid-glass group overflow-hidden rounded-3xl transition-all duration-300 ${
                      isOpen
                        ? "liquid-glass-active [box-shadow:var(--glass-shadow),0_0_70px_-20px_rgb(var(--accent-rgb)/0.75)]"
                        : "hover:-translate-y-0.5"
                    }`}
                    style={{
                      animation: `resultIn 600ms cubic-bezier(0.16,1,0.3,1) ${
                        hideGreeting ? idx * 80 : 0
                      }ms both`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOpen(item.id)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-ink sm:text-[15px]">
                          {item.question}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-4">
                          {item.teaser}
                        </span>
                      </span>
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-[var(--surface-glass)] text-ink-2 transition-transform duration-300 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>

                    <div
                      className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isOpen
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-line px-5 pb-5 pt-4 sm:px-6">
                          {isOpen && revealed === 0 && (
                            <div className="flex items-center gap-3 py-2">
                              <span className="relative flex size-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)]/60" />
                                <span className="relative inline-flex size-2 rounded-full bg-[var(--accent)]" />
                              </span>
                              <span className="eyebrow text-[12px]">
                                Preparing your answer…
                              </span>
                            </div>
                          )}

                          {showAnswerText && (
                            <p className="text-[13.5px] leading-[1.75] text-ink-2 sm:text-[15px]">
                              {visibleText}
                              {isStreaming && (
                                <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-[var(--accent)] align-middle" />
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* -------------------- GLASS CONSOLE -------------------- */}
        <div className="relative mx-auto mt-10 max-w-2xl">
          {/* Colour behind the console so the frosted glass has something to refract */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10"
          >
            <div className="absolute left-[10%] top-[10%] h-3/4 w-1/2 rounded-full bg-[#2f6bff] opacity-40 blur-[90px]" />
            <div className="absolute right-[8%] bottom-[5%] h-2/3 w-2/5 rounded-full bg-[#7c4dff] opacity-30 blur-[90px]" />
          </div>

          <div className="liquid-glass rounded-[32px] p-3 sm:p-4">
            {/* Header: mascot / video + prompt */}
            <div className="flex items-center gap-4 px-2 pb-4 pt-1">
              {/*
                Media box.
                - Idle (mascot):   no frame — the transparent PNG floats on the glass.
                - Playing / Done:  curved glass tray frame, showing the video
                                   (playing or paused on the last frame).
              */}
              <div
                className={`media-box relative shrink-0 transition-all duration-500 ${
                  showFrame ? "media-box-framed" : "media-box-bare"
                } ${videoDone ? "video-float" : ""}`}
                style={{ width: BOX_SIZE, height: BOX_SIZE }}
                aria-hidden
              >
                {showFrame && <div className="media-box-bg absolute inset-0" />}

                <div
                  className={`absolute overflow-hidden transition-all duration-500 ${
                    showFrame ? "inset-[5px] media-box-inner" : "inset-0"
                  }`}
                >
                  <video
                    ref={videoRef}
                    src="/chat.mp4"
                    playsInline
                    muted
                    preload="metadata"
                    onEnded={handleVideoEnded}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                      showVideoLayer ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  {videoIdle && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Image
                        src="/mascot.png"
                        alt=""
                        fill
                        priority
                        sizes={`${BOX_SIZE}px`}
                        className="object-contain drop-shadow-[0_10px_25px_rgba(77,141,255,0.45)]"
                      />
                    </div>
                  )}

                  {showFrame && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[calc(1.5rem-6px)] ring-1 ring-inset ring-[var(--edge-hi)]"
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-ink-3">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  FMD AI · Online
                </div>
                <p className="mt-1.5 text-[17px] font-light leading-snug text-ink sm:text-[19px]">
                  Ask me anything about your dental health…
                </p>
              </div>
            </div>

            {/* Suggestions — glass list rows */}
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]">
              {QUICK_CHIPS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleChipClick(id, label)}
                  className="group flex w-full items-center gap-3.5 border-b border-white/[0.07] px-4 py-2.5 text-left text-[14px] text-ink-2 transition-colors last:border-b-0 hover:bg-white/[0.07] hover:text-ink"
                >
                  <span className="liquid-glass grid size-8 shrink-0 place-items-center rounded-xl text-ink">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="size-4 shrink-0 text-ink-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="mt-3 flex items-center gap-2 rounded-full border border-white/12 bg-black/25 p-1.5 pl-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] focus-within:border-[rgb(var(--accent-rgb)/0.6)] focus-within:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35),0_0_0_4px_rgb(var(--accent-rgb)/0.18)]"
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSubmittedQuery("");
                }}
                placeholder="Describe a symptom or ask a question..."
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-ink placeholder:text-ink-4 focus:outline-none"
                aria-label="Ask FMD AI a dental question"
              />

              {query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="shrink-0 rounded-full p-2 text-ink-4 transition-colors hover:text-ink"
                  aria-label="Clear"
                >
                  <X className="size-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleMicClick}
                aria-label="Voice input"
                className={`relative flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-white/10 hover:text-ink ${
                  listening ? "text-ink" : ""
                }`}
              >
                {listening && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/30" />
                )}
                <Mic className="size-4" />
              </button>

              <button
                type="submit"
                aria-label="Send"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#6fa4ff] to-[#2f6bff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-6px_rgba(77,141,255,0.85)] transition-all hover:brightness-110 active:scale-95 disabled:from-white/15 disabled:to-white/10 disabled:text-ink-4 disabled:shadow-none"
                disabled={!query.trim()}
              >
                <ArrowUp className="size-4" strokeWidth={2.25} />
              </button>
            </form>
          </div>

          <div className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-2 text-center">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink-4" />
            <p className="text-[11px] leading-relaxed text-ink-4">
              Guidance, not diagnosis. FMD AI explains and suggests; it never
              books, contacts clinics or pays on your behalf.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes resultIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        :global(.video-float) {
          animation: videoFloat 2.6s ease-in-out infinite;
        }

        @keyframes videoFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        /* ------------------------------------------------------------------
           Media box — two visual states
         ------------------------------------------------------------------ */

        /* Framed (video playing / paused on last frame) */
        :global(.media-box-framed) {
          border-radius: 1.75rem;
          overflow: hidden;
          box-shadow:
            0 30px 70px -25px rgb(var(--accent-rgb) / 0.45),
            0 8px 24px -12px rgb(0 0 0 / 0.5);
        }

        /* Bare (mascot idle) — no frame, no shadow, no background */
        :global(.media-box-bare) {
          border-radius: 1.25rem;
          overflow: hidden;
          box-shadow: none;
        }

        /* Outer glass "tray" — layered gradient + inner light */
        :global(.media-box-bg) {
          border-radius: inherit;
          background:
            linear-gradient(
              160deg,
              rgb(var(--accent-rgb) / 0.18) 0%,
              var(--surface-glass) 45%,
              var(--surface-elevated) 100%
            );
          border: 1px solid var(--line);
          backdrop-filter: blur(14px) saturate(1.2);
          -webkit-backdrop-filter: blur(14px) saturate(1.2);
        }

        :global(.media-box-bg::before) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            to bottom,
            var(--inner-hi) 0%,
            transparent 35%
          );
          pointer-events: none;
          opacity: 0.9;
        }

        :global(.media-box-bg::after) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow:
            inset 0 1px 0 var(--inner-hi),
            inset 0 -1px 0 rgb(0 0 0 / 0.25);
          pointer-events: none;
        }

        /* Inner content area, inset from the tray edges */
        :global(.media-box-inner) {
          border-radius: 1.35rem;
          background: rgb(0 0 0 / 0.35);
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// StarField
// ---------------------------------------------------------------------------
function StarField() {
  const stars = useMemo(
    () => [
      { cx: "8%", cy: "22%", r: 1, o: 0.35 },
      { cx: "18%", cy: "68%", r: 1.4, o: 0.5 },
      { cx: "27%", cy: "14%", r: 0.8, o: 0.3 },
      { cx: "41%", cy: "82%", r: 1, o: 0.4 },
      { cx: "55%", cy: "18%", r: 1.2, o: 0.45 },
      { cx: "68%", cy: "72%", r: 0.9, o: 0.35 },
      { cx: "78%", cy: "28%", r: 1.5, o: 0.55 },
      { cx: "88%", cy: "60%", r: 1, o: 0.4 },
      { cx: "93%", cy: "34%", r: 0.8, o: 0.3 },
      { cx: "12%", cy: "48%", r: 1.1, o: 0.42 },
      { cx: "62%", cy: "44%", r: 0.7, o: 0.25 },
      { cx: "34%", cy: "56%", r: 1.3, o: 0.48 },
    ],
    []
  );

  return (
    <div aria-hidden className="absolute inset-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-[var(--star)]"
          style={{
            left: s.cx,
            top: s.cy,
            width: s.r * 2,
            height: s.r * 2,
            opacity: s.o,
            boxShadow: "0 0 6px rgb(var(--horizon-rgb) / 0.6)",
            animation: `twinkle ${3 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}