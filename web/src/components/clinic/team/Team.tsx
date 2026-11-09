"use client";

import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { ACCESS, changeRole, inviteMember, listTeam, type Member, type TeamRole } from "@/sample/team";
import { useClinic } from "../Shell";

const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const ROLES: TeamRole[] = ["Associate dentist", "Hygienist", "Front desk"];
const BRANCH: Record<string, string> = { main: "Main", kora: "Koramangala" };

export function Team() {
  const { clinic, user } = useClinic();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState("");
  const isOwner = user.role === "clinic_owner";
  const load = useCallback(() => listTeam(clinic.id).then(setTeam), [clinic.id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!team)
    return (
      <div aria-busy aria-label="Loading">
        <Panel className="h-[260px] motion-safe:animate-pulse" />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
          {toast}
        </p>
      )}
      <Panel as="section" className="p-4 sm:p-5">
        <div className={h2}>
          <h2>
            People <span className="text-[13px] font-normal text-ink-3">{team.length} at {clinic.name}</span>
          </h2>
          {isOwner && (
            <Button size="sm" onClick={() => setInviting(true)}>
              <UserPlus className="size-4" strokeWidth={1.75} /> Invite
            </Button>
          )}
        </div>
        <ul className="mt-2">
          {team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-0">
              <span className="min-w-0">
                <span className="block text-[15px] text-ink">
                  {m.name} {m.demoUserId === user.id && <span className="text-[13px] text-ink-3">(you)</span>}
                </span>
                <span className="block text-[13px] text-ink-3">
                  {m.branches.map((b) => BRANCH[b] ?? b).join(", ")}
                  {m.chair ? ` · ${m.chair}` : ""}
                  {isOwner ? ` · ${m.phone}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {m.status === "invited" && <Tag tone="warn">Invited</Tag>}
                {isOwner && m.role !== "Owner" ? (
                  <>
                    <label htmlFor={`role-${m.id}`} className="sr-only">
                      Role for {m.name}
                    </label>
                    <select
                      id={`role-${m.id}`}
                      className="h-9 rounded-full border border-line bg-[var(--surface-glass)] px-3 text-[14px] text-ink outline-none [color-scheme:dark]"
                      value={m.role}
                      onChange={async (e) => {
                        await changeRole(clinic.id, m.id, e.target.value as TeamRole, user.role);
                        void load();
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <Tag tone={m.role === "Owner" ? "accent" : "muted"}>{m.role}</Tag>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>What each role can open</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          {Object.entries(ACCESS).map(([role, what]) => (
            <div key={role} className="contents">
              <dt className="text-[14.5px] text-ink">{role}</dt>
              <dd className="mb-2 text-[14px] text-ink-2 sm:mb-0">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-ink-3">Reports never show diagnoses or notes, and money stays with the owner.</p>
      </Panel>

      {inviting && (
        <Invite
          branches={clinic.branches.map((b) => b.id)}
          onClose={() => setInviting(false)}
          onSave={async (input) => {
            const m = await inviteMember(clinic.id, input, user.role);
            setInviting(false);
            setToast(`${m.name} invited as ${m.role}. In the demo no message is sent; once live, they get a sign-in link by SMS.`);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Invite({ branches, onClose, onSave }: { branches: string[]; onClose: () => void; onSave: (i: { name: string; phone: string; role: TeamRole; branch: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<TeamRole>("Associate dentist");
  const [branch, setBranch] = useState(branches[0]);
  const [error, setError] = useState("");
  return (
    <Sheet title="Invite someone" onClose={onClose}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave({ name, phone, role, branch });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Field label="Name">
          <input id="inv-name" className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mobile number">
          <input id="inv-phone" className={fieldCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Role">
          <select id="inv-role" className={fieldCls} value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Branch">
          <select id="inv-branch" className={fieldCls} value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b} value={b}>
                {BRANCH[b] ?? b}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">Send invite</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
