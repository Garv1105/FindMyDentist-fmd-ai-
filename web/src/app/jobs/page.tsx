"use client";

import { Briefcase, Flag, MapPin } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { CITIES, REPORT_CATEGORIES } from "@/lib/catalog";
import { api, useMe } from "@/lib/me";

type Job = {
  id: string;
  orgName: string;
  title: string;
  roleType: string;
  roleLabel: string;
  city: string;
  area: string;
  description: string;
  requirements: string;
  compensation: string;
  apply: { method: "email" | "url" | "phone"; value: string };
  status: string;
  employerVerified: boolean;
  postedAt: number;
  expiresAt: number;
  mine: boolean;
};
const ROLES: [string, string][] = [
  ["associate", "Associate dentist"],
  ["consultant", "Consultant / specialist"],
  ["assistant", "Dental assistant"],
  ["hygienist", "Dental hygienist"],
  ["front_desk", "Front desk / coordinator"],
  ["internship", "Internship"],
  ["other", "Other"],
];
const day = (t: number) => new Date(t).toLocaleDateString("en-IN", { dateStyle: "medium" });

export default function JobsPage() {
  const me = useMe();
  const [f, setF] = useState({ q: "", city: "", role: "" });
  const [items, setItems] = useState<Job[] | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, x]) => x));
    const t = setTimeout(() => api<{ items: Job[] }>(`/api/jobs?${qs}`).then((r) => setItems(r.items)).catch(() => setItems([])), 200);
    return () => clearTimeout(t);
  }, [f, v]);
  const canPost = me && (me.accountType === "company" || me.accountType === "dentist");

  return (
    <Page>
      <p className="eyebrow">Jobs & opportunities</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Dental jobs</h1>
      <p className="mt-2 max-w-2xl text-[13.5px] text-ink-4">Listings are posted by verified dentists and dental companies. FMD doesn&apos;t verify every employer or claim; listings marked &quot;Employer verified&quot; have been checked.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Search jobs" placeholder="Search jobs" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className={`${inputCls} h-10 !w-56 text-[13px]`} />
            <select aria-label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={`${inputCls} h-10 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}>
              <option value="">Any city</option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select aria-label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={`${inputCls} h-10 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}>
              <option value="">Any role</option>
              {ROLES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <ul className="mt-5 space-y-3">
            {!items && <li className="text-ink-4">Loading…</li>}
            {items?.length === 0 && <li className="glass rounded-[22px] p-8 text-center text-[13.5px] text-ink-4">No open listings match.</li>}
            {items?.map((j) => (
              <JobCard key={j.id} j={j} signedIn={!!me} />
            ))}
          </ul>
        </div>
        <aside className="space-y-5">
          {canPost ? <PostJob onPosted={() => setV((x) => x + 1)} /> : <p className="glass rounded-[22px] p-5 text-[13px] text-ink-4">Verified dentists and dental company accounts can post listings.</p>}
          {canPost && <MyListings version={v} onChanged={() => setV((x) => x + 1)} />}
        </aside>
      </div>
    </Page>
  );
}

function JobCard({ j, signedIn }: { j: Job; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [rep, setRep] = useState(false);
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const href = j.apply.method === "email" ? `mailto:${j.apply.value}` : j.apply.method === "phone" ? `tel:${j.apply.value}` : j.apply.value;
  const report = async () => {
    try {
      await api("/api/reports", { method: "POST", body: { targetType: "job", targetId: j.id, category: cat } });
      setMsg({ kind: "success", text: "Thanks. Moderators will review this listing." });
      setRep(false);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  return (
    <li className="glass rounded-[22px] p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="icon-tile size-10 shrink-0">
          <Briefcase className="size-4" strokeWidth={1.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] text-ink">{j.title}</h2>
          <p className="text-[12.5px] text-ink-3">
            {j.orgName} · {j.roleLabel}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-4">
            <MapPin className="size-3" strokeWidth={1.5} /> {j.area ? `${j.area}, ` : ""}
            {j.city} · posted {day(j.postedAt)} · {j.employerVerified ? "Employer verified" : "Employer not verified by FMD"}
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-ghost h-9 px-4 text-[12.5px]">
          {open ? "Less" : "Details"}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-ink-2">
          <p className="whitespace-pre-line">{j.description}</p>
          {j.requirements && <p className="whitespace-pre-line text-ink-3">Requirements: {j.requirements}</p>}
          <p className="text-ink-3">Compensation: {j.compensation}</p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={href} target={j.apply.method === "url" ? "_blank" : undefined} rel="noopener noreferrer" className="btn-primary h-10 px-5 text-[13px]">
              Apply via {j.apply.method === "url" ? "website" : j.apply.method}
            </a>
            {signedIn && (
              <button onClick={() => setRep((r) => !r)} className="flex h-10 items-center gap-1.5 px-3 text-[12.5px] text-ink-3 hover:text-ink">
                <Flag className="size-3.5" strokeWidth={1.5} /> Report listing
              </button>
            )}
          </div>
          {rep && (
            <div className="flex gap-2">
              <select aria-label="Reason" value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`}>
                <option value="">Why are you reporting this?</option>
                {Object.entries(REPORT_CATEGORIES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <button disabled={!cat} onClick={report} className="btn-primary h-10 shrink-0 px-4 text-[12.5px] disabled:opacity-50">
                Send
              </button>
            </div>
          )}
        </div>
      )}
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </li>
  );
}

function PostJob({ onPosted }: { onPosted: () => void }) {
  const [f, setF] = useState({ orgName: "", title: "", roleType: "associate", city: "Bengaluru", area: "", description: "", requirements: "", compensation: "", applyMethod: "email", applyValue: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/jobs", { method: "POST", body: f });
      setMsg({ kind: "success", text: "Listing published for 30 days." });
      onPosted();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  };
  const cls = `${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`;
  return (
    <form onSubmit={submit} className="glass space-y-2 rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Post a job</h2>
      <input aria-label="Clinic or company" placeholder="Clinic or company name" value={f.orgName} onChange={set("orgName")} className={cls} />
      <input aria-label="Job title" placeholder="Job title" value={f.title} onChange={set("title")} className={cls} />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Role type" value={f.roleType} onChange={set("roleType")} className={cls}>
          {ROLES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="City" value={f.city} onChange={set("city")} className={cls}>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <input aria-label="Area" placeholder="Area (optional)" value={f.area} onChange={set("area")} className={cls} />
      <textarea aria-label="Description" placeholder="Role description" rows={4} value={f.description} onChange={set("description")} className={`${inputCls} h-auto py-2.5 text-[13px]`} />
      <input aria-label="Requirements" placeholder="Requirements (optional)" value={f.requirements} onChange={set("requirements")} className={cls} />
      <input aria-label="Compensation" placeholder="Compensation (optional)" value={f.compensation} onChange={set("compensation")} className={cls} />
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <select aria-label="Apply by" value={f.applyMethod} onChange={set("applyMethod")} className={cls}>
          <option value="email">Email</option>
          <option value="url">Website</option>
          <option value="phone">Phone</option>
        </select>
        <input aria-label="Application contact" placeholder={f.applyMethod === "url" ? "https://…" : f.applyMethod === "email" ? "jobs@clinic.com" : "10-digit mobile"} value={f.applyValue} onChange={set("applyValue")} className={cls} />
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button className="btn-primary h-10 w-full text-[13px]">Publish listing</button>
    </form>
  );
}

function MyListings({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [items, setItems] = useState<Job[] | null>(null);
  useEffect(() => {
    api<{ items: Job[] }>("/api/jobs/mine").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [version]);
  if (!items?.length) return null;
  const act = async (id: string, action: "renew" | "close") => {
    await api(`/api/jobs/${id}`, { method: "POST", body: { action } });
    onChanged();
  };
  return (
    <section className="glass rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Your listings</h2>
      <ul className="mt-3 space-y-2 text-[12.5px]">
        {items.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center gap-2 text-ink-3">
            <span className="flex-1 text-ink-2">{j.title}</span>
            <span className="capitalize">{j.status}</span>
            {j.status !== "removed" && (
              <>
                <button onClick={() => act(j.id, "renew")} className="underline underline-offset-4">
                  Renew
                </button>
                {j.status === "active" && (
                  <button onClick={() => act(j.id, "close")} className="underline underline-offset-4">
                    Close
                  </button>
                )}
              </>
            )}
            <span className="w-full text-ink-4">{j.status === "active" ? `Visible until ${day(j.expiresAt)}` : j.status === "removed" ? "Removed by moderators" : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
