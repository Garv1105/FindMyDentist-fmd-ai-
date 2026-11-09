"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button, Empty, Panel, Tag, type Tone } from "@/components/app/kit";
import type { AgendaItem, FreeSlot, Part } from "@/sample/calendar";
import type { Appointment, ApptStatus } from "@/sample/clinic";

export const hm = (iso: string) => iso.slice(11, 16).replace(/^0/, "");

export const STATUS: Record<ApptStatus, [Tone, string]> = {
  booked: ["muted", "Booked"],
  unconfirmed: ["warn", "Unconfirmed"],
  confirmed: ["ok", "Confirmed"],
  checked_in: ["accent", "In chair"],
  completed: ["muted", "Done"],
  no_show: ["bad", "No-show"],
  cancelled: ["muted", "Cancelled"],
};
export const statusOf = (a: Appointment): [Tone, string] => (a.status === "booked" && a.viaFmd ? ["muted", "Booked via FMD"] : STATUS[a.status]);

/* ---------------- date strip ---------------- */

export function DateStrip({ days, date, onPick, onWeek }: { days: { date: string; booked: number; closed: boolean }[]; date: string; onPick: (d: string) => void; onWeek: (dir: -1 | 1) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Previous week" onClick={() => onWeek(-1)} className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" strokeWidth={1.75} />
      </button>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Choose a day">
        {days.map((d) => {
          const on = d.date === date;
          const dt = new Date(`${d.date}T12:00:00+05:30`);
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onPick(d.date)}
              className={`min-w-[64px] flex-1 rounded-2xl border px-1.5 py-2 text-center transition-colors ${
                on ? "border-[var(--button-primary)] bg-[var(--button-primary)] text-[var(--button-primary-fg)]" : "border-line-strong text-ink hover:border-[var(--accent)]"
              } ${d.closed && !on ? "opacity-45" : ""}`}
            >
              <span className={`block text-[12px] uppercase tracking-[0.06em] ${on ? "" : "text-ink-3"}`}>{dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}</span>
              <span className="block text-[21px] font-medium leading-tight">{dt.getUTCDate()}</span>
              <span className={`block text-[11.5px] ${on ? "" : "text-ink-3"}`}>{d.closed ? "Closed" : `${d.booked} booked`}</span>
            </button>
          );
        })}
      </div>
      <button type="button" aria-label="Next week" onClick={() => onWeek(1)} className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-ink-2 hover:text-ink">
        <ChevronRight className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/* ---------------- list (agenda) ---------------- */

function ApptCard({ appt, isNow, onOpen }: { appt: Appointment; isNow: boolean; onOpen: () => void }) {
  const [tone, label] = statusOf(appt);
  const finished = appt.status === "completed" || appt.status === "no_show";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid w-full grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors sm:grid-cols-[76px_minmax(0,1fr)_auto] ${
        isNow
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-line bg-[var(--surface-glass)] hover:border-line-strong"
      } ${finished ? "opacity-60" : ""}`}
    >
      <span>
        <span className="block text-[16px] font-semibold text-ink">{hm(appt.start)}</span>
        <span className="block text-[12.5px] text-ink-3">{appt.minutes} min</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15.5px] font-medium text-ink">{appt.patientName}</span>
        <span className="line-clamp-2 block text-[13.5px] text-ink-3 sm:line-clamp-1">
          {appt.type} · {appt.dentist} · {appt.chair}
          {appt.viaFmd ? " · via FMD" : ""}
        </span>
      </span>
      <Tag tone={tone}>{label}</Tag>
    </button>
  );
}

/** A part of the day's free time as one row of time chips, so the list stays about the patients. */
function FreeRow({ slots, onBook }: { slots: FreeSlot[]; onBook: (s: FreeSlot) => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] px-3.5 py-3">
      <p className="mb-2 text-[13.5px] font-medium text-[var(--tone-ok)]">Free to book</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((f) => (
          <button
            key={`${f.branchId}-${f.chair}-${f.start}`}
            type="button"
            onClick={() => onBook(f)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--tone-ok)_45%,transparent)] px-3 py-1.5 text-[14px] text-ink hover:bg-[color-mix(in_srgb,var(--tone-ok)_10%,transparent)]"
          >
            <Plus className="size-3.5 text-[var(--tone-ok)]" strokeWidth={2.25} />
            <span className="font-semibold">{hm(f.start)}</span>
            <span className="text-ink-3">
              {f.dentist} · {f.minutes >= 120 ? `${Math.floor(f.minutes / 60)} h` : `${f.minutes} min`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgendaList({ parts, onOpen, onBook }: { parts: Part[]; onOpen: (a: Appointment) => void; onBook: (s: FreeSlot) => void }) {
  const shown = parts.filter((p) => p.items.length > 0);
  if (shown.length === 0) return <Empty title="Nothing matches these filters" hint="Try another day, dentist or status." />;
  return (
    <div className="flex flex-col gap-5">
      {shown.map((p) => {
        const free = p.items.filter((i) => i.kind === "free").length;
        const booked = p.items.length - free;
        return (
          <section key={p.name} aria-label={p.name}>
            <h3 className="mb-2 flex justify-between text-[12.5px] font-medium uppercase tracking-[0.14em] text-ink-3">
              <span>{p.name}</span>
              <span>
                {booked ? `${booked} booked` : ""}
                {booked && free ? " · " : ""}
                {free ? `${free} free` : ""}
              </span>
            </h3>
            <div className="flex flex-col gap-2">
              {p.items.map((i) => i.kind === "appt" && <ApptCard key={i.appt.id} appt={i.appt} isNow={i.isNow} onOpen={() => onOpen(i.appt)} />)}
              {free > 0 && <FreeRow slots={p.items.filter((i): i is FreeSlot => i.kind === "free")} onBook={onBook} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- by dentist (showtimes) ---------------- */

const CHIP: Record<Tone, string> = {
  ok: "border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_10%,transparent)] text-ink",
  warn: "border-[color-mix(in_srgb,var(--tone-warn)_50%,transparent)] bg-[color-mix(in_srgb,var(--tone-warn)_10%,transparent)] text-[var(--tone-warn)]",
  bad: "border-[color-mix(in_srgb,var(--tone-bad)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone-bad)_7%,transparent)] text-[var(--tone-bad)]",
  accent: "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--accent-soft)] text-ink",
  muted: "border-line bg-[var(--surface-glass)] text-ink-2",
};

export function ByDentist({ rows, onOpen, onBook }: { rows: { branchId: string; chair: string; dentist: string; slots: AgendaItem[] }[]; onOpen: (a: Appointment) => void; onBook: (s: FreeSlot) => void }) {
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <section key={`${r.branchId}-${r.chair}`} className="grid gap-3 border-t border-line py-4 first:border-0 first:pt-0 lg:grid-cols-[200px_minmax(0,1fr)]">
          <h3>
            <span className="block text-[15.5px] font-medium text-ink">{r.dentist}</span>
            <span className="block text-[13.5px] text-ink-3">{r.chair}</span>
          </h3>
          {r.slots.length === 0 ? (
            <p className="text-[14px] text-ink-3">Nothing on this day</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {r.slots.map((i) =>
                i.kind === "appt" ? (
                  <button
                    key={i.appt.id}
                    type="button"
                    onClick={() => onOpen(i.appt)}
                    className={`min-w-[104px] rounded-xl border px-3 py-2 text-left ${CHIP[statusOf(i.appt)[0]]} ${i.appt.status === "completed" ? "line-through decoration-[var(--text-faint)]" : ""}`}
                  >
                    <span className="block text-[15px] font-semibold">{hm(i.appt.start)}</span>
                    <span className="block max-w-[150px] truncate text-[12.5px]">
                      {i.appt.patientName.split(" ")[0]} {i.appt.patientName.split(" ")[1]?.[0] ?? ""}. · {statusOf(i.appt)[1].toLowerCase()}
                    </span>
                  </button>
                ) : (
                  <button
                    key={`${i.branchId}-${i.chair}-${i.start}`}
                    type="button"
                    onClick={() => onBook(i)}
                    className="min-w-[104px] rounded-xl border border-dashed border-[color-mix(in_srgb,var(--tone-ok)_55%,transparent)] px-3 py-2 text-left text-[var(--tone-ok)] hover:bg-[color-mix(in_srgb,var(--tone-ok)_6%,transparent)]"
                  >
                    <span className="block text-[15px] font-semibold">{hm(i.start)}</span>
                    <span className="block text-[12.5px]">Free · {i.minutes} min</span>
                  </button>
                ),
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------------- side panel ---------------- */

export function Glance({ g, isToday }: { g: { booked: number; free: number; unconfirmed: number; noShow: number }; isToday: boolean }) {
  const cells: [string, number, string?][] = [
    ["booked", g.booked],
    ["free slots", g.free],
    ["unconfirmed", g.unconfirmed, "var(--tone-warn)"],
    ["no-show", g.noShow, g.noShow ? "var(--tone-bad)" : undefined],
  ];
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <h3 className="mb-3 text-[15.5px] font-medium text-ink">{isToday ? "Today at a glance" : "This day at a glance"}</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map(([label, n, color]) => (
          <div key={label} className="rounded-2xl border border-line p-3">
            <span className="block text-[26px] font-light leading-tight" style={{ color: color ?? "var(--text-primary)" }}>
              {n}
            </span>
            <span className="text-[13.5px] text-ink-3">{label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Waitlist({ items, onOffer }: { items: { id: string; name: string; wants: string; note: string; offered: boolean }[]; onOffer: (id: string) => void }) {
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <h3 className="mb-1 flex justify-between text-[15.5px] font-medium text-ink">
        Waitlist <span className="text-[13.5px] font-normal text-ink-3">{items.length} waiting</span>
      </h3>
      {items.length === 0 ? (
        <p className="py-3 text-[14px] text-ink-3">Nobody is waiting</p>
      ) : (
        <ul>
          {items.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-0">
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium text-ink">{w.name}</span>
                <span className="block text-[13px] text-ink-3">
                  {w.wants} · {w.note}
                </span>
              </span>
              {w.offered ? (
                <span className="text-[13px] text-[var(--tone-ok)]">Offered (demo)</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => onOffer(w.id)}>
                  Offer a slot
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
