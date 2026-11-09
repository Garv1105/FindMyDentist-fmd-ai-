"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Empty, Panel, Tag } from "@/components/app/kit";
import { toggleFollowUp, type FollowUp } from "@/sample/clinic";

const DUE = { overdue: ["bad", "Overdue"], today: ["warn", "Today"], upcoming: ["muted", "Upcoming"] } as const;

function Item({ f, clinicId, onChange }: { f: FollowUp; clinicId: string; onChange: (f: FollowUp) => void }) {
  const [tone, label] = DUE[f.due];
  return (
    <li className="flex items-start gap-3 border-t border-line py-3 first:border-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={f.done}
        aria-label={f.title}
        onClick={async () => onChange(await toggleFollowUp(clinicId, f.id))}
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] ${f.done ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--button-primary-fg)]" : "border-line-strong"}`}
      >
        {f.done && <Check className="size-3.5" strokeWidth={2.5} />}
      </button>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14.5px] leading-snug ${f.done ? "text-ink-3 line-through" : "font-medium text-ink"}`}>{f.title}</span>
        <span className="block text-[13px] text-ink-3">{f.note}</span>
      </span>
      {!f.done && (f.fromAi ? <Tag tone="accent">AI</Tag> : <Tag tone={tone}>{label}</Tag>)}
    </li>
  );
}

export function FollowUps({ items, clinicId, base, onChange }: { items: FollowUp[]; clinicId: string; base: string; onChange: (f: FollowUp) => void }) {
  // done items sink to the bottom of their group
  const group = (kind: FollowUp["kind"]) => items.filter((f) => f.kind === kind).sort((a, b) => Number(a.done) - Number(b.done));
  const sections = [
    ["Follow-ups", group("follow_up")],
    ["Staff tasks", group("staff_task")],
  ] as const;
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[16px] font-medium text-ink">Follow-ups & tasks</h2>
        <Link href={`${base}/tasks`} className="text-[13.5px] text-ink-2 hover:text-ink">
          All tasks ›
        </Link>
      </div>
      {items.length === 0 ? (
        <Empty title="Nothing waiting" />
      ) : (
        sections.map(
          ([title, list]) =>
            list.length > 0 && (
              <div key={title}>
                <p className="mb-0.5 mt-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">{title}</p>
                <ul>
                  {list.map((f) => (
                    <Item key={f.id} f={f} clinicId={clinicId} onChange={onChange} />
                  ))}
                </ul>
              </div>
            ),
        )
      )}
    </Panel>
  );
}
