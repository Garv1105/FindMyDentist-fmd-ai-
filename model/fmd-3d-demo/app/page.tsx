"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Clip } from "./components/Mascot";

const Mascot = dynamic(() => import("./components/Mascot"), { ssr: false });

// each section sets the looping pose and (optionally) plays a gesture when it scrolls into view
const SECTIONS: { title: string; body: string; base: Clip; gesture?: Clip }[] = [
  { title: "Hi, I'm your smile buddy!", body: "Hover over me and I'll wave. Click me and I'll celebrate.", base: "Idle", gesture: "Wave" },
  { title: "Find trusted dentists near you", body: "Verified clinics, real reviews, clear prices.", base: "Idle", gesture: "Point" },
  { title: "Book in a few taps", body: "Pick a time that suits you. We'll walk you through it.", base: "Walk" },
  { title: "Calm, painless care", body: "Relax. Your smile is in good hands.", base: "Meditate" },
  { title: "You're all set!", body: "See you at your appointment.", base: "Idle", gesture: "Celebrate" },
];

const BUTTONS: Clip[] = ["Idle", "Wave", "Point", "Celebrate", "Nod", "HeadShake", "Think", "Walk", "Meditate"];
const LOOPS: Clip[] = ["Idle", "Walk", "Meditate"];

export default function Home() {
  const [base, setBase] = useState<Clip>("Idle");
  const [gesture, setGesture] = useState<{ name: Clip; id: number } | null>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const active = useRef(-1);
  const gestureId = useRef(0);

  const play = (name: Clip) => {
    if (LOOPS.includes(name)) setBase(name);
    else setGesture({ name, id: ++gestureId.current });
  };

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index);
          if (!e.isIntersecting || i === active.current) continue;
          active.current = i;
          setBase(SECTIONS[i].base);
          const g = SECTIONS[i].gesture;
          if (g) setGesture({ name: g, id: ++gestureId.current });
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }, // a section is "active" when it crosses the middle of the screen
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="bg-gradient-to-b from-sky-50 to-white text-slate-900">
      <div className="mx-auto grid max-w-6xl md:grid-cols-2">
        <div className="sticky top-0 order-first h-[55vh] md:order-last md:h-screen">
          <Mascot base={base} gesture={gesture} />
        </div>

        <div className="px-6">
          {SECTIONS.map((s, i) => (
            <section
              key={s.title}
              data-index={i}
              ref={(el) => { refs.current[i] = el; }}
              className="flex min-h-[80vh] flex-col justify-center md:min-h-screen"
            >
              <p className="font-semibold uppercase tracking-[0.2em] text-blue-600">FindMyDentist</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{s.title}</h2>
              <p className="mt-4 max-w-md text-lg leading-8 text-slate-500">{s.body}</p>
            </section>
          ))}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-4 z-10 mx-auto flex w-fit max-w-[95vw] flex-wrap justify-center gap-2 rounded-2xl bg-white/80 p-2 shadow-lg backdrop-blur">
        {BUTTONS.map((b) => (
          <button
            key={b}
            onClick={() => play(b)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              base === b ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-blue-100"
            }`}
          >
            {b}
          </button>
        ))}
      </nav>
    </main>
  );
}
