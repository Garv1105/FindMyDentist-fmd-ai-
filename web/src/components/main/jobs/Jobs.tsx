"use client";

import { ArrowLeft, BadgeCheck, Bookmark, BookmarkCheck, Briefcase, Flag, MapPin, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { CITIES } from "@/lib/catalog";
import { fmtPhone } from "@/lib/fmd";
import { feeRange, when } from "@/lib/format";
import { useMe, useRequireMe } from "@/lib/me";
import {
  canPostJobs,
  checkJob,
  closeJob,
  EXPERIENCE,
  getJob,
  JOB_REPORTS,
  jobState,
  LISTING_DAYS,
  myJobs,
  postJob,
  renewJob,
  reportJob,
  ROLES,
  searchJobs,
  TYPES,
  type Job,
  type JobInput,
} from "@/sample/jobs";
import { getAccountType } from "@/sample/onboarding";
import { getSaved, toggleSaved } from "@/sample/saved";

const salaryText = (j: Pick<Job, "salary" | "type">) => (j.salary ? `${feeRange(j.salary)} ${j.type === "locum" ? "a day" : "a month"}` : "Salary not given");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Whether FMD checked the employer, said plainly either way (PDR §4.9). */
function Employer({ j }: { j: Pick<Job, "employer"> }) {
  return j.employer.verified ? (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-2">
      <BadgeCheck className="size-4" strokeWidth={1.75} /> Employer checked by FMD
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-3">
      <ShieldQuestion className="size-4" strokeWidth={1.75} /> FMD hasn&apos;t verified this employer
    </span>
  );
}

function JobCard({ j }: { j: Job }) {
  return (
    <Link href={`/jobs/${j.id}`} className="app-panel grid gap-2 p-5 transition-colors hover:border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[16px] font-medium text-ink">{j.title}</p>
        <div className="flex flex-wrap gap-1.5">
          <Tag tone="muted">{TYPES[j.type]}</Tag>
          {j.mine && <Tag tone="accent">Yours</Tag>}
        </div>
      </div>
      <p className="text-[14px] text-ink-2">{j.employer.name}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" strokeWidth={1.75} /> {j.area}, {j.city}
        </span>
        <span>{ROLES[j.role]}</span>
        <span>{salaryText(j)}</span>
        <span>Posted {day(j.posted_at)}</span>
      </p>
      <Employer j={j} />
    </Link>
  );
}

/* ---------------- /jobs ---------------- */

const FILTERS: { key: string; label: string; options: [string, string][] }[] = [
  { key: "role", label: "Role", options: [["", "Any role"], ...Object.entries(ROLES)] },
  { key: "city", label: "City", options: [["", "Any city"], ...CITIES.map((c): [string, string] => [c, c])] },
  { key: "type", label: "Type", options: [["", "Any type"], ...Object.entries(TYPES)] },
  { key: "experience", label: "Experience you have", options: [["", "Any"], ...Object.entries(EXPERIENCE)] },
  { key: "salary_min", label: "Pay at least", options: [["", "Any"], ["25000", "₹25,000 a month"], ["50000", "₹50,000 a month"], ["75000", "₹75,000 a month"]] },
];

export function JobsPage() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const key = params.toString();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [res, setRes] = useState<Job[] | null>(null);
  const [canPost, setCanPost] = useState(false);
  const userId = me === undefined ? undefined : (me?.id ?? null);
  useEffect(() => {
    if (userId === undefined) return;
    const p = new URLSearchParams(key);
    searchJobs(userId, {
      q: p.get("q") ?? undefined,
      role: p.get("role") ?? undefined,
      city: p.get("city") ?? undefined,
      type: p.get("type") ?? undefined,
      experience: p.get("experience") ?? undefined,
      salary_min: Number(p.get("salary_min")) || undefined,
    }).then((r) => setRes(r.items));
  }, [userId, key]);
  useEffect(() => {
    if (me) getAccountType(me.id).then((t) => setCanPost(canPostJobs(me, t)));
  }, [me]);
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(p.size ? `/jobs?${p}` : "/jobs", { scroll: false });
  };
  const submit = (e: FormEvent) => (e.preventDefault(), set("q", q.trim()));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
            Dental jobs <Tag tone="muted">Demo</Tag>
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-3">Jobs at clinics and dental companies. Check each employer yourself before you share personal details.</p>
        </div>
        {canPost && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/jobs/mine" variant="secondary" size="sm">
              Your postings
            </ButtonLink>
            <ButtonLink href="/jobs/new" size="sm">
              Post a job
            </ButtonLink>
          </div>
        )}
      </div>
      <Panel className="grid gap-4 p-5">
        <form onSubmit={submit} role="search" className="flex gap-2">
          <input className={`${fieldCls} min-w-0 flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title, clinic or area" aria-label="Search jobs" maxLength={60} />
          <Button type="submit">Search</Button>
        </form>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FILTERS.map((f) => (
            <Field key={f.key} label={f.label}>
              <select className={fieldCls} value={params.get(f.key) ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </Panel>
      <p aria-live="polite" className="text-[13.5px] text-ink-3">
        {res ? `${res.length} ${res.length === 1 ? "job" : "jobs"}` : "Searching…"}
        {key && (
          <button type="button" onClick={() => (setQ(""), router.replace("/jobs", { scroll: false }))} className="ml-3 text-ink-3 underline-offset-4 hover:text-ink hover:underline">
            Clear filters
          </button>
        )}
      </p>
      {!res ? (
        <div className="app-panel h-40 animate-pulse" aria-busy />
      ) : res.length === 0 ? (
        <Panel className="p-6 text-[15px] text-ink-2">No jobs match. Try fewer filters.</Panel>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {res.map((j) => (
            <li key={j.id}>
              <JobCard j={j} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- /jobs/[id] ---------------- */

export function JobPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const [j, setJ] = useState<Job | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [now] = useState(() => Date.now());
  const userId = me === undefined ? undefined : (me?.id ?? null);
  useEffect(() => {
    if (userId === undefined) return;
    getJob(userId, id).then(setJ);
    if (userId) getSaved(userId, "job").then((l) => setSaved(l.includes(id)));
  }, [userId, id]);
  if (j === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (j === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that job</h1>
        <ButtonLink href="/jobs" variant="secondary">
          Dental jobs
        </ButtonLink>
      </Panel>
    );
  const state = jobState(j, now);
  const save = async () => {
    if (!me) return router.push(`/login?next=${encodeURIComponent(`/jobs/${id}`)}`);
    setSaved(await toggleSaved(me.id, "job", id));
  };
  const apply =
    j.apply.method === "email" ? (
      <ButtonLink href={`mailto:${j.apply.value}?subject=${encodeURIComponent(`Application: ${j.title}`)}`}>Apply by email</ButtonLink>
    ) : j.apply.method === "url" ? (
      <a href={j.apply.value} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full bg-[var(--button-primary)] px-5 text-[14px] font-semibold text-[var(--button-primary-fg)] hover:opacity-90">
        Apply on their site
      </a>
    ) : (
      <ButtonLink href={`tel:${j.apply.value}`}>Call {fmtPhone(j.apply.value)}</ButtonLink>
    );
  const rows: [string, ReactNode][] = [
    ["Employer", j.employer.name],
    ["Where", `${j.area}, ${j.city}`],
    ["Role", ROLES[j.role]],
    ["Type", TYPES[j.type]],
    ["Experience", j.min_years ? `${j.min_years}+ years` : "Freshers welcome"],
    ["Pay", salaryText(j)],
    ["Posted", `${day(j.posted_at)} · open until ${day(j.expires_at)}`],
  ];

  return (
    <div className="mx-auto grid w-full max-w-[820px] gap-5">
      <Link href="/jobs" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Dental jobs
      </Link>
      <div className="grid gap-1.5">
        <h1 className="text-[22px] font-medium text-ink">{j.title}</h1>
        <Employer j={j} />
      </div>
      {state !== "active" && <Notice kind="info">{state === "expired" ? "This listing has expired." : "The employer has closed this listing."} Applications aren&apos;t open.</Notice>}
      <Panel className="p-5 sm:p-6">
        <dl className="grid gap-2.5 text-[14.5px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-0.5 sm:grid-cols-[130px_1fr]">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel className="grid gap-3 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">About the job</h2>
        <p className="whitespace-pre-line text-[14.5px] text-ink-2">{j.description}</p>
        {j.requirements.length > 0 && (
          <>
            <h3 className="text-[14.5px] font-medium text-ink">What they ask for</h3>
            <ul className="grid list-disc gap-1 pl-5 text-[14.5px] text-ink-2">
              {j.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </Panel>
      <div className="flex flex-wrap items-center gap-2">
        {state === "active" && apply}
        <Button variant="secondary" onClick={save} aria-pressed={saved}>
          {saved ? <BookmarkCheck className="size-4" strokeWidth={1.75} /> : <Bookmark className="size-4" strokeWidth={1.75} />}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      <p className="text-[12.5px] text-ink-3">You apply with the employer directly. A real employer never asks you to pay to apply.</p>
      {reported ? (
        <p className="text-[13.5px] text-ink-2">Thanks, FMD&apos;s team will look at this listing.</p>
      ) : (
        <button type="button" onClick={() => setReporting(true)} className="inline-flex w-fit items-center gap-1.5 text-[13.5px] text-ink-3 hover:text-ink">
          <Flag className="size-4" strokeWidth={1.75} /> Report this job
        </button>
      )}
      {reporting && <ReportJob userId={me?.id ?? null} id={j.id} onClose={() => setReporting(false)} onDone={() => (setReporting(false), setReported(true))} />}
    </div>
  );
}

function ReportJob({ userId, id, onClose, onDone }: { userId: string | null; id: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<keyof typeof JOB_REPORTS | "">("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet title="Report this job" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[14px] text-ink-2">What&apos;s wrong with it?</legend>
          {(Object.entries(JOB_REPORTS) as [keyof typeof JOB_REPORTS, string][]).map(([k, v]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-[14.5px] text-ink hover:bg-[var(--surface-glass)]">
              <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} className="size-4 accent-[var(--accent)]" />
              {v}
            </label>
          ))}
        </fieldset>
        <Field label={reason === "other" ? "Tell us what's wrong" : "Anything to add? (optional)"}>
          <textarea className={`${fieldCls} h-20 resize-y py-2.5`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => reportJob(userId, id, reason, note).then(onDone, (e: Error) => setErr(e.message))}>Send report</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- /jobs/new (and editing) ---------------- */

const EMPTY: JobInput = { title: "", role: "associate", type: "full_time", employer: "", city: "Bengaluru", area: "", description: "", requirements: "", min_years: 0, salary: null, apply: { method: "email", value: "" } };

export function NewJobPage() {
  const me = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const editId = params.get("edit");
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);
  const [f, setF] = useState<JobInput>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const userId = me?.id;
  useEffect(() => {
    if (!me) return;
    getAccountType(me.id).then((t) => setAllowed(canPostJobs(me, t)));
    if (editId)
      myJobs(me.id).then((l) => {
        const j = l.find((x) => x.id === editId);
        if (j) setF({ ...j, employer: j.employer.name, requirements: j.requirements.join("\n") });
      });
  }, [me, userId, editId]);
  if (!me || allowed === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (!allowed)
    return (
      <Panel className="mx-auto grid w-full max-w-[720px] justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">Posting jobs is for clinics and dental professionals</h1>
        <p className="text-[14.5px] text-ink-2">Verified dentists, clinic owners and dental company accounts can post jobs.</p>
        <ButtonLink href="/jobs" variant="secondary">
          Dental jobs
        </ButtonLink>
      </Panel>
    );
  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => (setErr(null), setF((x) => ({ ...x, [k]: v })));
  const clinic = me.workspaces[0]?.clinic_name ?? "";
  const publish = async () => {
    try {
      // left empty, the employer is the clinic this person owns
      const j = await postJob(me.id, { ...f, employer: f.employer.trim() || clinic }, editId, Date.now());
      router.push(`/jobs/${j.id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const draft: Job = {
    ...f,
    id: "preview",
    employer: { name: f.employer || clinic || "Your clinic", verified: false, clinic_id: null },
    title: f.title || "Job title",
    requirements: [],
    apply: f.apply,
    posted_at: new Date(0).toISOString(),
    expires_at: new Date(0).toISOString(),
    status: "active",
    mine: true,
    demo: true,
  };

  return (
    <div className="mx-auto grid w-full max-w-[820px] gap-5">
      <Link href="/jobs/mine" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Your postings
      </Link>
      <h1 className="text-[24px] font-medium text-ink">{editId ? "Edit job" : "Post a job"}</h1>
      <Panel className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title">
            <input className={fieldCls} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={100} />
          </Field>
          <Field label="Clinic or company">
            <input className={fieldCls} value={f.employer} onChange={(e) => set("employer", e.target.value)} maxLength={100} placeholder={clinic} />
          </Field>
          <Field label="Role">
            <select className={fieldCls} value={f.role} onChange={(e) => set("role", e.target.value as JobInput["role"])}>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select className={fieldCls} value={f.type} onChange={(e) => set("type", e.target.value as JobInput["type"])}>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <select className={fieldCls} value={f.city} onChange={(e) => set("city", e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Area">
            <input className={fieldCls} value={f.area} onChange={(e) => set("area", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Experience needed (years)">
            <input type="number" min={0} max={30} className={fieldCls} value={f.min_years} onChange={(e) => set("min_years", Number(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Pay from (₹ a ${f.type === "locum" ? "day" : "month"})`}>
              <input type="number" min={0} className={fieldCls} value={f.salary?.min ?? ""} onChange={(e) => set("salary", e.target.value ? { min: Number(e.target.value), max: f.salary?.max ?? Number(e.target.value) } : null)} />
            </Field>
            <Field label="to (₹)">
              <input type="number" min={0} className={fieldCls} value={f.salary?.max ?? ""} disabled={!f.salary} onChange={(e) => set("salary", { min: f.salary!.min, max: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
        <Field label="About the job" hint="What the work is, the hours, and who they'll work with.">
          <textarea className={`${fieldCls} h-28 resize-y py-2.5`} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
        </Field>
        <Field label="Requirements (one per line)">
          <textarea className={`${fieldCls} h-24 resize-y py-2.5`} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} maxLength={1000} />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13.5px] text-ink-3">How to apply</legend>
          <div className="flex flex-wrap gap-2">
            {(["email", "url", "phone"] as const).map((m) => (
              <label key={m} className={`cursor-pointer rounded-full border px-4 py-2 text-[14px] ${f.apply.method === m ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2"}`}>
                <input type="radio" name="apply" className="sr-only" checked={f.apply.method === m} onChange={() => set("apply", { method: m, value: "" })} />
                {m === "email" ? "Email" : m === "url" ? "Link" : "Phone"}
              </label>
            ))}
          </div>
          <input
            className={`${fieldCls} sm:max-w-[420px]`}
            value={f.apply.value}
            onChange={(e) => set("apply", { ...f.apply, value: e.target.value })}
            aria-label="Application email, link or phone"
            placeholder={f.apply.method === "email" ? "jobs@yourclinic.in" : f.apply.method === "url" ? "https://" : "98765 43210"}
          />
        </fieldset>
        <p className="text-[13px] text-ink-3">
          The listing runs {LISTING_DAYS} days, then you can renew it. It shows &quot;FMD hasn&apos;t verified this employer&quot; until FMD checks your clinic or company.
        </p>
      </Panel>
      {preview && (
        <div className="grid gap-2">
          <p className="text-[13px] text-ink-3">Preview</p>
          <JobCard j={draft} />
        </div>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={publish}>{editId ? "Save changes" : "Publish"}</Button>
        <Button variant="secondary" onClick={() => (setErr(checkJob({ ...f, employer: f.employer || clinic })), setPreview((v) => !v))}>
          {preview ? "Hide preview" : "Preview"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- /jobs/mine ---------------- */

export function MyJobsPage() {
  const me = useRequireMe();
  const [list, setList] = useState<Job[] | null>(null);
  const [now, setNow] = useState(0);
  const userId = me?.id;
  const load = useCallback(() => {
    if (userId) myJobs(userId).then((l) => (setList(l), setNow(Date.now())));
  }, [userId]);
  useEffect(load, [load]);
  if (!me || !list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const tone = { active: "ok", expired: "warn", closed: "muted" } as const;
  return (
    <div className="mx-auto grid w-full max-w-[820px] gap-5">
      <Link href="/jobs" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Dental jobs
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[24px] font-medium text-ink">Your postings</h1>
        <ButtonLink href="/jobs/new" size="sm">
          Post a job
        </ButtonLink>
      </div>
      {list.length === 0 ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <Briefcase className="size-6 text-ink-3" strokeWidth={1.5} />
          <p className="text-[15px] text-ink-2">You haven&apos;t posted a job yet.</p>
        </Panel>
      ) : (
        <ul className="grid gap-3">
          {list.map((j) => {
            const s = jobState(j, now);
            return (
              <li key={j.id}>
                <Panel className="grid gap-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/jobs/${j.id}`} className="text-[15.5px] font-medium text-ink hover:underline">
                      {j.title}
                    </Link>
                    <Tag tone={tone[s]}>{s === "active" ? `Open until ${day(j.expires_at)}` : s === "expired" ? "Expired" : "Closed"}</Tag>
                  </div>
                  <p className="text-[13px] text-ink-3">
                    {j.employer.name} · {j.area}, {j.city} · posted {when(Date.parse(j.posted_at))}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <ButtonLink href={`/jobs/new?edit=${j.id}`} variant="secondary" size="sm">
                      Edit
                    </ButtonLink>
                    <Button variant="secondary" size="sm" onClick={() => renewJob(me.id, j.id).then(load)}>
                      {s === "active" ? `Renew for ${LISTING_DAYS} days` : "Reopen"}
                    </Button>
                    {s === "active" && (
                      <Button variant="secondary" size="sm" onClick={() => closeJob(me.id, j.id).then(load)}>
                        Close
                      </Button>
                    )}
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { JobCard };
