"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { safeNext, useQuery } from "@/components/auth/fields";
import { SignupForm } from "@/components/auth/forms";
import { DentistProfileForm } from "@/components/auth/security";
import { Page } from "@/components/Page";
import { accountChanged, useMe } from "@/lib/me";

/**
 * Dentist sign-up: an FMD account (FastAPI), then the council registration that FMD verifies. Already signed in: just
 * the registration. A dentist profile is what makes an account a dentist account.
 */
export default function DentistRegisterPage() {
  const me = useMe();
  const router = useRouter();
  const next = safeNext(useQuery().get("next"));
  const step = me === undefined ? null : me ? "profile" : "account";

  return (
    <Page narrow>
      <p className="eyebrow">For dentists</p>
      <h1 className="mt-4 text-[34px] font-extralight leading-[1.1] tracking-[-0.03em] text-ink sm:text-[42px]">
        {step === "profile" && me?.dentistProfile ? "Your dentist profile" : "Register as a dentist"}
      </h1>
      <ol className="mt-6 flex gap-2 text-[12.5px]" aria-label="Steps">
        {(["account", "profile"] as const).map((s, i) => (
          <li key={s} aria-current={step === s ? "step" : undefined} className={`rounded-full border px-3 py-1 ${step === s ? "border-line-strong text-ink" : "border-line text-ink-4"}`}>
            {i + 1}. {s === "account" ? "Your account" : "Council registration"}
          </li>
        ))}
      </ol>

      <div className="glass mt-5 rounded-[28px] p-6 sm:p-8">
        {step === null && <p className="text-[13px] text-ink-4">Loading…</p>}
        {step === "account" && (
          <>
            <SignupForm onDone={accountChanged} />
            <p className="mt-5 text-center text-[13px] text-ink-4">
              Already have an FMD account?{" "}
              <Link href="/signin?next=/dentist/register" className="text-ink-2 underline underline-offset-4 hover:text-ink">
                Sign in
              </Link>
            </p>
          </>
        )}
        {step === "profile" && me && (
          <DentistProfileForm
            profile={me.dentistProfile}
            submitLabel={me.dentistProfile ? "Save profile" : "Submit for verification"}
            onSaved={() => !me.dentistProfile && router.push(next ?? "/account")}
          />
        )}
      </div>
    </Page>
  );
}
