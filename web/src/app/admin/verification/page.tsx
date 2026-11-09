"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

type Claim = { id: string; dentist_id: string; dentist_name: string; claimant: string; registration_number: string; council: string; note: string; status: string; created_at: number };

export default function VerificationQueue() {
  const me = useMe();
  const isOps = !!me?.roles.some((r) => r === "fmd_ops" || r === "super_admin");
  return (
    <Page>
      <p className="eyebrow">FMD Operations</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink">Profile verification</h1>
      <p className="mt-2 max-w-xl text-[13.5px] text-ink-4">
        Approving links the profile to the dentist&apos;s account and shows a Verified badge. Patients see exactly the checks you record here, so record only what you actually verified.
      </p>
      <div className="mt-8">
        {me === null && (
          <Notice kind="info">
            Staff sign-in required. <Link href="/signin?next=/admin/verification" className="underline">Sign in</Link>
          </Notice>
        )}
        {me && !isOps && <Notice kind="error">This area is for FMD staff.</Notice>}
        {isOps && <Claims />}
      </div>
    </Page>
  );
}

function Claims() {
  const [items, setItems] = useState<Claim[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ items: Claim[] }>("/api/admin/claims").then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  }, []);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!items) return <p className="text-ink-4">Loading…</p>;
  if (!items.length) return <p className="rounded-2xl border border-line p-6 text-center text-[13px] text-ink-4">No claims yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <ClaimRow key={c.id} c={c} onDecided={setItems} />
      ))}
    </ul>
  );
}

function ClaimRow({ c, onDecided }: { c: Claim; onDecided: (items: Claim[]) => void }) {
  const [checks, setChecks] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const decide = async (decision: "approve" | "reject") => {
    setErr("");
    try {
      onDecided((await api<{ items: Claim[] }>(`/api/admin/claims/${c.id}`, { method: "POST", body: { decision, checks, reason } })).items);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <li className="glass rounded-[22px] p-5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink">{c.claimant}</span>
        <span className="text-ink-4">claims</span>
        <Link href={`/dentists/${c.dentist_id}`} className="text-ink underline underline-offset-4">
          {c.dentist_name}
        </Link>
        <span className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-[12px] capitalize text-ink-3">{c.status}</span>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">
        Registration {c.registration_number} · {c.council} · submitted {new Date(c.created_at).toLocaleDateString("en-IN")}
      </p>
      {c.note && <p className="mt-1 text-[12.5px] text-ink-4">“{c.note}”</p>}
      {c.status === "submitted" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <textarea aria-label="Checks performed" rows={2} placeholder="What you verified, e.g. 'Registration confirmed on the KSDC register, 11 Oct 2026'" value={checks} onChange={(e) => setChecks(e.target.value)} className={`${inputCls} h-auto py-2.5 text-[13px]`} />
          <textarea aria-label="Rejection reason" rows={2} placeholder="Reason shown to the dentist if rejecting" value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} h-auto py-2.5 text-[13px]`} />
          <button onClick={() => decide("approve")} className="btn-primary h-10 text-[13px]">
            Approve & verify
          </button>
          <button onClick={() => decide("reject")} className="btn-ghost h-10 text-[13px]">
            Reject
          </button>
        </div>
      )}
      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </li>
  );
}
