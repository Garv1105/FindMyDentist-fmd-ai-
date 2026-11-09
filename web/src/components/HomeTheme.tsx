"use client";

import { useEffect } from "react";
import { DEFAULT_THEME, resolveTheme, STORAGE_KEY } from "@/lib/themes";

/**
 * The homepage is drawn for the dark look (its planet, glows and artwork), so it shows dark whatever theme is chosen.
 * The head script already opens "/" dark; this covers arriving here from another page, and puts the visitor's own
 * theme back when they leave.
 */
export default function HomeTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = DEFAULT_THEME;
    return () => {
      let choice: string | null = null;
      try {
        choice = localStorage.getItem(STORAGE_KEY);
      } catch {}
      root.dataset.theme = resolveTheme(choice);
    };
  }, []);
  return null;
}
