"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Chips, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { OtpStep, useRun } from "@/components/auth/AuthForms";
import { Notice } from "@/components/Page";
import { fmtPhone, type Me } from "@/lib/fmd";
import { useRequireMe } from "@/lib/me";
import {
  buildExport,
  cancelDeletion,
  CHANNELS,
  getConsents,
  getDeletion,
  getExport,
  getPrefs,
  KINDS,
  PURPOSES,
  REASONS,
  requestDeletion,
  requestExport,
  savePrefs,
  setConsent,
  type Channel,
  type CommPrefs,
  type Consent,
  type DeletionRequest,
  type ExportJob,
  type Kind,
} from "@/sample/privacy";
import { Section } from "./Dentist";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const ALL = Object.keys(CHANNELS) as Channel[];

/** /account/privacy: consents, which messages you get, download your data, delete your account. */
export function PrivacyPage() {
  const me = useRequireMe();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const userId = me?.id;
  const signedUp = me?.created_at;
  useEffect(() => {
    if (userId && signedUp) getConsents(userId, signedUp).then(setConsents);
  }, [userId, signedUp]);
  if (!me || !consents) return <div className="app-panel h-40 animate-pulse" aria-busy />;
  const marketing = consents.find((c) => c.purpose === "marketing")!.granted;

  return (
    <div className="grid gap-5">
      <Link href="/account" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Account
      </Link>
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
          Privacy and data <Tag tone="muted">Demo · saved in this browser</Tag>
        </h1>
        <p className="mt-1 max-w-[680px] text-[14.5px] text-ink-3">
          Choose what FMD may use your information for and how we contact you. You can also get a copy of your data or delete your account.
        </p>
      </div>
      <Consents me={me} consents={consents} onChange={setConsents} />
      {/* remounts when marketing changes: withdrawing it switches offers off */}
      <Messages key={String(marketing)} me={me} marketing={marketing} />
      <DataExport me={me} />
      <DeleteAccount me={me} />
    </div>
  );
}

/* ---------------- consents ---------------- */

function Consents({ me, consents, onChange }: { me: Me; consents: Consent[]; onChange: (c: Consent[]) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const toggle = async (c: Consent) => {
    setErr(null);
    try {
      await setConsent(me.id, c.purpose, !c.granted);
      onChange(await getConsents(me.id, me.created_at));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Section title="Consents" text="What you've agreed FMD may use your information for. Each one is separate, and changing one doesn't change the others.">
      {err && <Notice kind="error">{err}</Notice>}
      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-line">
        {consents.map((c) => {
          const p = PURPOSES[c.purpose];
          return (
            <li key={c.purpose} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1 basis-[260px]">
                <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium text-ink">
                  {p.label}
                  {p.required ? <Tag tone="muted">Required</Tag> : <Tag tone={c.granted ? "ok" : "muted"}>{c.granted ? "On" : "Off"}</Tag>}
                </p>
                <p className="text-[13.5px] text-ink-3">
                  {p.text}
                  {p.required && " Needed to use FMD; to withdraw it, delete your account."}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-3">
                  {c.at ? `${c.granted ? "Given" : "Withdrawn"} ${day(c.at)} · notice version ${c.version}` : "Not given"}
                </p>
              </div>
              {!p.required && (
                <Button size="sm" variant={c.granted ? "secondary" : "primary"} onClick={() => toggle(c)} aria-label={`${c.granted ? "Withdraw" : "Give"}: ${p.label}`}>
                  {c.granted ? "Withdraw" : "Give consent"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-ink-3">
        What each one means is set out in the{" "}
        <Link href="/privacy" className="font-medium text-ink underline underline-offset-4">
          Privacy Notice
        </Link>
        .
      </p>
    </Section>
  );
}

/* ---------------- messages ---------------- */

/** without a verified email, no email messages except security alerts (they go to any email on the account) */
const withoutEmail = (p: CommPrefs): CommPrefs => ({
  ...p,
  matrix: Object.fromEntries(Object.entries(p.matrix).map(([k, row]) => [k, k === "security" ? row : { ...row, email: false }])) as CommPrefs["matrix"],
});

function Messages({ me, marketing }: { me: Me; marketing: boolean }) {
  const emailOk = me.email_verified;
  const [p, setP] = useState<CommPrefs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    getPrefs(me.id).then((x) => setP(emailOk ? x : withoutEmail(x)));
  }, [me.id, emailOk]);
  if (!p) return <div className="app-panel h-40 animate-pulse" aria-busy />;

  const edit = (next: CommPrefs) => (setSaved(false), setErr(null), setP(next));
  const setRow = (k: Kind, on: string[]) => edit({ ...p, matrix: { ...p.matrix, [k]: Object.fromEntries(ALL.map((c) => [c, on.includes(c)])) } });
  const off = (k: Kind): Channel[] => (k === "security" ? ALL : k === "offers" && !marketing ? ALL : emailOk ? [] : ["email"]);
  const save = async () => {
    try {
      setP(await savePrefs(me.id, p, { marketing, emailVerified: emailOk }));
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Section title="Messages from FMD" text="Choose how we reach you for each kind of message. App notifications work once the FMD app is out.">
      {!emailOk && (
        <p className="text-[13.5px] text-ink-3">
          To get email messages,{" "}
          <Link href="/account" className="font-medium text-ink underline underline-offset-4">
            add and verify an email
          </Link>{" "}
          first.
        </p>
      )}
      <div className="grid gap-5">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <div key={k} className="grid gap-1.5">
            <Chips label={KINDS[k].label} options={ALL} labels={CHANNELS} value={ALL.filter((c) => p.matrix[k][c])} onChange={(v) => setRow(k, v)} disabled={off(k)} />
            <p className="text-[13px] text-ink-3">{KINDS[k].text}</p>
          </div>
        ))}
      </div>
      <fieldset className="grid gap-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-[13.5px] text-ink-3">Quiet hours</legend>
        <label className="flex items-center gap-2.5 text-[14px] text-ink">
          <input type="checkbox" checked={p.quiet.on} onChange={(e) => edit({ ...p, quiet: { ...p.quiet, on: e.target.checked } })} className="size-4 accent-[var(--accent)]" />
          No reminders or offers at night
        </label>
        {p.quiet.on && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-[360px]">
            <Field label="From">
              <input type="time" className={fieldCls} value={p.quiet.from} onChange={(e) => edit({ ...p, quiet: { ...p.quiet, from: e.target.value } })} />
            </Field>
            <Field label="To">
              <input type="time" className={fieldCls} value={p.quiet.to} onChange={(e) => edit({ ...p, quiet: { ...p.quiet, to: e.target.value } })} />
            </Field>
          </div>
        )}
        <p className="text-[13px] text-ink-3">Appointment changes and security alerts still come through.</p>
      </fieldset>
      {err && <Notice kind="error">{err}</Notice>}
      {saved && <Notice kind="success">Message preferences saved.</Notice>}
      <div>
        <Button onClick={save}>Save message preferences</Button>
      </div>
    </Section>
  );
}

/* ---------------- download my data ---------------- */

function DataExport({ me }: { me: Me }) {
  const [job, setJob] = useState<ExportJob | null | undefined>(undefined);
  const [asked, setAsked] = useState(0); // bumps after a new request, to start checking again
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const check = () =>
      getExport(me.id).then((j) => {
        setJob(j);
        if (j?.status === "preparing") t = setTimeout(check, 1500);
      });
    check();
    return () => clearTimeout(t);
  }, [me.id, asked]);

  const prepare = async () => {
    await requestExport(me.id);
    setAsked((n) => n + 1);
  };
  const download = async () => {
    const blob = new Blob([JSON.stringify(await buildExport(me), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fmd-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Section title="Download your data" text="A copy of the information your FMD account holds, in a file you can keep (JSON). We prepare it, then the download link works for 7 days.">
      {job === undefined ? (
        <div className="h-11 animate-pulse rounded-2xl bg-[var(--surface-glass)]" aria-busy />
      ) : job === null ? (
        <div>
          <Button onClick={prepare}>Prepare my data</Button>
        </div>
      ) : job.status === "preparing" ? (
        <p role="status" className="flex items-center gap-2 text-[14px] text-ink-2">
          <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} /> Preparing your file. We&apos;ll also text you when it&apos;s ready.
        </p>
      ) : (
        <>
          <p role="status" className="text-[14px] text-ink-2">
            Your file is ready. The link works until {day(job.expires_at!)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>Download my data</Button>
            <Button variant="secondary" onClick={prepare}>
              Prepare a new copy
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}

/* ---------------- delete my account ---------------- */

function DeleteAccount({ me }: { me: Me }) {
  const [req, setReq] = useState<DeletionRequest | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    getDeletion(me.id).then(setReq);
  }, [me.id]);
  if (req === undefined) return null;

  return (
    <Section title="Delete your account" tag={req && <Tag tone="warn">Deletion requested</Tag>}>
      {note && <Notice kind="success">{note}</Notice>}
      {req ? (
        <>
          <p className="text-[14.5px] text-ink-2">
            You asked us to delete your account on {day(req.requested_at)}. We&apos;ll text you at {fmtPhone(me.phone)} when it&apos;s done. You can cancel until we start.
          </p>
          <div>
            <Button variant="secondary" onClick={() => cancelDeletion(me.id).then(() => (setReq(null), setNote("Your deletion request is cancelled. Your account stays as it is.")))}>
              Cancel deletion request
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[14.5px] text-ink-2">This deletes your FMD account and the information in it. We explain exactly what happens before you confirm.</p>
          <div>
            <Button variant="secondary" className="!text-[var(--tone-bad)]" onClick={() => (setNote(null), setOpen(true))}>
              Delete my account
            </Button>
          </div>
        </>
      )}
      {open && (
        <DeleteSheet
          me={me}
          onClose={() => setOpen(false)}
          onDone={(r) => {
            setReq(r);
            setOpen(false);
            setNote("We've received your request.");
          }}
        />
      )}
    </Section>
  );
}

const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

function DeleteSheet({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: (r: DeletionRequest) => void }) {
  const { busy, err, run } = useRun();
  const [step, setStep] = useState<"explain" | "code">("explain");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [code, setCode] = useState("");
  return (
    <Sheet title="Delete your account?" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        {step === "explain" ? (
          <>
            <div className="grid gap-3 text-[14px] text-ink-2">
              <div>
                <p className="font-medium text-ink">We delete</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>your profile, preferences and sign-ins</li>
                  <li>records you uploaded and anything you shared</li>
                  <li>your FMD AI conversations, posts and comments</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-ink">We keep, where the law requires it</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>payment invoices and receipts</li>
                  <li>a record that you asked for this deletion</li>
                </ul>
              </div>
              <p>Clinics you visited keep their own treatment records. Ask them directly about those.</p>
            </div>
            <Field label="Why are you leaving? (optional)">
              <select className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose a reason</option>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-start gap-2.5 text-[14px] text-ink">
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
              I understand my account and its data will be deleted, and this can&apos;t be undone once it&apos;s done.
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Keep my account
              </Button>
              <Button disabled={!sure} onClick={() => (setCode(newCode()), setStep("code"))}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <OtpStep
            to={fmtPhone(me.phone)}
            busy={busy}
            run={run}
            demoCode={code}
            onResend={async () => setCode(newCode())}
            onBack={() => setStep("explain")}
            onCode={(c) =>
              run(async () => {
                if (c !== code) throw new Error("That code is wrong. Check it and try again.");
                onDone(await requestDeletion(me.id, reason || null));
              })
            }
          />
        )}
      </div>
    </Sheet>
  );
}
