"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { H, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type P = { id: string; name: string; phone: string; dob: string; lastVisitAt: number | null; linkedToFmd: boolean };
type Dupe = { id: string; name: string; phone: string; dob: string };

export default function PatientsPage() {
  const { call, can, clinicId } = useClinic();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<P[] | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => call<P[]>(`patients?q=${encodeURIComponent(q)}`).then(setItems).catch(() => setItems([])), 200);
    return () => clearTimeout(t);
  }, [q, call, v]);
  return (
    <>
      <H title="Patients" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <input aria-label="Search patients" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-10 text-[13px]`} />
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-[18px] border border-line">
            {items?.length === 0 && <li className="p-6 text-center text-[13px] text-ink-4">No patients found.</li>}
            {items?.map((p) => (
              <li key={p.id}>
                <Link href={`/clinic/${clinicId}/patients/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13.5px] hover:bg-[var(--accent-soft)]">
                  <span className="flex-1 text-ink">{p.name}</span>
                  <span className="text-ink-4">{p.phone}</span>
                  <span className="w-44 text-right text-[12px] text-ink-4">{p.lastVisitAt ? `Last visit ${when(p.lastVisitAt).split(",")[0]}` : "No visits yet"}</span>
                  {p.linkedToFmd && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-3">FMD</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {can("patients.write") && <Register onDone={() => setV((x) => x + 1)} />}
      </div>
    </>
  );
}

function Register({ onDone }: { onDone: () => void }) {
  const { call } = useClinic();
  const [f, setF] = useState({ fullName: "", phone: "", email: "", dob: "", gender: "", medicalAlerts: "", consentTreatment: false, consentComms: false });
  const [dupes, setDupes] = useState<Dupe[]>([]);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const submit = async (confirmNotDuplicate = false) => {
    setMsg(null);
    try {
      const r = await call<{ duplicateCandidates: Dupe[]; created: string | null }>("patients", "POST", { ...f, confirmNotDuplicate });
      if (!r.created) return setDupes(r.duplicateCandidates);
      setDupes([]);
      setMsg({ kind: "success", text: `${f.fullName} registered.` });
      setF({ ...f, fullName: "", phone: "", email: "", dob: "", medicalAlerts: "" });
      onDone();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const cls = `${inputCls} h-9 text-[12.5px] [&>option]:bg-[var(--surface)]`;
  return (
    <form onSubmit={(e: FormEvent) => (e.preventDefault(), submit())} className="glass space-y-2 rounded-[20px] p-5">
      <h2 className="text-[15px] text-ink">Register a patient</h2>
      <input aria-label="Full name" placeholder="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className={cls} />
      <div className="grid grid-cols-2 gap-2">
        <input aria-label="Mobile" placeholder="Mobile" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={cls} />
        <input aria-label="Date of birth" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} className={cls} />
      </div>
      <input aria-label="Email" placeholder="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={cls} />
      <input aria-label="Medical alerts" placeholder="Medical alerts: allergies, conditions (optional)" value={f.medicalAlerts} onChange={(e) => setF({ ...f, medicalAlerts: e.target.value })} className={cls} />
      <label className="flex items-start gap-2 text-[12.5px] text-ink-2">
        <input type="checkbox" checked={f.consentTreatment} onChange={(e) => setF({ ...f, consentTreatment: e.target.checked })} className="mt-0.5" /> Treatment consent form signed
      </label>
      <label className="flex items-start gap-2 text-[12.5px] text-ink-2">
        <input type="checkbox" checked={f.consentComms} onChange={(e) => setF({ ...f, consentComms: e.target.checked })} className="mt-0.5" /> Patient agrees to reminders and recall messages
      </label>
      {dupes.length > 0 && (
        <div className="rounded-xl border border-line-strong p-3 text-[12.5px] text-ink-2">
          <p className="text-ink">Possible duplicate:</p>
          {dupes.map((d) => (
            <p key={d.id}>
              {d.name} · {d.phone} {d.dob && `· born ${d.dob}`}
            </p>
          ))}
          <button type="button" onClick={() => submit(true)} className="btn-ghost mt-2 h-8 px-3 text-[12px]">
            It&apos;s a different person: register anyway
          </button>
        </div>
      )}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button className="btn-primary h-9 w-full text-[12.5px]">Register</button>
    </form>
  );
}
