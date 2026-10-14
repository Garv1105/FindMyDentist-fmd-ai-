"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { STATUS_LABEL, TicketThread, type Ticket } from "@/components/support/TicketThread";
import { ARTICLES } from "@/lib/help";
import { api, useMe } from "@/lib/me";

const AREAS: [string, string][] = [
  ["account", "Account & sign-in"],
  ["booking", "Appointments & booking"],
  ["records", "Dental records"],
  ["assistant", "FMD AI"],
  ["concierge", "FMD Edge"],
  ["membership", "Membership & payments"],
  ["content", "Explore & content"],
  ["other", "Something else"],
];

export default function HelpPage() {
  const me = useMe();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? ARTICLES.filter((a) => `${a.q} ${a.a} ${a.area}`.toLowerCase().includes(s)) : ARTICLES;
  }, [q]);
  const groups = [...new Set(results.map((a) => a.area))];

  return (
    <Page>
      <p className="eyebrow">Help</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">How can we help?</h1>
      <div className="mt-6 flex max-w-xl items-center gap-2 rounded-full border border-line bg-[var(--surface-glass)] px-4 focus-within:border-line-strong">
        <Search className="size-4 text-ink-3" strokeWidth={1.5} />
        <input aria-label="Search help" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help articles" className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-4" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {results.length === 0 && <p className="text-[13.5px] text-ink-4">No articles match. Send us a request instead.</p>}
          {groups.map((g) => (
            <section key={g}>
              <h2 className="text-[13px] uppercase tracking-[0.18em] text-ink-4">{g}</h2>
              <div className="mt-2 space-y-2">
                {results
                  .filter((a) => a.area === g)
                  .map((a) => (
                    <details key={a.id} className="glass rounded-[18px] px-5 py-3.5">
                      <summary className="cursor-pointer text-[14.5px] text-ink">{a.q}</summary>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{a.a}</p>
                    </details>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <aside>
          {me === null && (
            <Notice kind="info">
              <Link href="/signin?next=/help" className="underline">Sign in</Link> to send a support request and track replies.
            </Notice>
          )}
          {me && <Requests />}
        </aside>
      </div>
    </Page>
  );
}

function Requests() {
  const [items, setItems] = useState<{ id: string; reference: string; subject: string; status: string }[] | null>(null);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    api<{ items: NonNullable<typeof items> }>("/api/support/tickets").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [v]);
  const show = async (id: string) => setOpen(await api<Ticket>(`/api/support/tickets/${id}`));
  return (
    <div className="space-y-5">
      {open ? (
        <section className="glass rounded-[22px] p-5">
          <button onClick={() => setOpen(null)} className="mb-3 text-[12.5px] text-ink-3 hover:text-ink">
            ← All requests
          </button>
          <TicketThread t={open} onChange={(t) => (setOpen(t), setV((x) => x + 1))} />
        </section>
      ) : (
        <>
          <NewRequest onCreated={(t) => (setOpen(t), setV((x) => x + 1))} />
          {items && items.length > 0 && (
            <section className="glass rounded-[22px] p-5">
              <h2 className="text-[15px] text-ink">Your requests</h2>
              <ul className="mt-3 space-y-2">
                {items.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => show(t.id)} className="flex w-full items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-left text-[13px] hover:border-line-strong">
                      <span className="flex-1 truncate text-ink-2">{t.subject}</span>
                      <span className="text-[12px] text-ink-4">{STATUS_LABEL[t.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function NewRequest({ onCreated }: { onCreated: (t: Ticket) => void }) {
  const [f, setF] = useState({ area: "booking", severity: "normal", subject: "", body: "", impact: "" });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      onCreated(await api<Ticket>("/api/support/tickets", { method: "POST", body: f }));
    } catch (er) {
      setErr((er as Error).message);
    }
  };
  const cls = `${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`;
  return (
    <form onSubmit={submit} className="glass space-y-2 rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Send a request</h2>
      <p className="text-[12px] text-ink-4">The FMD team replies here. Response times aren&apos;t guaranteed yet, and support isn&apos;t available 24/7.</p>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Topic" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className={cls}>
          {AREAS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="How serious?" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={cls}>
          <option value="low">Minor</option>
          <option value="normal">Normal</option>
          <option value="high">Blocking me</option>
          <option value="critical">Urgent: privacy or safety</option>
        </select>
      </div>
      <input aria-label="Subject" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={cls} />
      <textarea aria-label="Describe the problem" placeholder="What happened, and what did you expect?" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={`${inputCls} h-auto py-2.5 text-[13px]`} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-primary h-10 w-full text-[13px]">Send request</button>
    </form>
  );
}
