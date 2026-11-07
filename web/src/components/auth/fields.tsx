"use client";

import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type InputHTMLAttributes } from "react";
import { inputCls, Notice } from "@/components/Page";
import { api } from "@/lib/me";

/*
 * Building blocks for the FastAPI sign-in screens (logic from main-websie's client/shared, in this app's design).
 * The rules mirror the server's, so most mistakes are caught before a request; the server stays the judge.
 */

export const labelCls = "block text-[13px] text-ink-2";
export const checkCls = "mt-0.5 size-4 shrink-0 accent-[var(--accent)]";
const COUNTRY = "+91";

/** "98765 43210", "098765 43210" or "+91 98765 43210" → "+919876543210" */
export function toPhone(mobile: string) {
  let d = mobile.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return `${COUNTRY}${d}`;
}
export const phoneProblem = (mobile: string) =>
  /^[6-9][0-9]{9}$/.test(toPhone(mobile).slice(COUNTRY.length)) ? null : "Enter a valid 10-digit Indian mobile number, e.g. 98765 43210.";

/** An email or an Indian mobile number, as FastAPI expects it. */
export function resolveIdentifier(raw: string) {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    return { identifier: email, problem: /^\S+@\S+\.\S+$/.test(email) ? null : "Enter a valid email address." };
  }
  return { identifier: toPhone(v), problem: phoneProblem(v) };
}

/** Same policy as the server (server/app/services/password_policy.py). */
export const PASSWORD_RULES: { label: string; ok: (p: string) => boolean }[] = [
  { label: "8+ characters", ok: (p) => p.length >= 8 },
  { label: "a lowercase letter", ok: (p) => /[a-z]/.test(p) },
  { label: "an uppercase letter", ok: (p) => /[A-Z]/.test(p) },
  { label: "a number", ok: (p) => /[0-9]/.test(p) },
  { label: "a special character", ok: (p) => /[^A-Za-z0-9]/.test(p) },
];
export function passwordProblem(p: string) {
  const missing = PASSWORD_RULES.filter((r) => !r.ok(p)).map((r) => r.label);
  return missing.length ? `Password needs ${missing.join(", ")}.` : null;
}

/** Only same-site paths: never send someone off to another site after signing in. */
export const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : null);

const noSubscribe = () => () => {};
/** The page's query string (empty on the server and while hydrating, so the markup matches). */
export const useQuery = () => new URLSearchParams(useSyncExternalStore(noSubscribe, () => location.search, () => ""));

export function PhoneField({ id = "mobile", label = "Mobile number", defaultValue, autoFocus }: { id?: string; label?: string; defaultValue?: string; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="mt-2 flex">
        <span className="inline-flex items-center rounded-l-2xl border border-r-0 border-line bg-[var(--surface-elevated)] px-3.5 text-[14px] text-ink-3">{COUNTRY}</span>
        <input
          id={id}
          name={id}
          type="tel"
          required
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          className={`${inputCls} rounded-l-none`}
        />
      </div>
    </div>
  );
}

export function PasswordField({ label, id, ...props }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative mt-2">
        <input id={id} name={id} type={shown ? "text" : "password"} maxLength={128} className={`${inputCls} pr-12`} {...props} />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-4 hover:text-ink"
        >
          {shown ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

export function PasswordRules({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]" aria-live="polite" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.ok(password);
        return (
          <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-ink-2" : "text-ink-4"}`}>
            {ok ? <Check className="size-3.5 text-[var(--accent)]" strokeWidth={2} /> : <Circle className="size-3" strokeWidth={1.5} />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

const RESEND_SECONDS = 30;

/**
 * Enter a 6-digit code. Resend unlocks after 30s (the server's cooldown). In development no SMS or email is sent, so
 * the code is read from FastAPI's /auth/otp/dev and filled in.
 */
export function OtpStep({
  sentTo,
  submitLabel,
  onVerify,
  onResend,
  onBack,
  backLabel = "Change",
}: {
  sentTo: string;
  submitLabel: string;
  onVerify: (code: string) => Promise<void>;
  onResend?: () => Promise<unknown>;
  onBack: () => void;
  backLabel?: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [devCode, setDevCode] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dev = process.env.NODE_ENV === "development";

  const fetchDev = useCallback(async () => {
    if (!dev) return;
    const r = await api<{ code: string | null }>("/api/v1/auth/otp/dev").catch(() => ({ code: null }));
    setDevCode(r.code);
    if (r.code) setCode(r.code);
  }, [dev]);
  useEffect(() => {
    if (!dev) return;
    let live = true;
    api<{ code: string | null }>("/api/v1/auth/otp/dev")
      .catch(() => ({ code: null }))
      .then((r) => {
        if (!live) return;
        setDevCode(r.code);
        if (r.code) setCode(r.code);
      });
    return () => {
      live = false;
    };
  }, [dev]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  const resend = async () => {
    setError("");
    try {
      await onResend?.();
      setResendIn(RESEND_SECONDS);
      await fetchDev();
      input.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[13.5px] text-ink-3">
        We sent a 6-digit code to <span className="text-ink">{sentTo}</span>.{" "}
        <button type="button" onClick={onBack} className="text-ink-2 underline underline-offset-4 hover:text-ink">
          {backLabel}
        </button>
      </p>
      <label htmlFor="otp" className={labelCls}>
        Code
      </label>
      <input
        ref={input}
        id="otp"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        className={`${inputCls} text-center text-[18px] tracking-[0.5em]`}
      />
      {dev && (
        <Notice kind="info">
          Development: no SMS or email is sent. {devCode ? <>The code is <span className="font-mono text-ink">{devCode}</span> (filled in).</> : "Fetching the code…"}
        </Notice>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <button disabled={busy || code.length !== 6} className="btn-primary h-12 w-full text-[14px] disabled:opacity-50">
        {busy ? "Checking…" : submitLabel}
      </button>
      {onResend && (
        <button type="button" onClick={resend} disabled={resendIn > 0} className="block w-full text-center text-[12.5px] text-ink-3 hover:text-ink disabled:text-ink-4">
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
      )}
    </form>
  );
}
