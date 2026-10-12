"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { CITIES } from "@/lib/catalog";
import { api, useMe } from "@/lib/me";

type Clinic = { id: string; name: string; area: string; city: string; status: string; roles: string[] };

export default function ClinicHome() {
  const me = useMe();
  const [items, setItems] = useState<Clinic[] | null>(null);
  useEffect(() => {
    if (me) api<{ items: Clinic[] }>("/api/clinic").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [me]);
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
        {items && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <ul className="space-y-3">
              {items.length === 0 && <li className="glass rounded-[22px] p-8 text-center text-[13.5px] text-ink-4">You&apos;re not part of a clinic workspace yet.</li>}
              {items.map((c) => (
                <li key={c.id}>
                  <Link href={`/clinic/${c.id}`} className="glass glass-interactive flex items-center gap-4 rounded-[22px] p-5">
                    <span className="icon-tile size-11">
                      <Building2 className="size-5" strokeWidth={1.4} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[16px] text-ink">{c.name}</span>
                      <span className="block text-[12.5px] text-ink-4">
                        {c.area}, {c.city} · {c.roles.join(", ")}
                      </span>
                    </span>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] capitalize text-ink-3">{c.status === "setup" ? "Setup" : c.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {me?.accountType === "dentist" ? (
              <Create />
            ) : (
              <p className="glass rounded-[22px] p-5 text-[13px] text-ink-4">Clinic workspaces are created from a dentist account. Staff join through an invitation from the clinic owner.</p>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function Create() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", city: "Bengaluru", area: "", address: "", phone: "" });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const { clinicId } = await api<{ clinicId: string }>("/api/clinic", { method: "POST", body: f });
      router.push(`/clinic/${clinicId}/settings`);
    } catch (er) {
      setErr((er as Error).message);
    }
  };
  const cls = `${inputCls} h-10 text-[13px] [&>option]:bg-[var(--surface)]`;
  return (
    <form onSubmit={submit} className="glass space-y-2 rounded-[22px] p-5">
      <h2 className="text-[15px] text-ink">Set up a clinic workspace</h2>
      <p className="text-[12px] text-ink-4">Starts in setup mode. FMD verifies the clinic before it goes live.</p>
      <input aria-label="Clinic name" placeholder="Clinic name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={cls} />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={cls}>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input aria-label="Area" placeholder="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className={cls} />
      </div>
      <input aria-label="Address" placeholder="Address (optional)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={cls} />
      <input aria-label="Clinic phone" placeholder="Clinic phone (optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={cls} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-primary h-10 w-full text-[13px]">Create workspace</button>
    </form>
  );
}
