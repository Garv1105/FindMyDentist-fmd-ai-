"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { H, inr, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Detail = {
  id: string;
  name: string;
  phone: string;
  email: string;
  dob: string;
  medicalAlerts?: string;
  consentTreatmentAt: number | null;
  consentComms: boolean;
  linkedToFmd: boolean;
  timeline: { at: number; kind: string; title: string; detail: string; ref: string }[];
  access: { clinical: boolean; billing: boolean };
};
type Note = { id: string; rootId: string; version: number; status: string; complaint: string; findings: string; diagnosis: string; plan: string; amendmentReason: string; aiDrafted: boolean; author: string; signedBy: string | null; signedAt: number | null; createdAt: number };
type Chart = { current: { tooth: number; surfaces: string; finding: string; created_at: number }[]; history: { tooth: number; surfaces: string; finding: string; created_at: number; author: string }[] };
type Plan = { id: string; title: string; status: string; totalInr: number; acknowledgedNote: string; items: { procedure: string; tooth: string; qty: number; lineInr: number }[] };

const TABS = ["Timeline", "Notes", "Chart", "Plans", "Files"] as const;

export function PatientView() {
  const { patientId } = useParams<{ patientId: string }>();
  const { call, clinicId } = useClinic();
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");
  const [err, setErr] = useState("");
  const load = useCallback(() => call<Detail>(`patients/${patientId}`).then(setD).catch((e) => setErr(e.message)), [call, patientId]);
  useEffect(() => {
    load();
  }, [load]);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!d) return <p className="text-ink-4">Loading…</p>;
  const tabs = TABS.filter((t) => t === "Timeline" || d.access.clinical);
  return (
    <>
      <Link href={`/clinic/${clinicId}/patients`} className="text-[12.5px] text-ink-4 hover:text-ink">
        ← Patients
      </Link>
      <H title={d.name} desc={[d.phone, d.email, d.dob && `born ${d.dob}`, d.linkedToFmd && "linked FMD account"].filter(Boolean).join(" · ")} />
      <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-3">{d.consentTreatmentAt ? `Treatment consent on file (${when(d.consentTreatmentAt).split(",")[0]})` : "No treatment consent recorded"}</span>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-3">{d.consentComms ? "Agrees to reminders" : "No reminder consent"}</span>
        {d.medicalAlerts && <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-ink">Alert: {d.medicalAlerts}</span>}
      </div>
      <div role="tablist" className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-[13px] ${tab === t ? "bg-[var(--accent-soft)] text-ink" : "text-ink-3 hover:text-ink"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Timeline" && (
        <ol className="space-y-2">
          {d.timeline.length === 0 && <li className="text-[13px] text-ink-4">Nothing recorded yet.</li>}
          {d.timeline.map((e, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-line px-4 py-2.5 text-[13px]">
              <span className="w-40 text-ink-4">{when(e.at)}</span>
              <span className="w-24 capitalize text-ink-3">{e.kind}</span>
              <span className="flex-1 text-ink-2">{e.title}</span>
              <span className="text-ink-4">{e.detail}</span>
            </li>
          ))}
        </ol>
      )}
      {tab === "Notes" && <Notes patientId={patientId} onChange={load} />}
      {tab === "Chart" && <ChartTab patientId={patientId} />}
      {tab === "Plans" && <Plans patientId={patientId} />}
      {tab === "Files" && <Files patientId={patientId} />}
    </>
  );
}

function Notes({ patientId, onChange }: { patientId: string; onChange: () => void }) {
  const { call, can } = useClinic();
  const [list, setList] = useState<Note[] | null>(null);
  const [f, setF] = useState({ complaint: "", findings: "", diagnosis: "", plan: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const load = useCallback(() => call<Note[]>(`patients/${patientId}/notes`).then(setList).catch((e) => setMsg({ kind: "error", text: e.message })), [call, patientId]);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "success", text: ok });
      load();
      onChange();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const write = can("clinical.write");
  const cls = `${inputCls} h-auto py-2 text-[13px]`;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <ul className="space-y-3">
        {list?.length === 0 && <li className="text-[13px] text-ink-4">No notes yet.</li>}
        {list?.map((n) => (
          <li key={n.id} className={`glass rounded-[18px] p-4 text-[13px] ${n.status === "superseded" ? "opacity-60" : ""}`}>
            <p className="text-[12px] text-ink-4">
              v{n.version} · {n.status === "superseded" ? "superseded by a later amendment" : n.status} · {n.author} · {when(n.createdAt)}
              {n.signedBy && ` · signed by ${n.signedBy}`}
              {n.aiDrafted && " · drafted by the AI manager"}
            </p>
            {n.amendmentReason && <p className="mt-1 text-ink-3">Amendment reason: {n.amendmentReason}</p>}
            {(["complaint", "findings", "diagnosis", "plan"] as const).map((k) => n[k] && (
              <p key={k} className="mt-1 text-ink-2">
                <span className="capitalize text-ink-4">{k}:</span> {n[k]}
              </p>
            ))}
            {write && n.status === "draft" && (
              <button onClick={() => run(() => call(`notes/${n.id}/sign`, "POST", n.aiDrafted ? { acceptAiDraft: confirm("This note was drafted by the AI manager. Do you accept it as your clinical record?") } : {}), "Note signed.")} className="btn-primary mt-2 h-8 px-3 text-[12px]">
                Sign note
              </button>
            )}
            {write && n.status === "signed" && (
              <button
                onClick={() => {
                  const reason = prompt("Reason for the amendment?");
                  const diagnosis = reason && prompt("Corrected diagnosis (leave as is to keep):", n.diagnosis);
                  if (reason) run(() => call(`notes/${n.id}/amend`, "POST", { reason, diagnosis: diagnosis ?? n.diagnosis }), "Amendment drafted. Sign it to replace the current version.");
                }}
                className="mt-2 h-8 px-2 text-[12px] text-ink-3 underline underline-offset-4"
              >
                Amend
              </button>
            )}
          </li>
        ))}
      </ul>
      {write && (
        <div className="glass space-y-2 rounded-[20px] p-5">
          <h3 className="text-[15px] text-ink">New note</h3>
          {(["complaint", "findings", "diagnosis", "plan"] as const).map((k) => (
            <textarea key={k} aria-label={k} placeholder={k[0].toUpperCase() + k.slice(1)} rows={2} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={cls} />
          ))}
          <p className="text-[11.5px] text-ink-4">Saved as a draft. Signed notes can only be amended, never edited.</p>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <button onClick={() => run(() => call(`patients/${patientId}/notes`, "POST", f).then(() => setF({ complaint: "", findings: "", diagnosis: "", plan: "" })), "Draft saved.")} className="btn-primary h-9 w-full text-[12.5px]">
            Save draft
          </button>
        </div>
      )}
    </div>
  );
}

function ChartTab({ patientId }: { patientId: string }) {
  const { call, can } = useClinic();
  const [c, setC] = useState<Chart | null>(null);
  const [f, setF] = useState({ tooth: "", surfaces: "", finding: "" });
  const [err, setErr] = useState("");
  useEffect(() => {
    call<Chart>(`patients/${patientId}/chart`).then(setC).catch((e) => setErr(e.message));
  }, [call, patientId]);
  const add = async () => {
    setErr("");
    try {
      setC(await call<Chart>(`patients/${patientId}/chart`, "POST", { tooth: Number(f.tooth), surfaces: f.surfaces, finding: f.finding }));
      setF({ tooth: "", surfaces: "", finding: "" });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const quadrants = [
    [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  ];
  const finding = (t: number) => c?.current.find((x) => x.tooth === t);
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[18px] border border-line p-4">
        {quadrants.map((row, i) => (
          <div key={i} className="flex min-w-[640px] gap-1 py-1">
            {row.map((t) => (
              <button key={t} title={finding(t)?.finding ?? "No finding"} onClick={() => setF({ ...f, tooth: String(t) })} className={`flex h-14 flex-1 flex-col items-center justify-center rounded-lg border text-[11px] ${finding(t) ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-4"}`}>
                <span>{t}</span>
                {finding(t) && <span className="max-w-full truncate px-0.5 text-[9.5px]">{finding(t)!.finding}</span>}
              </button>
            ))}
          </div>
        ))}
        <p className="mt-2 text-[11.5px] text-ink-4">FDI notation. Each entry is kept: newer findings appear here, older ones stay in the history below.</p>
      </div>
      {can("clinical.write") && (
        <div className="flex flex-wrap gap-2">
          <input aria-label="Tooth" placeholder="Tooth (e.g. 36)" value={f.tooth} onChange={(e) => setF({ ...f, tooth: e.target.value })} className={`${inputCls} h-9 !w-32 text-[12.5px]`} />
          <input aria-label="Surfaces" placeholder="Surfaces (MODBL)" value={f.surfaces} onChange={(e) => setF({ ...f, surfaces: e.target.value })} className={`${inputCls} h-9 !w-36 text-[12.5px]`} />
          <input aria-label="Finding" placeholder="Finding" value={f.finding} onChange={(e) => setF({ ...f, finding: e.target.value })} className={`${inputCls} h-9 flex-1 text-[12.5px]`} />
          <button onClick={add} className="btn-primary h-9 px-4 text-[12.5px]">
            Add finding
          </button>
        </div>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      <ol className="space-y-1 text-[12.5px] text-ink-3">
        {c?.history.slice().reverse().map((h, i) => (
          <li key={i}>
            {when(h.created_at)} · tooth {h.tooth}
            {h.surfaces && ` (${h.surfaces})`}: {h.finding} · {h.author}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Plans({ patientId }: { patientId: string }) {
  const { call, can } = useClinic();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState([{ procedure: "", tooth: "", qty: 1, unitInr: 0, discountInr: 0 }]);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const load = useCallback(() => call<Plan[]>(`patients/${patientId}/plans`).then(setPlans).catch(() => setPlans([])), [call, patientId]);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const next: Record<string, string[]> = { draft: ["proposed"], proposed: ["accepted", "declined"], accepted: ["completed"] };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <ul className="space-y-3">
        {plans?.length === 0 && <li className="text-[13px] text-ink-4">No treatment plans.</li>}
        {plans?.map((p) => (
          <li key={p.id} className="glass rounded-[18px] p-4 text-[13px]">
            <div className="flex items-center justify-between">
              <p className="text-ink">{p.title}</p>
              <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] capitalize text-ink-3">{p.status}</span>
            </div>
            <ul className="mt-2 space-y-0.5 text-ink-3">
              {p.items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {it.procedure}
                    {it.tooth && ` (tooth ${it.tooth})`} × {it.qty}
                  </span>
                  <span>{inr(it.lineInr)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-line pt-2 text-ink">
              <span>Estimate total</span>
              <span>{inr(p.totalInr)}</span>
            </p>
            {p.acknowledgedNote && <p className="mt-1 text-[12px] text-ink-4">Patient response: {p.acknowledgedNote}</p>}
            {can("clinical.write") && (
              <div className="mt-2 flex gap-2">
                {(next[p.status] ?? []).map((to) => (
                  <button
                    key={to}
                    onClick={() => {
                      const note = to === "accepted" || to === "declined" ? prompt("How did the patient acknowledge it? (e.g. signed estimate, verbal in clinic)") : "";
                      if (note === null) return;
                      run(() => call(`plans/${p.id}/status`, "POST", { to, note }));
                    }}
                    className="btn-ghost h-8 px-3 text-[12px] capitalize"
                  >
                    {to === "proposed" ? "Propose to patient" : `Mark ${to}`}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {can("clinical.write") && (
        <div className="glass space-y-2 rounded-[20px] p-5">
          <h3 className="text-[15px] text-ink">New plan & estimate</h3>
          <input aria-label="Plan title" placeholder="Title, e.g. Root canal + crown 36" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} h-9 text-[12.5px]`} />
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_50px_80px_70px] gap-1.5">
              <input aria-label="Procedure" placeholder="Procedure" value={l.procedure} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, procedure: e.target.value } : x)))} className={`${inputCls} h-9 text-[12px]`} />
              <input aria-label="Tooth" placeholder="Tooth" value={l.tooth} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, tooth: e.target.value } : x)))} className={`${inputCls} h-9 text-[12px]`} />
              <input aria-label="Quantity" type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className={`${inputCls} h-9 px-2 text-[12px]`} />
              <input aria-label="Fee (₹)" type="number" min={0} placeholder="₹" value={l.unitInr} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitInr: Number(e.target.value) } : x)))} className={`${inputCls} h-9 px-2 text-[12px]`} />
              <input aria-label="Discount (₹)" type="number" min={0} placeholder="Disc" value={l.discountInr} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, discountInr: Number(e.target.value) } : x)))} className={`${inputCls} h-9 px-2 text-[12px]`} />
            </div>
          ))}
          <button onClick={() => setLines([...lines, { procedure: "", tooth: "", qty: 1, unitInr: 0, discountInr: 0 }])} className="text-[12px] text-ink-3 underline underline-offset-4">
            Add line
          </button>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <button onClick={() => run(() => call(`patients/${patientId}/plans`, "POST", { title, items: lines }).then(() => (setTitle(""), setLines([{ procedure: "", tooth: "", qty: 1, unitInr: 0, discountInr: 0 }]))))} className="btn-primary h-9 w-full text-[12.5px]">
            Create plan
          </button>
        </div>
      )}
    </div>
  );
}

function Files({ patientId }: { patientId: string }) {
  const { call, clinicId, can } = useClinic();
  const [files, setFiles] = useState<{ id: string; title: string; mime: string; size_bytes: number; created_at: number }[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => call<NonNullable<typeof files>>(`patients/${patientId}/files`).then(setFiles).catch(() => setFiles([])), [call, patientId]);
  useEffect(() => {
    load();
  }, [load]);
  const upload = async (file: File) => {
    setErr("");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("title", file.name);
    const res = await fetch(`/api/clinic/${clinicId}/patients-upload/${patientId}`, { method: "POST", body: fd });
    if (!res.ok) setErr((await res.json()).message ?? "Upload failed.");
    load();
  };
  return (
    <div className="space-y-3">
      {can("clinical.write") && (
        <label className="btn-ghost h-9 cursor-pointer px-4 text-[12.5px]">
          Attach X-ray, photo or report
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.dcm" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      <ul className="space-y-2">
        {files?.length === 0 && <li className="text-[13px] text-ink-4">No attachments.</li>}
        {files?.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-[13px]">
            <span className="flex-1 text-ink-2">{f.title}</span>
            <span className="text-ink-4">{when(f.created_at)}</span>
            <a href={`/api/clinic/${clinicId}/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost h-8 px-3 text-[12px]">
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
