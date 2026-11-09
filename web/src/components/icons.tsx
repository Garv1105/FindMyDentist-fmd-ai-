import type { SVGProps } from "react";

/** Molar outline drawn to match Lucide's 24px / round-stroke grid. */
export function ToothIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.2 3C5 3 3.5 4.7 3.5 7.1c0 2 .8 3.4 1.3 5 .5 1.7.6 3.6 1 5.4.3 1.6.9 3.5 2 3.5 1 0 1.4-1.4 1.7-3 .3-1.5.6-3.1 2.5-3.1s2.2 1.6 2.5 3.1c.3 1.6.7 3 1.7 3 1.1 0 1.7-1.9 2-3.5.4-1.8.5-3.7 1-5.4.5-1.6 1.3-3 1.3-5C20.5 4.7 19 3 16.8 3c-1.9 0-2.9 1.1-4.8 1.1S9.1 3 7.2 3Z" />
      <path d="M9.5 4.6c.9.6 1.7 1.4 2.5 1.4" opacity=".6" />
    </svg>
  );
}
