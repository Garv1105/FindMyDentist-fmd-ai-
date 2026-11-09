import Link from "next/link";
import { Empty, Panel, Tag, type Tone } from "@/components/app/kit";
import type { Appointment, ApptStatus } from "@/sample/clinic";

const STATUS: Partial<Record<ApptStatus, [Tone, string]>> = {
  checked_in: ["ok", "Checked in"],
  unconfirmed: ["warn", "Unconfirmed"],
  confirmed: ["accent", "Confirmed"],
  booked: ["muted", "Booked"],
};

export function NextAppointments({ appts, base, isToday }: { appts: Appointment[]; base: string; isToday: boolean }) {
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[16px] font-medium text-ink">{isToday ? "Next appointments" : "Appointments"}</h2>
        <Link href={`${base}/calendar`} className="text-[13.5px] text-ink-2 hover:text-ink">
          Open calendar ›
        </Link>
      </div>
      {appts.length === 0 ? (
        <Empty title={isToday ? "No more appointments today" : "No appointments to show"} />
      ) : (
        <ul>
          {appts.map((a, i) => {
            const [tone, label] = a.status === "booked" && a.viaFmd ? (["muted", "Booked via FMD"] as const) : (STATUS[a.status] ?? ["muted", a.status]);
            return (
              <li key={a.id} className="relative grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-3 first:border-0">
                {i === 0 && isToday && <span className="absolute -left-3 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)] sm:-left-[13px]" aria-hidden />}
                <span>
                  <span className="block text-[15px] font-medium text-ink">{a.start.slice(11, 16).replace(/^0/, "")}</span>
                  <span className="block text-[12.5px] text-ink-3">{a.minutes} min</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-ink">{a.patientName}</span>
                  <span className="block truncate text-[13.5px] text-ink-3">
                    {a.type} · {a.dentist} · {a.chair}
                  </span>
                </span>
                <Tag tone={tone}>{label}</Tag>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
