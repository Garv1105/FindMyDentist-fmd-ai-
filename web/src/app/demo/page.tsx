"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Page } from "@/components/Page";
import { DEMO_USERS, homeOf, safeNext, type DemoUser } from "@/lib/demo";
import { useDemoUser } from "@/lib/useDemoUser";

const OPENS: Record<DemoUser["role"], string> = {
  patient: "Opens FMD Main",
  dentist: "Opens FMD Main",
  clinic_owner: "Opens FMD Clinic",
  clinic_front_desk: "Opens FMD Clinic",
  student: "Opens FMD Main · FMD Scholar coming soon",
  company: "Opens Jobs",
};

function Chooser() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { user, signIn } = useDemoUser();

  const choose = (u: DemoUser) => {
    signIn(u.id);
    router.push(next ? safeNext(next) : homeOf(u));
  };

  return (
    <ul className="mt-8 grid gap-3">
      {DEMO_USERS.map((u) => (
        <li key={u.id}>
          <button
            onClick={() => choose(u)}
            className="glass glass-interactive group flex w-full items-center gap-4 rounded-[22px] p-4 text-left"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[15px] font-semibold text-ink ring-[1.5px] ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]">
              {u.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium text-ink">{u.name}</span>
              <span className="block text-[13.5px] text-ink-3">
                {u.title} · {OPENS[u.role]}
              </span>
            </span>
            {user?.id === u.id && <span className="text-[12.5px] text-ink-3">Current</span>}
            <ArrowRight className="arrow-nudge size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function DemoPage() {
  return (
    <Page narrow>
      <h1 className="type-h2">Try FMD as any role</h1>
      <p className="type-lede mt-3">FMD is in preview. Pick who you want to be; no password needed.</p>
      <p className="mt-3 text-[15px] text-ink-3">
        Prefer your own account?{" "}
        <Link href="/login" className="text-ink underline underline-offset-4">
          Sign in or create one
        </Link>
      </p>
      <Suspense>
        <Chooser />
      </Suspense>
    </Page>
  );
}
