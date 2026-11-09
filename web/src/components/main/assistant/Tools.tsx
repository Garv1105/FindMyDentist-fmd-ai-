"use client";

import { ArrowLeft, Download, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, Chips, IconButton, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { istDate, rupees } from "@/lib/format";
import type { Me } from "@/lib/fmd";
import { useRequireMe } from "@/lib/me";
import {
  addReminder,
  budgetCsv,
  CLAIM_CHECKLIST,
  CONDITIONS,
  deleteHistory,
  deleteReminder,
  EMPTY_HISTORY,
  getBudget,
  getChecklist,
  getHistory,
  listReminders,
  newLine,
  newTreatment,
  POLICY_TERMS,
  saveBudget,
  saveChecklist,
  saveHistory,
  summarise,
  TEMPLATES,
  totals,
  updateReminder,
  type Budget,
  type DentalHistory,
  type Reminder,
  type ReportSummary,
} from "@/sample/companion";
import { listJourneys, type Journey } from "@/sample/journeys";

const download = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

function Frame({ title, intro, label, children }: { title: string; intro: string; label: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[860px] gap-5">
      <Link href="/assistant" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> FMD AI
      </Link>
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
          {title} <Tag tone="muted">Demo · saved in this browser</Tag>
        </h1>
        <p className="mt-1 text-[14.5px] text-ink-3">{intro}</p>
      </div>
      <p className="w-fit rounded-full border border-[color-mix(in_srgb,var(--tone-warn)_45%,transparent)] px-3.5 py-1.5 text-[13.5px] font-medium text-ink">{label}</p>
      {children}
    </div>
  );
}

/** /assistant/tools/[tool] */
export function ToolPage() {
  const { tool } = useParams<{ tool: string }>();
  const me = useRequireMe();
  if (!me) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  if (tool === "budget") return <BudgetTool me={me} />;
  if (tool === "insurance") return <InsuranceTool me={me} />;
  if (tool === "reminders") return <RemindersTool me={me} />;
  if (tool === "history") return <HistoryTool me={me} />;
  return (
    <Panel className="grid justify-items-start gap-3 p-6">
      <h1 className="text-[19px] font-medium text-ink">That tool doesn&apos;t exist</h1>
      <ButtonLink href="/assistant" variant="secondary">
        FMD AI
      </ButtonLink>
    </Panel>
  );
}

/* ---------------- treatment budget ---------------- */

function BudgetTool({ me }: { me: Me }) {
  const [b, setB] = useState<Budget | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  useEffect(() => {
    getBudget(me.id).then(setB);
    listJourneys(me.id).then(setJourneys);
  }, [me.id]);
  if (!b) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const t = totals(b);
  const edit = (patch: Partial<Budget>) => (setMsg(null), setB({ ...b, ...patch }));
  const line = (id: string, patch: Partial<Budget["lines"][number]>) => edit({ lines: b.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const fromPlan = (j: Journey) => {
    const p = j.plans.at(-1)!;
    edit({ lines: p.items.map((x) => newLine(x.label, x.amount)), source: `Plan version ${p.version} from ${j.clinic.name}` });
  };
  const save = async () => {
    try {
      await saveBudget(me.id, b);
      setMsg({ kind: "success", text: "Budget saved." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  return (
    <Frame title="Treatment budget" intro="Add up what a treatment might cost, from your own figures or your clinic's estimate." label="Estimate, not a quote. Your dentist and insurer confirm the real amounts.">
      {journeys.some((j) => j.plans.length) && (
        <Panel className="flex flex-wrap items-center gap-2 p-4">
          <span className="text-[14px] text-ink-2">Start from your clinic&apos;s plan:</span>
          {journeys
            .filter((j) => j.status === "in_progress")
            .map((j) => (
              <Button key={j.id} variant="secondary" size="sm" onClick={() => fromPlan(j)}>
                {j.title.split(",")[0]}
              </Button>
            ))}
        </Panel>
      )}
      <Panel className="grid gap-3 p-5">
        {b.source && <p className="text-[13px] text-ink-3">From: {b.source}</p>}
        {b.lines.length === 0 && <p className="text-[14px] text-ink-3">No items yet.</p>}
        {b.lines.map((l) => (
          <div key={l.id} className="grid items-end gap-2 sm:grid-cols-[1fr_90px_140px_auto]">
            <Field label="Item">
              <input className={fieldCls} value={l.label} onChange={(e) => line(l.id, { label: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Qty">
              <input className={fieldCls} type="number" min={1} value={l.qty} onChange={(e) => line(l.id, { qty: Number(e.target.value) })} />
            </Field>
            <Field label="Each (₹)">
              <input className={fieldCls} type="number" min={0} value={l.amount} onChange={(e) => line(l.id, { amount: Number(e.target.value) })} />
            </Field>
            <IconButton label={`Remove ${l.label || "item"}`} onClick={() => edit({ lines: b.lines.filter((x) => x.id !== l.id) })}>
              <X className="size-4" strokeWidth={1.75} />
            </IconButton>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={() => edit({ lines: [...b.lines, newLine()] })}>
            <Plus className="size-4" strokeWidth={1.75} /> Add an item
          </Button>
        </div>
        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <Field label="Discount from the clinic (₹)">
            <input className={fieldCls} type="number" min={0} value={b.discount} onChange={(e) => edit({ discount: Number(e.target.value) })} />
          </Field>
          <Field label="Expected from insurance (₹)" hint="Only an amount your insurer has confirmed.">
            <input className={fieldCls} type="number" min={0} value={b.insurance} onChange={(e) => edit({ insurance: Number(e.target.value) })} />
          </Field>
        </div>
        <dl className="grid gap-1.5 border-t border-line pt-3 text-[14.5px]">
          {(
            [
              ["Subtotal", rupees(t.subtotal)],
              ["Discount", `− ${rupees(t.discount)}`],
              ["Expected from insurance", `− ${rupees(t.insurance)}`],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2 text-[16px] font-medium">
            <dt className="text-ink">You may pay (estimate)</dt>
            <dd className="text-ink">{rupees(t.you)}</dd>
          </div>
        </dl>
      </Panel>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save}>Save budget</Button>
        <Button variant="secondary" onClick={() => download(new Blob([budgetCsv(b)], { type: "text/csv" }), `fmd-budget-${istDate(Date.now())}.csv`)}>
          <Download className="size-4" strokeWidth={1.75} /> Download (CSV)
        </Button>
      </div>
    </Frame>
  );
}

/* ---------------- insurance explainer ---------------- */

function InsuranceTool({ me }: { me: Me }) {
  const [ticks, setTicks] = useState<boolean[] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  useEffect(() => {
    getChecklist(me.id).then(setTicks);
  }, [me.id]);
  if (!ticks) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const tick = (i: number, v: boolean) => {
    const next = ticks.map((x, j) => (j === i ? v : x));
    setTicks(next);
    saveChecklist(me.id, next);
  };
  return (
    <Frame title="Insurance explainer" intro="Understand the words in a dental policy, and get your claim papers together." label="We can't confirm cover or approval. Your insurer decides.">
      <Panel className="grid gap-3 p-5">
        <h2 className="text-[16px] font-medium text-ink">Your policy or claim document</h2>
        <label className="w-fit cursor-pointer rounded-full border border-line px-4 py-2 text-[13.5px] font-semibold text-ink hover:border-line-strong has-[input:focus-visible]:border-[var(--accent)]">
          {file ? "Choose another file" : "Choose a file"}
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
        </label>
        {file && (
          <Notice kind="info">
            “{file}” stays on your device. In this demo FMD AI can&apos;t read it yet; the live version will summarise what your policy says about dental care, quoting the document.
          </Notice>
        )}
      </Panel>
      <Panel className="grid gap-3 p-5">
        <h2 className="text-[16px] font-medium text-ink">Words you&apos;ll see in a policy</h2>
        <dl className="grid gap-2.5 text-[14px]">
          {POLICY_TERMS.map(([k, v]) => (
            <div key={k}>
              <dt className="font-medium text-ink">{k}</dt>
              <dd className="text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel className="grid gap-3 p-5">
        <h2 className="text-[16px] font-medium text-ink">What a claim usually needs</h2>
        <p className="text-[13.5px] text-ink-3">General guidance. Your insurer&apos;s own list always wins. Ticks are saved for you.</p>
        <ul className="grid gap-2">
          {CLAIM_CHECKLIST.map((c, i) => (
            <li key={c}>
              <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px] text-ink">
                <input type="checkbox" checked={ticks[i]} onChange={(e) => tick(i, e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
                {c}
              </label>
            </li>
          ))}
        </ul>
        <p className="text-[13.5px] text-ink-2">
          {ticks.filter(Boolean).length} of {CLAIM_CHECKLIST.length} ready.{" "}
          <Link href="/records" className="font-medium text-ink underline underline-offset-4">
            Your invoices and reports are in Records.
          </Link>
        </p>
      </Panel>
    </Frame>
  );
}

/* ---------------- reminders ---------------- */

const repeatText = (r: Reminder) => (r.every === "day" ? `Every day at ${r.time}` : r.every === "days" ? `Every ${r.days} days at ${r.time}` : `On ${r.date} at ${r.time}`);

function RemindersTool({ me }: { me: Me }) {
  const [list, setList] = useState<Reminder[] | null>(null);
  const [today] = useState(() => istDate(Date.now()));
  const [f, setF] = useState<Omit<Reminder, "id" | "on">>({ title: "", every: "day", days: 14, time: "21:30", date: null });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    listReminders(me.id).then(setList);
  }, [me.id]);
  if (!list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const add = async (r: Omit<Reminder, "id" | "on">) => {
    setErr(null);
    try {
      setList(await addReminder(me.id, r, today));
      setF({ title: "", every: "day", days: 14, time: "21:30", date: null });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Frame
      title="Reminders"
      intro="Small nudges for your daily care and next visits. They arrive as notifications once the FMD app is out."
      label="Reminders you set yourself. FMD doesn't watch your health or check whether you did them."
    >
      <Panel className="grid gap-3 p-5">
        <h2 className="text-[16px] font-medium text-ink">Your reminders</h2>
        {list.length === 0 ? (
          <p className="text-[14px] text-ink-3">None yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-line">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={r.on} onChange={(e) => updateReminder(me.id, r.id, { on: e.target.checked }).then(setList)} className="size-4 accent-[var(--accent)]" />
                  <span>
                    <span className={`block text-[14.5px] ${r.on ? "text-ink" : "text-ink-3 line-through"}`}>{r.title}</span>
                    <span className="block text-[13px] text-ink-3">
                      {repeatText(r)}
                      {r.on ? "" : " · paused"}
                    </span>
                  </span>
                </label>
                <IconButton label={`Delete reminder: ${r.title}`} className="size-9" onClick={() => deleteReminder(me.id, r.id).then(setList)}>
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel className="grid gap-3 p-5">
        <h2 className="text-[16px] font-medium text-ink">Add one</h2>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.filter((t) => t.every !== "once").map((t) => (
            <Button key={t.title} variant="secondary" size="sm" onClick={() => add(t)}>
              <Plus className="size-4" strokeWidth={1.75} /> {t.title}
            </Button>
          ))}
        </div>
        {err && <Notice kind="error">{err}</Notice>}
        <div className="grid gap-3 sm:grid-cols-[1fr_170px_120px]">
          <Field label="What to remind you">
            <input className={fieldCls} list="fmd-reminder-ideas" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Repeat">
            <select className={fieldCls} value={f.every} onChange={(e) => setF({ ...f, every: e.target.value as Reminder["every"], date: e.target.value === "once" ? today : null })}>
              <option value="day">Every day</option>
              <option value="days">Every few days</option>
              <option value="once">Once</option>
            </select>
          </Field>
          <Field label="Time">
            <input type="time" className={fieldCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
        </div>
        <datalist id="fmd-reminder-ideas">
          {TEMPLATES.map((t) => (
            <option key={t.title} value={t.title} />
          ))}
        </datalist>
        {f.every === "days" && (
          <Field label="Every how many days?">
            <input type="number" min={2} max={90} className={`${fieldCls} sm:max-w-[160px]`} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} />
          </Field>
        )}
        {f.every === "once" && (
          <Field label="Date">
            <input type="date" min={today} className={`${fieldCls} sm:max-w-[220px]`} value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        )}
        <div>
          <Button onClick={() => add(f)}>Add reminder</Button>
        </div>
      </Panel>
    </Frame>
  );
}

/* ---------------- dental history ---------------- */

function HistoryTool({ me }: { me: Me }) {
  const [h, setH] = useState<DentalHistory | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    getHistory(me.id).then(setH);
  }, [me.id]);
  if (h === undefined) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const frame = (children: ReactNode) => (
    <Frame title="My dental history" intro="Your past treatments, allergies and medicines in one place, ready for your next visit." label="Only you see this. You choose what to share with a clinic.">
      {children}
    </Frame>
  );
  if (h === null)
    return frame(
      <Panel className="grid justify-items-start gap-3 p-6">
        <p className="text-[14.5px] text-ink-2">
          This is health information, so FMD keeps it only if you choose to. You can change or delete it any time, and FMD AI uses it only to help you prepare for visits.
        </p>
        <Button onClick={() => setH(EMPTY_HISTORY)}>Start my dental history</Button>
      </Panel>,
    );
  const edit = (patch: Partial<DentalHistory>) => (setMsg(null), setH({ ...h, ...patch }));
  const tr = (id: string, patch: Partial<DentalHistory["treatments"][number]>) => edit({ treatments: h.treatments.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const save = async () => {
    try {
      await saveHistory(me.id, h);
      setMsg({ kind: "success", text: "Dental history saved." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  return frame(
    <>
      <Panel className="grid gap-3 p-5">
        <h2 className="text-[16px] font-medium text-ink">Past treatments</h2>
        {h.treatments.map((t) => (
          <div key={t.id} className="grid items-end gap-2 sm:grid-cols-[1fr_150px_1fr_auto]">
            <Field label="What">
              <input className={fieldCls} value={t.what} onChange={(e) => tr(t.id, { what: e.target.value })} maxLength={120} placeholder="e.g. Filling" />
            </Field>
            <Field label="When">
              <input className={fieldCls} value={t.when} onChange={(e) => tr(t.id, { when: e.target.value })} maxLength={30} placeholder="e.g. 2024" />
            </Field>
            <Field label="Where">
              <input className={fieldCls} value={t.where} onChange={(e) => tr(t.id, { where: e.target.value })} maxLength={120} />
            </Field>
            <IconButton label={`Remove ${t.what || "treatment"}`} onClick={() => edit({ treatments: h.treatments.filter((x) => x.id !== t.id) })}>
              <X className="size-4" strokeWidth={1.75} />
            </IconButton>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={() => edit({ treatments: [...h.treatments, newTreatment()] })}>
            <Plus className="size-4" strokeWidth={1.75} /> Add a treatment
          </Button>
        </div>
      </Panel>
      <Panel className="grid gap-4 p-5">
        <Field label="Allergies" hint="Medicines, latex, anaesthetics, foods.">
          <textarea className={`${fieldCls} h-20 resize-y py-2.5`} value={h.allergies} onChange={(e) => edit({ allergies: e.target.value })} maxLength={500} />
        </Field>
        <Field label="Medicines you take" hint="Include blood thinners and supplements.">
          <textarea className={`${fieldCls} h-20 resize-y py-2.5`} value={h.medicines} onChange={(e) => edit({ medicines: e.target.value })} maxLength={500} />
        </Field>
        <Chips label="Health conditions a dentist should know about" options={CONDITIONS} value={h.conditions} onChange={(conditions) => edit({ conditions })} />
        <Field label="Preferences" hint="e.g. nervous about injections, prefer morning visits, prefer a woman dentist.">
          <textarea className={`${fieldCls} h-20 resize-y py-2.5`} value={h.preferences} onChange={(e) => edit({ preferences: e.target.value })} maxLength={500} />
        </Field>
      </Panel>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save}>Save</Button>
        <Button variant="secondary" className="!text-[var(--tone-bad)]" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" strokeWidth={1.75} /> Delete my dental history
        </Button>
      </div>
      {confirm && (
        <Sheet title="Delete your dental history?" onClose={() => setConfirm(false)}>
          <div className="grid gap-4">
            <p className="text-[14.5px] text-ink-2">Everything on this page is deleted. Your records and appointments aren&apos;t affected.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button onClick={() => deleteHistory(me.id).then(() => (setH(null), setConfirm(false)))}>Delete</Button>
            </div>
          </div>
        </Sheet>
      )}
    </>,
  );
}

/* ---------------- report summary (on a record's page) ---------------- */

export function ReportSummaryPanel({ recordId }: { recordId: string }) {
  const [s, setS] = useState<ReportSummary | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const explain = async () => (setOpen(true), setS(await summarise(recordId)));
  return (
    <Panel className="grid gap-3 p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
        <Sparkles className="size-4" strokeWidth={1.75} /> Plain-language summary
      </h2>
      {!open ? (
        <>
          <p className="text-[13.5px] text-ink-3">FMD AI can explain this document in everyday words.</p>
          <div>
            <Button variant="secondary" size="sm" onClick={explain}>
              Explain this document
            </Button>
          </div>
        </>
      ) : s === undefined ? (
        <p className="text-[13.5px] text-ink-3">Reading…</p>
      ) : s === null ? (
        <p className="text-[13.5px] text-ink-2">In this demo FMD AI can only explain documents from the demo clinic. The live version will read your own uploads too.</p>
      ) : (
        <>
          <Tag tone="accent">AI summary · not a diagnosis</Tag>
          <ul className="grid list-disc gap-1.5 pl-5 text-[14px] text-ink">
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div>
            <p className="text-[13.5px] text-ink-3">Questions you could ask your dentist</p>
            <ul className="grid list-disc gap-1 pl-5 text-[14px] text-ink-2">
              {s.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <p className="text-[12.5px] text-ink-3">{s.limits} Discuss it with your treating dentist.</p>
        </>
      )}
    </Panel>
  );
}
