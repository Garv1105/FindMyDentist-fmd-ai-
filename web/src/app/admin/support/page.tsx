"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Notice, Page } from "@/components/Page";
import { STATUS_LABEL, TicketThread, type Ticket } from "@/components/support/TicketThread";
import { api, useMe } from "@/lib/me";

type Q = {
  items: { id: string; reference: string; subject: string; areaLabel: string; severity: string; status: string; requester: string; assignee: string | null; createdAt: number }[];
  metrics: { open: number; medianFirstResponseHours: number | null; reopenRate: number | null };
};

export default function SupportQueuePage() {
  const me = useMe();
  const isOps = !!me?.roles.some((r) => r === "fmd_ops" || r === "super_admin");
  return (
    <Page>
      <p className="eyebrow">FMD Operations</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink">Support queue</h1>
      <div className="mt-8">
        {me === null && (
          <Notice kind="info">
            Staff sign-in required. <Link href="/signin?next=/admin/support" className="underline">Sign in</Link>
          </Notice>
        )}
        {me && !isOps && <Notice kind="error">This area is for FMD support staff.</Notice>}
        {isOps && <Queue />}
      </div>
    </Page>
  );
}

function Queue() {
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState<Q | null>(null);
  const [sel, setSel] = useState<Ticket | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    api<Q>(`/api/admin/support?status=${filter}`).then(setQ).catch(() => setQ({ items: [], metrics: { open: 0, medianFirstResponseHours: null, reopenRate: null } }));
  }, [filter, v]);
  return (
    <div className="space-y-5">
      {q && (
        <dl className="grid grid-cols-3 gap-3">
          {[
            ["Open", q.metrics.open],
            ["Median first response", q.metrics.medianFirstResponseHours === null ? "—" : `${q.metrics.medianFirstResponseHours} h`],
            ["Reopen rate", q.metrics.reopenRate === null ? "—" : `${q.metrics.reopenRate}%`],
          ].map(([l, val]) => (
            <div key={l as string} className="glass rounded-2xl p-4">
              <dt className="text-[12px] text-ink-4">{l}</dt>
              <dd className="mt-1 text-[22px] font-light text-ink">{val}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex gap-2">
        {["open", "waiting_on_user", "resolved", ""].map((s) => (
          <button key={s || "all"} aria-pressed={filter === s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-1.5 text-[13px] ${filter === s ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3"}`}>
            {s ? (STATUS_LABEL[s] ?? s) : "All"}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ul className="space-y-2">
          {q?.items.length === 0 && <li className="rounded-2xl border border-line p-6 text-center text-[13px] text-ink-4">Nothing here.</li>}
          {q?.items.map((t) => (
            <li key={t.id}>
              <button onClick={async () => setSel(await api<Ticket>(`/api/support/tickets/${t.id}`))} className="w-full rounded-2xl border border-line p-4 text-left hover:border-line-strong">
                <p className="text-[12px] text-ink-4">
                  {t.reference} · {t.areaLabel} · {t.severity} · {STATUS_LABEL[t.status]}
                </p>
                <p className="mt-1 text-[14px] text-ink">{t.subject}</p>
                <p className="text-[12px] text-ink-4">
                  {t.requester} · {t.assignee ? `assigned to ${t.assignee}` : "unassigned"}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <div>{sel ? <div className="glass rounded-[22px] p-5"><TicketThread t={sel} staff onChange={(t) => (setSel(t), setV((x) => x + 1))} /></div> : <p className="rounded-2xl border border-dashed border-line p-6 text-[13px] text-ink-4">Select a request.</p>}</div>
      </div>
    </div>
  );
}
