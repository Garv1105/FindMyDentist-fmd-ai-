"use client";

import { useCallback, useEffect, useState } from "react";
import { H, fromLocal, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Task = { id: string; title: string; detail: string; assignee: string | null; due_at: number | null; priority: string; status: string; source: string; overdue: boolean };
type Member = { userId: string; name: string };

export default function TasksPage() {
  const { call } = useClinic();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [mine, setMine] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [handovers, setHandovers] = useState<{ body: string; created_at: number; author: string }[]>([]);
  const [f, setF] = useState({ title: "", detail: "", assigneeId: "", due: "", priority: "normal" });
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    call<Task[]>(`tasks${mine ? "?mine=1" : ""}`).then(setTasks).catch((e) => setErr(e.message));
    call<typeof handovers>("handovers").then(setHandovers).catch(() => {});
  }, [call, mine]);
  useEffect(load, [load]);
  useEffect(() => {
    call<{ members: Member[] }>("members").then((r) => setMembers(r.members)).catch(() => {});
  }, [call]);
  const act = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <>
      <H title="Tasks & handover">
        <label className="flex items-center gap-2 text-[13px] text-ink-3">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine
        </label>
      </H>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="space-y-2">
          {tasks?.length === 0 && <li className="text-[13px] text-ink-4">No open tasks.</li>}
          {tasks?.map((t) => (
            <li key={t.id} className="glass flex flex-wrap items-start gap-3 rounded-[16px] p-4 text-[13px]">
              <input type="checkbox" aria-label={`Mark "${t.title}" done`} onChange={() => act(() => call(`tasks/${t.id}/status`, "POST", { status: "done" }))} className="mt-1" />
              <div className="flex-1">
                <p className="text-ink">
                  {t.title}
                  {t.priority === "high" && <span className="text-ink-3"> · high priority</span>}
                </p>
                {t.detail && <p className="text-ink-3">{t.detail}</p>}
                <p className="text-[12px] text-ink-4">
                  {t.assignee ? `Assigned to ${t.assignee}` : "Unassigned"}
                  {t.due_at && ` · due ${when(t.due_at)}`}
                  {t.overdue && " · overdue"}
                  {t.source === "ai" && " · suggested by the AI manager"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <aside className="space-y-5">
          <div className="glass space-y-2 rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">New task</h2>
            <input aria-label="Title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
            <input aria-label="Detail" placeholder="Detail (optional)" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Assignee" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} className={`${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select aria-label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={`${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <input aria-label="Due" type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
            <button onClick={() => act(() => call("tasks", "POST", { ...f, dueAt: f.due ? fromLocal(f.due) : null }).then(() => setF({ title: "", detail: "", assigneeId: "", due: "", priority: "normal" })))} className="btn-primary h-9 w-full text-[12.5px]">
              Add task
            </button>
          </div>
          <div className="glass space-y-2 rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">Handover notes</h2>
            <textarea aria-label="Handover note" rows={3} placeholder="What should the next shift know? (no unnecessary patient details)" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} h-auto py-2 text-[12.5px]`} />
            <button onClick={() => act(() => call("handovers", "POST", { body: note }).then(() => setNote("")))} className="btn-ghost h-9 w-full text-[12.5px]">
              Add handover
            </button>
            <ul className="space-y-2 pt-2">
              {handovers.map((h, i) => (
                <li key={i} className="text-[12.5px] text-ink-2">
                  <span className="text-ink-4">
                    {when(h.created_at)} · {h.author}:
                  </span>{" "}
                  {h.body}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
