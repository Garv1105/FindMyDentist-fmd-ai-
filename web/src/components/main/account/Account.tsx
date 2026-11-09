"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { OtpStep, PasswordInput, useRun } from "@/components/auth/AuthForms";
import { Notice } from "@/components/Page";
import { account, deviceName, fmtPhone, initials, type Me, type Session } from "@/lib/fmd";
import { authChanged, logout, useRequireMe } from "@/lib/me";
import { ACCOUNT_TYPES, getAccountType, type AccountType } from "@/sample/onboarding";
import { STATUS } from "./Dentist";

/* ---------------- formatting ---------------- */

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const since = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
function ago(iso: string) {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return "just now";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}
const METHOD: Record<string, string> = { signup: "signed up", password: "password", otp: "OTP", mfa: "password and code" };

const submit = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault();
  fn();
};

/* ---------------- page ---------------- */

type Open = "email" | "email-verify" | "email-remove" | "mfa-on" | "mfa-off" | "logout-all" | null;

/** /account: who is signed in, their email, two-step verification and signed-in devices (FastAPI /me/*). */
export function Account() {
  const me = useRequireMe();
  const [open, setOpen] = useState<Open>(null);
  const [flash, setFlash] = useState<string | null>(null);
  if (!me) return <div className="app-panel h-40 animate-pulse" aria-busy />;

  const close = () => setOpen(null);
  const done = (msg: string) => {
    setOpen(null);
    setFlash(msg);
    authChanged();
  };
  const show = (o: Open) => (setFlash(null), setOpen(o));

  return (
    <div className="grid gap-5">
      <h1 className="text-[24px] font-medium text-ink">Account</h1>
      {flash && <Notice kind="success">{flash}</Notice>}

      <Panel className="flex items-center gap-4 p-5 sm:p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[17px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]">
          {initials(me.full_name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium text-ink">{me.full_name}</p>
          <p className="text-[14px] text-ink-3">{fmtPhone(me.phone)}</p>
          <p className="mt-0.5 text-[13px] text-ink-3">Member since {since(me.created_at)}</p>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <EmailCard me={me} show={show} />
        <Card
          title="Two-step verification"
          tag={me.mfa_enabled ? <Tag tone="ok">On</Tag> : <Tag tone="muted">Off</Tag>}
          text={
            me.mfa_enabled
              ? `Logging in with your password also needs a code we text to ${fmtPhone(me.phone)}.`
              : `Add a second step: when you log in with your password, we'll also text a code to ${fmtPhone(me.phone)}.`
          }
        >
          {me.mfa_enabled ? (
            <Button variant="secondary" size="sm" onClick={() => show("mfa-off")}>
              Turn off
            </Button>
          ) : (
            <Button size="sm" onClick={() => show("mfa-on")}>
              Turn on
            </Button>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AccountTypeCard me={me} />
        <DentistCard me={me} />
      </div>

      <Devices onSignOutAll={() => show("logout-all")} />

      <Card title="Membership" text="Your plan, renewal, usage, payments and receipts.">
        <ButtonLink href="/membership" size="sm" variant="secondary">
          Manage membership
        </ButtonLink>
      </Card>

      <Card title="Privacy and data" text="Your consents, which messages you get, a copy of your data, or deleting your account.">
        <ButtonLink href="/account/privacy" size="sm" variant="secondary">
          Manage privacy and data
        </ButtonLink>
      </Card>

      {(open === "email" || open === "email-verify") && <EmailSheet me={me} verifyOnly={open === "email-verify"} onDone={done} onClose={close} />}
      {open === "email-remove" && (
        <PasswordSheet
          title="Remove email"
          text={`You won't be able to log in with ${me.email} or get security alerts there.`}
          action="Remove email"
          onConfirm={(pw) => account.removeEmail(pw)}
          onDone={() => done("Email removed.")}
          onClose={close}
        />
      )}
      {open === "mfa-on" && <MfaOnSheet me={me} onDone={() => done("Two-step verification is on.")} onClose={close} />}
      {open === "mfa-off" && (
        <PasswordSheet
          title="Turn off two-step verification"
          text="Logging in with your password will no longer ask for a code."
          action="Turn off"
          onConfirm={(pw) => account.disableMfa(pw)}
          onDone={() => done("Two-step verification is off.")}
          onClose={close}
        />
      )}
      {open === "logout-all" && <LogoutAllSheet onClose={close} />}
    </div>
  );
}

function Card({ title, tag, text, children }: { title: string; tag?: ReactNode; text: ReactNode; children?: ReactNode }) {
  return (
    <Panel as="section" className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-medium text-ink">{title}</h2>
        {tag}
      </div>
      <div className="text-[14.5px] text-ink-2">{text}</div>
      {children && <div className="mt-auto flex flex-wrap gap-2 pt-1">{children}</div>}
    </Panel>
  );
}

function AccountTypeCard({ me }: { me: Me }) {
  const [type, setType] = useState<AccountType | null | undefined>(undefined);
  useEffect(() => {
    getAccountType(me.id).then(setType);
  }, [me.id]);
  if (type === undefined) return <div className="app-panel h-40 animate-pulse" aria-busy />;
  const t = type && ACCOUNT_TYPES[type];
  return (
    <Card
      title="Account type"
      tag={<Tag tone="muted">Demo</Tag>}
      text={
        t
          ? `${t.label} · ${t.price}${t.yearly ? ". Works as a free account until the membership is paid." : ""}`
          : "Tell us how you use FMD, so we show you the right things."
      }
    >
      <ButtonLink href="/onboarding?next=%2Faccount" size="sm" variant={t ? "secondary" : "primary"}>
        {t ? "Change" : "Choose account type"}
      </ButtonLink>
    </Card>
  );
}

function DentistCard({ me }: { me: Me }) {
  const p = me.dentist_profile;
  return (
    <Card
      title="Dentist profile"
      tag={p && <Tag tone={STATUS[p.verification_status].tone}>{STATUS[p.verification_status].tag}</Tag>}
      text={p ? `${p.council} · Registration no. ${p.registration_no}` : "Are you a dentist? Add your registration so patients can find you on FMD."}
    >
      <ButtonLink href="/account/dentist" size="sm" variant={p ? "secondary" : "primary"}>
        {p ? "Edit dentist profile" : "Set up dentist profile"}
      </ButtonLink>
    </Card>
  );
}

/* ---------------- email ---------------- */

function EmailCard({ me, show }: { me: Me; show: (o: Open) => void }) {
  if (!me.email)
    return (
      <Card title="Email" tag={<Tag tone="muted">Not added</Tag>} text="Add an email to log in with it and to get security alerts.">
        <Button size="sm" onClick={() => show("email")}>
          Add email
        </Button>
      </Card>
    );
  const remove = (
    <Button variant="secondary" size="sm" onClick={() => show("email-remove")}>
      Remove
    </Button>
  );
  if (!me.email_verified)
    return (
      <Card
        title="Email"
        tag={<Tag tone="warn">Not verified</Tag>}
        text={
          <>
            <span className="break-all font-medium text-ink">{me.email}</span>
            <br />
            Verify it before you can log in with it.
          </>
        }
      >
        <Button size="sm" onClick={() => show("email-verify")}>
          Verify
        </Button>
        {remove}
      </Card>
    );
  return (
    <Card
      title="Email"
      tag={<Tag tone="ok">Verified</Tag>}
      text={
        <>
          <span className="break-all font-medium text-ink">{me.email}</span>
          <br />
          You can log in with it, and we send security alerts here.
        </>
      }
    >
      <Button variant="secondary" size="sm" onClick={() => show("email")}>
        Change
      </Button>
      {remove}
    </Card>
  );
}

/** Add, change or verify the email: send a code to it, then enter the code. Changing a verified email needs the password. */
function EmailSheet({ me, verifyOnly, onDone, onClose }: { me: Me; verifyOnly: boolean; onDone: (msg: string) => void; onClose: () => void }) {
  const changing = me.email_verified && !verifyOnly;
  const { busy, err, run } = useRun();
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState(verifyOnly ? (me.email ?? "") : "");
  const [password, setPassword] = useState("");
  const send = () => account.addEmail(email.trim(), changing ? password : undefined);

  return (
    <Sheet title={verifyOnly ? "Verify your email" : changing ? "Change email" : "Add email"} onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        {step === "form" ? (
          <form
            onSubmit={submit(() =>
              run(async () => {
                await send();
                authChanged(); // the backend has saved the new address as unverified
                setStep("code");
              }),
            )}
            className="grid gap-4"
          >
            {verifyOnly ? (
              <p className="text-[14.5px] text-ink-2">
                We&apos;ll send a 6-digit code to <span className="break-all font-medium text-ink">{email}</span>.
              </p>
            ) : (
              <Field label={changing ? "New email" : "Email"}>
                <input className={fieldCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={320} required />
              </Field>
            )}
            {changing && (
              <Field label="Current password" hint="Your current email is replaced as soon as we send the code.">
                <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
              </Field>
            )}
            <Button type="submit" disabled={busy || !email.trim() || (changing && !password)}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <OtpStep
            to={email.trim()}
            busy={busy}
            run={run}
            onResend={send}
            onBack={() => setStep("form")}
            onCode={(code) =>
              run(async () => {
                await account.verifyEmail(code);
                onDone("Email verified.");
              })
            }
          />
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- two-step verification ---------------- */

function MfaOnSheet({ me, onDone, onClose }: { me: Me; onDone: () => void; onClose: () => void }) {
  const { busy, err, run } = useRun();
  const [step, setStep] = useState<"intro" | "code">("intro");
  return (
    <Sheet title="Turn on two-step verification" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        {step === "intro" ? (
          <>
            <p className="text-[14.5px] text-ink-2">
              We&apos;ll text a code to <span className="font-medium text-ink">{fmtPhone(me.phone)}</span> to confirm it&apos;s yours. After that, logging in with
              your password will also ask for a code.
            </p>
            <Button disabled={busy} onClick={() => run(async () => (await account.startMfa(), setStep("code")))}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </>
        ) : (
          <OtpStep
            to={fmtPhone(me.phone)}
            busy={busy}
            run={run}
            onResend={account.startMfa}
            onBack={() => setStep("intro")}
            onCode={(code) => run(async () => (await account.enableMfa(code), onDone()))}
          />
        )}
      </div>
    </Sheet>
  );
}

/** A sensitive change confirmed with the current password. */
function PasswordSheet({
  title,
  text,
  action,
  onConfirm,
  onDone,
  onClose,
}: {
  title: string;
  text: string;
  action: string;
  onConfirm: (password: string) => Promise<void>;
  onDone: () => void;
  onClose: () => void;
}) {
  const { busy, err, run } = useRun();
  const [password, setPassword] = useState("");
  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit(() => run(async () => (await onConfirm(password), onDone())))} className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <p className="text-[14.5px] text-ink-2">{text}</p>
        <Field label="Current password">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !password}>
            {busy ? "Checking…" : action}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- devices ---------------- */

function Devices({ onSignOutAll }: { onSignOutAll: () => void }) {
  const [list, setList] = useState<Session[] | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      account.sessions().then(
        (s) => (setList(s), setErr(null)),
        (e: Error) => setErr(e.message),
      ),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await account.revokeSession(id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Where you're signed in" text="Sign out of any device you don't recognise.">
      <div className="grid w-full gap-4">
        {err && (
          <Notice kind="error">
            {err}{" "}
            <button type="button" onClick={load} className="font-medium underline underline-offset-4">
              Try again
            </button>
          </Notice>
        )}
        {list === undefined && !err ? (
          <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-glass)]" aria-busy />
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-line">
            {list?.map((s) => {
              const name = deviceName(s.user_agent);
              const Icon = /Android|iOS/.test(name) ? Smartphone : Monitor;
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Icon className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium text-ink">
                      {name}
                      {s.current && <Tag tone="accent">This device</Tag>}
                    </p>
                    <p className="text-[13px] text-ink-3">
                      {s.current ? "Active now" : `Active ${ago(s.last_seen_at)}`} · Signed in {day(s.created_at)} with {METHOD[s.auth_method] ?? s.auth_method}
                      {s.ip && ` · ${s.ip}`}
                    </p>
                  </div>
                  {!s.current && (
                    <Button variant="secondary" size="sm" disabled={busyId === s.id} onClick={() => revoke(s.id)} aria-label={`Sign out ${name}`}>
                      {busyId === s.id ? "Signing out…" : "Sign out"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onSignOutAll}>
        Sign out everywhere
      </Button>
    </Card>
  );
}

function LogoutAllSheet({ onClose }: { onClose: () => void }) {
  const { busy, err, run } = useRun();
  return (
    <Sheet title="Sign out everywhere?" onClose={onClose}>
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <p className="text-[14.5px] text-ink-2">This signs you out on every device, including this one. You&apos;ll need to log in again.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {/* once signed out, the page's sign-in guard takes over and opens /login */}
          <Button disabled={busy} onClick={() => run(() => logout(true))}>
            {busy ? "Signing out…" : "Sign out everywhere"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
