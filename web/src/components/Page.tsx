import type { ReactNode } from "react";
import Navbar from "./nav/Navbar";

/** Standard shell for app pages (everything except the cinematic homepage). */
export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <Navbar />
      <main className={`mx-auto w-full px-4 pb-24 pt-28 sm:px-6 sm:pt-32 ${narrow ? "max-w-[560px]" : "max-w-[1120px]"}`}>{children}</main>
    </>
  );
}

/** Inline status line: role=alert for errors so screen readers announce them; never colour-only. */
export function Notice({ kind, children }: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const label = kind === "error" ? "Error:" : kind === "success" ? "Done:" : "Note:";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-[13px] leading-relaxed ${
        kind === "error" ? "border-[color-mix(in_srgb,#e5484d_45%,transparent)] text-ink" : "border-line text-ink-2"
      }`}
    >
      <span className="font-medium">{label}</span> {children}
    </p>
  );
}

export const inputCls =
  "h-12 w-full rounded-2xl border border-line bg-[var(--surface-glass)] px-4 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-line-strong";
