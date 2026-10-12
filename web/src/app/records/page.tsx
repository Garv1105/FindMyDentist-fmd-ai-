"use client";

import { Download, Eye, FileText, History, Share2, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

type Rec = {
  id: string;
  title: string;
  docType: string;
  docTypeLabel: string;
  recordDate: string;
  clinicName: string;
  providerName: string;
  episode: string;
  mime: string;
  sizeBytes: number;
  shares: { id: string; dentistId: string; dentistName: string; expiresAt: number }[];
};
type List = { items: Rec[]; facets: { clinics: string[]; episodes: string[] }; usage: { usedBytes: number; quotaBytes: number; maxFileBytes: number } };

const TYPES = [
  ["report", "Report"],
  ["xray", "X-ray"],
  ["photo", "Photo"],
  ["prescription", "Prescription"],
  ["treatment_plan", "Treatment plan"],
  ["other", "Other document"],
] as const;
const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function RecordsPage() {
  const me = useMe();
  return (
    <Page>
      <p className="eyebrow">Dental records</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Your dental records</h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-3">
        Private to you. Stored separately from your profile, opened through short-lived links, and shared only with a dentist you choose, for as long as you choose.
      </p>
      <div className="mt-8">
        {me === undefined && <p className="text-ink-4">Loading…</p>}
        {me === null && (
          <Notice kind="info">
            <Link href="/signin?next=/records" className="underline">Sign in</Link> to keep your dental records in one place.
          </Notice>
        )}
        {me && (
          <>
            <Library />
            {me.accountType === "dentist" && <SharedWithMe />}
          </>
        )}
      </div>
    </Page>
  );
}

function Library() {
  const [data, setData] = useState<List | null>(null);
  const [filter, setFilter] = useState({ type: "", clinic: "", episode: "" });
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    api<List>(`/api/records?${qs}`).then(setData).catch((e) => setErr(e.message));
  }, [filter]);
  useEffect(load, [load]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <UploadCard onDone={load} usage={data?.usage} />
        {data && (
          <div className="glass rounded-[22px] p-5">
            <p className="text-[12px] text-ink-4">Storage</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)]" role="progressbar" aria-valuenow={data.usage.usedBytes} aria-valuemax={data.usage.quotaBytes} aria-label="Storage used">
              <div className="h-full bg-[var(--button-primary)]" style={{ width: `${Math.min(100, (data.usage.usedBytes / data.usage.quotaBytes) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-3">
              {mb(data.usage.usedBytes)} of {mb(data.usage.quotaBytes)} used
            </p>
            {/* a file download from an API route, not page navigation */}
            <a href="/api/records/export" download className="btn-ghost mt-4 h-9 w-full text-[12.5px]">
              <Download className="size-3.5" strokeWidth={1.5} /> Export my records (JSON)
            </a>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["type", "Type", TYPES as readonly (readonly [string, string])[]],
            ["clinic", "Clinic", (data?.facets.clinics ?? []).map((c) => [c, c] as const)],
            ["episode", "Treatment", (data?.facets.episodes ?? []).map((c) => [c, c] as const)],
          ].map(([k, label, opts]) => (
            <label key={k as string} className="flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-3">
              {label as string}
              <select
                value={filter[k as keyof typeof filter]}
                onChange={(e) => setFilter((f) => ({ ...f, [k as string]: e.target.value }))}
                className="max-w-[160px] cursor-pointer appearance-none bg-transparent text-ink outline-none [&>option]:bg-[var(--surface)]"
              >
                <option value="">All</option>
                {(opts as readonly (readonly [string, string])[]).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {err && <Notice kind="error">{err}</Notice>}
        {!data && !err && <p className="text-ink-4">Loading…</p>}
        {data?.items.length === 0 && (
          <div className="glass rounded-[24px] p-10 text-center">
            <FileText className="mx-auto size-6 text-ink-3" strokeWidth={1.3} />
            <p className="mt-3 text-[16px] font-light text-ink">No records {Object.values(filter).some(Boolean) ? "match these filters" : "yet"}</p>
            <p className="mt-1 text-[13px] text-ink-4">Upload reports, X-rays, photos, prescriptions or treatment plans.</p>
          </div>
        )}
        <ul className="space-y-3">
          {data?.items.map((r) => (
            <RecordRow key={r.id} r={r} onChange={load} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function UploadCard({ onDone, usage }: { onDone: () => void; usage?: List["usage"] }) {
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ title: "", docType: "report", recordDate: new Date().toISOString().slice(0, 10), clinicName: "", providerName: "", episode: "" });
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (usage && file.size > usage.maxFileBytes) return setMsg({ kind: "error", text: "Files must be 15 MB or smaller." });
    const body = new FormData();
    body.set("file", file);
    for (const [k, v] of Object.entries(f)) body.set(k, v);
    // XHR (not fetch) so we can show real upload progress
    const x = new XMLHttpRequest();
    x.open("POST", "/api/records");
    x.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    x.onload = () => {
      setProgress(null);
      const res = JSON.parse(x.responseText || "{}");
      if (x.status >= 200 && x.status < 300) {
        setMsg({ kind: "success", text: `“${res.title}” uploaded.` });
        setFile(null);
        setF((s) => ({ ...s, title: "" }));
        onDone();
      } else setMsg({ kind: "error", text: res.message ?? "Upload failed. Please try again." });
    };
    x.onerror = () => {
      setProgress(null);
      setMsg({ kind: "error", text: "Upload failed. Check your connection and try again." });
    };
    setMsg(null);
    setProgress(0);
    x.send(body);
  };

  return (
    <form onSubmit={submit} className="glass space-y-3 rounded-[22px] p-5">
      <h2 className="flex items-center gap-2 text-[15px] text-ink">
        <Upload className="size-4" strokeWidth={1.5} /> Add a document
      </h2>
      <input
        aria-label="File"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.dcm"
        onChange={(e) => {
          const fl = e.target.files?.[0] ?? null;
          setFile(fl);
          if (fl && !f.title) setF((s) => ({ ...s, title: fl.name.replace(/\.[^.]+$/, "").slice(0, 120) }));
        }}
        className="block w-full text-[12.5px] text-ink-3 file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-ink-2"
      />
      <p className="text-[11.5px] text-ink-4">PDF, JPEG, PNG, WebP or DICOM · up to 15 MB</p>
      <input aria-label="Document name" placeholder="Document name" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={`${inputCls} h-10 text-[13px]`} />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Type" value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })} className={`${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input aria-label="Document date" type="date" value={f.recordDate} onChange={(e) => setF({ ...f, recordDate: e.target.value })} className={`${inputCls} h-10 text-[13px]`} />
      </div>
      <input aria-label="Clinic (optional)" placeholder="Clinic (optional)" value={f.clinicName} onChange={(e) => setF({ ...f, clinicName: e.target.value })} className={`${inputCls} h-10 text-[13px]`} />
      <input aria-label="Dentist (optional)" placeholder="Dentist (optional)" value={f.providerName} onChange={(e) => setF({ ...f, providerName: e.target.value })} className={`${inputCls} h-10 text-[13px]`} />
      <input aria-label="Treatment or episode (optional)" placeholder="Treatment, e.g. Root canal 2026 (optional)" value={f.episode} onChange={(e) => setF({ ...f, episode: e.target.value })} className={`${inputCls} h-10 text-[13px]`} />
      {progress !== null && (
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress" className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
          <div className="h-full bg-[var(--button-primary)] transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button disabled={!file || progress !== null} className="btn-primary h-10 w-full text-[13px] disabled:opacity-50">
        {progress !== null ? `Uploading… ${progress}%` : "Upload"}
      </button>
    </form>
  );
}

function RecordRow({ r, onChange }: { r: Rec; onChange: () => void }) {
  const [panel, setPanel] = useState<"" | "share" | "history" | "delete">("");
  const [err, setErr] = useState("");
  const open = async (mode: "view" | "download") => {
    setErr("");
    try {
      const { url } = await api<{ url: string }>(`/api/records/${r.id}/link`, { method: "POST", body: { mode } });
      if (mode === "view") window.open(url, "_blank", "noopener");
      else location.assign(url);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const revoke = async (shareId: string) => {
    try {
      await api(`/api/records/${r.id}/share`, { method: "DELETE", body: { shareId } });
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const del = async () => {
    try {
      await api(`/api/records/${r.id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <li className="glass rounded-[22px] p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="icon-tile size-10 shrink-0">
          <FileText className="size-4" strokeWidth={1.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-ink">{r.title}</p>
          <p className="text-[12.5px] text-ink-4">
            {r.docTypeLabel} · {new Date(r.recordDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            {r.clinicName && ` · ${r.clinicName}`}
            {r.providerName && ` · ${r.providerName}`}
            {r.episode && ` · ${r.episode}`} · {mb(r.sizeBytes)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <IconBtn label="View" onClick={() => open("view")} icon={Eye} />
          <IconBtn label="Download" onClick={() => open("download")} icon={Download} />
          <IconBtn label="Share" onClick={() => setPanel(panel === "share" ? "" : "share")} icon={Share2} pressed={panel === "share"} />
          <IconBtn label="Access history" onClick={() => setPanel(panel === "history" ? "" : "history")} icon={History} pressed={panel === "history"} />
          <IconBtn label="Delete" onClick={() => setPanel(panel === "delete" ? "" : "delete")} icon={Trash2} pressed={panel === "delete"} />
        </div>
      </div>
      {r.shares.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {r.shares.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <Share2 className="size-3.5" strokeWidth={1.5} /> Shared with {s.dentistName} until {fmt(s.expiresAt)}
              <button onClick={() => revoke(s.id)} className="ml-1 text-ink-2 underline underline-offset-4">
                Stop sharing
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
      {panel === "share" && <SharePanel id={r.id} onDone={() => (setPanel(""), onChange())} />}
      {panel === "history" && <HistoryPanel id={r.id} />}
      {panel === "delete" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[16px] border border-line-strong p-4 text-[13px] text-ink-2">
          Delete this document? Sharing stops and the file is removed. This can&apos;t be undone.
          <button onClick={del} className="btn-primary h-9 px-4 text-[12.5px]">
            Delete
          </button>
          <button onClick={() => setPanel("")} className="btn-ghost h-9 px-4 text-[12.5px]">
            Keep
          </button>
        </div>
      )}
    </li>
  );
}

function IconBtn({ label, onClick, icon: Icon, pressed }: { label: string; onClick: () => void; icon: typeof Eye; pressed?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`grid size-9 place-items-center rounded-full border transition-colors ${pressed ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-3 hover:text-ink"}`}
    >
      <Icon className="size-4" strokeWidth={1.5} />
    </button>
  );
}

function SharePanel({ id, onDone }: { id: string; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; specialty: string; clinic: { area: string } | null }[]>([]);
  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);
  const [days, setDays] = useState(7);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      api<{ organic: typeof results }>(`/api/providers?q=${encodeURIComponent(q.trim())}`).then((r) => setResults(r.organic)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const share = async () => {
    setErr("");
    try {
      await api(`/api/records/${id}/share`, { method: "POST", body: { dentistId: pick!.id, days, confirmed: true } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="mt-4 space-y-3 rounded-[16px] border border-line p-4">
      {!pick ? (
        <>
          <label htmlFor={`q-${id}`} className="text-[12.5px] text-ink-2">
            Share with which dentist?
          </label>
          <input id={`q-${id}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className={`${inputCls} h-10 text-[13px]`} />
          <ul className="space-y-1">
            {(q.trim().length >= 2 ? results : []).map((d) => (
              <li key={d.id}>
                <button onClick={() => setPick(d)} className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-[var(--accent-soft)]">
                  {d.name} <span className="text-ink-4">· {d.specialty}{d.clinic ? `, ${d.clinic.area}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            Share with <span className="text-ink">{pick.name}</span>
            <button aria-label="Choose a different dentist" onClick={() => setPick(null)} className="text-ink-4 hover:text-ink">
              <X className="size-3.5" />
            </button>
          </p>
          <label className="flex items-center gap-2 text-[13px] text-ink-3">
            Access for
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${inputCls} h-9 !w-auto text-[13px] [&>option]:bg-[var(--surface)]`}>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            I want {pick.name} to be able to view this document until the access period ends or I stop sharing.
          </label>
          <button disabled={!ok} onClick={share} className="btn-primary h-9 px-4 text-[12.5px] disabled:opacity-50">
            Share document
          </button>
        </>
      )}
      {err && <Notice kind="error">{err}</Notice>}
    </div>
  );
}

function HistoryPanel({ id }: { id: string }) {
  const [items, setItems] = useState<{ kind: string; detail: string; at: number; actor: string | null }[] | null>(null);
  useEffect(() => {
    api<{ items: NonNullable<typeof items> }>(`/api/records/${id}/history`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [id]);
  return (
    <ol className="mt-4 space-y-1.5 rounded-[16px] border border-line p-4 text-[12.5px] text-ink-3">
      {!items && <li>Loading…</li>}
      {items?.map((e, i) => (
        <li key={i}>
          {fmt(e.at)} · {e.kind.replace("_", " ")} by {e.actor ?? "someone"}
          {e.detail && <span className="text-ink-4"> ({e.detail})</span>}
        </li>
      ))}
    </ol>
  );
}

function SharedWithMe() {
  const [items, setItems] = useState<{ id: string; title: string; docTypeLabel: string; recordDate: string; patient: string; expiresAt: number }[] | null>(null);
  useEffect(() => {
    api<{ items: NonNullable<typeof items> }>("/api/records/shared").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  const open = async (id: string) => {
    const { url } = await api<{ url: string }>(`/api/records/${id}/link`, { method: "POST", body: { mode: "view" } });
    window.open(url, "_blank", "noopener");
  };
  return (
    <section className="mt-10">
      <h2 className="text-[20px] font-light text-ink">Shared with me by patients</h2>
      <p className="mt-1 text-[13px] text-ink-4">Visible only while the patient&apos;s share is active. Every view is shown to the patient.</p>
      <ul className="mt-4 space-y-2">
        {items?.length === 0 && <li className="text-[13px] text-ink-4">Nothing shared with you right now.</li>}
        {items?.map((r) => (
          <li key={r.id} className="glass flex items-center gap-3 rounded-[18px] p-4 text-[13px]">
            <span className="flex-1 text-ink-2">
              {r.title} <span className="text-ink-4">· {r.docTypeLabel} · from {r.patient} · until {fmt(r.expiresAt)}</span>
            </span>
            <button onClick={() => open(r.id)} className="btn-ghost h-9 px-4 text-[12.5px]">
              View
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
