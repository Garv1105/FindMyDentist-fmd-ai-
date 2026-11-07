"use client";

import { ArrowRight, Building2, GraduationCap, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNext, useQuery } from "@/components/auth/fields";
import { ForgotPasswordForm, LoginForm, SignupForm } from "@/components/auth/forms";
import { EmailSettings } from "@/components/auth/security";
import { Notice, Page } from "@/components/Page";
import { accountChanged, api, useMe } from "@/lib/me";

type Mode = "login" | "signup" | "forgot" | "welcome";
const TITLES: Record<Mode, string> = { login: "Sign in to FMD", signup: "Create your account", forgot: "Reset your password", welcome: "Welcome to FMD" };

/** One page for signing in, creating an account and resetting a password: /signin, /signin?mode=signup, ?next=/path. */
export default function SignInPage() {
  const router = useRouter();
  const q = useQuery();
  const next = safeNext(q.get("next"));
  const [chosen, setMode] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? (q.get("mode") === "signup" ? "signup" : "login");
  const go = () => router.push(next ?? "/account");

  return (
    <Page narrow>
      <p className="eyebrow">Account</p>
      <h1 className="mt-4 text-[34px] font-extralight leading-[1.1] tracking-[-0.03em] text-ink sm:text-[42px]">{TITLES[mode]}</h1>

      {(mode === "login" || mode === "signup") && (
        <div role="tablist" aria-label="Sign in or create an account" className="mt-8 grid grid-cols-2 rounded-full border border-line p-1 text-[13.5px]">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`h-10 rounded-full transition-colors ${mode === m ? "bg-[var(--button-primary)] text-[var(--button-primary-fg)]" : "text-ink-3 hover:text-ink"}`}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <div className="glass mt-5 rounded-[28px] p-6 sm:p-8">
        {mode === "login" && (
          <LoginForm
            onForgot={() => setMode("forgot")}
            onDone={async () => {
              await accountChanged();
              go();
            }}
          />
        )}
        {mode === "signup" && (
          <SignupForm
            onDone={async () => {
              await accountChanged();
              setMode("welcome");
            }}
          />
        )}
        {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
        {mode === "welcome" && <Welcome next={next} onDone={go} />}
      </div>

      {mode === "login" && (
        <p className="mt-5 text-center text-[13px] text-ink-4">
          A dentist?{" "}
          <Link href="/dentist/register" className="text-ink-2 underline underline-offset-4 hover:text-ink">
            Register as a dentist
          </Link>
        </p>
      )}
    </Page>
  );
}

const TYPES = [
  { id: "patient", label: "Patient", hint: "Find dentists, book, keep records", icon: UserRound },
  { id: "student", label: "Dental student", hint: "Includes FMD Scholar access", icon: GraduationCap },
  { id: "company", label: "Dental company", hint: "Corporate page and opportunities", icon: Building2 },
] as const;

/** Right after sign-up: what kind of account this is, and an optional email. */
function Welcome({ next, onDone }: { next: string | null; onDone: () => void }) {
  const me = useMe();
  const [type, setType] = useState<string>("patient");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      if (type !== "patient") await api("/api/me", { method: "PATCH", body: { accountType: type } });
      await accountChanged();
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="text-[13px] text-ink-2">I am a…</legend>
        <div className="mt-3 grid gap-2">
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
                <span className="mt-0.5 block text-[12.5px] text-ink-4">{hint}</span>
              </span>
            </label>
          ))}
          <Link
            href={`/dentist/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="flex items-start gap-3 rounded-2xl border border-line p-3.5 transition-colors hover:border-line-strong"
          >
            <Stethoscope className="mt-1 size-4 text-ink-2" strokeWidth={1.5} />
            <span>
              <span className="block text-[14px] text-ink">Dentist</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-4">Add your council registration to get verified</span>
            </span>
          </Link>
        </div>
      </fieldset>

      {me && (
        <div className="border-t border-line pt-6">
          <p className="mb-3 text-[13px] text-ink-2">Email (optional)</p>
          <EmailSettings me={me} />
        </div>
      )}

      {error && <Notice kind="error">{error}</Notice>}
      <button onClick={save} disabled={busy} className="btn-primary h-12 w-full text-[14px] disabled:opacity-50">
        {busy ? "Saving…" : "Continue"} <ArrowRight className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
