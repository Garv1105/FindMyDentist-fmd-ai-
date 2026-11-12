"use client";

import { useSyncExternalStore } from "react";

/**
 * Text in more than one language (PDR §17, Annex K). Messages live here by key; screens move onto it one at a time,
 * starting with the app shell. English is the source. Other languages are added only after a person has reviewed
 * them: the Hindi below is a draft by the developer, unreviewed, so it can be switched on only in development.
 */
const en = {
  "nav.ai": "Ask FMD AI",
  "nav.find": "Find a dentist",
  "nav.explore": "Explore",
  "nav.records": "Records",
  "nav.appointments": "Appointments",
  "nav.jobs": "Jobs",
  "tab.home": "Home",
  "tab.find": "Find",
  "tab.me": "Me",
  soon: "Soon",
  "menu.appointments": "My appointments",
  "menu.edge": "FMD Edge requests",
  "menu.saved": "Saved",
  "menu.account": "Account",
  "menu.help": "Help",
  "menu.logout": "Log out",
  "menu.login": "Log in",
  "menu.signup": "Create account",
  "menu.demo": "Try a demo account",
  "menu.profile": "Log in or create an account",
} as const;
export type MessageKey = keyof typeof en;

/** DRAFT, not reviewed by a native speaker or a clinician. Never shown on the live site. */
const hiDraft: Record<MessageKey, string> = {
  "nav.ai": "FMD AI से पूछें",
  "nav.find": "डेंटिस्ट खोजें",
  "nav.explore": "एक्सप्लोर",
  "nav.records": "रिकॉर्ड",
  "nav.appointments": "अपॉइंटमेंट",
  "nav.jobs": "नौकरियाँ",
  "tab.home": "होम",
  "tab.find": "खोजें",
  "tab.me": "मैं",
  soon: "जल्द",
  "menu.appointments": "मेरे अपॉइंटमेंट",
  "menu.edge": "FMD Edge अनुरोध",
  "menu.saved": "सेव किए गए",
  "menu.account": "खाता",
  "menu.help": "मदद",
  "menu.logout": "लॉग आउट",
  "menu.login": "लॉग इन",
  "menu.signup": "अकाउंट बनाएं",
  "menu.demo": "डेमो अकाउंट आज़माएं",
  "menu.profile": "लॉग इन करें या अकाउंट बनाएं",
};

export const LANGUAGES = [
  { code: "en", label: "English", messages: en, reviewed: true },
  { code: "hi", label: "हिन्दी (draft, unreviewed)", messages: hiDraft, reviewed: false },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];

/** only reviewed languages on the live site */
export const available = () => LANGUAGES.filter((l) => l.reviewed || process.env.NODE_ENV !== "production");

const KEY = "fmd-lang";
const listeners = new Set<() => void>();
function current(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return available().some((l) => l.code === v) ? (v as Lang) : "en";
  } catch {
    return "en";
  }
}
export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // stays for this page only
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

/** t("nav.find"). Renders English on the server and first paint, then the chosen language. */
export function useT() {
  const lang = useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    current,
    () => "en" as Lang,
  );
  const messages = LANGUAGES.find((l) => l.code === lang)!.messages as Record<MessageKey, string>;
  return { lang, t: (k: MessageKey) => messages[k] ?? en[k] };
}
