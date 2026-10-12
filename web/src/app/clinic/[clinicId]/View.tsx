"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { H, inr, useClinic } from "@/components/clinic/Shell";
import { Notice } from "@/components/Page";

type Dash = {
  today: { total: number; booked: number; confirmed: number; checkedIn: number; completed: number; cancelled: number; noShow: number };
  pendingFmdRequests: number;
  unconfirmedUpcoming: number;
  recallDue: number;
  openTasks: number;
  incompleteNotes?: number;
  collectionsTodayInr?: number;
  outstandingInr?: number;
  inventoryAlerts?: number;
};

export default function ClinicDashboard() {
  const { call, clinicId } = useClinic();
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    call<Dash>("dashboard").then(setD).catch((e) => setErr(e.message));
  }, [call]);
  const base = `/clinic/${clinicId}`;
  const cards: [string, string | number, string, string][] = d
    ? [
        ["Today's appointments", d.today.total, `${d.today.checkedIn} checked in · ${d.today.completed} completed · ${d.today.noShow} no-show`, `${base}/calendar`],
        ["FMD requests to answer", d.pendingFmdRequests, "Patients waiting for your confirmation", `${base}/calendar`],
        ["Unconfirmed upcoming", d.unconfirmedUpcoming, "Booked but not yet confirmed", `${base}/calendar`],
        ["Due for recall", d.recallDue, "Last visit over 6 months ago, nothing booked", `${base}/ai`],
        ["Open tasks", d.openTasks, "Across the team", `${base}/tasks`],
        ...(d.incompleteNotes !== undefined ? [["Visits without a signed note", d.incompleteNotes, "Completed in the last 14 days", `${base}/patients`] as [string, number, string, string]] : []),
        ...(d.collectionsTodayInr !== undefined ? [["Collected today", inr(d.collectionsTodayInr), `Outstanding ${inr(d.outstandingInr ?? 0)}`, `${base}/billing`] as [string, string, string, string]] : []),
        ...(d.inventoryAlerts !== undefined ? [["Stock alerts", d.inventoryAlerts, "Low stock or expiring soon", `${base}/inventory`] as [string, number, string, string]] : []),
      ]
    : [];
  return (
    <>
      <H title="Today" desc="Based on what's recorded in Clinic OS. Figures are operational, not audited." />
      {err && <Notice kind="error">{err}</Notice>}
      {!d && !err && <p className="text-ink-4">Loading…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, hint, href]) => (
          <Link key={label} href={href} className="glass glass-interactive rounded-[20px] p-5">
            <p className="text-[12px] text-ink-4">{label}</p>
            <p className="mt-1 text-[28px] font-light text-ink">{value}</p>
            <p className="mt-1 text-[12px] text-ink-3">{hint}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
