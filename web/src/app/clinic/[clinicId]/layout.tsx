import { Suspense, type ReactNode } from "react";
import { ClinicShell } from "@/components/clinic/Shell";

/** Clinic OS is a signed-in app shell whose data loads in the browser; instant-navigation validation isn't a goal here. */
export const instant = false;

/** URL params are request-time data under Cache Components, so the workspace shell streams in behind Suspense. */
export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="px-6 pt-32 text-center text-[13px] text-ink-4">Opening Clinic OS…</p>}>
      <ClinicShell>{children}</ClinicShell>
    </Suspense>
  );
}
