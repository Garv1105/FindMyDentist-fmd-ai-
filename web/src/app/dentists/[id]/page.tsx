import { Suspense } from "react";
import { DentistView } from "./DentistView";

/** URL params are request-time data under Cache Components, so the client view streams in behind Suspense. */
export default function DentistPage() {
  return (
    <Suspense fallback={<p className="px-4 pt-32 text-center text-[13px] text-ink-4">Loading profile…</p>}>
      <DentistView />
    </Suspense>
  );
}
