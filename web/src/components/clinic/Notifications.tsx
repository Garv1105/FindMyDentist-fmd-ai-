"use client";

import { Bell, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/app/kit";
import { listNotices, markNoticesRead, type Notice } from "@/sample/clinic";
import { useDismiss } from "./dismiss";

const clock = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/** The bell and its panel (PRD 15): a dropdown on laptops, a sheet from the bottom on phones. */
export function Notifications({ clinicId, base }: { clinicId: string; base: string }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panel, bell);

  useEffect(() => {
    listNotices(clinicId).then(setItems);
  }, [clinicId]);

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    await markNoticesRead(clinicId);
    setItems(await listNotices(clinicId));
  };
  const unread = items.some((n) => !n.read);

  return (
    <div className="relative">
      <IconButton ref={bell} label={unread ? "Notifications, unread" : "Notifications"} aria-expanded={open} onClick={toggle}>
        <Bell className="size-[18px]" strokeWidth={1.5} />
        {unread && <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />}
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-label="Notifications"
            className="app-panel fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-b-none p-4 lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-[calc(100%+10px)] lg:w-[380px] lg:rounded-b-[22px]"
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[16px] font-medium text-ink">Notifications</p>
              <IconButton label="Close notifications" className="size-9 lg:hidden" onClick={() => setOpen(false)}>
                <X className="size-4" strokeWidth={1.5} />
              </IconButton>
            </div>
            {items.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-ink-3">You&apos;re all caught up</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id} className="border-t border-line first:border-0">
                    <Link href={`${base}/${n.href}`} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl px-1 py-3 hover:bg-[var(--accent-soft)]">
                      <span className="text-[14.5px] leading-snug text-ink">
                        {n.text}
                        <span className="mt-0.5 block text-[13px] text-ink-3">{clock(n.at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
