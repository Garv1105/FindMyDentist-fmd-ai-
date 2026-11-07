"use client";

import { Building2, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { EmailSettings } from "@/components/auth/security";
import { inputCls, Notice, Page } from "@/components/Page";
import { CITIES } from "@/lib/catalog";
import { accountChanged, api, CLINIC_ROLE_LABELS, useMe, type Me, type Workspace } from "@/lib/me";

type Clinic = { id: string; name: string; area: string; city: string; status: string; roles: string[] };

/**
 * Your clinics. A clinic and its team live in the FastAPI service (POST /api/v1/clinics); its workspace here (calendar,
 * patients, billing…) is set up right after, by the owner.
 */
export default function ClinicHome() {
  const me = useMe();
  const [items, setItems] = useState<Clinic[] | null>(null);
  useEffect(() => {
    if (me) api<{ items: Clinic[] }>("/api/clinic").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [me]);
  // clinics of yours in FastAPI with no workspace here yet
  const pending = me?.workspaces.filter((w) => !w.workspace_id) ?? [];
  return (
    <Page>
      <p className="eyebrow">FMD Clinic OS</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Your clinics</h1>
      <p className="mt-2 max-w-2xl text-[13.5px] text-ink-4">
        Clinic management with an AI clinic manager that prepares work for your approval. Clinic OS is a separate subscription from your dentist membership (₹2,000/month, excl. GST).
      </p>
      <div className="mt-8">
        {me === null && (
          <Notice kind="info">
            <Link href="/signin?next=/clinic" className="underline">Sign in</Link> to open Clinic OS.
          </Notice>
        )}
        {me && items && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <ul className="space-y-3">
              {items.length === 0 && pending.length === 0 && (
                <li className="glass rounded-[22px] p-8 text-center text-[13.5px] text-ink-4">You&apos;re not part of a clinic yet. Create one, or ask a clinic owner for an invitation.</li>
              )}
              {items.map((c) => (
                <li key={c.id}>
                  <Link href={`/clinic/${c.id}`} className="glass glass-interactive flex items-center gap-4 rounded-[22px] p-5">
                    <span className="icon-tile size-11">
                      <Building2 className="size-5" strokeWidth={1.4} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[16px] text-ink">{c.name}</span>
                      <span className="block text-[12.5px] text-ink-4">
                        {[c.area, c.city].filter(Boolean).join(", ")} · {c.roles.join(", ").replace("front_desk", "front desk")}
                      </span>
                    </span>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] capitalize text-ink-3">{c.status === "setup" ? "Setup" : c.status}</span>
                  </Link>
                </li>
              ))}
              {pending.map((w) => (
                <PendingClinic key={w.clinic_id} w={w} />
              ))}
            </ul>
            <Create me={me} />
          </div>
        )}
      </div>
    </Page>
  );
}

/** A FastAPI clinic without a workspace here: its owner finishes the setup; staff wait for that. */
function PendingClinic({ w }: { w: Workspace }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="glass rounded-[22px] p-5">
      <div className="flex items-center gap-4">
        <span className="icon-tile size-11">
          <Clock3 className="size-5" strokeWidth={1.4} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] text-ink">{w.clinic_name}</span>
          <span className="block text-[12.5px] text-ink-4">
            {CLINIC_ROLE_LABELS[w.role]} · {w.role === "owner" ? "workspace not set up yet" : "waiting for the owner to set up the workspace"}
          </span>
        </span>
        {w.role === "owner" && !open && (
          <button onClick={() => setOpen(true)} className="btn-primary h-9 px-4 text-[12.5px]">
            Set up workspace
          </button>
        )}
      </div>
      {open && (
        <div className="mt-4">
          <WorkspaceForm apiClinicId={w.clinic_id} name={w.clinic_name} />
        </div>
      )}
    </li>
  );
}

const fieldCls = `${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`;

/** This app's details for a FastAPI clinic (area and address are used by the dentist directory), then its workspace. */
function WorkspaceForm({ apiClinicId, name }: { apiClinicId: string; name: string }) {
  const router = useRouter();
  const [f, setF] = useState({ city: "Bengaluru", area: "", address: "" });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const { clinicId } = await api<{ clinicId: string }>("/api/clinic", { method: "POST", body: { apiClinicId, name, ...f } });
      await accountChanged();
      router.push(`/clinic/${clinicId}/settings`);
    } catch (er) {
      setErr((er as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={fieldCls}>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input aria-label="Area" placeholder="Area" required value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className={fieldCls} />
      </div>
      <input aria-label="Address" placeholder="Address (optional)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={fieldCls} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-primary h-10 w-full text-[13px]">Set up workspace</button>
    </form>
  );
}

/** Create a clinic: in FastAPI (needs a verified email - it's the clinic owner's contact), then its workspace here. */
function Create({ me }: { me: Me }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", city: "Bengaluru", area: "", address: "", phone: "", email: "", gstin: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!me.emailVerified)
    return (
      <div className="glass space-y-3 rounded-[22px] p-5">
        <h2 className="text-[15px] text-ink">Create a clinic</h2>
        <p className="text-[12.5px] text-ink-4">First verify your email: it&apos;s how FMD and your staff reach the clinic owner.</p>
        <EmailSettings me={me} />
      </div>
    );

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const clinic = await api<{ id: string }>("/api/v1/clinics", {
        method: "POST",
        body: { name: f.name.trim(), city: f.city, phone: f.phone, email: f.email.trim() || null, gstin: f.gstin.trim() || null },
      });
      const { clinicId } = await api<{ clinicId: string }>("/api/clinic", {
        method: "POST",
        body: { apiClinicId: clinic.id, name: f.name.trim(), city: f.city, area: f.area, address: f.address, phone: f.phone },
      });
      await accountChanged();
      router.push(`/clinic/${clinicId}/settings`);
    } catch (er) {
      setErr((er as Error).message);
      setBusy(false);
      await accountChanged(); // if the clinic was created, it now shows as "set up workspace"
    }
  };
  return (
    <form onSubmit={submit} className="glass space-y-2 rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Create a clinic</h2>
      <p className="text-[12px] text-ink-4">You become its owner. The workspace starts in setup mode; FMD verifies the clinic before it goes live.</p>
      <input aria-label="Clinic name" placeholder="Clinic name" required maxLength={200} value={f.name} onChange={set("name")} className={fieldCls} />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="City" value={f.city} onChange={set("city")} className={fieldCls}>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input aria-label="Area" placeholder="Area" required value={f.area} onChange={set("area")} className={fieldCls} />
      </div>
      <input aria-label="Address" placeholder="Address (optional)" value={f.address} onChange={set("address")} className={fieldCls} />
      <input aria-label="Clinic phone" placeholder="Clinic phone" required type="tel" value={f.phone} onChange={set("phone")} className={fieldCls} />
      <input aria-label="Clinic email" placeholder="Clinic email (optional)" type="email" value={f.email} onChange={set("email")} className={fieldCls} />
      <input aria-label="GSTIN" placeholder="GSTIN (optional)" maxLength={15} value={f.gstin} onChange={set("gstin")} className={`${fieldCls} uppercase`} />
      {err && <Notice kind="error">{err}</Notice>}
      <button disabled={busy} className="btn-primary h-10 w-full text-[13px] disabled:opacity-50">
        {busy ? "Creating…" : "Create clinic"}
      </button>
    </form>
  );
}
