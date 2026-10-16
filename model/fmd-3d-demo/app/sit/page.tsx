"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
type MotionValue<T> = { get(): T }; // demo copy: the web app imports this from motion/react

// test harness for the hero's seated mascot: meditates, then "arrives" after 4 s (as the hero does on scroll)
const Mascot3D = dynamic(() => import("./Mascot3D"), { ssr: false });
const still = { get: () => 0 } as unknown as MotionValue<number>;

export default function SitTest() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1020]">
      <div className="relative h-[480px] w-[480px]">
        <div className="absolute inset-y-0 left-1/2 w-[170%] -translate-x-1/2">
          <Mascot3D active settled={settled} rotY={still} rotX={still} />
        </div>
      </div>
      <p id="state" className="fixed left-4 top-4 text-white">{settled ? "settled" : "meditating"}</p>
    </main>
  );
}
