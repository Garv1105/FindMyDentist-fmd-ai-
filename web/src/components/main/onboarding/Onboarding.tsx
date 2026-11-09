"use client";

import { Building2, Check, GraduationCap, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/app/kit";
import { Field, fieldCls } from "@/components/app/Sheet";
import { AuthCard } from "@/components/auth/AuthForms";
import { Notice } from "@/components/Page";
import { CITIES } from "@/lib/catalog";
import { safeNext } from "@/lib/demo";
import type { Me } from "@/lib/fmd";
import { useRequireMe } from "@/lib/me";
import {
  ACCOUNT_TYPES,
  COURSES,
  getAccountType,
  getCompany,
  getPatientPrefs,
  getStudent,
  LANGS,
  saveCompany,
  savePatientPrefs,
  saveStudent,
  setAccountType,
  YEARS,
  type AccountType,
  type CompanyProfile,
  type StudentProfile,
} from "@/sample/onboarding";
import { track } from "@/lib/analytics";

const ICONS: Record<AccountType, LucideIcon> = { patient: UserRound, dentist: Stethoscope, student: GraduationCap, company: Building2 };
const isType = (v: string | null): v is AccountType => !!v && v in ACCOUNT_TYPES;
const submit = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault();
  fn();
};

/** /onboarding: right after sign-up (and from Account to change it). Asks only what each type of account needs. */
export function Onboarding() {
  const me = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const asked = params.get("as");
  const [type, setType] = useState<AccountType | null>(isType(asked) ? asked : null);
  const [step, setStep] = useState<"type" | "details" | "done">("type");

  // someone changing their type starts from the current one
  const userId = me?.id;
  useEffect(() => {
    if (userId && !isType(asked)) getAccountType(userId).then((t) => t && setType(t));
  }, [userId, asked]);

  if (!me) return <div className="min-h-dvh" aria-busy />;

  const choose = async () => {
    if (!type) return;
    if (type === "dentist") {
      await setAccountType(me.id, "dentist");
      track("onboarding_completed", { account_type: "dentist" });
      router.push("/account/dentist"); // the registration form there is the dentist's next step
    } else setStep("details");
  };
  /** after the details (or skipping them): patients go straight on, paid types see what their membership means */
  const finish = async () => {
    await setAccountType(me.id, type!);
    track("onboarding_completed", { account_type: type });
    if (type === "patient") router.push(next);
    else setStep("done");
  };

  if (step === "type")
    return (
      <AuthCard wide title="What brings you to FMD?" text="Step 1 of 2 · You can change this later in your account.">
        <form onSubmit={submit(choose)} className="grid gap-5">
          <fieldset>
            <legend className="sr-only">Account type</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((t) => {
                const on = type === t;
                const Icon = ICONS[t];
                return (
                  <label
                    key={t}
                    className={`flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-4 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--accent)] ${
                      on ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--accent-soft)]" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <input type="radio" name="account-type" value={t} checked={on} onChange={() => setType(t)} className="sr-only" />
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5 text-[15.5px] font-medium text-ink">
                        <Icon className="size-[18px]" strokeWidth={1.5} />
                        {ACCOUNT_TYPES[t].label}
                      </span>
                      {on && <Check className="size-4 text-ink" strokeWidth={2} aria-hidden />}
                    </span>
                    <span className="text-[13.5px] font-medium text-ink-2">{ACCOUNT_TYPES[t].price}</span>
                    <span className="text-[13.5px] text-ink-3">{ACCOUNT_TYPES[t].blurb}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="text-[13px] text-ink-3">You can use FMD free while you decide. A paid membership starts only when you pay for it.</p>
          <Button type="submit" disabled={!type}>
            Continue
          </Button>
        </form>
      </AuthCard>
    );

  if (step === "details") {
    const back = () => setStep("type");
    if (type === "patient") return <PatientStep me={me} onBack={back} onDone={finish} />;
    if (type === "student") return <StudentStep me={me} onBack={back} onDone={finish} />;
    return <CompanyStep me={me} onBack={back} onDone={finish} />;
  }

  const t = ACCOUNT_TYPES[type!];
  return (
    <AuthCard title="You're all set" text={`Your account is set up as a ${t.label.toLowerCase()}.`}>
      <div className="grid gap-4">
        <p className="rounded-2xl border border-line px-4 py-3 text-[14px] text-ink-2">
          <span className="font-medium text-ink">
            {t.label} membership · {t.price}.
          </span>{" "}
          Until it&apos;s paid, your account works as a free account.
          {type === "student" && " FMD Scholar opens once your student ID is checked and your membership is active."}
          {type === "company" && " Your company page goes live once FMD verifies the company."}
        </p>
        <ButtonLink href={`/checkout/${type}`}>Pay for membership</ButtonLink>
        <ButtonLink href={next} variant="secondary">
          Go to FMD
        </ButtonLink>
        <ButtonLink href="/account" variant="secondary">
          Your account
        </ButtonLink>
      </div>
    </AuthCard>
  );
}

/** Step 2 frame: why we ask, the form, and Back / Skip / Continue. */
function Step({
  title,
  why,
  err,
  busy,
  onBack,
  onSkip,
  onSubmit,
  children,
}: {
  title: string;
  why: string;
  err: string | null;
  busy: boolean;
  onBack: () => void;
  onSkip?: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <AuthCard wide title={title} text={`Step 2 of 2 · ${why}`}>
      <form onSubmit={submit(onSubmit)} className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        {children}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          {onSkip && (
            <button type="button" onClick={onSkip} className="px-3 text-[14px] text-ink-3 hover:text-ink">
              Skip for now
            </button>
          )}
          <Button type="submit" disabled={busy} className="ml-auto">
            {busy ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

/** run a save, keep its error */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (fn: () => Promise<unknown>, then: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      then();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, save };
}

type StepProps = { me: Me; onBack: () => void; onDone: () => void };

function PatientStep({ me, onBack, onDone }: StepProps) {
  const { busy, err, save } = useSave();
  const [p, setP] = useState({ city: "", language: "en" });
  useEffect(() => {
    getPatientPrefs(me.id).then(setP);
  }, [me.id]);
  return (
    <Step
      title="A little about you"
      why="We use your city to suggest nearby dentists, and your language for FMD AI's replies. Change these any time."
      err={err}
      busy={busy}
      onBack={onBack}
      onSkip={onDone}
      onSubmit={() => save(() => savePatientPrefs(me.id, p), onDone)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your city (optional)">
          <input className={fieldCls} list="fmd-cities" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} autoComplete="address-level2" maxLength={80} />
        </Field>
        <Field label="Language for FMD AI">
          <select className={fieldCls} value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <datalist id="fmd-cities">
        {CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </Step>
  );
}

function StudentStep({ me, onBack, onDone }: StepProps) {
  const { busy, err, save } = useSave();
  const [s, setS] = useState<StudentProfile>({ college: "", course: "BDS", year: "1st year", id_doc: null });
  const [file, setFile] = useState<File | null>(null);
  const fileId = useId();
  useEffect(() => {
    getStudent(me.id).then((x) => x && setS(x));
  }, [me.id]);
  const doc = file ?? s.id_doc;
  return (
    <Step
      title="Your studies"
      why="Only to check you're a dental student, for the student price and FMD Scholar. Your ID is seen only by FMD's verification team."
      err={err}
      busy={busy}
      onBack={onBack}
      onSkip={onDone}
      onSubmit={() => save(() => saveStudent(me.id, s, file ?? undefined), onDone)}
    >
      <Field label="College">
        <input className={fieldCls} value={s.college} onChange={(e) => setS({ ...s, college: e.target.value })} maxLength={160} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course">
          <select className={fieldCls} value={s.course} onChange={(e) => setS({ ...s, course: e.target.value })}>
            {COURSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <select className={fieldCls} value={s.year} onChange={(e) => setS({ ...s, year: e.target.value })}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[13.5px] text-ink-3">Student ID card (PDF, JPG or PNG, up to 5 MB)</p>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={fileId}
            className="inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-[var(--button-secondary)] px-4 text-[13px] font-semibold text-ink hover:border-line-strong focus-within:border-[var(--accent)]"
          >
            {doc ? "Replace file" : "Upload ID"}
          </label>
          <input id={fileId} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {doc && <span className="break-all text-[13.5px] text-ink-2">{doc.name}</span>}
        </div>
      </div>
    </Step>
  );
}

function CompanyStep({ me, onBack, onDone }: StepProps) {
  const { busy, err, save } = useSave();
  const [c, setC] = useState<CompanyProfile>({ name: "", contact_name: me.full_name, gstin: null, website: null });
  useEffect(() => {
    getCompany(me.id).then((x) => x && setC(x));
  }, [me.id]);
  return (
    <Step
      title="Your company"
      why="Shown on your company page once FMD verifies the company. A GSTIN helps us verify you faster."
      err={err}
      busy={busy}
      onBack={onBack}
      onSkip={onDone}
      onSubmit={() => save(() => saveCompany(me.id, c), onDone)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name">
          <input className={fieldCls} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} autoComplete="organization" maxLength={160} required />
        </Field>
        <Field label="Contact person">
          <input className={fieldCls} value={c.contact_name} onChange={(e) => setC({ ...c, contact_name: e.target.value })} autoComplete="name" maxLength={120} required />
        </Field>
        <Field label="GSTIN (optional)">
          <input
            className={`${fieldCls} uppercase`}
            value={c.gstin ?? ""}
            onChange={(e) => setC({ ...c, gstin: e.target.value || null })}
            maxLength={15}
            placeholder="29ABCDE1234F1Z5"
            autoComplete="off"
          />
        </Field>
        <Field label="Website (optional)">
          <input className={fieldCls} type="url" value={c.website ?? ""} onChange={(e) => setC({ ...c, website: e.target.value || null })} placeholder="https://" autoComplete="url" />
        </Field>
      </div>
    </Step>
  );
}
