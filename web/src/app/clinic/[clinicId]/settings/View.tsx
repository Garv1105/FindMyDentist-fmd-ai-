"use client";

import { useCallback, useEffect, useState } from "react";
import { H, useClinic } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type S = {
  hours: { weekday: number; opens: string; closes: string }[];
  types: { id: string; name: string; duration_min: number; buffer_min: number; fee_note: string; bookable_online: number; active: number }[];
  chairs: { id: string; name: string }[];
  policy: { min_notice_minutes: number; cancellation_terms: string; live_schedule: number; schedule_source: string } | undefined;
  providers: { id: string; name: string }[];
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  const { call, can, ws, refresh } = useClinic();
  const [s, setS] = useState<S | null>(null);
  const [hours, setHours] = useState<{ weekday: number; opens: string; closes: string }[]>([]);
  const [type, setType] = useState({ name: "", duration_min: 30, buffer_min: 5, fee_note: "" });
  const [chair, setChair] = useState("");
  const [policy, setPolicy] = useState({ min_notice_minutes: 120, cancellation_terms: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const load = useCallback(
    () =>
      call<S>("settings")
        .then((x) => {
          setS(x);
          setHours(x.hours);
          if (x.policy) setPolicy({ min_notice_minutes: x.policy.min_notice_minutes, cancellation_terms: x.policy.cancellation_terms });
        })
        .catch((e) => setMsg({ kind: "error", text: e.message })),
    [call],
  );
  useEffect(() => {
    load();
  }, [load]);
  const owner = can("settings.manage");
  const save = async (body: Record<string, unknown>, ok: string) => {
    setMsg(null);
    try {
      const x = await call<S>("settings", "POST", body);
      setS(x);
      setHours(x.hours);
      setMsg({ kind: "success", text: ok });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const publish = async (on: boolean) => {
    setMsg(null);
    try {
      const r = await call<{ slots?: number }>(on ? "availability/publish" : "availability/unpublish", "POST", { days: 14 });
      setMsg({ kind: "success", text: on ? `Published ${r.slots} bookable times for the next 14 days.` : "Online booking times removed. Patients can still send requests." });
      load();
      refresh();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  if (!s) return msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : <p className="text-ink-4">Loading…</p>;
  const cls = `${inputCls} h-9 text-[12.5px]`;
  return (
    <>
      <H title="Settings" desc={owner ? "Hours, appointment types, chairs and booking rules for this clinic." : "Only clinic owners can change these settings."} />
      {msg && (
        <div className="mb-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="glass space-y-2 rounded-[20px] p-5">
          <h2 className="text-[15px] text-ink">Working hours</h2>
          {hours.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-[12.5px]">
              <select aria-label="Day" disabled={!owner} value={h.weekday} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))} className={`${cls} !w-36 [&>option]:bg-[var(--surface)]`}>
                {DAYS.map((d, k) => (
                  <option key={d} value={k}>
                    {d}
                  </option>
                ))}
              </select>
              <input aria-label="Opens" type="time" disabled={!owner} value={h.opens} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, opens: e.target.value } : x)))} className={`${cls} !w-28`} />
              <span className="text-ink-4">to</span>
              <input aria-label="Closes" type="time" disabled={!owner} value={h.closes} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, closes: e.target.value } : x)))} className={`${cls} !w-28`} />
              {owner && (
                <button aria-label="Remove period" onClick={() => setHours(hours.filter((_, j) => j !== i))} className="text-ink-4 hover:text-ink">
                  ×
                </button>
              )}
            </div>
          ))}
          {owner && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => setHours([...hours, { weekday: 1, opens: "10:00", closes: "18:00" }])} className="text-[12px] text-ink-3 underline underline-offset-4">
                Add period
              </button>
              <button onClick={() => save({ hours }, "Hours saved.")} className="btn-primary ml-auto h-8 px-4 text-[12px]">
                Save hours
              </button>
            </div>
          )}
        </section>

        <section className="glass space-y-2 rounded-[20px] p-5">
          <h2 className="text-[15px] text-ink">Appointment types</h2>
          <ul className="space-y-1 text-[12.5px] text-ink-2">
            {s.types.map((t) => (
              <li key={t.id} className={t.active ? "" : "opacity-50"}>
                {t.name} · {t.duration_min} min + {t.buffer_min} min buffer {t.fee_note && `· ${t.fee_note}`}
                {owner && (
                  <button onClick={() => save({ type: { ...t, active: !t.active, bookable_online: !!t.bookable_online } }, "Updated.")} className="ml-2 text-ink-4 underline underline-offset-4">
                    {t.active ? "Retire" : "Restore"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {owner && (
            <div className="grid grid-cols-[1fr_70px_70px] gap-1.5 pt-1">
              <input aria-label="Type name" placeholder="New type, e.g. Extraction" value={type.name} onChange={(e) => setType({ ...type, name: e.target.value })} className={cls} />
              <input aria-label="Minutes" type="number" min={5} value={type.duration_min} onChange={(e) => setType({ ...type, duration_min: Number(e.target.value) })} className={`${cls} px-2`} />
              <input aria-label="Buffer minutes" type="number" min={0} value={type.buffer_min} onChange={(e) => setType({ ...type, buffer_min: Number(e.target.value) })} className={`${cls} px-2`} />
              <input aria-label="Fee note" placeholder="Fee note shown to patients (optional)" value={type.fee_note} onChange={(e) => setType({ ...type, fee_note: e.target.value })} className={`${cls} col-span-2`} />
              <button onClick={() => save({ type }, "Type added.").then(() => setType({ name: "", duration_min: 30, buffer_min: 5, fee_note: "" }))} className="btn-primary h-9 text-[12px]">
                Add
              </button>
            </div>
          )}
          <h2 className="pt-3 text-[15px] text-ink">Chairs</h2>
          <p className="text-[12.5px] text-ink-2">{s.chairs.map((c) => c.name).join(", ")}</p>
          {owner && (
            <div className="flex gap-2">
              <input aria-label="Chair name" placeholder="New chair" value={chair} onChange={(e) => setChair(e.target.value)} className={cls} />
              <button onClick={() => save({ chairName: chair }, "Chair added.").then(() => setChair(""))} className="btn-ghost h-9 px-4 text-[12px]">
                Add
              </button>
            </div>
          )}
        </section>

        <section className="glass space-y-2 rounded-[20px] p-5 xl:col-span-2">
          <h2 className="text-[15px] text-ink">Online booking on FMD</h2>
          <p className="text-[12.5px] text-ink-3">
            Status: {s.policy?.live_schedule ? `bookable times published from Clinic OS (${s.policy.schedule_source})` : "patients send requests and you propose a time"}. Linked dentist profiles: {s.providers.map((p) => p.name).join(", ") || "none yet"}.
          </p>
          {owner && (
            <>
              <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                <label className="text-[12.5px] text-ink-2">
                  Minimum notice (minutes)
                  <input type="number" min={0} value={policy.min_notice_minutes} onChange={(e) => setPolicy({ ...policy, min_notice_minutes: Number(e.target.value) })} className={`${cls} mt-1`} />
                </label>
                <label className="text-[12.5px] text-ink-2">
                  Cancellation terms shown to patients
                  <input value={policy.cancellation_terms} onChange={(e) => setPolicy({ ...policy, cancellation_terms: e.target.value })} className={`${cls} mt-1`} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => save({ policy }, "Booking rules saved.")} className="btn-ghost h-9 px-4 text-[12.5px]">
                  Save booking rules
                </button>
                <button disabled={ws.status !== "active"} onClick={() => publish(true)} className="btn-primary h-9 px-4 text-[12.5px] disabled:opacity-50">
                  Publish next 14 days
                </button>
                {!!s.policy?.live_schedule && (
                  <button onClick={() => publish(false)} className="h-9 px-2 text-[12.5px] text-ink-3 underline underline-offset-4">
                    Stop online booking
                  </button>
                )}
              </div>
              {ws.status !== "active" && <p className="text-[12px] text-ink-4">Publishing is available once FMD activates your workspace.</p>}
            </>
          )}
        </section>
      </div>
    </>
  );
}
