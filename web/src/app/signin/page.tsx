"use client";

import { ArrowRight, Building2, GraduationCap, Stethoscope, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, authChanged } from "@/lib/me";

type Step = "identify" | "code" | "profile";
const TYPES = [
  { id: "patient", label: "Patient", hint: "Find dentists, book, keep records", icon: UserRound },
  { id: "dentist", label: "Dentist", hint: "Professional profile and content", icon: Stethoscope },
  { id: "student", label: "Dental student", hint: "Includes FMD Scholar access", icon: GraduationCap },
  { id: "company", label: "Dental company", hint: "Corporate page and opportunities", icon: Building2 },
] as const;

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identify");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [ticket, setTicket] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("patient");
  const [consents, setConsents] = useState({ terms: false, privacy: false, comms_appointments: true, comms_marketing: false, ai_history: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    authChanged();
    const next = new URLSearchParams(location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
  };

  const sendCode = run(async () => {
    const r = await api<{ target: string; devCode?: string }>("/api/auth/otp", { method: "POST", body: { target } });
    setTarget(r.target);
    setDevCode(r.devCode);
    setCode("");
    setStep("code");
  });

  const verify = run(async () => {
    const r = await api<{ signedIn?: boolean; needsProfile?: boolean; ticket?: string }>("/api/auth/verify", { method: "POST", body: { target, code } });
    if (r.needsProfile && r.ticket) {
      setTicket(r.ticket);
      setStep("profile");
    } else done();
  });

  const register = run(async () => {
    await api("/api/auth/register", { method: "POST", body: { ticket, name, accountType: type, consents } });
    done();
  });

  return (
    <Page narrow>
      <p className="eyebrow">Account</p>
      <h1 className="mt-4 text-[34px] font-extralight leading-[1.1] tracking-[-0.03em] text-ink sm:text-[42px]">
        {step === "profile" ? "Create your account" : "Sign in to FMD"}
      </h1>

      <div className="glass mt-8 rounded-[28px] p-6 sm:p-8">
        {step === "identify" && (
          <form onSubmit={sendCode} className="space-y-4">
            <label htmlFor="target" className="block text-[13px] text-ink-2">
              Email or mobile number
            </label>
            <input id="target" value={target} onChange={(e) => setTarget(e.target.value)} autoComplete="username" placeholder="you@example.com or 98765 43210" className={inputCls} />
            <p className="text-[12.5px] text-ink-4">We&apos;ll send a one-time code. New here? You&apos;ll create an account after verifying.</p>
            {error && <Notice kind="error">{error}</Notice>}
            <button disabled={busy || !target.trim()} className="btn-primary h-12 w-full text-[14px] disabled:opacity-50">
              {busy ? "Sending…" : "Send code"} <ArrowRight className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verify} className="space-y-4">
            <label htmlFor="code" className="block text-[13px] text-ink-2">
              Enter the 6-digit code sent to <span className="text-ink">{target}</span>
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className={`${inputCls} tracking-[0.4em]`}
            />
            {devCode && (
              <Notice kind="info">
                Development mode: no SMS or email provider is configured, so the code is shown here: <span className="font-mono text-ink">{devCode}</span>
              </Notice>
            )}
            {error && <Notice kind="error">{error}</Notice>}
            <button disabled={busy || code.length !== 6} className="btn-primary h-12 w-full text-[14px] disabled:opacity-50">
              {busy ? "Checking…" : "Verify"}
            </button>
            <div className="flex justify-between text-[12.5px]">
              <button type="button" onClick={() => setStep("identify")} className="text-ink-3 hover:text-ink">
                Use a different email or number
              </button>
              <button type="button" onClick={sendCode} className="text-ink-3 hover:text-ink">
                Resend code
              </button>
            </div>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={register} className="space-y-6">
            <fieldset>
              <legend className="text-[13px] text-ink-2">I am a…</legend>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPES.map(({ id, label, hint, icon: Icon }) => (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${type === id ? "border-line-strong bg-[var(--accent-soft)]" : "border-line hover:border-line-strong"}`}
                  >
                    <input type="radio" name="type" value={id} checked={type === id} onChange={() => setType(id)} className="mt-1 accent-[var(--accent)]" />
                    <span>
                      <span className="flex items-center gap-2 text-[14px] text-ink">
                        <Icon className="size-4" strokeWidth={1.5} />
                        {label}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink-4">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {type !== "patient" && (
                <p className="mt-2 text-[12px] text-ink-4">Professional, student and company accounts are verified before any badge or membership benefit appears.</p>
              )}
            </fieldset>

            <div>
              <label htmlFor="name" className="block text-[13px] text-ink-2">
                Your name
              </label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`${inputCls} mt-2`} />
            </div>

            <fieldset className="space-y-2.5">
              <legend className="text-[13px] text-ink-2">Consent</legend>
              <details className="rounded-2xl border border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-3">
                <summary className="cursor-pointer text-ink-2">How FMD uses your information</summary>
                <p className="mt-2">
                  We keep your contact details to sign you in and, if you allow it, to send appointment updates. Health details you add (records, assistant
                  conversations) are stored separately, shared only when you choose, and never used for advertising. You can export your data or request
                  deletion from your account. This notice is a draft pending legal review.
                </p>
              </details>
              {(
                [
                  ["terms", "I accept the FMD terms of use (draft)", true],
                  ["privacy", "I have read the privacy notice above", true],
                  ["comms_appointments", "Send me appointment and booking updates", false],
                  ["comms_marketing", "Send me news and offers (optional)", false],
                  ["ai_history", "Save my FMD AI conversations so I can revisit them", false],
                ] as const
              ).map(([k, label, required]) => (
                <label key={k} className="flex items-start gap-3 text-[13.5px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={consents[k]}
                    onChange={(e) => setConsents((c) => ({ ...c, [k]: e.target.checked }))}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span>
                    {label}
                    {required && <span className="text-ink-4"> (required)</span>}
                  </span>
                </label>
              ))}
            </fieldset>

            {error && <Notice kind="error">{error}</Notice>}
            <button disabled={busy || !consents.terms || !consents.privacy || name.trim().length < 2} className="btn-primary h-12 w-full text-[14px] disabled:opacity-50">
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </Page>
  );
}
