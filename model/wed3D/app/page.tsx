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

// seated hero mascot (model/blender/sit): bump ?v= when the GLB is rebuilt, or the browser keeps the old one
const SIT_URL = "/mascot-sitting.glb?v=11";
const SIT_LOOPS = ["Meditate", "Fly", "Idle", "Talk", "Think", "Explain"];
const SIT_BUTTONS = [...SIT_LOOPS, "Wake", "Wave", "PointLeft", "PointRight", "Present", "LookAround", "Nod", "Smile", "Happy"];

// new standing mascot (model/blender/tripo): bump ?v= when the GLB is rebuilt
const NEW_URL = "/mascot-tripo.glb?v=5";
const NEW_LOOPS = ["Idle", "Walk", "Run", "Dance", "Talk", "Think", "Sit"];
const NEW_BUTTONS = [...NEW_LOOPS, "Wave", "PointLeft", "PointRight", "Present", "ThumbsUp", "Clap", "Jump", "Celebrate",
  "Bow", "Nod", "HeadShake", "LookAround", "Smile", "Surprised", "Sad", "SitDown", "StandUp"];
const THEN: Record<string, string> = { SitDown: "Sit", StandUp: "Idle" }; // loop to settle into afterwards
// new seated mascot (model/blender/tripo: prep_tripo.py sit, rig_tripo.py sit, anim_sit_tripo.py); bump ?v= on rebuild
const NEW_SIT_URL = "/mascot-tripo-sit.glb?v=12";
const NEW_SIT_LOOPS = ["Meditate", "Fly", "Idle", "Typing", "Talk", "Think", "Explain"];
const NEW_SIT_BUTTONS = [...NEW_SIT_LOOPS, "Wake", "Wave", "PointLeft", "PointRight", "Present", "ThumbsUp", "Clap",
  "Happy", "LookAround", "Brows", "Nod", "HeadShake", "Smile"];
const SIT_THEN: Record<string, string> = { Wake: "Idle" };

type Gesture = { name: string; id: number } | null;

/** base loop + replayable one-shot gesture */
function useClips(initial: string, loops: string[]) {
  const [base, setBase] = useState(initial);
  const [gesture, setGesture] = useState<Gesture>(null);
  const id = useRef(0);
  const play = (name: string) => (loops.includes(name) ? setBase(name) : setGesture({ name, id: ++id.current }));
  return { base, gesture, play, setBase };
}

function ClipButtons({ clips, active, onPick }: { clips: string[]; active: string; onPick: (c: string) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-4 z-10 mx-auto flex w-fit max-w-[95vw] flex-wrap justify-center gap-2 rounded-2xl bg-white/80 p-2 shadow-lg backdrop-blur">
      {clips.map((b) => (
        <button
          key={b}
          onClick={() => onPick(b)}
          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
            active === b ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-blue-100"
          }`}
        >
          {b}
        </button>
      ))}
    </nav>
  );
}

function Standing() {
  const { base, gesture, play, setBase } = useClips("Idle", LOOPS);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const active = useRef(-1);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index);
          if (!e.isIntersecting || i === active.current) continue;
          active.current = i;
          setBase(SECTIONS[i].base);
          const g = SECTIONS[i].gesture;
          if (g) play(g);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }, // a section is "active" when it crosses the middle of the screen
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- observe once; play/setBase only touch state
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

      <ClipButtons clips={BUTTONS} active={base} onPick={play} />
    </main>
  );
}

function Sitting() {
  const { base, gesture, play } = useClips("Meditate", SIT_LOOPS);
  return (
    <main className="h-screen bg-gradient-to-b from-[#0b1020] to-[#1a2a55]">
      <Mascot url={SIT_URL} free base={base} gesture={gesture} />
      <p className="fixed inset-x-0 top-16 text-center text-sm text-slate-300">Drag to rotate · scroll to zoom</p>
      <ClipButtons clips={SIT_BUTTONS} active={base} onPick={play} />
    </main>
  );
}

function NewStanding() {
  const { base, gesture, play, setBase } = useClips("Idle", NEW_LOOPS);
  const pick = (c: string) => {
    play(c);
    if (THEN[c]) setBase(THEN[c]);
  };
  return (
    <main className="h-screen bg-gradient-to-b from-[#0b1020] to-[#1a2a55]">
      {/* the canvas ends above the clip buttons (they wrap to 3-4 rows), so the feet stay visible */}
      <div className="h-[calc(100vh-13rem)] pt-16 md:h-[calc(100vh-9rem)]">
        <Mascot url={NEW_URL} free base={base} gesture={gesture} />
      </div>
      <p className="fixed inset-x-0 top-28 text-center text-sm text-slate-300 md:top-16">Drag to rotate · scroll to zoom</p>
      <ClipButtons clips={NEW_BUTTONS} active={base} onPick={pick} />
    </main>
  );
}

function NewSitting() {
  const { base, gesture, play, setBase } = useClips("Meditate", NEW_SIT_LOOPS);
  const pick = (c: string) => {
    play(c);
    if (SIT_THEN[c]) setBase(SIT_THEN[c]);
  };
  return (
    <main className="h-screen bg-gradient-to-b from-[#0b1020] to-[#1a2a55]">
      <div className="h-[calc(100vh-11rem)] pt-16 md:h-[calc(100vh-8rem)]">
        <Mascot url={NEW_SIT_URL} free base={base} gesture={gesture} />
      </div>
      <p className="fixed inset-x-0 top-28 text-center text-sm text-slate-300 md:top-16">Drag to rotate · scroll to zoom</p>
      <ClipButtons clips={NEW_SIT_BUTTONS} active={base} onPick={pick} />
    </main>
  );
}

// new Tripo exports (model/mascot/tooth character 3d model*.glb): no clips, so the motions are code-driven
const TRIPO = {
  "Tripo Rig": { url: "/tripo-rig.glb", lift: 0.277, motions: ["Float", "Spin", "Jump", "Wave"] },
  "Tripo Raw": { url: "/tripo-raw.glb?v=2", lift: 0, motions: ["Float", "Spin", "Jump"] },
  "Tripo Sit Rig": { url: "/tripo-sit-rig.glb", lift: 0.12, motions: ["Float", "Spin", "Jump", "Wave"] },
  "Tripo Sit Raw": { url: "/tripo-sit-raw.glb", lift: 0, motions: ["Float", "Spin", "Jump"] },
};
const TABS = ["New Standing", "New Sitting", "Standing", "Sitting", "Tripo Rig", "Tripo Raw", "Tripo Sit Rig", "Tripo Sit Raw"] as const;

function Tripo({ url, lift, motions }: (typeof TRIPO)[keyof typeof TRIPO]) {
  const [motion, setMotion] = useState(motions[0]);
  return (
    <main className="h-screen bg-gradient-to-b from-[#0b1020] to-[#1a2a55]">
      <Mascot url={url} free base="" lift={lift} motion={motion} />
      <p className="fixed inset-x-0 top-16 text-center text-sm text-slate-300">Drag to rotate · scroll to zoom</p>
      <ClipButtons clips={motions} active={motion} onPick={setMotion} />
    </main>
  );
}

export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("New Standing");
  return (
    <>
      <nav className="fixed inset-x-0 top-4 z-20 mx-auto flex w-fit max-w-[95vw] flex-wrap justify-center gap-1 rounded-2xl bg-white/80 p-1 shadow-lg backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-100"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "New Standing" ? <NewStanding /> : tab === "New Sitting" ? <NewSitting /> : tab === "Standing" ? <Standing /> : tab === "Sitting" ? <Sitting /> : <Tripo key={tab} {...TRIPO[tab]} />}
    </>
  );
}
