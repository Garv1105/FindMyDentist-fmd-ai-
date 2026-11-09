"use client";

import { LayoutList, Plus, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Panel } from "@/components/app/kit";
import { getAgenda, getByDentist, getWeekStrip, listWaitlist, offerSlot, type FreeSlot, type Part } from "@/sample/calendar";
import { CHAIRS, type Appointment, type ApptStatus } from "@/sample/clinic";
import { todayIst, useClinic } from "../Shell";
import { AgendaList, ByDentist, DateStrip, Glance, hm, Waitlist } from "./parts";
import { ApptSheet, BookSheet, type BookDraft } from "./sheets";

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

const STATUSES: [ApptStatus | "free", string][] = [
  ["unconfirmed", "Unconfirmed"],
  ["confirmed", "Confirmed"],
  ["checked_in", "In chair"],
  ["completed", "Done"],
  ["no_show", "No-show"],
  ["free", "Free slots"],
];

type Data = {
  week: { date: string; booked: number; closed: boolean }[];
  parts: Part[];
  glance: { booked: number; free: number; unconfirmed: number; noShow: number };
  rows: Awaited<ReturnType<typeof getByDentist>>;
  waitlist: Awaited<ReturnType<typeof listWaitlist>>;
};

const selectCls = "h-10 rounded-full border border-line bg-[var(--surface-glass)] px-3.5 text-[14px] text-ink outline-none [color-scheme:dark] hover:border-line-strong";

/** FMD Clinic Calendar: the day as one clear list (or by dentist), with free time you can book (PRD 6.4). */
export function Calendar() {
  const { clinic, base, date, setDate, branchId } = useClinic();
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const view = params.get("view") === "dentist" ? "dentist" : "list";
  const status = (params.get("status") ?? params.get("filter") ?? "") as ApptStatus | "free" | "";
  const dentist = params.get("dentist") ?? "";
  const setParam = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(params);
      if (value) p.set(key, value);
      else p.delete(key);
      if (key === "status") p.delete("filter");
      router.replace(`${path}?${p}`, { scroll: false });
    },
    [params, path, router],
  );

  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState<BookDraft | null>(null);
  const [toast, setToast] = useState("");
  const refresh = useCallback(() => setVersion((v) => v + 1), []);


  useEffect(() => {
    let live = true;
    const opts = { date, branchId };
    Promise.all([
      getWeekStrip(clinic.id, { from: mondayOf(date), days: 7, branchId }),
      getAgenda(clinic.id, { ...opts, dentist: dentist || undefined, status: status || undefined }),
      getByDentist(clinic.id, opts),
      listWaitlist(clinic.id, branchId),
    ]).then(([week, agenda, rows, waitlist]) => live && setData({ week, ...agenda, rows: dentist ? rows.filter((r) => r.dentist === dentist) : rows, waitlist }));
    return () => {
      live = false;
    };
  }, [clinic.id, date, branchId, dentist, status, version]);

  const dentists = (branchId === "all" ? Object.values(CHAIRS).flat() : (CHAIRS[branchId] ?? [])).map((c) => c.dentist);
  const closed = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  const isToday = date === todayIst();
  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 3500);
  };
  const bookFree = (s: FreeSlot) => setBooking({ branchId: s.branchId, chair: s.chair, date, start: s.start.slice(11, 16) });
  const draftFor = (patientName?: string): BookDraft => {
    const b = branchId === "all" ? "main" : branchId;
    return { branchId: b, chair: CHAIRS[b]?.[0]?.chair ?? "Chair 1", date: date < todayIst() ? todayIst() : date, start: "10:00", patientName };
  };
  const bookNew = () => setBooking(draftFor());
  // a patient page's "Book" button arrives with ?book=<name>
  const bookFor = params.get("book");
  const sheet = booking ?? (bookFor ? draftFor(bookFor) : null);
  const closeBooking = () => {
    setBooking(null);
    if (bookFor) setParam("book", "");
  };

  return (
    <div className="flex flex-col gap-4">
      {data && (
        <Panel className="p-3 sm:p-4">
          <DateStrip days={data.week} date={date} onPick={setDate} onWeek={(d) => setDate(addDays(date, 7 * d))} />
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-full border border-line-strong p-1" role="group" aria-label="View">
          {(
            [
              ["list", "List", LayoutList],
              ["dentist", "By dentist", Users],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setParam("view", v === "list" ? "" : v)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[14px] ${view === v ? "bg-[var(--button-primary)] font-semibold text-[var(--button-primary-fg)]" : "text-ink-2 hover:text-ink"}`}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="cal-dentist">
          Dentist
        </label>
        <select id="cal-dentist" className={selectCls} value={dentist} onChange={(e) => setParam("dentist", e.target.value)}>
          <option value="">All dentists</option>
          {dentists.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        {view === "list" && (
          <>
            <label className="sr-only" htmlFor="cal-status">
              Status
            </label>
            <select id="cal-status" className={selectCls} value={status} onChange={(e) => setParam("status", e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </>
        )}
        <Button className="ml-auto" onClick={bookNew}>
          <Plus className="size-4" strokeWidth={2.25} />
          Book
        </Button>
      </div>

      {toast && (
        <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
          {toast}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel as="section" className="p-4 sm:p-5">
          {!data ? (
            <div className="h-[420px] motion-safe:animate-pulse" aria-busy />
          ) : closed ? (
            <Empty title="Closed on Sundays" hint="Pick another day in the strip above." />
          ) : view === "list" ? (
            <AgendaList parts={data.parts} onOpen={setOpen} onBook={bookFree} />
          ) : (
            <ByDentist rows={data.rows} onOpen={setOpen} onBook={bookFree} />
          )}
        </Panel>
        {data && (
          <div className="flex flex-col gap-4">
            <Glance g={data.glance} isToday={isToday} />
            <Waitlist
              items={data.waitlist}
              onOffer={async (id) => {
                await offerSlot(clinic.id, id);
                refresh();
              }}
            />
          </div>
        )}
      </div>

      {open && <ApptSheet appt={open} clinicId={clinic.id} base={base} onClose={() => setOpen(null)} onChanged={refresh} />}
      {sheet && (
        <BookSheet
          clinicId={clinic.id}
          draft={sheet}
          onClose={closeBooking}
          onBooked={(a) => {
            setBooking(null);
            // one URL update: drop ?book= and jump to the booked day together, so neither undoes the other
            const p = new URLSearchParams(params);
            p.delete("book");
            p.set("date", a.start.slice(0, 10));
            if (bookFor || a.start.slice(0, 10) !== date) router.replace(`${path}?${p}`, { scroll: false });
            refresh();
            say(`Booked ${a.patientName} at ${hm(a.start)} with ${a.dentist} (demo, nothing was sent).`);
          }}
        />
      )}
    </div>
  );
}
