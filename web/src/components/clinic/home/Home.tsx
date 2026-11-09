"use client";

import { useEffect, useState } from "react";
import { Empty, Panel } from "@/components/app/kit";
import { Reveal } from "@/components/ui";
import { dayBills } from "@/sample/billing";
import { getClinicHome, type AiTask, type ClinicHome, type FollowUp } from "@/sample/clinic";
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
  const [collected, setCollected] = useState({ totalInr: 0, count: 0 });
  const [key, setKey] = useState("");
  const [failed, setFailed] = useState("");
  const want = `${date}|${branchId}`;

  useEffect(() => {
    let live = true;
    Promise.all([getClinicHome(clinic.id, { date, branchId }), dayBills(clinic.id, { branchId, date })]).then(
      ([h, bills]) => {
        if (!live) return;
        const day = bills.filter((b) => b.status === "paid");
        setCollected({ totalInr: day.reduce((n, b) => n + b.amountInr, 0), count: day.length });
        setHome(h);
        setKey(want);
        setFailed("");
      },
      () => live && setFailed(want),
    );
    return () => {
      live = false;
    };
  }, [clinic.id, date, branchId, want]);

  // updates replace one item in whatever is on screen now, never an older copy
  const putTask = (t: AiTask) => setHome((h) => h && { ...h, tasks: h.tasks.map((x) => (x.id === t.id ? t : x)) });
  const putFollowUp = (f: FollowUp) => setHome((h) => h && { ...h, followUps: h.followUps.map((x) => (x.id === f.id ? f : x)) });

  if (failed === want)
    return (
      <Panel className="p-6">
        <Empty title="This day couldn't be loaded" hint="Try another date or branch, or reload the page." />
      </Panel>
    );
  if (!home || key !== want) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <Reveal y={12}>
        <AiBriefing home={home} user={user} clinicId={clinic.id} onTask={putTask} />
      </Reveal>
      <Reveal y={12} delay={0.06}>
        <Kpis home={home} base={base} collected={collected} />
      </Reveal>
      <Reveal y={12} delay={0.12} className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <NextAppointments appts={home.next} base={base} isToday={home.isToday} />
        <FollowUps
          items={home.followUps}
          clinicId={clinic.id}
          base={base}
          onChange={putFollowUp}
        />
      </Reveal>
      <p className="text-right text-[13px] text-ink-3">Figures come from what&apos;s recorded in FMD Clinic. They&apos;re operational, not audited.</p>
    </div>
  );
}
