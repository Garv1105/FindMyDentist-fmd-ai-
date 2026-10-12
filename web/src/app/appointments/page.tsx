"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtDay, fmtTime } from "@/components/booking/BookingPanel";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

type Booking = {
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  dentist: { id: string; name: string; specialty: string; demo: boolean };
  clinic: { name: string; area: string; phone: string };
  startsAt: number | null;
  preferredWindow: string;
  feeNote: string;
  cancellationTerms: string;
  canChange: boolean;
  createdAt: number;
};
type Event = { at: number; from_status: string | null; to_status: string; note: string };

export default function AppointmentsPage() {
  const me = useMe();
  return (
    <Page>
      <p className="eyebrow">Appointments</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Your appointments</h1>
      <div className="mt-8">
        {me === undefined && <p className="text-ink-4">Loading…</p>}
        {me === null && (
          <Notice kind="info">
            <Link href="/signin?next=/appointments" className="underline">Sign in</Link> to see your appointment requests.
          </Notice>
        )}
        {me && <List />}
      </div>
    </Page>
  );
}

function List() {
  const [items, setItems] = useState<Booking[] | null>(null);
  const [err, setErr] = useState("");
  const load = () => api<{ items: Booking[] }>("/api/bookings").then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!items) return <p className="text-ink-4">Loading…</p>;
  if (!items.length)
    return (
      <div className="glass rounded-[24px] p-10 text-center">
        <p className="text-[17px] font-light text-ink">No appointment requests yet</p>
        <Link href="/#dentists" className="btn-primary mt-5 h-10 px-5 text-[13px]">
          Find a dentist
        </Link>
      </div>
    );
  return (
    <ul className="space-y-4">
      {items.map((b) => (
        <Item key={b.id} b={b} onChange={load} />
      ))}
    </ul>
  );
}

function Item({ b, onChange }: { b: Booking; onChange: () => void }) {
  const [history, setHistory] = useState<Event[] | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const cancel = async () => {
    try {
      await api(`/api/bookings/${b.id}/cancel`, { method: "POST", body: { reason } });
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const toggleHistory = async () => {
    if (history) return setHistory(null);
    try {
      setHistory((await api<{ events: Event[] }>(`/api/bookings/${b.id}`)).events);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <li className="glass rounded-[24px] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[12px] text-ink-3">{b.reference}</p>
          <h2 className="mt-1 text-[18px] font-light text-ink">
            <Link href={`/dentists/${b.dentist.id}`} className="hover:underline">
              {b.dentist.name}
            </Link>
            <span className="text-ink-3"> · {b.dentist.specialty}</span>
          </h2>
          <p className="text-[13px] text-ink-3">
            {b.clinic.name}, {b.clinic.area}
          </p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2">{b.statusLabel}</span>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[110px_1fr]">
        <dt className="text-ink-4">Time</dt>
        <dd className="text-ink-2">{b.startsAt ? `${fmtDay(b.startsAt)}, ${fmtTime(b.startsAt)} IST` : `Clinic to propose · you prefer ${b.preferredWindow}`}</dd>
        <dt className="text-ink-4">Fee</dt>
        <dd className="text-ink-2">{b.feeNote}</dd>
        <dt className="text-ink-4">Cancellation</dt>
        <dd className="text-ink-2">{b.cancellationTerms}</dd>
      </dl>
      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {b.canChange && (
          <>
            <Link href={`/dentists/${b.dentist.id}?reschedule=${b.id}#book`} className="btn-ghost h-9 px-4 text-[12.5px]">
              Reschedule
            </Link>
            <button onClick={() => setCancelling((c) => !c)} className="btn-ghost h-9 px-4 text-[12.5px]">
              Cancel request
            </button>
          </>
        )}
        {b.clinic.phone && (
          <a href={`tel:${b.clinic.phone}`} className="btn-ghost h-9 px-4 text-[12.5px]">
            Call clinic
          </a>
        )}
        <button onClick={toggleHistory} className="h-9 px-2 text-[12.5px] text-ink-3 underline underline-offset-4 hover:text-ink">
          {history ? "Hide history" : "Status history"}
        </button>
      </div>
      {cancelling && (
        <div className="mt-4 flex flex-wrap gap-2">
          <input aria-label="Reason (optional)" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} h-10 flex-1 text-[13px]`} />
          <button onClick={cancel} className="btn-primary h-10 px-4 text-[13px]">
            Confirm cancellation
          </button>
        </div>
      )}
      {history && (
        <ol className="mt-4 space-y-1.5 border-t border-line pt-4 text-[12.5px] text-ink-3">
          {history.map((h, i) => (
            <li key={i}>
              {new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {h.to_status.replaceAll("_", " ")}
              {h.note && <span className="text-ink-4"> — {h.note}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-[11.5px] text-ink-4">Reminders will be sent once messaging is connected. Need help? Contact the clinic or FMD support.</p>
    </li>
  );
}
