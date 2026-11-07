"use client";

import { BadgeCheck, Clock3, Monitor, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { inputCls, Notice } from "@/components/Page";
import { accountChanged, api, signOut, type DentistProfile, type Me } from "@/lib/me";
import { labelCls, OtpStep, PasswordField } from "./fields";

/*
 * Account security and the dentist profile, all held by the FastAPI service (/api/v1/me/*, /api/v1/auth/*). After a
 * change, accountChanged() brings this app's copy of the account up to date.
 */

function useAction() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return { error, setError, busy, run };
}

const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-2">{children}</div>;
const ghost = "btn-ghost h-9 px-4 text-[12.5px]";
const primary = "btn-primary h-10 px-5 text-[13px] disabled:opacity-50";

/* ---------------- email ---------------- */

/** Add, verify, change or remove the account email. A verified email can sign in and receive security alerts. */
export function EmailSettings({ me }: { me: Me }) {
  const email = me.email ?? me.pendingEmail;
  const [step, setStep] = useState<null | "add" | "verify" | "change" | "remove">(null);
  const [draft, setDraft] = useState<string | null>(null);
  const { error, setError, busy, run } = useAction();
  const close = () => {
    setStep(null);
    setDraft(null);
    setError("");
  };

  const submitEmail = (e: FormEvent<HTMLFormElement>, changing: boolean) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const addr = String(f.get("email")).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setError("Enter a valid email address.");
    void run(async () => {
      await api("/api/v1/me/email", { method: "POST", body: changing ? { email: addr, password: String(f.get("password")) } : { email: addr } });
      setDraft(addr);
      setStep("verify");
      await accountChanged();
    });
  };

  if (step === "verify" && (draft ?? email))
    return (
      <OtpStep
        sentTo={draft ?? email!}
        submitLabel="Verify email"
        backLabel="Cancel"
        onBack={close}
        onResend={() => api("/api/v1/me/email", { method: "POST", body: { email: draft ?? email } })}
        onVerify={async (code) => {
          await api("/api/v1/me/email/verify", { method: "POST", body: { code } });
          close();
          await accountChanged();
        }}
      />
    );

  if (step === "add" || step === "change")
    return (
      <form onSubmit={(e) => submitEmail(e, step === "change")} className="space-y-4">
        <div>
          <label htmlFor="new-email" className={labelCls}>
            {step === "change" ? "New email" : "Email"}
          </label>
          <input id="new-email" name="email" type="email" required autoComplete="email" className={`${inputCls} mt-2`} />
        </div>
        {step === "change" && <PasswordField label="Current password" id="password" required autoComplete="current-password" />}
        {error && <Notice kind="error">{error}</Notice>}
        <Row>
          <button disabled={busy} className={primary}>
            {busy ? "Sending code…" : "Send verification code"}
          </button>
          <button type="button" onClick={close} className={ghost}>
            Cancel
          </button>
        </Row>
      </form>
    );

  if (step === "remove")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const password = String(new FormData(e.currentTarget).get("password"));
          void run(async () => {
            await api("/api/v1/me/email", { method: "DELETE", body: { password } });
            close();
            await accountChanged();
          });
        }}
        className="space-y-4"
      >
        <p className="text-[13px] text-ink-3">You will no longer be able to sign in or get security alerts by email.</p>
        <PasswordField label="Current password" id="password" required autoComplete="current-password" />
        {error && <Notice kind="error">{error}</Notice>}
        <Row>
          <button disabled={busy} className={primary}>
            {busy ? "Removing…" : "Remove email"}
          </button>
          <button type="button" onClick={close} className={ghost}>
            Cancel
          </button>
        </Row>
      </form>
    );

  if (!email)
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-ink-3">Add an email to sign in with it, get security alerts and create a clinic.</p>
        <button onClick={() => setStep("add")} className={primary}>
          Add email
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
        {email}
        {me.emailVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-3">
            <BadgeCheck className="size-3" strokeWidth={1.75} /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-4">
            <Clock3 className="size-3" strokeWidth={1.5} /> Not verified
          </span>
        )}
      </p>
      <Row>
        {!me.emailVerified && (
          <button onClick={() => void run(async () => (await api("/api/v1/me/email", { method: "POST", body: { email } }), setStep("verify")))} className={primary}>
            Verify email
          </button>
        )}
        <button onClick={() => setStep(me.emailVerified ? "change" : "add")} className={ghost}>
          Change
        </button>
        {me.emailVerified && (
          <button onClick={() => setStep("remove")} className={ghost}>
            Remove
          </button>
        )}
      </Row>
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}

/* ---------------- two-step sign-in ---------------- */

/** SMS code after the password, on top of it. Turning it off needs the password. */
export function MfaSettings({ me }: { me: Me }) {
  const [step, setStep] = useState<null | "verify" | "off">(null);
  const { error, setError, busy, run } = useAction();
  const start = () => api("/api/v1/me/mfa/start", { method: "POST" });

  if (step === "verify")
    return (
      <OtpStep
        sentTo={me.phone ?? "your mobile number"}
        submitLabel="Turn on two-step sign-in"
        backLabel="Cancel"
        onBack={() => setStep(null)}
        onResend={start}
        onVerify={async (code) => {
          await api("/api/v1/me/mfa", { method: "POST", body: { code } });
          setStep(null);
          await accountChanged();
        }}
      />
    );

  if (step === "off")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const password = String(new FormData(e.currentTarget).get("password"));
          void run(async () => {
            await api("/api/v1/me/mfa", { method: "DELETE", body: { password } });
            setStep(null);
            await accountChanged();
          });
        }}
        className="space-y-4"
      >
        <PasswordField label="Current password" id="password" required autoComplete="current-password" />
        {error && <Notice kind="error">{error}</Notice>}
        <Row>
          <button disabled={busy} className={primary}>
            {busy ? "Turning off…" : "Turn off"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(null);
              setError("");
            }}
            className={ghost}
          >
            Cancel
          </button>
        </Row>
      </form>
    );

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-[13px] text-ink-3">
        {me.mfaEnabled ? <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" strokeWidth={1.5} /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />}
        {me.mfaEnabled
          ? "On. Signing in with your password also needs a code sent to your mobile."
          : "Off. Turn it on to also need a code sent to your mobile when you sign in with your password."}
      </p>
      {me.mfaEnabled ? (
        <button onClick={() => setStep("off")} className={ghost}>
          Turn off
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await start();
              setStep("verify");
            })
          }
          className={primary}
        >
          {busy ? "Sending code…" : "Turn on"}
        </button>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}

/* ---------------- devices ---------------- */

type ApiSession = { id: string; created_at: string; last_seen_at: string; auth_method: string; ip: string | null; user_agent: string | null; current: boolean };

/** "Chrome on Windows" from a user-agent string; good enough for recognising your own devices. */
function deviceLabel(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : ua.split("/")[0];
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function SessionsList({ onSignedOut }: { onSignedOut: () => void }) {
  const [list, setList] = useState<ApiSession[] | null>(null);
  const { error, busy, run } = useAction();
  const load = () => api<ApiSession[]>("/api/v1/me/sessions").then(setList);
  useEffect(() => {
    void run(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  return (
    <div>
      {!list && !error && <p className="text-[13px] text-ink-4">Loading…</p>}
      <ul className="space-y-3">
        {list?.map((s) => (
          <li key={s.id} className="flex items-center gap-3 text-[13px]">
            <Monitor className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink-2">{deviceLabel(s.user_agent)}</span>
              <span className="block text-[12px] text-ink-4">
                {s.current ? "This device · " : ""}last active {when(s.last_seen_at)}
                {s.ip ? ` · ${s.ip}` : ""}
              </span>
            </span>
            {!s.current && (
              <button onClick={() => void run(async () => (await api(`/api/v1/me/sessions/${s.id}`, { method: "DELETE" }), await load()))} className="btn-ghost h-8 px-3 text-[12px]">
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      {list && list.length > 1 && (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api("/api/v1/auth/logout-all", { method: "POST" });
              await signOut();
              onSignedOut();
            })
          }
          className="btn-ghost mt-4 h-9 px-4 text-[12.5px]"
        >
          Sign out everywhere
        </button>
      )}
      {error && (
        <div className="mt-3">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}

/* ---------------- dentist profile ---------------- */

const VERIFICATION: Record<DentistProfile["verification_status"], { label: string; icon: typeof BadgeCheck; text: string }> = {
  unverified: { label: "Not verified yet", icon: ShieldQuestion, text: "FMD checks your registration with the dental council before showing you as verified." },
  pending: { label: "Verification in progress", icon: Clock3, text: "We're checking your registration. This usually takes a few working days." },
  verified: { label: "Verified", icon: BadgeCheck, text: "Your registration has been checked." },
  rejected: { label: "Verification failed", icon: ShieldAlert, text: "We couldn't confirm these details. Check them and save again, or contact support." },
};

export function VerificationBadge({ status }: { status: DentistProfile["verification_status"] }) {
  const v = VERIFICATION[status];
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-ink-2">
      <v.icon className="size-3.5" strokeWidth={1.6} /> {v.label}
    </span>
  );
}

/** Council and registration number (required), qualifications and specialisation (optional). */
export function DentistProfileForm({ profile, onSaved, submitLabel = "Save profile" }: { profile: DentistProfile | null; onSaved?: () => void; submitLabel?: string }) {
  const { error, busy, run } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const val = (k: string) => String(f.get(k) ?? "").trim();
        setSaved(false);
        void run(async () => {
          await api("/api/v1/me/dentist-profile", {
            method: "PUT",
            body: { council: val("council"), registration_no: val("registration_no"), qualifications: val("qualifications") || null, specialisation: val("specialisation") || null },
          });
          await accountChanged();
          setSaved(true);
          onSaved?.();
        });
      }}
      className="space-y-4"
    >
      {profile && (
        <div className="space-y-1.5">
          <VerificationBadge status={profile.verification_status} />
          <p className="text-[12.5px] text-ink-4">{VERIFICATION[profile.verification_status].text}</p>
        </div>
      )}
      {(
        [
          ["council", "Dental council", "e.g. Karnataka State Dental Council", true, 100],
          ["registration_no", "Registration number", "As on your council certificate", true, 50],
          ["qualifications", "Qualifications", "e.g. BDS, MDS (optional)", false, 200],
          ["specialisation", "Specialisation", "e.g. Orthodontics (optional)", false, 100],
        ] as const
      ).map(([k, label, ph, req, max]) => (
        <div key={k}>
          <label htmlFor={`dp-${k}`} className={labelCls}>
            {label}
          </label>
          <input id={`dp-${k}`} name={k} required={req} maxLength={max} placeholder={ph} defaultValue={(profile?.[k] as string | null | undefined) ?? ""} className={`${inputCls} mt-2`} />
        </div>
      ))}
      {profile && <p className="text-[12px] text-ink-4">Changing the council or registration number restarts verification.</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {saved && <Notice kind="success">Saved.</Notice>}
      <button disabled={busy} className="btn-primary h-11 w-full text-[13.5px] disabled:opacity-50">
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
