"use client";

import { Briefcase, CalendarDays, Compass, FolderLock, House, Search, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { available, setLang, useT, type Lang, type MessageKey } from "@/lib/i18n";
import { SHOW_ACCOUNT } from "@/toggle";
import { AccountMenu } from "./AccountMenu";
import { NotificationsBell } from "./help/Support";

/**
 * The FMD Main app frame for every page except the homepage: a top bar on laptops, a tab bar on phones. A link whose
 * part isn't built yet shows as "Soon" instead of leading to a missing page; flip `ready` when its part lands.
 */
type Item = { href: string; label: MessageKey; Icon: LucideIcon; ready: boolean };

const TOP: Item[] = [
  { href: "/assistant", label: "nav.ai", Icon: Sparkles, ready: true },
  { href: "/dentists", label: "nav.find", Icon: Search, ready: true },
  { href: "/explore", label: "nav.explore", Icon: Compass, ready: true },
  { href: "/records", label: "nav.records", Icon: FolderLock, ready: true },
  { href: "/appointments", label: "nav.appointments", Icon: CalendarDays, ready: true },
  { href: "/jobs", label: "nav.jobs", Icon: Briefcase, ready: true },
];

const TABS: Item[] = [
  { href: "/", label: "tab.home", Icon: House, ready: true },
  { href: "/dentists", label: "tab.find", Icon: Search, ready: true },
  { href: "/explore", label: "nav.explore", Icon: Compass, ready: true },
  { href: "/records", label: "nav.records", Icon: FolderLock, ready: true },
  { href: "/account", label: "tab.me", Icon: UserRound, ready: true },
];

const isOn = (path: string, href: string) => href !== "/" && !href.startsWith("/#") && (path === href || path.startsWith(`${href}/`));

function Soon() {
  const { t } = useT();
  return <span className="rounded-full border border-line px-1.5 text-[10.5px] uppercase tracking-[0.08em] text-ink-4">{t("soon")}</span>;
}

/** Legal links, and (development only, until a reviewed translation exists) the language switch. */
function Footer() {
  const { lang } = useT();
  const langs = available();
  return (
    <footer className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-3 pb-6 text-[13px] text-ink-3 sm:px-5">
      <span>© FindMyDentist</span>
      <Link href="/terms" className="hover:text-ink">Terms of Use</Link>
      <Link href="/privacy" className="hover:text-ink">Privacy Notice</Link>
      <Link href="/help" className="hover:text-ink">Help</Link>
      {langs.length > 1 && (
        <label className="ml-auto flex items-center gap-2">
          Language
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-line bg-[var(--surface-glass)] px-2 py-1 text-ink">
            {langs.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </label>
      )}
    </footer>
  );
}

export function MainShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { t } = useT();
  return (
    <div className="app-glow min-h-dvh pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="app-panel app-solid mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-3 sm:px-4">
          <Link href="/" aria-label="FindMyDentist home" className="shrink-0">
            <Image src="/img/logo-fmd.webp" alt="FindMyDentist" width={337} height={180} priority className="h-10 w-auto" />
          </Link>
          {SHOW_ACCOUNT && (
            <nav aria-label="FMD" className="ml-4 hidden items-center gap-0.5 lg:flex">
              {TOP.map(({ href, label, Icon, ready }) =>
                ready ? (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isOn(path, href) ? "page" : undefined}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] transition-colors ${
                      isOn(path, href) ? "bg-[var(--accent-soft)] text-ink" : "text-ink-2 hover:bg-[var(--surface-glass)] hover:text-ink"
                    }`}
                  >
                    <Icon className="size-4" strokeWidth={1.5} />
                    {t(label)}
                  </Link>
                ) : (
                  <span key={href} aria-disabled className="inline-flex cursor-default items-center gap-2 px-3.5 py-2 text-[14px] text-ink-4">
                    <Icon className="size-4" strokeWidth={1.5} />
                    {t(label)} <Soon />
                  </span>
                ),
              )}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {SHOW_ACCOUNT && <NotificationsBell />}
            {SHOW_ACCOUNT && <AccountMenu />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-3 py-6 sm:px-5 sm:py-8">{children}</main>
      <Footer />

      {SHOW_ACCOUNT && (
        <nav
          aria-label="FMD"
          className="app-panel app-solid fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 rounded-b-none border-x-0 border-b-0 px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {TABS.map(({ href, label, Icon, ready }) => {
            const on = isOn(path, href);
            const inner = (
              <>
                <Icon className="size-5" strokeWidth={on ? 2 : 1.5} />
                <span className="text-[11.5px]">{t(label)}</span>
                {!ready && <span className="sr-only">(coming soon)</span>}
              </>
            );
            const cls = "flex min-h-[60px] flex-col items-center justify-center gap-1";
            return ready ? (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`${cls} ${on ? "text-ink" : "text-ink-3 hover:text-ink"}`}>
                {inner}
              </Link>
            ) : (
              <span key={href} aria-disabled className={`${cls} text-ink-4 opacity-60`}>
                {inner}
              </span>
            );
          })}
        </nav>
      )}
    </div>
  );
}
