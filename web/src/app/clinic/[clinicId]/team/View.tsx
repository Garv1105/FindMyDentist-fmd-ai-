"use client";

import { Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { H, useClinic } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";
import { accountChanged, api, CLINIC_ROLE_LABELS, useMe, type ApiClinicRole } from "@/lib/me";

/*
 * The clinic's team lives in the FastAPI service (/api/v1/clinics/{id}/members, /invitations): one role per person,
 * invitations by email. A change reaches this app's workspace when that person next signs in or opens it.
 */
type Member = { user: { id: string; full_name: string; phone: string; email: string | null }; role: ApiClinicRole; status: "active" | "deactivated" };
type Invite = { id: string; email: string; role: ApiClinicRole; expires_at: string; url?: string };
const ROLES = Object.entries(CLINIC_ROLE_LABELS) as [ApiClinicRole, string][];
const selectCls = `${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`;

export default function TeamPage() {
  const { ws, can } = useClinic();
  const me = useMe();
  const base = `/api/v1/clinics/${ws.apiClinicId}`;
  const manage = can("staff.manage");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [f, setF] = useState<{ email: string; role: ApiClinicRole }>({ email: "", role: "receptionist" });
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(
    () =>
      Promise.all([api<Member[]>(`${base}/members`), manage ? api<Invite[]>(`${base}/invitations`) : Promise.resolve([])])
        .then(([m, i]) => {
          setMembers(m);
          setInvites(i);
        })
        .catch((e) => setErr(e.message)),
    [base, manage],
  );
  useEffect(() => {
    if (ws.apiClinicId) load();
  }, [load, ws.apiClinicId]);
  const act = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!ws.apiClinicId) return <Notice kind="info">This demo workspace isn&apos;t linked to a clinic account, so its team can&apos;t be managed here.</Notice>;

  return (
    <>
      <H title="Team" desc="Each role sees only what it needs. Finance never sees clinical notes; front desk can't sign them; only owners manage staff and settings." />
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="space-y-2">
          {!members && <li className="text-[13px] text-ink-4">Loading…</li>}
          {members?.map((m) => {
            const self = m.user.id === me?.id;
            const off = m.status === "deactivated";
            return (
              <li key={m.user.id} className={`glass flex flex-wrap items-center gap-3 rounded-[16px] p-4 text-[13px] ${off ? "opacity-60" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">
                    {m.user.full_name}
                    {self && <span className="text-ink-4"> (you)</span>}
                  </span>
                  <span className="block text-[12px] text-ink-4">{[m.user.phone, m.user.email].filter(Boolean).join(" · ")}</span>
                </span>
                {manage && !off ? (
                  <select
                    aria-label={`Role of ${m.user.full_name}`}
                    value={m.role}
                    onChange={(e) =>
                      act(async () => {
                        await api(`${base}/members/${m.user.id}`, { method: "PATCH", body: { role: e.target.value } });
                        if (self) await accountChanged();
                      })
                    }
                    className={`${selectCls} w-[140px]`}
                  >
                    {ROLES.map(([r, l]) => (
                      <option key={r} value={r}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-3">{off ? "Removed" : CLINIC_ROLE_LABELS[m.role]}</span>
                )}
                {manage && !self && (
                  <button
                    onClick={() =>
                      (off || confirm(`Remove ${m.user.full_name} from this clinic? They lose access when they next open it.`)) &&
                      act(() => api(`${base}/members/${m.user.id}`, { method: "PATCH", body: { status: off ? "active" : "deactivated" } }))
                    }
                    className="text-[12px] text-ink-3 underline underline-offset-4"
                  >
                    {off ? "Restore" : "Remove"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {manage && (
          <aside className="glass space-y-2 rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">Invite staff</h2>
            <p className="text-[12px] text-ink-4">They get an email with a link. It works once, for that email address, within 7 days.</p>
            <input aria-label="Email" type="email" placeholder="Their email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
            <select aria-label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as ApiClinicRole })} className={selectCls}>
              {ROLES.map(([r, l]) => (
                <option key={r} value={r}>
                  {l}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                act(async () => {
                  const r = await api<Invite>(`${base}/invitations`, { method: "POST", body: { email: f.email.trim(), role: f.role } });
                  setLink(r.url ?? "");
                  setF({ ...f, email: "" });
                })
              }
              className="btn-primary h-9 w-full text-[12.5px]"
            >
              Send invitation
            </button>
            {link && (
              <div className="rounded-xl border border-line p-3 text-[12px] text-ink-2">
                Sent. You can also share the link yourself (shown only now):
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-ink">{link}</span>
                  <button onClick={() => navigator.clipboard?.writeText(link)} aria-label="Copy link" className="shrink-0 text-ink-3 hover:text-ink">
                    <Copy className="size-3.5" strokeWidth={1.75} />
                  </button>
                </span>
              </div>
            )}
            {invites.length > 0 && (
              <ul className="space-y-1.5 pt-2 text-[12px] text-ink-3">
                <li className="text-ink-2">Waiting to be accepted</li>
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {i.email} · {CLINIC_ROLE_LABELS[i.role]} · until {new Date(i.expires_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                    <button onClick={() => act(() => api(`${base}/invitations/${i.id}`, { method: "DELETE" }))} className="underline underline-offset-4">
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
