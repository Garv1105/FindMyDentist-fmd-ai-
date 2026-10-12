"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import type { ProviderProfile } from "@/components/providers";
import { ProfileBody } from "@/components/sections/ProfileDrawer";
import { BookingPanel } from "@/components/booking/BookingPanel";
import { api, useMe } from "@/lib/me";

export function DentistView() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<ProviderProfile | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<ProviderProfile>(`/api/providers/${id}`).then(setP).catch((e) => setErr(e.message));
  }, [id]);

  return (
    <Page>
      <Link href="/#dentists" className="text-[13px] text-ink-3 hover:text-ink">
        ← Back to dentists
      </Link>
      {err && (
        <div className="mt-6">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
      {!p && !err && <p className="mt-6 text-ink-4">Loading profile…</p>}
      {p && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="glass rounded-[28px] p-6 sm:p-8">
            {p.demo && <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-ink-4">Demo profile · not a real practitioner</p>}
            <ProfileBody p={p} />
          </section>
          <div className="space-y-6">
            <section id="book" className="glass scroll-mt-28 rounded-[28px] p-6 sm:p-8">
              <Suspense fallback={<p className="text-[13px] text-ink-4">Loading…</p>}>
                <BookingPanel profile={p} />
              </Suspense>
            </section>
            {!p.claimed && <ClaimPanel id={p.id} name={p.name} />}
          </div>
        </div>
      )}
    </Page>
  );
}

function ClaimPanel({ id, name }: { id: string; name: string }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ registrationNumber: "", council: "", note: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/api/providers/${id}/claim`, { method: "POST", body: f });
      setMsg({ kind: "success", text: "Claim submitted. FMD will verify your registration before the profile is linked to your account." });
      setOpen(false);
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  };
  return (
    <section className="rounded-[24px] border border-dashed border-line-strong p-5">
      <h2 className="text-[15px] text-ink">Are you {name}?</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-4">Claim this profile to manage it. FMD checks your dental council registration before linking it to your account.</p>
      {me === null && (
        <Link href={`/signin?next=/dentists/${id}`} className="btn-ghost mt-4 h-10 px-4 text-[13px]">
          Sign in to claim
        </Link>
      )}
      {me && me.accountType !== "dentist" && <p className="mt-3 text-[12.5px] text-ink-4">Only dentist accounts can claim a profile.</p>}
      {me?.accountType === "dentist" && !open && !msg && (
        <button onClick={() => setOpen(true)} className="btn-ghost mt-4 h-10 px-4 text-[13px]">
          Claim this profile
        </button>
      )}
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input aria-label="Registration number" placeholder="Dental council registration number" value={f.registrationNumber} onChange={(e) => setF({ ...f, registrationNumber: e.target.value })} className={inputCls} />
          <input aria-label="Council" placeholder="e.g. Karnataka State Dental Council" value={f.council} onChange={(e) => setF({ ...f, council: e.target.value })} className={inputCls} />
          <textarea aria-label="Note" placeholder="Anything that helps us verify (optional)" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={`${inputCls} h-auto py-3`} />
          <button className="btn-primary h-10 px-5 text-[13px]">Submit claim</button>
        </form>
      )}
      {msg && (
        <div className="mt-3">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </section>
  );
}
