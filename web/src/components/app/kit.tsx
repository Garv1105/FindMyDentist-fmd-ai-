import { Check } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Building blocks shared by FMD Clinic and FMD Main. Colours come only from the theme variables. */

export function Panel({ as: Tag = "div", className = "", children }: { as?: "section" | "div"; className?: string; children?: ReactNode }) {
  return <Tag className={`app-panel ${className}`}>{children}</Tag>;
}

export type Tone = "ok" | "warn" | "bad" | "accent" | "muted";
const TONES: Record<Tone, string> = {
  ok: "bg-[color-mix(in_srgb,var(--tone-ok)_12%,transparent)] text-[var(--tone-ok)]",
  warn: "bg-[color-mix(in_srgb,var(--tone-warn)_12%,transparent)] text-[var(--tone-warn)]",
  bad: "bg-[color-mix(in_srgb,var(--tone-bad)_12%,transparent)] text-[var(--tone-bad)]",
  accent: "bg-[var(--accent-soft)] text-[var(--headline-accent)]",
  muted: "bg-[var(--button-secondary)] text-ink-2",
};

export function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${TONES[tone]}`}>{children}</span>;
}

type Look = { variant?: "primary" | "secondary"; size?: "sm" | "md" };
const look = ({ variant = "primary", size = "md" }: Look) =>
  `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[opacity,background-color] disabled:opacity-50 ${
    size === "sm" ? "h-9 px-4 text-[13px]" : "h-11 px-5 text-[14px]"
  } ${
    variant === "primary"
      ? "bg-[var(--button-primary)] text-[var(--button-primary-fg)] hover:opacity-90"
      : "border border-line bg-[var(--button-secondary)] text-ink hover:border-line-strong"
  }`;

export function Button({ variant, size, className = "", ...rest }: Look & ComponentProps<"button">) {
  return <button type="button" className={`${look({ variant, size })} ${className}`} {...rest} />;
}

export function ButtonLink({ variant, size, className = "", ...rest }: Look & ComponentProps<typeof Link>) {
  return <Link className={`${look({ variant, size })} ${className}`} {...rest} />;
}

export function IconButton({ label, className = "", children, ...rest }: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`relative grid size-10 shrink-0 place-items-center rounded-full border border-line bg-[var(--surface-glass)] text-ink-2 transition-colors hover:text-ink ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
      <p className="text-[14px] text-ink-2">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-ink-3">{hint}</p>}
    </div>
  );
}

/** Tap-to-select tags (a multi-select); each one is a toggle button. `disabled` options can't change. */
export function Chips({
  label,
  options,
  value,
  onChange,
  disabled = [],
  labels,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: readonly string[];
  /** display text per option, when it differs from the option itself */
  labels?: Record<string, string>;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13.5px] text-ink-3">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              disabled={disabled.includes(o)}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] transition-colors ${
                on ? "border-[color-mix(in_srgb,var(--accent)_50%,transparent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {on && <Check className="size-3.5" strokeWidth={2} />}
              {labels?.[o] ?? o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
