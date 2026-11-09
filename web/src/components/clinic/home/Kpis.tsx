import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ClinicHome } from "@/sample/clinic";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Kpi({ href, label, value, sub, children }: { href: string; label: string; value: string | number; sub: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="app-panel group block p-4 transition-colors sm:p-5">
      <span className="flex items-center justify-between text-[13.5px] text-ink-3">
        {label}
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
      </span>
      <span className="mt-1 block text-[28px] font-light tracking-[-0.03em] text-ink sm:text-[32px]">{value}</span>
      <span className="mt-0.5 block text-[13.5px] text-ink-2">{sub}</span>
      {children}
    </Link>
  );
}

/** The four numbers under the briefing; each opens the page that explains it. */
export function Kpis({ home, base }: { home: ClinicHome; base: string }) {
  const { counts: c, money: m, attention: a } = home;
  const day = home.isToday ? "today" : "this day";
  const bar = (n: number, color: string) => (n ? <i className="block h-full" style={{ width: `${(n / c.total) * 100}%`, background: color }} /> : null);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kpi
        href={`${base}/calendar`}
        label={`Appointments ${day}`}
        value={c.total}
        sub={c.total ? `${c.checkedIn} checked in · ${c.completed} done · ${c.noShow} no-show` : "None booked"}
      >
        {c.total > 0 && (
          <span className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-glass)]" aria-hidden>
            {bar(c.completed, "var(--tone-ok)")}
            {bar(c.checkedIn, "var(--accent)")}
            {bar(c.noShow, "var(--tone-bad)")}
          </span>
        )}
      </Kpi>
      <Kpi
        href={`${base}/calendar?filter=unconfirmed`}
        label="Pending confirmations"
        value={c.unconfirmed + c.unconfirmedNextDay}
        sub={`${c.unconfirmed} ${day} · ${c.unconfirmedNextDay} ${home.isToday ? "tomorrow" : "the next day"}`}
      />
      <Kpi href={`${base}/billing`} label={`Collected ${day}`} value={inr(m.collectedInr)} sub={`${inr(m.outstandingInr)} outstanding · ${plural(m.outstandingPatients, "patient")}`} />
      <Kpi
        href={`${base}/tasks`}
        label="Needs attention"
        value={a.unsignedNotes + a.overdueFollowUps}
        sub={`${plural(a.unsignedNotes, "unsigned note")} · ${plural(a.overdueFollowUps, "overdue follow-up")}`}
      />
    </div>
  );
}
