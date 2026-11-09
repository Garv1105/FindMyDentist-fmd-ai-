"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

/**
 * Starts its children over on every visit. With cacheComponents, Next keeps a page's state when you leave it and shows
 * it again on return, so a sign-in or onboarding flow would reopen at its last step with old details. The reset runs
 * when the page is hidden, so a returning visitor never sees the old state. (In development, React's double mount
 * makes this remount once on first load.)
 */
export function Fresh({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  useEffect(() => () => setVisit((v) => v + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}
