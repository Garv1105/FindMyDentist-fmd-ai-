"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, useMe } from "@/lib/me";

type W = { clinic_id: string; name: string; city: string; area: string; status: string; created_at: number; owner: string; owner_contact: string | null };

/** Onboarding queue: FMD staff activate a clinic workspace after verifying it and setting up the subscription. */
export default function ClinicActivation() {
  const me = useMe();
  const isOps = !!me?.roles.some((r) => r === "fmd_ops" || r === "super_admin");
  const [items, setItems] = useState<W[] | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (isOps) api<{ items: W[] }>("/api/admin/clinics").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [isOps, v]);
  return (
    <Page>
      <p className="eyebrow">FMD Operations</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink">Clinic activation</h1>
      <div className="mt-8 space-y-3">
        {me === null && (
          <Notice kind="info">
            Staff sign-in required. <Link href="/signin?next=/admin/clinics" className="underline">Sign in</Link>
          </Notice>
        )}
        {me && !isOps && <Notice kind="error">This area is for FMD staff.</Notice>}
        {items?.length === 0 && <p className="text-[13px] text-ink-4">No clinic workspaces yet.</p>}
        {items?.map((w) => <Row key={w.clinic_id} w={w} onDone={() => setV((x) => x + 1)} />)}
      </div>
    </Page>
  );
}

function Row({ w, onDone }: { w: W; onDone: () => void }) {
  const [evidence, setEvidence] = useState("");
  const [err, setErr] = useState("");
  const activate = async () => {
    setErr("");
    try {
      await api(`/api/admin/clinics/${w.clinic_id}/activate`, { method: "POST", body: { evidence } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="glass rounded-[20px] p-5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-ink">
          {w.name} <span className="text-ink-4">· {w.area}, {w.city}</span>
        </span>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] capitalize text-ink-3">{w.status}</span>
      </div>
      <p className="text-[12px] text-ink-4">
        Owner {w.owner} ({w.owner_contact}) · created {new Date(w.created_at).toLocaleDateString("en-IN")}
      </p>
      {w.status === "setup" && (
        <div className="mt-3 flex gap-2">
          <input aria-label="Verification evidence" placeholder="What was verified, plus the subscription reference" value={evidence} onChange={(e) => setEvidence(e.target.value)} className={`${inputCls} h-9 text-[12.5px]`} />
          <button onClick={activate} className="btn-primary h-9 shrink-0 px-4 text-[12.5px]">
            Activate
          </button>
        </div>
      )}
      {err && (
        <div className="mt-2">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </div>
  );
}
