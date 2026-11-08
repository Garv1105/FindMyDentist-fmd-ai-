"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/app/kit";
import { Reveal } from "@/components/ui";
import { getClinicHome, type ClinicHome } from "@/sample/clinic";
import { useClinic } from "../Shell";
import { AiBriefing } from "./AiBriefing";
import { FollowUps } from "./FollowUps";
import { Kpis } from "./Kpis";
import { NextAppointments } from "./NextAppointments";

/** Skeleton panels the size of the real ones, so nothing jumps when data arrives. */
function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      <Panel className="h-[420px] motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Panel key={i} className="h-[132px] motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/** FMD Clinic Home, layout A: the AI briefing first, then the numbers, then today's list and the follow-ups. */
export function Home() {
  const { clinic, user, base, date, branchId } = useClinic();
  const [home, setHome] = useState<ClinicHome | null>(null);
  const [key, setKey] = useState("");
  const want = `${date}|${branchId}`;

  useEffect(() => {
    let live = true;
    getClinicHome(clinic.id, { date, branchId }).then((h) => {
      if (!live) return;
      setHome(h);
      setKey(want);
    });
    return () => {
      live = false;
    };
  }, [clinic.id, date, branchId, want]);

  if (!home || key !== want) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <Reveal y={12}>
        <AiBriefing home={home} user={user} clinicId={clinic.id} onTask={(t) => setHome({ ...home, tasks: home.tasks.map((x) => (x.id === t.id ? t : x)) })} />
      </Reveal>
      <Reveal y={12} delay={0.06}>
        <Kpis home={home} base={base} />
      </Reveal>
      <Reveal y={12} delay={0.12} className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <NextAppointments appts={home.next} base={base} isToday={home.isToday} />
        <FollowUps
          items={home.followUps}
          clinicId={clinic.id}
          base={base}
          onChange={(f) => setHome({ ...home, followUps: home.followUps.map((x) => (x.id === f.id ? f : x)) })}
        />
      </Reveal>
      <p className="text-right text-[13px] text-ink-3">Figures come from what&apos;s recorded in FMD Clinic. They&apos;re operational, not audited.</p>
    </div>
  );
}
