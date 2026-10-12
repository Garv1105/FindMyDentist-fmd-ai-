"use client";

import { useCallback, useEffect, useState } from "react";
import { H, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Team = { members: { userId: string; name: string; contact: string; roles: string[] }[]; invites: { id: string; email: string; role: string; expires_at: number }[] };
const ROLES: [string, string][] = [
  ["owner", "Owner / admin"],
  ["dentist", "Dentist"],
  ["front_desk", "Front desk"],
  ["finance", "Finance"],
  ["assistant", "Assistant"],
];

export default function TeamPage() {
  const { call, can } = useClinic();
  const [t, setT] = useState<Team | null>(null);
  const [f, setF] = useState({ email: "", role: "front_desk" });
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => call<Team>("members").then(setT).catch((e) => setErr(e.message)), [call]);
  useEffect(() => {
    load();
  }, [load]);
  const manage = can("staff.manage");
  const act = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <>
      <H title="Team" desc="Each role sees only what it needs. Finance never sees clinical notes; front desk can't sign them; only owners manage staff and settings." />
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="space-y-2">
          {t?.members.map((m) => (
            <li key={m.userId} className="glass rounded-[16px] p-4 text-[13px]">
              <p className="text-ink">{m.name}</p>
              <p className="text-[12px] text-ink-4">{m.contact}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ROLES.map(([r, label]) => {
                  const on = m.roles.includes(r);
                  return manage ? (
                    <button key={r} aria-pressed={on} onClick={() => act(() => call(`members/${m.userId}/roles`, "POST", { roles: on ? m.roles.filter((x) => x !== r) : [...m.roles, r] }))} className={`rounded-full border px-2.5 py-0.5 text-[12px] ${on ? "border-line-strong bg-[var(--accent-soft)] text-ink" : "border-line text-ink-4"}`}>
                      {label}
                    </button>
                  ) : (
                    on && (
                      <span key={r} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-3">
                        {label}
                      </span>
                    )
                  );
                })}
                {manage && (
                  <button onClick={() => confirm(`Remove ${m.name} from this clinic?`) && act(() => call(`members/${m.userId}/roles`, "POST", { roles: [] }))} className="ml-auto text-[12px] text-ink-3 underline underline-offset-4">
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {manage && (
          <aside className="glass space-y-2 rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">Invite staff</h2>
            <input aria-label="Email" placeholder="Their email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
            <select aria-label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={`${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`}>
              {ROLES.map(([r, l]) => (
                <option key={r} value={r}>
                  {l}
                </option>
              ))}
            </select>
            <button onClick={() => act(() => call<{ link: string }>("members/invite", "POST", f).then((r) => setLink(location.origin + r.link)))} className="btn-primary h-9 w-full text-[12.5px]">
              Create invitation
            </button>
            {link && (
              <p className="break-all rounded-xl border border-line p-3 text-[12px] text-ink-2">
                Email isn&apos;t connected yet, so share this link with them yourself. It works once, for that email address, within 7 days:
                <br />
                <span className="font-mono text-ink">{link}</span>
              </p>
            )}
            {t && t.invites.length > 0 && (
              <ul className="space-y-1 pt-2 text-[12px] text-ink-3">
                {t.invites.map((i) => (
                  <li key={i.id}>
                    {i.email} · {i.role} · expires {when(i.expires_at)}
                    <button onClick={() => act(() => call(`invites/${i.id}/revoke`, "POST"))} className="ml-2 underline underline-offset-4">
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
