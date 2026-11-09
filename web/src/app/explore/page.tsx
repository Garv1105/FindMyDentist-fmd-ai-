"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FeedCard, type FeedItem } from "@/components/content/FeedCard";
import { inputCls, Notice, Page } from "@/components/Page";
import { TOPICS } from "@/lib/catalog";
import { api, useMe } from "@/lib/me";

const TABS = [
  ["foryou", "For you"],
  ["following", "Following"],
  ["saved", "Saved"],
] as const;

export default function ExplorePage() {
  const me = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("foryou");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: FeedItem[]; interests: string[] } | null>(null);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);

  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const qs = new URLSearchParams({ tab });
    if (topic) qs.set("topic", topic);
    if (q.trim()) qs.set("q", q.trim());
    const t = setTimeout(() => api<{ items: FeedItem[]; interests: string[] }>(`/api/feed?${qs}`).then(setData).catch((e) => setErr(e.message)), 200);
    return () => clearTimeout(t);
  }, [tab, topic, q, version]);

  return (
    <Page>
      <p className="eyebrow">Explore</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Dental knowledge, from verified dentists</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-3">Every post is reviewed before it&apos;s published. Sponsored posts are always labelled. Educational only, not a substitute for an examination.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {(me ? TABS : TABS.slice(0, 1)).map(([v, l]) => (
              <button
                key={v}
                aria-pressed={tab === v}
                onClick={() => setTab(v)}
                className={`rounded-full border px-4 py-1.5 text-[13px] ${tab === v ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3 hover:text-ink"}`}
              >
                {l}
              </button>
            ))}
            <input aria-label="Search posts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className={`${inputCls} ml-auto h-9 !w-48 text-[13px]`} />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {["", ...TOPICS].map((t) => (
              <button
                key={t || "all"}
                aria-pressed={topic === t}
                onClick={() => setTopic(t)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] ${topic === t ? "border-line-strong text-ink" : "border-line text-ink-4 hover:text-ink"}`}
              >
                {t || "All topics"}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-4">
            {err && <Notice kind="error">{err}</Notice>}
            {!data && !err && <p className="text-ink-4">Loading…</p>}
            {data?.items.length === 0 && (
              <p className="glass rounded-[24px] p-8 text-center text-[13.5px] text-ink-4">
                {tab === "following" ? "Follow dentists to see their posts here." : tab === "saved" ? "Saved posts appear here." : "No posts match."}
              </p>
            )}
            {data?.items.map((i) => (
              <FeedCard key={`${i.id}-${version}`} item={i} me={me} onChange={load} />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          {me && <Interests initial={data?.interests ?? []} onSaved={load} />}
          {me?.accountType === "dentist" && <Composer />}
        </aside>
      </div>
    </Page>
  );
}

function Interests({ initial, onSaved }: { initial: string[]; onSaved: () => void }) {
  const [sel, setSel] = useState<string[] | null>(null);
  const current = sel ?? initial;
  const save = async (topics: string[]) => {
    setSel(topics);
    await api("/api/me/interests", { method: "PUT", body: { topics } });
    onSaved();
  };
  return (
    <section id="interests" className="glass scroll-mt-28 rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Your interests</h2>
      <p className="mt-1 text-[12px] text-ink-4">Used only to order your feed. We don&apos;t infer health conditions or use your records for this.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOPICS.map((t) => {
          const on = current.includes(t);
          return (
            <button key={t} aria-pressed={on} onClick={() => save(on ? current.filter((x) => x !== t) : [...current, t])} className={`rounded-full border px-3 py-1 text-[12.5px] ${on ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3"}`}>
              {t}
            </button>
          );
        })}
      </div>
      {current.length > 0 && (
        <button onClick={() => save([])} className="mt-3 text-[12px] text-ink-3 underline underline-offset-4">
          Reset personalisation
        </button>
      )}
    </section>
  );
}

function Composer() {
  const [f, setF] = useState({ kind: "education", topic: "Prevention", title: "", body: "", options: "", caseConsentRef: "", caseDeidentified: false, caseClinicallyReviewed: false });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [mine, setMine] = useState<{ id: string; title: string; status: string; moderation_note: string }[] | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    api<{ items: NonNullable<typeof mine> }>("/api/posts").then((r) => setMine(r.items)).catch(() => setMine([]));
  }, [v]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/posts", { method: "POST", body: { ...f, options: f.options.split("\n").map((s) => s.trim()).filter(Boolean) } });
      setMsg({ kind: "success", text: "Submitted for review. You'll see the outcome below." });
      setF((s) => ({ ...s, title: "", body: "", options: "" }));
      setV((x) => x + 1);
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  };
  return (
    <section className="glass rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Share knowledge</h2>
      <p className="mt-1 text-[12px] text-ink-4">For verified dentists. Posts are reviewed before publishing. Don&apos;t include identifiable patient details.</p>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={`${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`}>
            <option value="education">Education</option>
            <option value="post">Post</option>
            <option value="poll">Poll</option>
            <option value="case">Case (consented)</option>
          </select>
          <select aria-label="Topic" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} className={`${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <input aria-label="Title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={`${inputCls} h-10 text-[13px]`} />
        <textarea aria-label="Text" placeholder="What do you want patients to know?" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={`${inputCls} h-auto py-2.5 text-[13px]`} />
        {f.kind === "poll" && <textarea aria-label="Poll options" placeholder="One option per line (2–5)" rows={3} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} className={`${inputCls} h-auto py-2.5 text-[13px]`} />}
        {f.kind === "case" && (
          <div className="space-y-2 rounded-xl border border-line-strong p-3 text-[12.5px] text-ink-2">
            <input aria-label="Patient consent reference" placeholder="Patient consent reference" value={f.caseConsentRef} onChange={(e) => setF({ ...f, caseConsentRef: e.target.value })} className={`${inputCls} h-9 text-[13px]`} />
            <label className="flex gap-2">
              <input type="checkbox" checked={f.caseDeidentified} onChange={(e) => setF({ ...f, caseDeidentified: e.target.checked })} /> The case is de-identified (no names, faces or identifiers).
            </label>
            <label className="flex gap-2">
              <input type="checkbox" checked={f.caseClinicallyReviewed} onChange={(e) => setF({ ...f, caseClinicallyReviewed: e.target.checked })} /> The clinical content has been reviewed for accuracy.
            </label>
          </div>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button className="btn-primary h-10 w-full text-[13px]">Submit for review</button>
      </form>
      {mine && mine.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
          {mine.map((p) => (
            <li key={p.id} className="text-ink-3">
              <span className="text-ink-2">{p.title}</span> · {p.status.replace("_", " ")}
              {p.moderation_note && <span className="block text-ink-4">Reason: {p.moderation_note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
