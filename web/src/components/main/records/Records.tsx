"use client";

import { ArrowLeft, Download, FileText, Grid2x2, List, Pencil, Share2, ShieldCheck, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { istDate, timeLabel, when } from "@/lib/format";
import type { Me } from "@/lib/fmd";
import { useRequireMe } from "@/lib/me";
import { listJourneys, type Journey } from "@/sample/journeys";
import { ReportSummaryPanel } from "../assistant/Tools";
import { CLINICS } from "@/sample/providers";
import {
  accessEvents,
  addRecord,
  checkUpload,
  deleteRecord,
  exportAll,
  findRecipients,
  getLink,
  getRecord,
  getThumb,
  guessType,
  listRecords,
  listShares,
  RECORD_TYPES,
  revokeShare,
  shareRecords,
  storage,
  updateRecord,
  type AccessEvent,
  type DentalRecord,
  type Recipient,
  type RecordType,
  type ShareView,
} from "@/sample/records";

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const dateLabel = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const hrefOf = (r: DentalRecord) => (r.certificate_id ? `/certificates/${r.certificate_id}` : `/records/${r.id}`);
const save = (url: string, name: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
};

function Nav({ on }: { on: "records" | "shared" | "journeys" }) {
  const tabs: [string, string, typeof on][] = [
    ["/records", "All records", "records"],
    ["/records?tab=shared", "Shared", "shared"],
    ["/journey", "Treatment journeys", "journeys"],
  ];
  return (
    <nav aria-label="Records" className="flex w-fit flex-wrap gap-1 rounded-full border border-line bg-[var(--surface-glass)] p-1">
      {tabs.map(([href, label, k]) => (
        <Link key={k} href={href} aria-current={on === k ? "page" : undefined} className={`h-9 content-center rounded-full px-4 text-[13.5px] font-medium ${on === k ? "bg-[var(--accent-soft)] text-ink" : "text-ink-3 hover:text-ink"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
export { Nav as RecordsNav };

/* ---------------- /records ---------------- */

const FILTER_KEYS = ["type", "clinic", "dentist", "episode", "from", "to"] as const;

export function RecordsPage() {
  const me = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "shared" ? "shared" : "records";
  const key = params.toString();
  const [data, setData] = useState<{ records: DentalRecord[]; all: DentalRecord[]; used: number; limit: number; journeys: Journey[] } | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<"upload" | "share" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const userId = me?.id;
  const reload = useCallback(() => {
    if (!userId) return;
    const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, new URLSearchParams(key).get(k) ?? undefined]));
    Promise.all([listRecords(userId, f), listRecords(userId), storage(userId), listJourneys(userId)]).then(([records, all, s, journeys]) => setData({ records, all, ...s, journeys }));
  }, [userId, key]);
  useEffect(reload, [reload]);

  if (!me || !data) return <div className="app-panel h-48 animate-pulse" aria-busy />;

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(p.size ? `/records?${p}` : "/records", { scroll: false });
  };
  const exportZip = async () => {
    setExporting(true);
    try {
      const url = URL.createObjectURL(await exportAll(me.id));
      save(url, `fmd-records-${istDate(Date.now())}.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setExporting(false);
    }
  };
  const pct = Math.min(100, (data.used / data.limit) * 100);
  const clinics = [...new Map(data.all.filter((r) => r.clinic).map((r) => [r.clinic!.id, r.clinic!.name])).entries()];
  const dentists = [...new Map(data.all.filter((r) => r.dentist).map((r) => [r.dentist!.id, r.dentist!.name])).entries()];
  const filtered = FILTER_KEYS.some((k) => params.get(k));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
            Records <Tag tone="muted">Demo · stored in this browser</Tag>
          </h1>
          <p className="mt-1 max-w-[640px] text-[14.5px] text-ink-3">Your reports, X-rays, plans and invoices in one private place. Only you can see them, unless you share them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => (setNote(null), setOpen("share"))}>
            <Share2 className="size-4" strokeWidth={1.75} /> Share
          </Button>
          <Button size="sm" onClick={() => (setNote(null), setOpen("upload"))}>
            <Upload className="size-4" strokeWidth={1.75} /> Upload
          </Button>
        </div>
      </div>
      <Nav on={tab} />
      {note && <Notice kind="success">{note}</Notice>}

      {tab === "shared" ? (
        <SharedTab userId={me.id} />
      ) : (
        <>
          <Panel className="grid gap-4 p-5">
            <div className="grid gap-1.5">
              <div className="flex flex-wrap justify-between gap-2 text-[13.5px]">
                <span className="text-ink-2">
                  {mb(data.used)} of {mb(data.limit)} used
                </span>
                <button type="button" onClick={exportZip} disabled={exporting} className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline disabled:opacity-50">
                  <Download className="size-4" strokeWidth={1.75} /> {exporting ? "Preparing…" : "Download everything (zip)"}
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-glass)]" role="meter" aria-label="Storage used" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Type">
                <select className={fieldCls} value={params.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}>
                  <option value="">All types</option>
                  {Object.entries(RECORD_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Clinic">
                <select className={fieldCls} value={params.get("clinic") ?? ""} onChange={(e) => set("clinic", e.target.value)}>
                  <option value="">Any clinic</option>
                  {clinics.map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dentist">
                <select className={fieldCls} value={params.get("dentist") ?? ""} onChange={(e) => set("dentist", e.target.value)}>
                  <option value="">Any dentist</option>
                  {dentists.map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Treatment">
                <select className={fieldCls} value={params.get("episode") ?? ""} onChange={(e) => set("episode", e.target.value)}>
                  <option value="">Any treatment</option>
                  {data.journeys.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                  <option value="none">Not part of a treatment</option>
                </select>
              </Field>
              <Field label="From">
                <input type="date" className={fieldCls} value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />
              </Field>
              <Field label="To">
                <input type="date" className={fieldCls} value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p aria-live="polite" className="text-[13.5px] text-ink-3">
                {data.records.length} {data.records.length === 1 ? "record" : "records"}
              </p>
              {filtered && (
                <button type="button" onClick={() => router.replace("/records", { scroll: false })} className="text-[13.5px] text-ink-3 hover:text-ink">
                  Clear filters
                </button>
              )}
              <div role="group" aria-label="View" className="ml-auto flex gap-1">
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    aria-label={v === "grid" ? "Grid view" : "List view"}
                    onClick={() => setView(v)}
                    className={`grid size-9 place-items-center rounded-full border ${view === v ? "border-[var(--accent)] text-ink" : "border-line text-ink-3"}`}
                  >
                    {v === "grid" ? <Grid2x2 className="size-4" strokeWidth={1.75} /> : <List className="size-4" strokeWidth={1.75} />}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          {data.records.length === 0 ? (
            <Panel className="grid justify-items-start gap-3 p-6">
              <p className="text-[15px] text-ink">{filtered ? "No records match these filters." : "No records yet."}</p>
              <Button onClick={() => setOpen("upload")}>Upload a record</Button>
            </Panel>
          ) : view === "grid" ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.records.map((r) => (
                <li key={r.id}>
                  <RecordCard userId={me.id} r={r} journeys={data.journeys} />
                </li>
              ))}
            </ul>
          ) : (
            <Panel className="overflow-hidden">
              <ul className="divide-y divide-[var(--border)]">
                {data.records.map((r) => (
                  <li key={r.id}>
                    <Link href={hrefOf(r)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-[var(--surface-glass)]">
                      <span className="min-w-0 flex-1 basis-[220px] truncate text-[14.5px] font-medium text-ink">{r.title}</span>
                      <Tag tone="muted">{RECORD_TYPES[r.type]}</Tag>
                      <span className="text-[13.5px] text-ink-3">{dateLabel(r.date)}</span>
                      <span className="text-[13.5px] text-ink-3">{r.clinic?.name ?? "Added by you"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {open === "upload" && (
        <UploadSheet
          me={me}
          used={data.used}
          journeys={data.journeys}
          onClose={() => setOpen(null)}
          onDone={(n) => (setOpen(null), setNote(`${n} ${n === 1 ? "record" : "records"} added.`), reload())}
        />
      )}
      {open === "share" && (
        <ShareSheet userId={me.id} records={data.all} onClose={() => setOpen(null)} onDone={(msg) => (setOpen(null), setNote(msg), router.replace("/records?tab=shared", { scroll: false }))} />
      )}
    </div>
  );
}

function RecordCard({ userId, r, journeys }: { userId: string; r: DentalRecord; journeys: Journey[] }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    getThumb(userId, r.id).then(setThumb);
  }, [userId, r.id]);
  const j = journeys.find((x) => x.id === r.episode_id);
  return (
    <Link href={hrefOf(r)} className="app-panel flex h-full flex-col overflow-hidden transition-colors hover:border-line-strong">
      <div className="relative grid h-36 place-items-center bg-[var(--surface-glass)]">
        {thumb ? (
          <Image src={thumb} alt="" fill unoptimized className="object-cover" />
        ) : r.type === "certificate" ? (
          <ShieldCheck className="size-10 text-ink-3" strokeWidth={1.25} />
        ) : (
          <FileText className="size-10 text-ink-3" strokeWidth={1.25} />
        )}
      </div>
      <div className="grid gap-1.5 p-4">
        <p className="truncate text-[15px] font-medium text-ink">{r.title}</p>
        <p className="text-[13px] text-ink-3">
          {dateLabel(r.date)} · {r.source === "clinic" ? `From ${r.clinic?.name}` : "Added by you"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Tag tone="muted">{RECORD_TYPES[r.type]}</Tag>
          {j && <Tag tone="accent">{j.title.split(",")[0]}</Tag>}
        </div>
      </div>
    </Link>
  );
}

/* ---------------- upload ---------------- */

type Pending = { file: File; title: string; type: RecordType; date: string; clinic: string; episode: string; note: string; progress: number; error: string | null; done: boolean };

function UploadSheet({ me, used, journeys, onClose, onDone }: { me: Me; used: number; journeys: Journey[]; onClose: () => void; onDone: (n: number) => void }) {
  const [items, setItems] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [today] = useState(() => istDate(Date.now())); // fixed when the sheet opens
  const pick = (files: FileList | null) => {
    let total = used;
    const next = [...(files ?? [])].map((file): Pending => {
      const error = checkUpload(file, total);
      if (!error) total += file.size;
      return { file, title: file.name.replace(/\.[^.]+$/, ""), type: guessType(file.type), date: today, clinic: "", episode: "", note: "", progress: 0, error, done: false };
    });
    setItems(next);
  };
  const edit = (i: number, patch: Partial<Pending>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const ok = items.filter((x) => !x.error);

  const upload = async () => {
    setBusy(true);
    let added = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.error || it.done) continue;
      // the real upload reports progress as it sends; the demo fills the bar in steps
      for (const p of [25, 55, 85]) {
        edit(i, { progress: p });
        await new Promise((r) => setTimeout(r, 120));
      }
      try {
        const c = CLINICS.find((x) => x.id === it.clinic);
        await addRecord(
          me.id,
          { title: it.title, type: it.type, date: it.date, clinic: c ? { id: c.id, name: c.name } : null, dentist: null, episode_id: it.episode || null, note: it.note || null },
          it.file,
        );
        edit(i, { progress: 100, done: true });
        added++;
      } catch (e) {
        edit(i, { progress: 0, error: (e as Error).message });
      }
    }
    setBusy(false);
    if (added) onDone(added);
  };

  return (
    <Sheet title="Upload records" onClose={onClose} wide>
      <div className="grid gap-4">
        <p className="text-[14px] text-ink-2">PDF, JPG, PNG or WebP, up to 20 MB each. Files stay private to you.</p>
        <label className="grid cursor-pointer place-items-center gap-1 rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center hover:border-[var(--accent)] has-[input:focus-visible]:border-[var(--accent)]">
          <Upload className="size-6 text-ink-3" strokeWidth={1.5} />
          <span className="text-[14.5px] font-medium text-ink">Choose files</span>
          <span className="text-[13px] text-ink-3">or take a photo on your phone</span>
          <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files)} />
        </label>
        {items.map((it, i) => (
          <div key={i} className="grid gap-3 rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-all text-[14px] font-medium text-ink">{it.file.name}</p>
              <span className="text-[13px] text-ink-3">{mb(it.file.size)}</span>
            </div>
            {it.error ? (
              <Notice kind="error">
                {it.error}{" "}
                <Link href="/help/upload-limits" className="font-medium underline underline-offset-4">
                  Which files work?
                </Link>
              </Notice>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input className={fieldCls} value={it.title} onChange={(e) => edit(i, { title: e.target.value })} maxLength={120} disabled={it.done} />
                  </Field>
                  <Field label="Type">
                    <select className={fieldCls} value={it.type} onChange={(e) => edit(i, { type: e.target.value as RecordType })} disabled={it.done}>
                      {Object.entries(RECORD_TYPES)
                        .filter(([k]) => k !== "certificate")
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Date on the document">
                    <input type="date" max={today} className={fieldCls} value={it.date} onChange={(e) => edit(i, { date: e.target.value })} disabled={it.done} />
                  </Field>
                  <Field label="Clinic (optional)">
                    <select className={fieldCls} value={it.clinic} onChange={(e) => edit(i, { clinic: e.target.value })} disabled={it.done}>
                      <option value="">None or not on FMD</option>
                      {CLINICS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}, {c.area}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Treatment (optional)">
                    <select className={fieldCls} value={it.episode} onChange={(e) => edit(i, { episode: e.target.value })} disabled={it.done}>
                      <option value="">Not part of a treatment</option>
                      {journeys.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Note (optional)">
                    <input className={fieldCls} value={it.note} onChange={(e) => edit(i, { note: e.target.value })} maxLength={200} disabled={it.done} />
                  </Field>
                </div>
                {(it.progress > 0 || it.done) && (
                  <div className="grid gap-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-glass)]" role="progressbar" aria-label={`Uploading ${it.file.name}`} aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${it.progress}%` }} />
                    </div>
                    <p className="text-[12.5px] text-ink-3">{it.done ? "Added" : `Uploading… ${it.progress}%`}</p>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={busy || !ok.length || ok.every((x) => x.done)}>
            {busy ? "Uploading…" : ok.length > 1 ? `Upload ${ok.length} files` : "Upload"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- sharing ---------------- */

export function ShareSheet({ userId, records, preselect = [], onClose, onDone }: { userId: string; records: DentalRecord[]; preselect?: string[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [q, setQ] = useState("");
  const [to, setTo] = useState<Recipient | null>(null);
  const [ids, setIds] = useState<string[]>(preselect);
  const [days, setDays] = useState<"7" | "30" | "">("7");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const results = to ? [] : findRecipients(q);
  const shareable = records.filter((r) => r.type !== "certificate");

  const share = async () => {
    setErr(null);
    try {
      await shareRecords(userId, { to, record_ids: ids, days: days ? (Number(days) as 7 | 30) : null, note });
      onDone(`Shared ${ids.length} ${ids.length === 1 ? "record" : "records"} with ${to!.name}. You can end it any time from Shared.`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Sheet title="Share records" onClose={onClose} wide>
      <div className="grid gap-4">
        <p className="text-[14px] text-ink-2">Only the records you tick are shared, only with the person you choose, and you can end it at any time.</p>
        {err && <Notice kind="error">{err}</Notice>}
        <div className="grid gap-2">
          <p className="text-[13.5px] text-ink-3">1. Who with?</p>
          {to ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[var(--accent-soft)] px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-medium text-ink">{to.name}</span>
                <span className="block text-[13px] text-ink-3">{to.detail}</span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setTo(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <input className={fieldCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a dentist or clinic on FMD" aria-label="Search a dentist or clinic" />
              {results.length > 0 && (
                <ul className="divide-y divide-[var(--border)] rounded-2xl border border-line">
                  {results.map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <button type="button" onClick={() => setTo(r)} className="w-full px-4 py-2.5 text-left hover:bg-[var(--surface-glass)]">
                        <span className="block text-[14px] text-ink">{r.name}</span>
                        <span className="block text-[12.5px] text-ink-3">{r.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 2 && results.length === 0 && <p className="text-[13.5px] text-ink-3">No dentist or clinic on FMD matches that.</p>}
            </>
          )}
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13.5px] text-ink-3">2. Which records?</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-2xl border border-line p-2">
            {shareable.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-[var(--surface-glass)]">
                <input
                  type="checkbox"
                  checked={ids.includes(r.id)}
                  onChange={(e) => setIds((xs) => (e.target.checked ? [...xs, r.id] : xs.filter((x) => x !== r.id)))}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-[14px] text-ink">
                  {r.title} <span className="text-ink-3">· {dateLabel(r.date)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <Field label="3. For how long?">
            <select className={fieldCls} value={days} onChange={(e) => setDays(e.target.value as typeof days)}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="">Until I end it</option>
            </select>
          </Field>
          <Field label="Note for them (optional)">
            <input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. for my second opinion on 14 Nov" />
          </Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={share} disabled={!to || !ids.length}>
            {to && ids.length ? `Share ${ids.length} with ${to.name}` : "Share"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function SharedTab({ userId }: { userId: string }) {
  const [shares, setShares] = useState<ShareView[] | null>(null);
  const [records, setRecords] = useState<DentalRecord[]>([]);
  const load = useCallback(() => {
    Promise.all([listShares(userId), listRecords(userId)]).then(([s, r]) => (setShares(s), setRecords(r)));
  }, [userId]);
  useEffect(load, [load]);
  if (!shares) return <div className="app-panel h-32 animate-pulse" aria-busy />;
  const title = (id: string) => records.find((r) => r.id === id)?.title ?? "Deleted record";
  const active = shares.filter((s) => s.state === "active");
  const ended = shares.filter((s) => s.state !== "active");
  const row = (s: ShareView) => (
    <li key={s.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
      <div className="min-w-0 flex-1 basis-[260px]">
        <p className="text-[14.5px] font-medium text-ink">{s.to.name}</p>
        <p className="text-[13px] text-ink-3">{s.to.detail}</p>
        <p className="mt-1 text-[13.5px] text-ink-2">{s.record_ids.map(title).join(", ") || "No records left in this share"}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">
          Shared {when(Date.parse(s.created_at))} ·{" "}
          {s.state === "revoked" ? `ended ${when(Date.parse(s.revoked_at!))}` : s.expires_at ? `${s.state === "expired" ? "ended" : "until"} ${when(Date.parse(s.expires_at))}` : "until you end it"}
        </p>
        {s.note && <p className="text-[12.5px] text-ink-3">Your note: {s.note}</p>}
      </div>
      {s.state === "active" ? (
        <Button variant="secondary" size="sm" onClick={() => revokeShare(userId, s.id).then(load)} aria-label={`Stop sharing with ${s.to.name}`}>
          Stop sharing
        </Button>
      ) : (
        <Tag tone="muted">{s.state === "revoked" ? "Ended by you" : "Expired"}</Tag>
      )}
    </li>
  );
  return (
    <div className="grid gap-4">
      <Panel as="section" className="overflow-hidden">
        <h2 className="px-5 pt-4 text-[16px] font-medium text-ink">Shared now ({active.length})</h2>
        {active.length ? <ul className="divide-y divide-[var(--border)]">{active.map(row)}</ul> : <p className="px-5 pb-5 pt-2 text-[14px] text-ink-3">You aren&apos;t sharing anything right now.</p>}
      </Panel>
      {ended.length > 0 && (
        <Panel as="section" className="overflow-hidden">
          <h2 className="px-5 pt-4 text-[16px] font-medium text-ink">Ended</h2>
          <ul className="divide-y divide-[var(--border)]">{ended.map(row)}</ul>
        </Panel>
      )}
      <p className="text-[12.5px] text-ink-3">Stopping a share works at once: the links stop opening. Each record&apos;s access history shows who opened it.</p>
    </div>
  );
}

/* ---------------- /records/[id] ---------------- */

export function RecordPage() {
  const { id } = useParams<{ id: string }>();
  const me = useRequireMe();
  const router = useRouter();
  const [r, setR] = useState<DentalRecord | null | undefined>(undefined);
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [all, setAll] = useState<DentalRecord[]>([]);
  const [open, setOpen] = useState<"edit" | "delete" | "share" | null>(null);
  const [zoom, setZoom] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const userId = me?.id;

  const refresh = useCallback(() => {
    if (!userId) return;
    Promise.all([getRecord(userId, id), accessEvents(userId, id), listJourneys(userId), listRecords(userId)]).then(([rec, ev, js, recs]) => (setR(rec), setEvents(ev), setJourneys(js), setAll(recs)));
  }, [userId, id]);
  // opening the page opens the file: one short-lived link, logged once
  useEffect(() => {
    if (!userId) return;
    getLink(userId, id)
      .then(setLink, () => setLink(null))
      .then(refresh);
  }, [userId, id, refresh]);

  if (!me || r === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (r === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that record</h1>
        <ButtonLink href="/records" variant="secondary">
          Records
        </ButtonLink>
      </Panel>
    );

  const download = async () => {
    const l = await getLink(me.id, r.id, "download");
    save(l.url, l.name);
    refresh();
  };
  const j = journeys.find((x) => x.id === r.episode_id);
  const image = r.file.mime.startsWith("image/");
  const rows: [string, ReactNode][] = [
    ["Type", RECORD_TYPES[r.type]],
    ["Date", dateLabel(r.date)],
    ["From", r.source === "clinic" ? `${r.clinic?.name}${r.dentist ? `, ${r.dentist.name}` : ""}` : "Added by you"],
    [
      "Treatment",
      j ? (
        <Link href={`/journey/${j.id}`} className="underline-offset-4 hover:underline">
          {j.title}
        </Link>
      ) : (
        "Not part of a treatment"
      ),
    ],
    ["File", `${r.file.name} · ${mb(r.file.size)}`],
  ];
  if (r.clinic && r.source === "you") rows.splice(2, 1, ["From", `${r.clinic.name} (added by you)`]);
  if (r.note) rows.push(["Note", r.note]);

  return (
    <div className="grid gap-5">
      <Link href="/records" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Records
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-medium text-ink">{r.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={download}>
            <Download className="size-4" strokeWidth={1.75} /> Download
          </Button>
          <Button variant="secondary" size="sm" onClick={() => (setNote(null), setOpen("share"))}>
            <Share2 className="size-4" strokeWidth={1.75} /> Share
          </Button>
          <Button variant="secondary" size="sm" onClick={() => (setNote(null), setOpen("edit"))}>
            <Pencil className="size-4" strokeWidth={1.75} /> Edit details
          </Button>
          <Button variant="secondary" size="sm" className="!text-[var(--tone-bad)]" onClick={() => setOpen("delete")}>
            <Trash2 className="size-4" strokeWidth={1.75} /> Delete
          </Button>
        </div>
      </div>
      {note && <Notice kind="success">{note}</Notice>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="grid gap-2 overflow-hidden p-3">
          {!link ? (
            <div className="h-[420px] animate-pulse rounded-2xl bg-[var(--surface-glass)]" />
          ) : image ? (
            <button type="button" onClick={() => setZoom(true)} className="relative h-[420px] cursor-zoom-in overflow-hidden rounded-2xl" aria-label="Zoom in">
              <Image src={link.url} alt={r.title} fill unoptimized className="object-contain" />
            </button>
          ) : (
            <iframe src={link.url} title={r.title} className="h-[560px] w-full rounded-2xl bg-white" />
          )}
          {link && (
            <p className="flex items-center gap-1.5 px-2 pb-1 text-[12.5px] text-ink-3">
              <ShieldCheck className="size-3.5" strokeWidth={1.75} /> Private link, works until {timeLabel(Date.parse(link.expires_at))}
            </p>
          )}
        </Panel>

        <div className="grid gap-5">
          <Panel className="p-5">
            <dl className="grid gap-2.5 text-[14px]">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {(r.type === "report" || r.type === "plan") && <ReportSummaryPanel recordId={r.id} />}
          <Panel as="section" className="grid gap-3 p-5">
            <h2 className="text-[15px] font-medium text-ink">Who opened it</h2>
            <ol className="grid gap-2.5">
              {events.slice(0, 12).map((e, i) => (
                <li key={i} className="text-[13.5px]">
                  <span className="text-ink">{e.who}</span> <span className="text-ink-2">{e.what}</span>
                  <span className="block text-[12.5px] text-ink-3">{when(Date.parse(e.at))}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {zoom && link && (
        <Sheet title={r.title} onClose={() => setZoom(false)} wide>
          <div className="relative h-[70dvh]">
            <Image src={link.url} alt={r.title} fill unoptimized className="object-contain" />
          </div>
        </Sheet>
      )}
      {open === "edit" && <EditSheet userId={me.id} r={r} journeys={journeys} onClose={() => setOpen(null)} onDone={() => (setOpen(null), setNote("Details saved."), refresh())} />}
      {open === "share" && <ShareSheet userId={me.id} records={all} preselect={[r.id]} onClose={() => setOpen(null)} onDone={(msg) => (setOpen(null), setNote(msg), refresh())} />}
      {open === "delete" && (
        <Sheet title="Delete this record?" onClose={() => setOpen(null)}>
          <div className="grid gap-4">
            <p className="text-[14.5px] text-ink-2">
              “{r.title}” and its file are deleted for good, and taken out of anything you&apos;ve shared.
              {r.source === "clinic" && " The clinic keeps its own copy."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Keep it
              </Button>
              <Button onClick={() => deleteRecord(me.id, r.id).then(() => router.replace("/records"))}>Delete</Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function EditSheet({ userId, r, journeys, onClose, onDone }: { userId: string; r: DentalRecord; journeys: Journey[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: r.title, type: r.type, date: r.date, episode: r.episode_id ?? "", note: r.note ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const saveIt = async () => {
    try {
      await updateRecord(userId, r.id, { title: f.title, type: f.type, date: f.date, episode_id: f.episode || null, note: f.note });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Sheet title="Edit details" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Name">
          <input className={fieldCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select className={fieldCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as RecordType })}>
              {Object.entries(RECORD_TYPES)
                .filter(([k]) => k !== "certificate")
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Date on the document">
            <input type="date" className={fieldCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
        <Field label="Treatment">
          <select className={fieldCls} value={f.episode} onChange={(e) => setF({ ...f, episode: e.target.value })}>
            <option value="">Not part of a treatment</option>
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <input className={fieldCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={saveIt}>Save</Button>
        </div>
      </div>
    </Sheet>
  );
}
