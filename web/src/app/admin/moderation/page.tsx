"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

type Queue = {
  posts: { id: string; kind: string; topic: string; title: string; body: string; author: string | null; caseConsentRef: string | null; createdAt: number }[];
  reports: { id: string; target_type: string; target_id: string; category: string; categoryLabel: string; note: string; title: string | null; created_at: number }[];
};

export default function ModerationPage() {
  const me = useMe();
  const isMod = !!me?.roles.some((r) => r === "moderator" || r === "fmd_ops" || r === "super_admin");
  return (
    <Page>
      <p className="eyebrow">FMD Operations</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink">Moderation</h1>
      <p className="mt-2 max-w-xl text-[13.5px] text-ink-4">Review posts before they&apos;re public and act on reports. Authors see the reason you give.</p>
      <div className="mt-8">
        {me === null && (
          <Notice kind="info">
            Staff sign-in required. <Link href="/signin?next=/admin/moderation" className="underline">Sign in</Link>
          </Notice>
        )}
        {me && !isMod && <Notice kind="error">This area is for FMD moderators.</Notice>}
        {isMod && <Panels />}
      </div>
    </Page>
  );
}

function Panels() {
  const [q, setQ] = useState<Queue | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Queue>("/api/admin/moderation").then(setQ).catch((e) => setErr(e.message));
  }, []);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!q) return <p className="text-ink-4">Loading…</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="text-[18px] font-light text-ink">Posts awaiting review ({q.posts.length})</h2>
        <ul className="mt-3 space-y-3">
          {q.posts.length === 0 && <li className="text-[13px] text-ink-4">Nothing waiting.</li>}
          {q.posts.map((p) => (
            <Decision key={p.id} url={`/api/admin/moderation/posts/${p.id}`} onDone={setQ} actions={[["publish", "Publish"], ["reject", "Reject"]]}>
              <p className="text-[12px] text-ink-4">
                {p.kind} · {p.topic} · by {p.author ?? "unknown"}
                {p.caseConsentRef && ` · consent ref ${p.caseConsentRef}`}
              </p>
              <p className="mt-1 text-[15px] text-ink">{p.title}</p>
              <p className="mt-1 whitespace-pre-line text-[13px] text-ink-2">{p.body}</p>
            </Decision>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-[18px] font-light text-ink">Open reports ({q.reports.length})</h2>
        <ul className="mt-3 space-y-3">
          {q.reports.length === 0 && <li className="text-[13px] text-ink-4">No open reports.</li>}
          {q.reports.map((r) => (
            <Decision key={r.id} url={`/api/admin/moderation/reports/${r.id}`} onDone={setQ} actions={[["remove", "Remove content"], ["dismiss", "Dismiss"]]} field="action">
              <p className="text-[12px] text-ink-4">
                {r.target_type} · {r.categoryLabel}
              </p>
              <p className="mt-1 text-[14px] text-ink">{r.title ?? "(item)"}</p>
              {r.note && <p className="mt-1 text-[13px] text-ink-3">“{r.note}”</p>}
            </Decision>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Decision({ url, onDone, actions, children, field = "decision" }: { url: string; onDone: (q: Queue) => void; actions: [string, string][]; children: React.ReactNode; field?: string }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const act = async (value: string) => {
    setErr("");
    try {
      onDone(await api<Queue>(url, { method: "POST", body: { [field]: value, note } }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <li className="glass rounded-[22px] p-5">
      {children}
      <input aria-label="Reason" placeholder="Reason (required unless publishing)" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-3 h-10 text-[13px]`} />
      <div className="mt-2 flex gap-2">
        {actions.map(([v, l], i) => (
          <button key={v} onClick={() => act(v)} className={`${i === 0 ? "btn-primary" : "btn-ghost"} h-9 px-4 text-[12.5px]`}>
            {l}
          </button>
        ))}
      </div>
      {err && (
        <div className="mt-2">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </li>
  );
}
