"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { inputCls, Notice } from "../Page";
import type { ProviderProfile } from "../providers";
import { api, useMe } from "@/lib/me";

type Availability = {
  live: boolean;
  scheduleSource: string;
  clinicName: string;
  feeNote: string;
  cancellationTerms: string;
  slots: { id: string; startsAt: number; endsAt: number }[];
};
type Booking = { id: string; reference: string; statusLabel: string; startsAt: number | null; preferredWindow: string };

const TZ = "Asia/Kolkata";
export const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export function BookingPanel({ profile }: { profile: ProviderProfile }) {
  const me = useMe();
  const reschedule = useSearchParams().get("reschedule");
  const [avail, setAvail] = useState<Availability | null>(null);
  const [step, setStep] = useState<"choose" | "review" | "done">("choose");
  const [slot, setSlot] = useState<string | null>(null);
  const [preferred, setPreferred] = useState("");
  const [reason, setReason] = useState("");
  const [agree, setAgree] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Booking | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState(profile.clinics[0]?.id ?? "");

  const load = useCallback(() => {
    api<Availability>(`/api/providers/${profile.id}/availability?clinic=${encodeURIComponent(clinicId)}`).then(setAvail).catch((e) => setErr(e.message));
  }, [profile.id, clinicId]);
  useEffect(load, [load]);

  const days = useMemo(() => {
    const m = new Map<string, Availability["slots"]>();
    for (const s of avail?.slots ?? []) m.set(fmtDay(s.startsAt), [...(m.get(fmtDay(s.startsAt)) ?? []), s]);
    return [...m.entries()];
  }, [avail]);
  const activeDay = day ?? days[0]?.[0] ?? null;
  const chosen = avail?.slots.find((s) => s.id === slot);

  const confirm = async () => {
    setBusy(true);
    setErr("");
    try {
      const body = { dentistId: profile.id, clinicId, slotId: slot, preferredWindow: preferred, reason, confirmed: true, idempotencyKey: key };
      setDone(await api<Booking>(reschedule ? `/api/bookings/${reschedule}/reschedule` : "/api/bookings", { method: "POST", body }));
      setStep("done");
    } catch (e) {
      setErr((e as Error).message);
      if (/time|slot/i.test((e as Error).message)) {
        setSlot(null);
        setStep("choose");
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (me === null)
    return (
      <>
        <Heading reschedule={!!reschedule} />
        <p className="mt-3 text-[13.5px] text-ink-3">Sign in to request an appointment. You review every detail before anything is sent.</p>
        <Link href={`/signin?next=/dentists/${profile.id}%23book`} className="btn-primary mt-5 h-11 px-5 text-[13.5px]">
          Sign in to continue
        </Link>
      </>
    );
  if (!avail) return err ? <Notice kind="error">{err}</Notice> : <p className="text-[13px] text-ink-4">Loading availability…</p>;

  if (step === "done" && done)
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <span className="icon-tile size-14 !rounded-full">
          <Check className="size-6" strokeWidth={1.5} />
        </span>
        <h2 className="mt-5 text-[22px] font-light text-ink">{reschedule ? "New time requested" : "Request sent"}</h2>
        <p className="mt-2 text-[13px] text-ink-3">
          Reference <span className="font-mono text-ink">{done.reference}</span>
        </p>
        <p className="mt-3 max-w-[340px] text-[13px] leading-relaxed text-ink-3">
          Status: <span className="text-ink-2">{done.statusLabel}</span>. The appointment is confirmed only when the clinic confirms it.
        </p>
        <Link href="/appointments" className="btn-ghost mt-6 h-10 px-5 text-[13px]">
          View my appointments
        </Link>
      </div>
    );

  if (step === "review")
    return (
      <div>
        <button onClick={() => setStep("choose")} className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.5} /> Change details
        </button>
        <h2 className="mt-4 text-[22px] font-light tracking-[-0.02em] text-ink">Review before you confirm</h2>
        <p className="mt-1 text-[13px] text-ink-4">Nothing is sent until you confirm below.</p>
        <dl className="mt-5 divide-y divide-[var(--border)] rounded-[18px] border border-line">
          {[
            ["Dentist", `${profile.name} · ${profile.specialty}`],
            ["Clinic", avail.clinicName],
            ["Time", chosen ? `${fmtDay(chosen.startsAt)}, ${fmtTime(chosen.startsAt)} (IST)` : `Clinic will propose a time · you prefer: ${preferred}`],
            ["Fee", avail.feeNote],
            ["Cancellation", avail.cancellationTerms],
            ...(reason ? [["Reason", reason]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 px-4 py-3">
              <dt className="shrink-0 text-[12.5px] text-ink-4">{k}</dt>
              <dd className="text-right text-[13px] text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-ink-3">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
          I&apos;ve reviewed these details and want to send this request to the clinic. I understand it isn&apos;t confirmed until the clinic confirms.
        </label>
        {err && (
          <div className="mt-4">
            <Notice kind="error">{err}</Notice>
          </div>
        )}
        <button disabled={!agree || busy} onClick={confirm} className="btn-primary mt-5 h-12 w-full text-[14px] disabled:opacity-40">
          {busy ? "Sending…" : reschedule ? "Confirm new time" : "Confirm request"}
        </button>
      </div>
    );

  return (
    <div>
      <Heading reschedule={!!reschedule} />
      {profile.clinics.length > 1 && (
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-3">
          Clinic
          <select
            value={clinicId}
            onChange={(e) => {
              setClinicId(e.target.value);
              setSlot(null);
              setDay(null);
            }}
            className={`${inputCls} h-10 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}
          >
            {profile.clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.area}
              </option>
            ))}
          </select>
        </label>
      )}
      {avail.live ? (
        <>
          <p className="mt-2 text-[12.5px] text-ink-4">
            Times from the clinic&apos;s schedule{avail.scheduleSource === "demo" ? " (demo schedule)" : ""}. Shown in IST.
          </p>
          {days.length === 0 ? (
            <p className="mt-4 rounded-[14px] border border-dashed border-line-strong p-3.5 text-[12.5px] text-ink-3">No open times in the next two weeks. Try FMD Edge for help.</p>
          ) : (
            <>
              <div role="tablist" aria-label="Day" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
                {days.map(([d]) => (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={activeDay === d}
                    onClick={() => setDay(d)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] ${activeDay === d ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {days
                  .find(([d]) => d === activeDay)?.[1]
                  .map((s) => (
                    <button
                      key={s.id}
                      aria-pressed={slot === s.id}
                      onClick={() => setSlot(s.id)}
                      className={`rounded-[12px] border px-2 py-2 text-[13px] transition-all ${slot === s.id ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3 hover:border-line-strong"}`}
                    >
                      {fmtTime(s.startsAt)}
                    </button>
                  ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 rounded-[14px] border border-dashed border-line-strong p-3.5 text-[12.5px] leading-relaxed text-ink-3">
            This clinic isn&apos;t connected to live scheduling. Send a request with your preferred timing and the clinic will propose a time for you to accept.
          </p>
          <label htmlFor="pref" className="mt-4 block text-[13px] text-ink-2">
            When would you prefer?
          </label>
          <input id="pref" value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="e.g. Weekday mornings, or Saturday" className={`${inputCls} mt-2`} />
        </>
      )}
      <label htmlFor="reason" className="mt-4 block text-[13px] text-ink-2">
        What&apos;s the visit for? <span className="text-ink-4">(optional)</span>
      </label>
      <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Check-up, sensitivity in a back tooth" className={`${inputCls} mt-2`} />
      {err && (
        <div className="mt-4">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
      <button
        disabled={avail.live ? !slot : preferred.trim().length < 3}
        onClick={() => {
          setKey(crypto.randomUUID()); // one key per review → retries can't create duplicates
          setAgree(false);
          setErr("");
          setStep("review");
        }}
        className="btn-primary mt-5 h-12 w-full text-[14px] disabled:opacity-40"
      >
        Review request
      </button>
    </div>
  );
}

function Heading({ reschedule }: { reschedule: boolean }) {
  return <h2 className="text-[20px] font-light tracking-[-0.02em] text-ink">{reschedule ? "Choose a new time" : "Request an appointment"}</h2>;
}
