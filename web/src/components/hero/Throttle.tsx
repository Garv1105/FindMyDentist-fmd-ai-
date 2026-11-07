"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/** Inside a frameloop="demand" canvas: one frame every `ms` while active (phones: 30 fps, not the display's 60–120). */
export default function Throttle({ active, ms = 33 }: { active: boolean; ms?: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => invalidate(), ms);
    return () => clearInterval(id);
  }, [active, ms, invalidate]);
  return null;
}
