"use client";

import { ArrowLeft, Check, CircleDashed, CircleDot, Clock3, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Panel, Tag, type Tone } from "@/components/app/kit";
import { Notice } from "@/components/Page";
import { rupees } from "@/lib/format";
import { useRequireMe } from "@/lib/me";
import { acknowledgePlan, currentStage, getJourney, listJourneys, STAGE_STATUS, type Journey, type StageStatus } from "@/sample/journeys";
import { listRecords, RECORD_TYPES, type DentalRecord } from "@/sample/records";
import { RecordsNav } from "./Records";

const TONE: Record<StageStatus, Tone> = { completed: "ok", scheduled: "accent", waiting: "warn", planned: "muted", cancelled: "bad" };
const ICON: Record<StageStatus, typeof Check> = { completed: Check, scheduled: Clock3, waiting: CircleDot, planned: CircleDashed, cancelled: X };
const dateLabel = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/* ---------------- /journey ---------------- */

export function JourneysPage() {
  const me = useRequireMe();
  const [list, setList] = useState<Journey[] | null>(null);
  const userId = me?.id;
  useEffect(() => {
    if (userId) listJourneys(userId).then(setList);
  }, [userId]);
  if (!me || !list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
          Treatment journeys <Tag tone="muted">Demo</Tag>
        </h1>
        <p className="mt-1 max-w-[680px] text-[14.5px] text-ink-3">Each treatment from first visit to follow-up, as your clinic shares it with you. The clinic&apos;s record is the official one.</p>
      </div>
      <RecordsNav on="journeys" />
      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((j) => {
          const s = currentStage(j);
          return (
            <li key={j.id}>
              <Link href={`/journey/${j.id}`} className="app-panel grid h-full gap-2 p-5 transition-colors hover:border-line-strong">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[16px] font-medium text-ink">{j.title}</p>
                  <Tag tone={j.status === "completed" ? "muted" : "accent"}>{j.status === "completed" ? "Treatment done" : "In progress"}</Tag>
                </div>
                <p className="text-[13.5px] text-ink-3">
                  {j.dentist.name} · {j.clinic.name}, {j.clinic.area} · since {dateLabel(j.started)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
                  Next: {s.title} <Tag tone={TONE[s.status]}>{STAGE_STATUS[s.status]}</Tag>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- /journey/[id] ---------------- */

export function JourneyPage() {
  const { id } = useParams<{ id: string }>();
  const me = useRequireMe();
  const [j, setJ] = useState<Journey | null | undefined>(undefined);
  const [docs, setDocs] = useState<DentalRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const userId = me?.id;
  const load = useCallback(() => {
    if (userId) Promise.all([getJourney(userId, id), listRecords(userId, { episode: id })]).then(([x, d]) => (setJ(x), setDocs(d)));
  }, [userId, id]);
  useEffect(load, [load]);

  if (!me || j === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (j === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that treatment</h1>
        <ButtonLink href="/journey" variant="secondary">
          Treatment journeys
        </ButtonLink>
      </Panel>
    );

  const latest = j.plans.at(-1)!;
  const acked = j.acknowledged?.version === latest.version;
  const ack = async () => {
    setErr(null);
    try {
      setJ(await acknowledgePlan(me.id, j.id, latest.version));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-[860px] gap-5">
      <Link href="/journey" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Treatment journeys
      </Link>
      <div>
        <h1 className="text-[22px] font-medium text-ink">{j.title}</h1>
        <p className="mt-1 text-[14px] text-ink-3">
          {j.dentist.name} · {j.clinic.name}, {j.clinic.area}
        </p>
      </div>
      <Notice kind="info">This shows what the clinic has shared with you. Their record is the official one; ask them if anything here looks wrong.</Notice>
      {err && <Notice kind="error">{err}</Notice>}

      <Panel as="section" className="p-5 sm:p-6">
        <ol className="grid gap-0">
          {j.stages.map((s, i) => {
            const Icon = ICON[s.status];
            return (
              <li key={s.key} className="relative grid grid-cols-[32px_1fr] gap-3 pb-6 last:pb-0">
                {i < j.stages.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-32px)] w-px bg-[var(--border)]" />}
                <span className="grid size-8 place-items-center rounded-full border border-line bg-[var(--surface-elevated)]">
                  <Icon className="size-4 text-ink-2" strokeWidth={1.75} />
                </span>
                <div className="grid gap-1.5 pt-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink">
                    {s.title} <Tag tone={TONE[s.status]}>{STAGE_STATUS[s.status]}</Tag>
                    {s.date && <span className="text-[13px] font-normal text-ink-3">{dateLabel(s.date)}</span>}
                  </p>
                  <p className="text-[14px] text-ink-2">{s.text}</p>
                  {s.key === "plan" && <Plan j={j} acked={acked} onAck={ack} />}
                  {s.key === "documents" && docs.length > 0 && (
                    <ul className="grid gap-1">
                      {docs.map((d) => (
                        <li key={d.id}>
                          <Link href={d.certificate_id ? `/certificates/${d.certificate_id}` : `/records/${d.id}`} className="text-[14px] text-ink underline-offset-4 hover:underline">
                            {d.title}
                          </Link>{" "}
                          <span className="text-[12.5px] text-ink-3">· {RECORD_TYPES[d.type]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.action && (
                    <div>
                      <ButtonLink href={s.action.href} size="sm" variant={s.status === "waiting" ? "primary" : "secondary"}>
                        {s.action.label}
                      </ButtonLink>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}

function Plan({ j, acked, onAck }: { j: Journey; acked: boolean; onAck: () => void }) {
  const [old, setOld] = useState(false);
  const latest = j.plans.at(-1)!;
  const total = latest.items.reduce((n, x) => n + x.amount, 0);
  return (
    <div className="grid gap-3 rounded-2xl border border-line p-4">
      <p className="text-[13.5px] text-ink-3">
        Version {latest.version}, shared {dateLabel(latest.issued)}
      </p>
      <ul className="grid gap-1.5 text-[14px]">
        {latest.items.map((x) => (
          <li key={x.label} className="flex flex-wrap justify-between gap-2">
            <span className="text-ink">{x.label}</span>
            <span className="text-ink-2">{rupees(x.amount)}</span>
          </li>
        ))}
        <li className="flex flex-wrap justify-between gap-2 border-t border-line pt-1.5 font-medium">
          <span className="text-ink">Estimated total</span>
          <span className="text-ink">{rupees(total)}</span>
        </li>
      </ul>
      {latest.note && <p className="text-[13.5px] text-ink-2">{latest.note}</p>}
      {j.plans.length > 1 && (
        <div>
          <button type="button" onClick={() => setOld((o) => !o)} aria-expanded={old} className="text-[13.5px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
            {old ? "Hide" : "Show"} earlier versions
          </button>
          {old &&
            j.plans.slice(0, -1).map((p) => (
              <p key={p.version} className="mt-1 text-[13px] text-ink-3">
                Version {p.version} ({dateLabel(p.issued)}): {p.items.map((x) => `${x.label} ${rupees(x.amount)}`).join("; ")}. {p.note}
              </p>
            ))}
        </div>
      )}
      {acked ? (
        <p className="flex items-center gap-1.5 text-[13.5px] text-[var(--tone-ok)]">
          <Check className="size-4" strokeWidth={2} /> You acknowledged version {latest.version} on {dateLabel(j.acknowledged!.at.slice(0, 10))}.
        </p>
      ) : (
        <div className="grid gap-2">
          <p className="text-[13px] text-ink-3">
            Acknowledging tells the clinic you&apos;ve read this plan. It is <span className="font-medium text-ink-2">not</span> your consent to treatment: the clinic asks for that
            separately, after explaining the options and risks.
          </p>
          <div>
            <Button size="sm" onClick={onAck}>
              I&apos;ve read version {latest.version}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
