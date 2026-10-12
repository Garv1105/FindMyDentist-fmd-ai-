"use client";

import { Paperclip } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/me";
import { inputCls, Notice } from "../Page";

export type Ticket = {
  id: string;
  reference: string;
  areaLabel: string;
  severity: string;
  impact: string;
  subject: string;
  status: string;
  resolution: string;
  canReopen: boolean;
  messages: { body: string; fromStaff: boolean; internal: boolean; at: number; author: string }[];
  attachments: { id: string; mime: string; size_bytes: number }[];
};
export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};
const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** One ticket conversation, used by both the requester (/help) and staff (/admin/support). */
export function TicketThread({ t, staff = false, onChange }: { t: Ticket; staff?: boolean; onChange: (t: Ticket) => void }) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [resolution, setResolution] = useState("");
  const [err, setErr] = useState("");
  const call = async (body: Record<string, unknown>) => {
    setErr("");
    try {
      onChange(await api<Ticket>(`/api/support/tickets/${t.id}`, { method: "POST", body }));
      setText("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const upload = async (file: File) => {
    setErr("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/support/tickets/${t.id}/attachments`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) return setErr(data.message ?? "Upload failed.");
    onChange(data);
  };
  const closed = t.status === "resolved" || t.status === "closed";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-4">
        <span className="font-mono text-ink-3">{t.reference}</span>· {t.areaLabel} · severity {t.severity}
        <span className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-ink-2">{STATUS_LABEL[t.status]}</span>
      </div>
      <h3 className="text-[17px] font-light text-ink">{t.subject}</h3>
      {t.resolution && (
        <p className="rounded-xl border border-line px-3 py-2 text-[13px] text-ink-2">
          <span className="text-ink">Resolution:</span> {t.resolution}
        </p>
      )}
      <ol className="space-y-3">
        {t.messages.map((m, i) => (
          <li key={i} className={`rounded-2xl px-4 py-3 text-[13.5px] ${m.internal ? "border border-dashed border-line-strong text-ink-3" : m.fromStaff ? "bg-[var(--accent-soft)] text-ink-2" : "border border-line text-ink-2"}`}>
            <p className="mb-1 text-[11.5px] text-ink-4">
              {m.internal ? "Internal note · " : ""}
              {m.author} · {fmt(m.at)}
            </p>
            <p className="whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>
      {t.attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {t.attachments.map((a, i) => (
            <li key={a.id}>
              <a href={`/api/support/tickets/${t.id}/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost h-8 px-3 text-[12px]">
                <Paperclip className="size-3.5" /> Attachment {i + 1}
              </a>
            </li>
          ))}
        </ul>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      {(!closed || staff) && (
        <div className="space-y-2">
          <textarea aria-label="Message" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={staff ? "Reply to the requester, or add an internal note" : "Add a message"} className={`${inputCls} h-auto py-2.5 text-[13px]`} />
          <div className="flex flex-wrap items-center gap-2">
            {staff && (
              <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note
              </label>
            )}
            <button disabled={text.trim().length < 2} onClick={() => call({ action: "reply", body: text, internal })} className="btn-primary h-9 px-4 text-[12.5px] disabled:opacity-50">
              Send
            </button>
            {!staff && (
              <label className="btn-ghost h-9 cursor-pointer px-4 text-[12.5px]">
                <Paperclip className="size-3.5" /> Attach screenshot
                <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            )}
          </div>
          {!staff && <p className="text-[11.5px] text-ink-4">Please don&apos;t include patient details or medical images in screenshots unless support asks for them.</p>}
        </div>
      )}
      {!staff && t.canReopen && (
        <button onClick={() => call({ action: "reopen" })} className="btn-ghost h-9 px-4 text-[12.5px]">
          Reopen request
        </button>
      )}
      {staff && (
        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => call({ action: "update", assignToMe: true })} className="btn-ghost h-9 px-4 text-[12.5px]">
              Assign to me
            </button>
            {["in_progress", "waiting_on_user"].map((s) => (
              <button key={s} onClick={() => call({ action: "update", status: s })} className="btn-ghost h-9 px-4 text-[12.5px]">
                Mark {STATUS_LABEL[s].toLowerCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input aria-label="Resolution summary" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution summary (shown to requester)" className={`${inputCls} h-9 text-[13px]`} />
            <button onClick={() => call({ action: "update", status: "resolved", resolution })} className="btn-primary h-9 shrink-0 px-4 text-[12.5px]">
              Resolve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
