"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { inputCls, Notice } from "@/components/Page";
import { api } from "@/lib/me";
import { checkCls, labelCls, OtpStep, PasswordField, passwordProblem, PasswordRules, PhoneField, phoneProblem, resolveIdentifier, toPhone } from "./fields";

/*
 * Sign-up, log-in and password reset against the FastAPI service (/api/v1/auth/*). FastAPI sets the session cookies;
 * `onDone` runs once the visitor is signed in.
 */

/** Run a submit handler with a busy flag and the error shown to the visitor. */
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

const Submit = ({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) => (
  <button disabled={busy} className="btn-primary h-12 w-full text-[14px] disabled:opacity-50">
    {busy ? busyLabel : children}
  </button>
);

type Draft = { name: string; mobile: string; offers: boolean };

export function SignupForm({ onDone }: { onDone: () => Promise<void> | void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const { error, setError, busy, run } = useAction();
  const sendCode = (to: string) => api("/api/v1/auth/otp", { method: "POST", body: { identifier: to, purpose: "signup" } });

  const details = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const entered: Draft = { name: String(f.get("full_name")).trim(), mobile: String(f.get("mobile")), offers: f.get("offers") === "on" };
    setDraft(entered);
    const problem = phoneProblem(entered.mobile) ?? passwordProblem(password) ?? (f.get("confirm") !== password ? "The passwords don't match." : null);
    if (problem) return setError(problem);
    void run(async () => {
      await api("/api/v1/auth/password/check", { method: "POST", body: { password } }); // e.g. found in a data breach
      await sendCode(toPhone(entered.mobile));
      setPhone(toPhone(entered.mobile));
    });
  };

  if (phone && draft)
    return (
      <OtpStep
        sentTo={phone}
        submitLabel="Verify and create account"
        onBack={() => setPhone(null)}
        onResend={() => sendCode(phone)}
        onVerify={async (otp) => {
          await api("/api/v1/auth/register", {
            method: "POST",
            body: { full_name: draft.name, phone, password, otp, marketing_opt_in: draft.offers, accept_terms: true, age_confirmed: true },
          });
          await onDone();
        }}
      />
    );

  return (
    <form onSubmit={details} className="space-y-4">
      <div>
        <label htmlFor="full_name" className={labelCls}>
          Full name
        </label>
        <input id="full_name" name="full_name" required maxLength={200} autoComplete="name" defaultValue={draft?.name} className={`${inputCls} mt-2`} />
      </div>
      <PhoneField defaultValue={draft?.mobile} />
      <PasswordField label="Create a password" id="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <PasswordRules password={password} />
      <PasswordField label="Confirm password" id="confirm" required autoComplete="new-password" />
      <div className="space-y-2.5 pt-1 text-[13px] text-ink-3">
        <label className="flex items-start gap-2.5">
          <input name="offers" type="checkbox" defaultChecked={draft?.offers ?? false} className={checkCls} />
          Send me relevant offers and news from FMD (optional)
        </label>
        <label className="flex items-start gap-2.5">
          <input name="age" type="checkbox" required className={checkCls} />
          I confirm I am 18 or older
        </label>
        <label className="flex items-start gap-2.5">
          <input name="terms" type="checkbox" required className={checkCls} />I agree to the terms of use and privacy policy
        </label>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <Submit busy={busy} busyLabel="Sending code…">
        Send code <ArrowRight className="size-4" strokeWidth={1.75} />
      </Submit>
    </form>
  );
}

export function LoginForm({ onDone, onForgot }: { onDone: () => Promise<void> | void; onForgot: () => void }) {
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [otpTo, setOtpTo] = useState<string | null>(null);
  const [mfa, setMfa] = useState<string | null>(null);
  const { error, setError, busy, run } = useAction();
  const sendCode = (to: string) => api("/api/v1/auth/otp", { method: "POST", body: { identifier: to, purpose: "login" } });

  if (mfa)
    return (
      <OtpStep
        sentTo="your mobile number"
        submitLabel="Verify and sign in"
        backLabel="Start again"
        onBack={() => setMfa(null)}
        onVerify={async (code) => {
          await api("/api/v1/auth/mfa/verify", { method: "POST", body: { challenge_token: mfa, code } });
          await onDone();
        }}
      />
    );
  if (otpTo)
    return (
      <OtpStep
        sentTo={otpTo}
        submitLabel="Sign in"
        onBack={() => setOtpTo(null)}
        onResend={() => sendCode(otpTo)}
        onVerify={async (code) => {
          await api("/api/v1/auth/login/otp", { method: "POST", body: { identifier: otpTo, code } });
          await onDone();
        }}
      />
    );

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { identifier, problem } = resolveIdentifier(String(f.get("identifier")));
    if (problem) return setError(problem);
    void run(async () => {
      if (mode === "otp") {
        await sendCode(identifier);
        setOtpTo(identifier);
        return;
      }
      const r = await api<{ mfa_required?: boolean; challenge_token?: string }>("/api/v1/auth/login/password", {
        method: "POST",
        body: { login: identifier, password: String(f.get("password")) },
      });
      if (r.mfa_required && r.challenge_token) setMfa(r.challenge_token);
      else await onDone();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="identifier" className={labelCls}>
          Mobile number{mode === "password" ? " or email" : " or verified email"}
        </label>
        <input id="identifier" name="identifier" required autoComplete="username" placeholder="98765 43210" className={`${inputCls} mt-2`} />
      </div>
      {mode === "password" && <PasswordField label="Password" id="password" required autoComplete="current-password" />}
      {error && <Notice kind="error">{error}</Notice>}
      <Submit busy={busy} busyLabel={mode === "otp" ? "Sending code…" : "Signing in…"}>
        {mode === "otp" ? "Send code" : "Sign in"} <ArrowRight className="size-4" strokeWidth={1.75} />
      </Submit>
      <div className="flex justify-between text-[12.5px]">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "otp" ? "password" : "otp");
            setError("");
          }}
          className="text-ink-3 hover:text-ink"
        >
          {mode === "otp" ? "Use a password instead" : "Use a one-time code instead"}
        </button>
        <button type="button" onClick={onForgot} className="text-ink-3 hover:text-ink">
          Forgot password?
        </button>
      </div>
    </form>
  );
}

type ResetStep = { name: "who" } | { name: "code"; identifier: string } | { name: "password"; identifier: string; proof: string } | { name: "done" };

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<ResetStep>({ name: "who" });
  const [password, setPassword] = useState("");
  const { error, setError, busy, run } = useAction();
  const sendCode = (to: string) => api("/api/v1/auth/otp", { method: "POST", body: { identifier: to, purpose: "reset_password" } });

  if (step.name === "done")
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[var(--accent)]" strokeWidth={1.25} />
        <p className="text-[15px] text-ink">Password changed</p>
        <p className="text-[13px] text-ink-3">You were signed out on every device. Sign in with your new password.</p>
        <button onClick={onBack} className="btn-primary h-12 w-full text-[14px]">
          Back to sign in
        </button>
      </div>
    );
  if (step.name === "code")
    return (
      <OtpStep
        sentTo={step.identifier}
        submitLabel="Continue"
        onBack={() => setStep({ name: "who" })}
        onResend={() => sendCode(step.identifier)}
        onVerify={async (code) => {
          const r = await api<{ proof_token: string }>("/api/v1/auth/otp/verify", {
            method: "POST",
            body: { identifier: step.identifier, purpose: "reset_password", code },
          });
          setStep({ name: "password", identifier: step.identifier, proof: r.proof_token });
        }}
      />
    );
  if (step.name === "password")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const confirm = String(new FormData(e.currentTarget).get("confirm"));
          const problem = passwordProblem(password) ?? (confirm !== password ? "The passwords don't match." : null);
          if (problem) return setError(problem);
          void run(async () => {
            await api("/api/v1/auth/password/reset", { method: "POST", body: { identifier: step.identifier, proof_token: step.proof, new_password: password } });
            setStep({ name: "done" });
          });
        }}
        className="space-y-4"
      >
        <PasswordField label="New password" id="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordRules password={password} />
        <PasswordField label="Confirm new password" id="confirm" required autoComplete="new-password" />
        {error && <Notice kind="error">{error}</Notice>}
        <Submit busy={busy} busyLabel="Saving…">
          Change password
        </Submit>
      </form>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const { identifier, problem } = resolveIdentifier(String(new FormData(e.currentTarget).get("identifier")));
        if (problem) return setError(problem);
        void run(async () => {
          await sendCode(identifier);
          setStep({ name: "code", identifier });
        });
      }}
      className="space-y-4"
    >
      <p className="text-[13.5px] text-ink-3">Enter your mobile number or verified email. We&apos;ll send a code to reset your password.</p>
      <div>
        <label htmlFor="identifier" className={labelCls}>
          Mobile number or verified email
        </label>
        <input id="identifier" name="identifier" required autoComplete="username" className={`${inputCls} mt-2`} />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <Submit busy={busy} busyLabel="Sending code…">
        Send code
      </Submit>
      <button type="button" onClick={onBack} className="block w-full text-center text-[12.5px] text-ink-3 hover:text-ink">
        Back to sign in
      </button>
    </form>
  );
}
