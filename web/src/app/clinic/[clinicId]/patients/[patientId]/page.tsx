import { Suspense } from "react";
import { PatientView } from "./PatientView";

export const instant = false;

export default function PatientPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-ink-4">Loading patient…</p>}>
      <PatientView />
    </Suspense>
  );
}
