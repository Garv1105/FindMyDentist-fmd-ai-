"use client";

import { ArrowLeft, Check, Eye, EyeOff, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink, Panel } from "@/components/app/kit";
import { Field, fieldCls } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { safeNext } from "@/lib/demo";
import { auth, passwordRules } from "@/lib/fmd";
import { authChanged } from "@/lib/me";
import { track } from "@/lib/analytics";

/* ---------------- shared parts ---------------- */

export function AuthCard({ title, text, children, footer, wide = false }: { title: string; text?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="app-glow grid min-h-dvh place-items-center px-4 py-10">
      <div className={`w-full ${wide ? "max-w-[640px]" : "max-w-[440px]"}`}>
        <Link href="/" aria-label="FindMyDentist home" className="mx-auto mb-6 block w-fit">
          <Image src="/img/logo-fmd.webp" alt="FindMyDentist" width={337} height={180} priority className="h-11 w-auto" />
        </Link>
        <Panel className="p-6 sm:p-8">
          <h1 className="text-[22px] font-medium text-ink">{title}</h1>
          {text && <p className="mt-1.5 text-[14.5px] text-ink-3">{text}</p>}
          <div className="mt-6">{children}</div>
        </Panel>
        {footer && <p className="mt-5 text-center text-[14px] text-ink-3">{footer}</p>}
      </div>
    </div>
  );
}

const linkCls = "font-medium text-ink underline-offset-4 hover:underline";

/** busy flag + one error line for a form; every backend call goes through run() */
export function useRun() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, setErr, run };
}

/** Where to go once signed in: ?next= if it stays on this site, else home. `via` is a stop on the way (sign-up →
 *  /onboarding), which gets this page's query (next, as) to carry on with. */
export function useFinish() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  return {
    next,
    finish: (via?: string) => {
      authChanged();
      router.replace(via ? via + location.search : safeNext(next));
    },
  };
}
const withNext = (href: string, next: string | null) => (next ? `${href}?next=${encodeURIComponent(next)}` : href);

const submit = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault();
  fn();
};

export function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        type={show ? "text" : "password"}
        className={`${fieldCls} pr-12`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={128}
        required
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-1 grid w-10 place-items-center text-ink-3 hover:text-ink"
      >
        {show ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
      </button>
    </span>
  );
}

function PasswordRules({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]" aria-label="Password needs">
      {passwordRules(password).map((r) => (
        <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-[var(--tone-ok)]" : "text-ink-3"}`}>
          {r.ok ? <Check className="size-3.5 shrink-0" strokeWidth={2} /> : <X className="size-3.5 shrink-0" strokeWidth={2} />}
          <span>
            {r.label}
            <span className="sr-only">{r.ok ? " (done)" : " (missing)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const RESEND_AFTER = 30; // the backend allows one OTP per number every 30s

/** Enter the 6-digit code sent to `to`, with resend after a cooldown. On dev backends the code is shown. */
export function OtpStep({
  to,
  busy,
  onCode,
  onBack,
  onResend,
  run,
  demoCode,
}: {
  to: string;
  busy: boolean;
  onCode: (code: string) => void;
  onBack: () => void;
  onResend: () => Promise<void>;
  run: (fn: () => Promise<void>) => Promise<void>;
  /** a flow with no backend yet shows its pretend code here instead of the dev backend's */
  demoCode?: string;
}) {
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(RESEND_AFTER);
  const [dev, setDev] = useState<string | null>(null);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => {
    if (!demoCode && process.env.NODE_ENV !== "production") auth.devOtp().then(setDev);
  }, [sent, demoCode]);

  const resend = () =>
    run(async () => {
      await onResend();
      setCode("");
      setWait(RESEND_AFTER);
      setSent((n) => n + 1);
    });

  return (
    <form onSubmit={submit(() => onCode(code))} className="grid gap-4">
      <p className="text-[14.5px] text-ink-2">
        Enter the 6-digit code sent to <span className="font-medium text-ink">{to}</span>.
      </p>
      <Field label="Code" hint={demoCode ? `Demo: the code is ${demoCode}` : dev ? `Development backend: the code is ${dev}` : undefined}>
        <input
          className={`${fieldCls} text-center text-[20px] tracking-[0.5em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          autoFocus
          required
        />
      </Field>
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Continue"}
      </Button>
      <div className="flex items-center justify-between text-[13.5px]">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Change
        </button>
        {wait > 0 ? (
          <span className="text-ink-3" aria-live="polite">
            Resend in {wait}s
          </span>
        ) : (
          <button type="button" onClick={resend} disabled={busy} className="font-medium text-ink hover:underline">
            Resend code
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------------- log in ---------------- */

export function LoginForm() {
  const { next, finish } = useFinish();
  const { busy, err, setErr, run } = useRun();
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"form" | "otp" | "mfa">("form");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");

  const pick = (m: typeof method) => (setMethod(m), setStep("form"), setErr(null));

  const sendLoginOtp = () =>
    run(async () => {
      await auth.sendOtp(id.trim(), "login");
      setStep("otp");
    });
  /** true when a second factor is needed (a fresh challenge is set) */
  const passwordStep = async () => {
    const r = await auth.loginPassword(id.trim(), password);
    if (!("mfa_required" in r)) return false;
    setChallenge(r.challenge_token);
    return true;
  };
  const withPassword = () => run(async () => ((await passwordStep()) ? setStep("mfa") : finish()));

  return (
    <AuthCard
      title="Log in to FMD"
      text="One account for FMD and FMD Clinic."
      footer={
        <>
          New to FMD?{" "}
          <Link href={withNext("/register", next)} className={linkCls}>
            Create an account
          </Link>
        </>
      }
    >
      {step === "form" && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-line bg-[var(--surface-glass)] p-1" role="group" aria-label="Log in with">
          {(["otp", "password"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => pick(m)}
              className={`h-9 rounded-full text-[13.5px] font-medium transition-colors ${method === m ? "bg-[var(--accent-soft)] text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {m === "otp" ? "OTP" : "Password"}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}

        {step === "form" && method === "otp" && (
          <form onSubmit={submit(sendLoginOtp)} className="grid gap-4">
            <Field label="Mobile number or email">
              <input className={fieldCls} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="98765 43210" required />
            </Field>
            <Button type="submit" disabled={busy || !id.trim()}>
              {busy ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        )}

        {step === "form" && method === "password" && (
          <form onSubmit={submit(withPassword)} className="grid gap-4">
            <Field label="Mobile number or email">
              <input className={fieldCls} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="98765 43210" required />
            </Field>
            <Field label="Password">
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
            </Field>
            <Link href={withNext("/forgot-password", next)} className="-mt-1 w-fit text-[13.5px] text-ink-3 hover:text-ink">
              Forgot password?
            </Link>
            <Button type="submit" disabled={busy || !id.trim() || !password}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <OtpStep
            to={id.trim()}
            busy={busy}
            run={run}
            onResend={() => auth.sendOtp(id.trim(), "login")}
            onBack={() => (setStep("form"), setErr(null))}
            onCode={(code) => run(async () => (await auth.loginOtp(id.trim(), code), finish()))}
          />
        )}

        {step === "mfa" && (
          <>
            <p className="text-[14.5px] text-ink-2">Your account has two-step verification on.</p>
            <OtpStep
              to="your second-step method"
              busy={busy}
              run={run}
              onResend={async () => void (await passwordStep())} // a new code comes with a new challenge
              onBack={() => (setStep("form"), setErr(null))}
              onCode={(code) => run(async () => (await auth.verifyMfa(challenge, code), finish()))}
            />
          </>
        )}
      </div>
    </AuthCard>
  );
}

/* ---------------- sign up ---------------- */

export function RegisterForm() {
  const { next, finish } = useFinish();
  const { busy, err, setErr, run } = useRun();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [f, setF] = useState({ name: "", phone: "", password: "", confirm: "", offers: false, adult: false, terms: false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const start = () => {
    if (!passwordRules(f.password).every((r) => r.ok)) return setErr("Choose a password that meets every rule below it.");
    if (f.password !== f.confirm) return setErr("The two passwords don't match.");
    if (!f.adult || !f.terms) return setErr("Confirm you are 18 or older and agree to the Terms and Privacy Notice.");
    run(async () => {
      await auth.checkPassword(f.password); // breached passwords fail here, before an OTP is spent
      await auth.sendOtp(f.phone.trim(), "signup");
      setStep("otp");
    });
  };

  return (
    <AuthCard
      title="Create your FMD account"
      text="For patients and dentists. You'll confirm your mobile number with an OTP."
      footer={
        <>
          Already have an account?{" "}
          <Link href={withNext("/login", next)} className={linkCls}>
            Log in
          </Link>
        </>
      }
    >
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}

        {step === "form" ? (
          <form onSubmit={submit(start)} className="grid gap-4">
            <Field label="Full name">
              <input className={fieldCls} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={200} required />
            </Field>
            <Field label="Mobile number" hint="Indian numbers only for now.">
              <input
                className={fieldCls}
                value={f.phone}
                onChange={(e) => set("phone", e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                required
              />
            </Field>
            <div>
              <Field label="Password">
                <PasswordInput value={f.password} onChange={(v) => set("password", v)} autoComplete="new-password" />
              </Field>
              <PasswordRules password={f.password} />
            </div>
            <Field label="Confirm password">
              <PasswordInput value={f.confirm} onChange={(v) => set("confirm", v)} autoComplete="new-password" />
            </Field>
            <fieldset className="grid gap-2.5 text-[14px] text-ink-2">
              <legend className="sr-only">Agreements</legend>
              <Check2 checked={f.adult} onChange={(v) => set("adult", v)}>
                I am 18 or older.
              </Check2>
              <Check2 checked={f.terms} onChange={(v) => set("terms", v)}>
                I agree to FMD&apos;s{" "}
                <Link href="/terms" target="_blank" className="font-medium text-ink underline underline-offset-4">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-medium text-ink underline underline-offset-4">
                  Privacy Notice
                </Link>
                .
              </Check2>
              <Check2 checked={f.offers} onChange={(v) => set("offers", v)}>
                Send me offers and dental tips (optional).
              </Check2>
            </fieldset>
            <Button type="submit" disabled={busy || !f.name.trim() || !f.phone.trim() || !f.password || !f.confirm}>
              {busy ? "Sending OTP…" : "Continue"}
            </Button>
          </form>
        ) : (
          <OtpStep
            to={f.phone.trim()}
            busy={busy}
            run={run}
            onResend={() => auth.sendOtp(f.phone.trim(), "signup")}
            onBack={() => (setStep("form"), setErr(null))}
            onCode={(otp) =>
              run(async () => {
                await auth.register({ full_name: f.name.trim(), phone: f.phone.trim(), password: f.password, otp, marketing_opt_in: f.offers });
                track("sign_up_completed");
                finish("/onboarding");
              })
            }
          />
        )}
      </div>
    </AuthCard>
  );
}

function Check2({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
      <span>{children}</span>
    </label>
  );
}

/* ---------------- forgot password ---------------- */

export function ForgotPasswordForm() {
  const { next } = useFinish();
  const { busy, err, setErr, run } = useRun();
  const [step, setStep] = useState<"id" | "otp" | "password" | "done">("id");
  const [id, setId] = useState("");
  const [proof, setProof] = useState("");
  const [pw, setPw] = useState({ password: "", confirm: "" });

  const save = () => {
    if (!passwordRules(pw.password).every((r) => r.ok)) return setErr("Choose a password that meets every rule below it.");
    if (pw.password !== pw.confirm) return setErr("The two passwords don't match.");
    run(async () => {
      await auth.resetPassword(id.trim(), proof, pw.password);
      setStep("done");
    });
  };

  return (
    <AuthCard
      title={step === "done" ? "Password changed" : "Reset your password"}
      text={step === "done" ? undefined : "We'll send a code to the mobile number or email on your account."}
      footer={
        step !== "done" && (
          <>
            Remembered it?{" "}
            <Link href={withNext("/login", next)} className={linkCls}>
              Log in
            </Link>
          </>
        )
      }
    >
      <div className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}

        {step === "id" && (
          <form
            onSubmit={submit(() =>
              run(async () => {
                await auth.sendOtp(id.trim(), "reset_password");
                setStep("otp");
              }),
            )}
            className="grid gap-4"
          >
            <Field label="Mobile number or email">
              <input className={fieldCls} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="98765 43210" required />
            </Field>
            <Button type="submit" disabled={busy || !id.trim()}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <OtpStep
            to={id.trim()}
            busy={busy}
            run={run}
            onResend={() => auth.sendOtp(id.trim(), "reset_password")}
            onBack={() => (setStep("id"), setErr(null))}
            onCode={(code) =>
              run(async () => {
                setProof((await auth.verifyResetOtp(id.trim(), code)).proof_token);
                setStep("password");
              })
            }
          />
        )}

        {step === "password" && (
          <form onSubmit={submit(save)} className="grid gap-4">
            <div>
              <Field label="New password">
                <PasswordInput value={pw.password} onChange={(v) => setPw((p) => ({ ...p, password: v }))} autoComplete="new-password" />
              </Field>
              <PasswordRules password={pw.password} />
            </div>
            <Field label="Confirm new password">
              <PasswordInput value={pw.confirm} onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} autoComplete="new-password" />
            </Field>
            <Button type="submit" disabled={busy || !pw.password || !pw.confirm}>
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}

        {step === "done" && (
          <>
            <Notice kind="success">Your password was changed and you were signed out on every device.</Notice>
            <ButtonLink href={withNext("/login", next)}>Log in</ButtonLink>
          </>
        )}
      </div>
    </AuthCard>
  );
}
