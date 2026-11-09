"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button, Panel } from "@/components/app/kit";
import { Field, fieldCls } from "@/components/app/Sheet";
import { Page } from "@/components/Page";
import { formatPhone, homeOf, isPhone, makeUser, PREVIEW_CODE, ROLES, safeNext, userByPhone, type DemoRole, type DemoUser } from "@/lib/demo";
import { useDemoUser } from "@/lib/useDemoUser";

type Mode = "signin" | "signup";
type Step = { kind: "form" } | { kind: "code"; user: DemoUser | null } | { kind: "unknown" };

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { signIn } = useDemoUser();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<DemoRole>("patient");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const switchTo = (m: Mode) => {
    setMode(m);
    setStep({ kind: "form" });
    setError("");
  };

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isPhone(phone)) return setError("Enter a 10-digit mobile number");
    if (mode === "signin") {
      const found = userByPhone(phone);
      return setStep(found ? { kind: "code", user: found } : { kind: "unknown" });
    }
    try {
      setStep({ kind: "code", user: makeUser({ name, role, phone }) });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== "code" || !step.user) return;
    if (code.trim() !== PREVIEW_CODE) return setError("That code doesn't match. Use the preview code shown above.");
    const u = step.user;
    signIn(u.id.startsWith("demo-") ? u.id : u);
    router.push(next ? safeNext(next) : homeOf(u));
  };

  return (
    <Panel className="p-6 sm:p-8">
      <div className="mb-6 flex w-fit rounded-full border border-line-strong p-1" role="tablist" aria-label="Sign in or create an account">
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchTo(m)}
            className={`h-9 rounded-full px-4 text-[14.5px] ${mode === m ? "bg-[var(--button-primary)] font-semibold text-[var(--button-primary-fg)]" : "text-ink-2 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {step.kind === "form" && (
        <form onSubmit={submitForm} className="flex flex-col gap-4">
          <div>
            <h1 className="text-[26px] font-light tracking-[-0.02em] text-ink">{mode === "signin" ? "Welcome back" : "Who are you?"}</h1>
            <p className="mt-1 text-[15px] text-ink-3">{mode === "signin" ? "Sign in with your mobile number." : "Pick how you'll use FMD. You can switch later."}</p>
          </div>
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Account type">
                {ROLES.map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    role="radio"
                    aria-checked={role === r.role}
                    onClick={() => setRole(r.role)}
                    className={`rounded-2xl border px-3.5 py-3 text-left transition-colors ${role === r.role ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line-strong hover:border-[var(--accent)]"}`}
                  >
                    <span className="block text-[15px] font-medium text-ink">{r.label}</span>
                    <span className="block text-[13px] text-ink-3">{r.hint}</span>
                  </button>
                ))}
              </div>
              <Field label="Your name">
                <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            </>
          )}
          <Field label="Mobile number">
            <div className="flex items-center gap-2">
              <span className="grid h-11 place-items-center rounded-2xl border border-line-strong px-3 text-[15px] text-ink-2">+91</span>
              <input className={fieldCls} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98450 12345" />
            </div>
          </Field>
          {error && (
            <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full">
            Send code
          </Button>
          <p className="text-[13.5px] text-ink-3">
            Preview: no real account is needed and no message is sent. Any number works; the code is shown on the next screen.
            {mode === "signin" && " Try 98450 10101 (clinic owner) or 99860 44120 (patient)."}
          </p>
        </form>
      )}

      {step.kind === "unknown" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-[26px] font-light tracking-[-0.02em] text-ink">No account yet</h1>
          <p className="text-[15px] text-ink-2">There&apos;s no FMD account with {formatPhone(phone)}. Create one with this number?</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => switchTo("signup")}>Create an account</Button>
            <Button variant="secondary" onClick={() => setStep({ kind: "form" })}>
              Use another number
            </Button>
          </div>
        </div>
      )}

      {step.kind === "code" && (
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <div>
            <h1 className="text-[26px] font-light tracking-[-0.02em] text-ink">Enter the code</h1>
            <p className="mt-1 text-[15px] text-ink-3">Sent to {formatPhone(phone)}</p>
          </div>
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-[14.5px] text-ink-2">
            <span>
              Preview code: <b className="font-semibold tracking-[0.15em] text-ink">{PREVIEW_CODE}</b>
            </span>
            <button type="button" onClick={() => setCode(PREVIEW_CODE)} className="text-[14px] font-medium text-ink underline underline-offset-4">
              Fill it in
            </button>
          </p>
          <Field label="6-digit code">
            <input
              className={`${fieldCls} text-center text-[22px] tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          {error && (
            <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full">
            Continue
          </Button>
          <button type="button" onClick={() => (setStep({ kind: "form" }), setCode(""), setError(""))} className="text-[14px] text-ink-3 hover:text-ink">
            Change number
          </button>
        </form>
      )}

      <p className="mt-6 border-t border-line pt-4 text-[14px] text-ink-3">
        Just looking around?{" "}
        <Link href={next ? `/demo?next=${encodeURIComponent(next)}` : "/demo"} className="text-ink underline underline-offset-4">
          Try FMD as any role
        </Link>
      </p>
    </Panel>
  );
}

export default function SignInPage() {
  return (
    <Page narrow>
      <Suspense>
        <SignIn />
      </Suspense>
    </Page>
  );
}
