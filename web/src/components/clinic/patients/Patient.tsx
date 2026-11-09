"use client";

import { ArrowLeft, CalendarPlus, FileText, MessageCircle, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink, Empty, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { addNote, amendNote, getPatient, planTotal, type Note, type PatientDetail, type ToothState } from "@/sample/patients";
import { useClinic } from "../Shell";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const TABS = [
  ["timeline", "Timeline"],
  ["chart", "Chart & notes"],
  ["plans", "Treatment plans"],
  ["files", "Files"],
  ["billing", "Billing"],
] as const;
type Tab = (typeof TABS)[number][0];

/* ---------------- chart (FDI numbering) ---------------- */

const UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
const TOOTH: Record<ToothState, [cls: string, label: string]> = {
  filled: ["border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-ink", "Filling"],
  crown: ["border-[var(--tone-warn)] bg-[color-mix(in_srgb,var(--tone-warn)_18%,transparent)] text-ink", "Crown"],
  treatment: ["border-[var(--tone-bad)] bg-[color-mix(in_srgb,var(--tone-bad)_16%,transparent)] text-ink", "In treatment"],
  missing: ["border-dashed border-line-strong bg-transparent text-ink-3 opacity-50", "Missing"],
};

function Chart({ p }: { p: PatientDetail }) {
  const first = Object.keys(p.toothHistory)[0] ?? null;
  const [tooth, setTooth] = useState<string | null>(p.teeth["36"] ? "36" : first);
  const row = (teeth: string[]) => (
    <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-16">
      {teeth.map((t) => {
        const state = p.teeth[t];
        return (
          <button
            key={t}
            type="button"
            aria-pressed={tooth === t}
            aria-label={`Tooth ${t}${state ? `, ${TOOTH[state][1].toLowerCase()}` : ""}`}
            onClick={() => setTooth(t)}
            className={`grid aspect-[3/4] place-items-end justify-center rounded-[8px_8px_11px_11px] border pb-1 text-[12px] font-medium ${
              state ? TOOTH[state][0] : "border-line-strong bg-[var(--surface-glass)] text-ink-3"
            } ${tooth === t ? "ring-2 ring-[var(--text-primary)]" : ""}`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
  const history = tooth ? (p.toothHistory[tooth] ?? []) : [];
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <h3 className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
        Chart <span className="text-[13px] font-normal text-ink-3">Tap a tooth for its history · FDI numbering</span>
      </h3>
      <p className="mb-1.5 text-[12.5px] uppercase tracking-[0.12em] text-ink-3">Upper</p>
      {row(UPPER)}
      <p className="mb-1.5 mt-3 text-[12.5px] uppercase tracking-[0.12em] text-ink-3">Lower</p>
      {row(LOWER)}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-3">
        {(Object.keys(TOOTH) as ToothState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <i className={`inline-block size-3 rounded-[4px] border ${TOOTH[s][0]}`} />
            {TOOTH[s][1]}
          </span>
        ))}
      </div>
      {tooth && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[15px] font-medium text-ink">Tooth {tooth} · history</p>
          {history.length === 0 ? (
            <p className="mt-1 text-[14px] text-ink-3">Nothing recorded for this tooth.</p>
          ) : (
            <ul className="mt-1">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-x-3 py-1.5 text-[14.5px] text-ink-2">
                  {h.what}
                  <span className="text-[13px] text-ink-3">
                    {h.date} · {h.by}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- notes ---------------- */

function NoteSheet({ title, amend, onClose, onSave }: { title: string; amend?: Note; onClose: () => void; onSave: (text: string, reason: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave(text, reason);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Sheet title={title} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        {amend && (
          <div className="rounded-2xl border border-line p-3.5 text-[14.5px] text-ink-2">
            <p className="mb-1 text-[13px] text-ink-3">
              Original · {amend.date} · {amend.by} · signed
            </p>
            {amend.text}
          </div>
        )}
        <Field label={amend ? "Amendment" : "Note"}>
          <textarea className={`${fieldCls} h-auto min-h-[120px] py-3 leading-relaxed`} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {amend && (
          <Field label="Reason for the amendment" hint="Kept with the record; the original note stays as it was">
            <input className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Measurement correction" />
          </Field>
        )}
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <p className="text-[13px] text-ink-3">{amend ? "Saving adds the amendment beneath the original, with your name and today's date." : "Saving signs the note as you. Signed notes can be amended but never edited."}</p>
        <div className="flex gap-2">
          <Button type="submit">{amend ? "Save amendment" : "Sign and save"}</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function Notes({ p, onAmend }: { p: PatientDetail; onAmend: (n: Note) => void }) {
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
        Clinical notes <span className="text-[13px] font-normal text-ink-3">Signed notes can&apos;t be edited, only amended</span>
      </h3>
      {p.notes.length === 0 ? (
        <Empty title="No notes yet" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {p.notes.map((n) => (
            <li key={n.id} className="rounded-2xl border border-line p-3.5">
              <p className="mb-1 flex flex-wrap justify-between gap-2 text-[13px] text-ink-3">
                <span>
                  {n.date} · {n.by} · signed
                </span>
                <button type="button" onClick={() => onAmend(n)} className="font-medium text-ink-2 hover:text-ink">
                  Amend
                </button>
              </p>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{n.text}</p>
              {n.amendments.map((a, i) => (
                <div key={i} className="mt-2.5 rounded-xl border border-dashed border-line-strong p-3 text-[14px] text-ink-2">
                  <p className="mb-0.5 flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-3">
                    <span>
                      Amendment · {a.date} · {a.by}
                    </span>
                    <span>Reason: {a.reason}</span>
                  </p>
                  {a.text}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- page ---------------- */

export function PatientPage() {
  const { clinic, base, user } = useClinic();
  const { patientId } = useParams<{ patientId: string }>();
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const tab = (TABS.some(([t]) => t === params.get("tab")) ? params.get("tab") : "timeline") as Tab;
  const setTab = (t: Tab) => {
    const q = new URLSearchParams(params);
    if (t === "timeline") q.delete("tab");
    else q.set("tab", t);
    router.replace(`${path}?${q}`, { scroll: false });
  };

  const [p, setP] = useState<PatientDetail | null | undefined>(undefined);
  const [sheet, setSheet] = useState<{ amend?: Note } | null>(null);
  const [toast, setToast] = useState("");
  const load = useCallback(() => getPatient(clinic.id, patientId).then(setP), [clinic.id, patientId]);
  useEffect(() => {
    load();
  }, [load]);
  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 3500);
  };

  if (p === undefined) return <Panel className="h-[480px] motion-safe:animate-pulse" />;
  if (p === null)
    return (
      <Panel className="mx-auto max-w-[460px] p-7 text-center">
        <h2 className="text-[20px] font-medium text-ink">Patient not found</h2>
        <p className="mt-2 text-[15px] text-ink-3">This link doesn&apos;t match a patient at {clinic.name}.</p>
        <ButtonLink href={`${base}/patients`} variant="secondary" className="mt-5">
          Back to patients
        </ButtonLink>
      </Panel>
    );

  const plan = p.plans[0];
  const paid = p.payments.reduce((n, x) => n + x.amountInr, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href={`${base}/patients`} className="mr-auto inline-flex items-center gap-1.5 text-[14.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          All patients
        </Link>
        <Button variant="secondary" size="sm" onClick={() => say("Messaging patients arrives in a later release.")}>
          <MessageCircle className="size-4" strokeWidth={1.75} />
          Message
        </Button>
        <ButtonLink variant="secondary" size="sm" href={`${base}/calendar?book=${encodeURIComponent(p.name)}`}>
          <CalendarPlus className="size-4" strokeWidth={1.75} />
          Book
        </ButtonLink>
        <Button size="sm" onClick={() => setSheet({})}>
          <NotebookPen className="size-4" strokeWidth={1.75} />
          Add note
        </Button>
      </div>

      {toast && (
        <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
          {toast}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel as="section" className="self-start p-5">
          <div className="mb-4 flex items-center gap-3.5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[17px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]">{p.initials}</span>
            <span className="min-w-0">
              <span className="block text-[19px] font-medium text-ink">{p.name}</span>
              <span className="block text-[13.5px] text-ink-3">
                {p.pid} · since {p.since}
              </span>
            </span>
          </div>
          <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[14.5px]">
            {(
              [
                ["Age · sex", `${p.age} · ${p.sex === "F" ? "Female" : "Male"}`],
                ["Phone", p.phone],
                ["Email", p.email],
                ["Guardian", p.guardian],
                ["Language", p.language],
                ["Address", p.address],
                ["Referred by", p.referredBy],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="break-words text-ink">{v}</dd>
                </div>
              ))}
          </dl>
          {p.alerts.length > 0 && (
            <div role="note" className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--tone-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-bad)_8%,transparent)] p-3.5 text-[14.5px] text-ink">
              <p className="mb-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[var(--tone-bad)]">Medical alerts</p>
              {p.alerts.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          )}
          <p className="mb-2 mt-5 text-[15px] font-medium text-ink">Consent</p>
          <div className="flex flex-wrap gap-1.5">
            {p.consents.map((c) => (
              <Tag key={c.label} tone={c.ok ? "ok" : "muted"}>
                {c.label}
                {c.ok ? "" : ": no"}
              </Tag>
            ))}
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
            <div role="tablist" aria-label="Patient record" className="flex w-max gap-1 rounded-full border border-line-strong p-1">
              {TABS.map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] ${tab === t ? "bg-[var(--button-primary)] font-semibold text-[var(--button-primary-fg)]" : "text-ink-2 hover:text-ink"}`}
                >
                  {label}
                  {t === "files" && p.files.length > 0 ? ` ${p.files.length}` : ""}
                </button>
              ))}
            </div>
          </div>

          {tab === "timeline" && (
            <Panel as="section" className="p-5">
              {p.timeline.length === 0 ? (
                <Empty title="Nothing recorded yet" />
              ) : (
                <ol className="relative border-l-2 border-line-strong pl-5">
                  {p.timeline.map((e, i) => (
                    <li key={i} className="relative pb-5 last:pb-0">
                      <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-[var(--surface-elevated)] ring-2 ring-[var(--accent)]" aria-hidden />
                      <p className="text-[13px] text-ink-3">{e.date}</p>
                      <p className="text-[15.5px] font-medium text-ink">{e.title}</p>
                      <p className="text-[14.5px] text-ink-2">{e.detail}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}

          {tab === "chart" && (
            <>
              <Chart p={p} />
              <Notes p={p} onAmend={(n) => setSheet({ amend: n })} />
            </>
          )}

          {tab === "plans" && (
            <Panel as="section" className="p-5">
              {!plan ? (
                <Empty title="No treatment plans" />
              ) : (
                <>
                  <h3 className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
                    Treatment plan · {plan.status} {plan.date}
                    <span className="text-[13px] font-normal text-ink-3">Version {plan.version}</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[14.5px]">
                      <thead>
                        <tr className="border-b border-line text-[13px] text-ink-3">
                          <th className="py-2 pr-3 font-medium">Procedure</th>
                          <th className="py-2 pr-3 font-medium">Tooth</th>
                          <th className="py-2 pr-3 font-medium">Qty</th>
                          <th className="py-2 text-right font-medium">Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.lines.map((l) => (
                          <tr key={l.what} className="border-b border-line text-ink">
                            <td className="py-2.5 pr-3">{l.what}</td>
                            <td className="py-2.5 pr-3">{l.tooth ?? "—"}</td>
                            <td className="py-2.5 pr-3">{l.qty}</td>
                            <td className="py-2.5 text-right">{inr(l.qty * l.feeInr)}</td>
                          </tr>
                        ))}
                        {plan.discountInr > 0 && (
                          <tr className="border-b border-line text-ink-3">
                            <td className="py-2.5 pr-3" colSpan={3}>
                              Discount{plan.discountNote ? ` (${plan.discountNote.toLowerCase()})` : ""}
                            </td>
                            <td className="py-2.5 text-right">−{inr(plan.discountInr)}</td>
                          </tr>
                        )}
                        <tr className="font-semibold text-ink">
                          <td className="py-2.5 pr-3" colSpan={3}>
                            Total
                          </td>
                          <td className="py-2.5 text-right">{inr(planTotal(plan))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[13.5px] text-ink-3">
                    {plan.signedBy ? `Signed by ${plan.signedBy} on ${plan.date}` : "Not signed yet"} · an estimate, not a final bill
                  </p>
                </>
              )}
            </Panel>
          )}

          {tab === "files" && (
            <Panel as="section" className="p-5">
              {p.files.length === 0 ? (
                <Empty title="No files yet" hint="X-rays, photos and signed forms appear here." />
              ) : (
                <ul>
                  {p.files.map((f) => (
                    <li key={f.name} className="flex items-center gap-3 border-t border-line py-3 first:border-0">
                      <FileText className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
                      <span className="min-w-0 flex-1 text-[15px] text-ink">{f.name}</span>
                      <Tag tone="muted">{f.kind}</Tag>
                      <span className="w-16 text-right text-[13px] text-ink-3">{f.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {tab === "billing" && (
            <Panel as="section" className="p-5">
              <p className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-medium text-ink">
                Bills <span className="text-[13.5px] font-normal text-ink-3">Every bill is paid in full · {inr(paid)} in total</span>
              </p>
              {p.payments.length === 0 ? (
                <Empty title="No bills yet" />
              ) : (
                <ul>
                  {p.payments.map((x) => (
                    <li key={x.ref} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3 text-[15px] first:border-0">
                      <span className="text-ink">
                        {inr(x.amountInr)} · {x.mode} <Tag tone="ok">Paid</Tag>
                      </span>
                      <span className="text-[13.5px] text-ink-3">
                        {x.date} · {x.ref}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>

      {sheet && (
        <NoteSheet
          title={sheet.amend ? "Amend note" : `New note · ${p.name}`}
          amend={sheet.amend}
          onClose={() => setSheet(null)}
          onSave={async (text, reason) => {
            if (sheet.amend) await amendNote(clinic.id, p.id, sheet.amend.id, { text, reason, by: user.name });
            else await addNote(clinic.id, p.id, { text, by: user.name });
            setSheet(null);
            await load();
            if (tab !== "chart") setTab("chart");
            say(sheet.amend ? "Amendment saved; the original note is unchanged." : "Note signed and saved (demo).");
          }}
        />
      )}
    </div>
  );
}
