"use client";

import { LogOut, Monitor } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { inputCls, Notice, Page } from "@/components/Page";
import { api, authChanged, useMe, type Me } from "@/lib/me";

type Session = { ref: string; current: boolean; createdAt: number; lastSeenAt: number; device: string };
const LANGS = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["kn", "ಕನ್ನಡ"],
  ["te", "తెలుగు"],
  ["ta", "தமிழ்"],
] as const;
/** "Chrome on Windows" from a user-agent string; good enough for recognising your own devices. */
function deviceLabel(ua: string) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : ua.split("/")[0];
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
const fmt = (t: number) => new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function AccountPage() {
  const me = useMe();
  return (
    <Page>
      <p className="eyebrow">Account</p>
      {me === undefined && <p className="mt-6 text-ink-3">Loading your account…</p>}
      {me === null && (
        <div className="mt-6 max-w-[480px] space-y-4">
          <h1 className="text-[34px] font-extralight tracking-[-0.03em] text-ink">You&apos;re signed out</h1>
          <Link href="/signin?next=/account" className="btn-primary h-12 px-6 text-[14px]">
            Sign in
          </Link>
        </div>
      )}
      {me && <Account me={me} />}
    </Page>
  );
}

function Card({ title, children, desc }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="glass rounded-[26px] p-6 sm:p-7">
      <h2 className="text-[18px] font-light tracking-[-0.01em] text-ink">{title}</h2>
      {desc && <p className="mt-1 text-[13px] text-ink-4">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Account({ me }: { me: Me }) {
  return (
    <>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Hello, {me.name.split(" ")[0]}</h1>
      {me.status === "deletion_requested" && (
        <div className="mt-6">
          <Notice kind="info">Your deletion request is being processed. Some records may be kept where the law requires.</Notice>
        </div>
      )}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Profile me={me} />
        <Membership me={me} />
        <MyConcierge />
        <Preferences me={me} />
        <Sessions />
        <Danger />
      </div>
    </>
  );
}

function Profile({ me }: { me: Me }) {
  const [name, setName] = useState(me.name);
  const [lang, setLang] = useState(me.language);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const save = async () => {
    setMsg(null);
    try {
      await api("/api/me", { method: "PATCH", body: { name, language: lang } });
      authChanged();
      setMsg({ kind: "success", text: "Profile saved." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  return (
    <Card title="Profile">
      <dl className="mb-5 grid grid-cols-[110px_1fr] gap-y-2 text-[13.5px]">
        <dt className="text-ink-4">Account type</dt>
        <dd className="capitalize text-ink-2">{me.accountType}</dd>
        <dt className="text-ink-4">Sign-in</dt>
        <dd className="text-ink-2">{me.email ?? me.phone}</dd>
      </dl>
      <label htmlFor="pname" className="text-[13px] text-ink-2">
        Name
      </label>
      <input id="pname" value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-2`} />
      <label htmlFor="plang" className="mt-4 block text-[13px] text-ink-2">
        Preferred language
      </label>
      <select id="plang" value={lang} onChange={(e) => setLang(e.target.value)} className={`${inputCls} mt-2 [&>option]:bg-[var(--surface)]`}>
        {LANGS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[12px] text-ink-4">Interface translations are being reviewed; content currently appears in English.</p>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="btn-primary h-10 px-5 text-[13px]">
          Save
        </button>
      </div>
      {msg && (
        <div className="mt-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
    </Card>
  );
}

type PlanV = { code: string; name: string; priceInr: number; period: string; features: string[]; pendingDecision: string | null; taxNote: string | null; termsNote: string | null };
type MembershipRes = {
  current: { planCode: string; status: string; renewsOrEndsAt: number | null } | null;
  catalog: { membership: PlanV; addOns: PlanV[]; separateProducts: PlanV[]; checkout: { available: boolean; reason: string } };
  entitlements: { mainMembership: boolean; scholar: boolean; clinicOs: boolean };
  usage: { feature: string; label: string; used: number; limit: number | null; provisional: boolean }[];
};
const per = (p: string) => (p === "year" ? "/year" : p === "month" ? "/month" : p === "one_time" ? " one-time" : "");
const price = (p: PlanV) => (p.priceInr === 0 ? "Free" : `₹${p.priceInr.toLocaleString("en-IN")}${per(p.period)}`);

function Membership({ me }: { me: Me }) {
  const [m, setM] = useState<MembershipRes | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<MembershipRes>("/api/me/membership").then(setM).catch((e) => setErr(e.message));
  }, []);
  const plan = m?.catalog.membership;
  const statusLabel = (s?: string) => ({ active: "Active", grace: "In grace period", pending_verification: "Awaiting verification", cancelled: "Cancelled", expired: "Expired" })[s ?? ""] ?? "Not active";
  return (
    <Card title="Membership" desc="Price, renewal, benefits and limits are shown before any purchase.">
      {err && <Notice kind="error">{err}</Notice>}
      {!m && !err && <p className="text-[13px] text-ink-4">Loading…</p>}
      {m && plan && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] text-ink">{plan.name}</p>
              <p className="text-[13px] text-ink-3">{price(plan)}{plan.taxNote ? " · excl. GST" : ""}</p>
            </div>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-2">{me.accountType === "patient" ? "Active" : statusLabel(m.current?.status)}</span>
          </div>
          {m.current?.renewsOrEndsAt && <p className="text-[12.5px] text-ink-3">Renews or ends on {new Date(m.current.renewsOrEndsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>}
          <ul className="space-y-1 text-[13px] text-ink-2">
            {plan.features.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          {m.usage.map((u) => (
            <div key={u.feature}>
              <p className="flex justify-between text-[12.5px] text-ink-3">
                <span>{u.label}</span>
                <span>
                  {u.used}
                  {u.limit !== null && ` of ${u.limit}`}
                </span>
              </p>
              {u.limit !== null && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)]" role="progressbar" aria-valuenow={u.used} aria-valuemax={u.limit} aria-label={u.label}>
                  <div className="h-full bg-[var(--button-primary)]" style={{ width: `${Math.min(100, (u.used / u.limit) * 100)}%` }} />
                </div>
              )}
              {u.provisional && <p className="mt-1 text-[11.5px] text-ink-4">Limit is provisional until FMD confirms Scholar quotas.</p>}
            </div>
          ))}
          {plan.pendingDecision && <p className="text-[12px] text-ink-4">{plan.pendingDecision}</p>}
          {plan.priceInr > 0 && !m.entitlements.mainMembership && (
            <p className="rounded-[14px] border border-dashed border-line-strong p-3 text-[12.5px] leading-relaxed text-ink-3">
              {m.catalog.checkout.reason} {plan.termsNote}
            </p>
          )}
          {m.catalog.addOns.map((p) => (
            <p key={p.code} className="text-[12.5px] text-ink-3">
              Optional: {p.name}, {price(p)}. {p.pendingDecision}
            </p>
          ))}
          {m.catalog.separateProducts.map((p) => (
            <p key={p.code} className="text-[12.5px] text-ink-4">
              {p.name} ({price(p)}) is a separate clinic subscription, not part of this membership.
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

type Cq = { reference: string; need: string; statusLabel: string; createdAt: number; updatedAt: number };
function MyConcierge() {
  const [items, setItems] = useState<Cq[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ items: Cq[] }>("/api/concierge/mine")
      .then((r) => setItems(r.items))
      .catch((e) => setErr(e.message));
  }, []);
  return (
    <Card title="Your FMD Edge requests" desc="Status updates from the FMD coordination team.">
      {err && <Notice kind="error">{err}</Notice>}
      {items?.length === 0 && (
        <p className="text-[13px] text-ink-4">
          No requests yet. <Link href="/#concierge" className="underline underline-offset-4">Request FMD Edge assistance</Link>
        </p>
      )}
      <ul className="space-y-3">
        {items?.map((i) => (
          <li key={i.reference} className="flex items-start justify-between gap-3 text-[13px]">
            <span>
              <span className="block font-mono text-ink-2">{i.reference}</span>
              <span className="block text-[12px] text-ink-4">
                {i.need} · sent {fmt(i.createdAt)}
              </span>
            </span>
            <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-2">{i.statusLabel}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Preferences({ me }: { me: Me }) {
  const [c, setC] = useState(me.consents);
  const [err, setErr] = useState("");
  const toggle = async (k: "comms_appointments" | "comms_marketing" | "ai_history") => {
    setErr("");
    const next = { ...c, [k]: !c[k] };
    setC(next);
    try {
      const r = await api<{ consents: Me["consents"] }>("/api/me/consents", { method: "PUT", body: { [k]: next[k] } });
      setC(r.consents);
    } catch (e) {
      setC(c);
      setErr((e as Error).message);
    }
  };
  const rows = [
    ["comms_appointments", "Appointment and booking updates", "Reminders and changes for bookings you make."],
    ["comms_marketing", "News and offers", "Separate from appointment messages. Off unless you turn it on."],
    ["ai_history", "Save FMD AI conversations", "Lets you revisit past conversations. Turning off stops saving new ones."],
  ] as const;
  return (
    <Card title="Communication & privacy" desc="Each choice is recorded with a timestamp and can be changed any time.">
      <ul className="space-y-4">
        {rows.map(([k, label, hint]) => (
          <li key={k} className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-[14px] text-ink-2">{label}</span>
              <span className="block text-[12px] text-ink-4">{hint}</span>
            </span>
            <button
              role="switch"
              aria-checked={c[k]}
              aria-label={label}
              onClick={() => toggle(k)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${c[k] ? "border-line-strong bg-[var(--button-primary)]" : "border-line bg-[var(--surface-glass)]"}`}
            >
              <span className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-all ${c[k] ? "left-6 bg-[var(--button-primary-fg)]" : "left-1 bg-[var(--text-faint)]"}`} />
              <span className="sr-only">{c[k] ? "On" : "Off"}</span>
            </button>
          </li>
        ))}
      </ul>
      {err && (
        <div className="mt-4">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </Card>
  );
}

function Sessions() {
  const [list, setList] = useState<Session[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ sessions: Session[] }>("/api/me/sessions")
      .then((r) => setList(r.sessions))
      .catch((e) => setErr(e.message));
  }, []);
  const revoke = async (ref: string) => {
    try {
      setList((await api<{ sessions: Session[] }>("/api/me/sessions", { method: "DELETE", body: { ref } })).sessions);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card title="Signed-in devices">
      {!list && !err && <p className="text-[13px] text-ink-4">Loading…</p>}
      {err && <Notice kind="error">{err}</Notice>}
      <ul className="space-y-3">
        {list?.map((s) => (
          <li key={s.ref} className="flex items-center gap-3 text-[13px]">
            <Monitor className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink-2">{deviceLabel(s.device)}</span>
              <span className="block text-[12px] text-ink-4">
                {s.current ? "This device · " : ""}last active {fmt(s.lastSeenAt)}
              </span>
            </span>
            {!s.current && (
              <button onClick={() => revoke(s.ref)} className="btn-ghost h-8 px-3 text-[12px]">
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      {list && list.length > 1 && (
        <button onClick={() => revoke("others")} className="btn-ghost mt-4 h-9 px-4 text-[12.5px]">
          Sign out all other devices
        </button>
      )}
    </Card>
  );
}

function Danger() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    authChanged();
    router.push("/");
  };
  const request = async () => {
    try {
      const r = await api<{ reference: string }>("/api/me/deletion", { method: "POST", body: { reason } });
      setMsg({ kind: "success", text: `Request ${r.reference} received. The FMD team will confirm what is deleted and what must be retained by law.` });
      setOpen(false);
      authChanged();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  return (
    <Card title="Sign out & delete">
      <button onClick={signOut} className="btn-ghost h-10 px-4 text-[13px]">
        <LogOut className="size-4" strokeWidth={1.5} /> Sign out
      </button>
      <div className="mt-6 border-t border-line pt-5">
        {!open ? (
          <button onClick={() => setOpen(true)} className="text-[13px] text-ink-3 underline underline-offset-4 hover:text-ink">
            Request account deletion
          </button>
        ) : (
          <div className="space-y-3">
            <label htmlFor="reason" className="block text-[13px] text-ink-2">
              Reason (optional)
            </label>
            <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} h-auto py-3`} />
            <div className="flex gap-2">
              <button onClick={request} className="btn-primary h-10 px-4 text-[13px]">
                Submit deletion request
              </button>
              <button onClick={() => setOpen(false)} className="btn-ghost h-10 px-4 text-[13px]">
                Cancel
              </button>
            </div>
          </div>
        )}
        {msg && (
          <div className="mt-4">
            <Notice kind={msg.kind}>{msg.text}</Notice>
          </div>
        )}
      </div>
    </Card>
  );
}
