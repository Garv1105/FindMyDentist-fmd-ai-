"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Empty, Panel, Tag, type Tone } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { getClinicHome, toggleFollowUp, type FollowUp } from "@/sample/clinic";
import { addHandover, addTask, getTasks, tick, toggleTask, type Task } from "@/sample/tasks";
import { listTeam, type Member } from "@/sample/team";
import { useClinic } from "../Shell";

type Data = Awaited<ReturnType<typeof getTasks>>;
const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const DUE: Record<string, [Tone, string]> = { overdue: ["bad", "Overdue"], today: ["warn", "Today"], "this week": ["muted", "This week"], upcoming: ["muted", "Upcoming"] };
const seg = (on: boolean) => `rounded-full border px-3 py-1.5 text-[13.5px] ${on ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:text-ink"}`;

export function Tasks() {
  const { clinic, branchId, date, user } = useClinic();
  const [data, setData] = useState<Data | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [mine, setMine] = useState(user.role === "dentist");
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      Promise.all([getTasks(clinic.id, date), getClinicHome(clinic.id, { date, branchId }), listTeam(clinic.id)]).then(([d, h, t]) => {
        setData(d);
        setFollowUps(h.followUps);
        setTeam(t);
      }),
    [clinic.id, date, branchId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return <div className="grid gap-4 lg:grid-cols-2" aria-busy aria-label="Loading">{[0, 1, 2].map((i) => <Panel key={i} className="h-[200px] motion-safe:animate-pulse" />)}</div>;

  const tasks = data.tasks.filter((t) => !mine || t.assignee === user.name);
  const open = tasks.filter((t) => !t.done);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel as="section" className="p-4 sm:p-5">
          <div className={h2}>
            <h2>
              Tasks <span className={sub}>{open.length} open</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={seg(mine)} aria-pressed={mine} onClick={() => setMine(true)}>
                Mine
              </button>
              <button type="button" className={seg(!mine)} aria-pressed={!mine} onClick={() => setMine(false)}>
                Everyone
              </button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" strokeWidth={2} /> New task
              </Button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="mt-3">
              <Empty title="No tasks for you" hint="Switch to Everyone to see the whole clinic's list." />
            </div>
          ) : (
            <ul className="mt-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 border-t border-line py-2.5 first:border-0">
                  <input
                    id={`task-${t.id}`}
                    type="checkbox"
                    checked={t.done}
                    onChange={async () => {
                      await toggleTask(clinic.id, t.id);
                      void load();
                    }}
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <label htmlFor={`task-${t.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className={`block text-[14.5px] ${t.done ? "text-ink-3 line-through" : "text-ink"}`}>{t.title}</span>
                    <span className="block text-[13px] text-ink-3">
                      {t.assignee}
                      {t.fromAi ? " · suggested by FMD Manager" : ""}
                    </span>
                  </label>
                  {!t.done && <Tag tone={DUE[t.due][0]}>{DUE[t.due][1]}</Tag>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            Follow-ups <span className={sub}>also on Home</span>
          </h2>
          <ul className="mt-2">
            {followUps.map((f) => (
              <li key={f.id} className="flex items-start gap-3 border-t border-line py-2.5 first:border-0">
                <input
                  id={`fu-${f.id}`}
                  type="checkbox"
                  checked={f.done}
                  onChange={async () => {
                    await toggleFollowUp(clinic.id, f.id);
                    void load();
                  }}
                  className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                />
                <label htmlFor={`fu-${f.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className={`block text-[14.5px] ${f.done ? "text-ink-3 line-through" : "text-ink"}`}>{f.title}</span>
                  <span className="block text-[13px] text-ink-3">{f.note}</span>
                </label>
                {!f.done && <Tag tone={DUE[f.due][0]}>{DUE[f.due][1]}</Tag>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.checklists.map((c) => {
          const done = c.items.filter((i) => i.ticked).length;
          return (
            <Panel as="section" key={c.list} className="p-4 sm:p-5">
              <h2 className={h2}>
                {c.list === "opening" ? "Opening checklist" : "Closing checklist"}{" "}
                <span className={sub}>
                  {done} of {c.items.length} · {new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                </span>
              </h2>
              <ul className="mt-2">
                {c.items.map((i) => (
                  <li key={i.item} className="border-t border-line first:border-0">
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 text-[14.5px]">
                      <input
                        type="checkbox"
                        checked={i.ticked}
                        onChange={async () => {
                          await tick(clinic.id, date, c.list, i.item);
                          void load();
                        }}
                        className="size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className={i.ticked ? "text-ink-3 line-through" : "text-ink"}>{i.item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>

      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          Shift handover <span className={sub}>what the next shift needs to know</span>
        </h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            try {
              await addHandover(clinic.id, note, user.name);
              setNote("");
              setError("");
              void load();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label htmlFor="handover" className="sr-only">
            Handover note
          </label>
          <input id="handover" className={`${fieldCls} flex-1`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Chair 2 handpiece is noisy; Mr. Khan will call back about his bill" />
          <Button type="submit">Add note</Button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <ul className="mt-3">
          {data.handovers.map((h) => (
            <li key={h.id} className="border-t border-line py-2.5 first:border-0">
              <p className="text-[14.5px] text-ink">{h.text}</p>
              <p className="text-[13px] text-ink-3">
                {h.by} · {h.at}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      {adding && (
        <NewTask
          people={team.filter((m) => m.status === "active").map((m) => m.name)}
          me={user.name}
          onClose={() => setAdding(false)}
          onSave={async (t) => {
            await addTask(clinic.id, t);
            setAdding(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function NewTask({ people, me, onClose, onSave }: { people: string[]; me: string; onClose: () => void; onSave: (t: { title: string; assignee: string; due: Task["due"] }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(people.includes(me) ? me : people[0] ?? me);
  const [due, setDue] = useState<Task["due"]>("today");
  const [error, setError] = useState("");
  return (
    <Sheet title="New task" onClose={onClose}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave({ title, assignee, due });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Field label="What needs doing">
          <input id="task-title" className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Who">
          <select id="task-who" className={fieldCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="When">
          <select id="task-due" className={fieldCls} value={due} onChange={(e) => setDue(e.target.value as Task["due"])}>
            <option value="today">Today</option>
            <option value="this week">This week</option>
          </select>
        </Field>
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">Add task</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
