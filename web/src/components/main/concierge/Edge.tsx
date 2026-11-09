"use client";

import { ArrowLeft, Check, CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink, Panel, Tag, type Tone } from "@/components/app/kit";
import { Field, fieldCls } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { when } from "@/lib/format";
import { fmtPhone } from "@/lib/fmd";
import { useMe, useRequireMe } from "@/lib/me";
import {
  AREAS,
  BEST_TIMES,
  BY,
  cancelEnquiry,
  createEnquiry,
  getEnquiry,
  listEnquiries,
  METHODS,
  NEEDS,
  respond,
  sendMessage,
  STATUS,
  TIMINGS,
  type Enquiry,
  type Input,
  type Method,
  type Status,
} from "@/sample/concierge";

const TONE: Record<Status, Tone> = {
  new: "accent",
  contact_attempted: "warn",
  contacted: "accent",
  needs_clarification: "warn",
  coordinating: "accent",
  awaiting_you: "warn",
  confirmed: "ok",
  closed: "muted",
  cancelled: "muted",
};
const STEPS = [
  ["You ask", "Tell us what you need, where, and when."],
  ["We call you", "A coordinator gets in touch the way you prefer."],
  ["We arrange options", "Verified dentists, times and fees that fit."],
  ["You decide", "Nothing is booked or paid until you say yes."],
];
/** a demo coordinator replies within seconds; the page checks again every few */
const REFRESH_MS = 4000;

/* ---------------- /concierge ---------------- */

export function EdgePage() {
  const me = useMe();
  const [done, setDone] = useState<Enquiry | null>(null);
  return (
    <div className="mx-auto grid w-full max-w-[900px] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
            FMD Edge <Tag tone="muted">Demo</Tag>
          </h1>
          <p className="mt-1 max-w-[640px] text-[14.5px] text-ink-3">A person from FMD helps you find the right dentist and arranges it with you. FMD coordinates; your dentist treats.</p>
        </div>
        {me && (
          <ButtonLink href="/concierge/enquiries" variant="secondary" size="sm">
            Your requests
          </ButtonLink>
        )}
      </div>

      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="app-panel grid content-start gap-1 p-4">
            <span className="text-[12.5px] text-ink-3">Step {i + 1}</span>
            <span className="text-[15px] font-medium text-ink">{t}</span>
            <span className="text-[13.5px] text-ink-2">{d}</span>
          </li>
        ))}
      </ol>

      <Panel className="grid gap-2 p-5 text-[14px] text-ink-2">
        <p>
          <span className="font-medium text-ink">Where:</span> {AREAS.join(", ")} for now (demo areas).
        </p>
        <p>
          <span className="font-medium text-ink">When we reply:</span> on working days, during working hours. FMD Edge isn&apos;t an emergency service: for an emergency, call 112.
        </p>
        <p>
          <span className="font-medium text-ink">Cost:</span> asking is free. Any fee for a dentist, test or transport is shown to you first, and only goes ahead if you accept it.
        </p>
      </Panel>

      {done ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <CircleCheck className="size-8 text-[var(--tone-ok)]" strokeWidth={1.5} />
          <h2 className="text-[20px] font-medium text-ink">We&apos;ve received your request</h2>
          <p className="text-[14.5px] text-ink-2">
            Reference <span className="font-medium text-ink">{done.ref}</span>. This isn&apos;t a confirmed appointment yet: a coordinator will contact you by{" "}
            {BY[done.contact.method]} first.
          </p>
          <ButtonLink href={`/concierge/enquiries/${done.ref}`}>Follow your request</ButtonLink>
        </Panel>
      ) : me === null ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <h2 className="text-[17px] font-medium text-ink">Ask FMD Edge</h2>
          <p className="text-[14.5px] text-ink-2">Log in so you can follow your request and answer your coordinator.</p>
          <ButtonLink href="/login?next=%2Fconcierge">Log in to ask</ButtonLink>
        </Panel>
      ) : me ? (
        <RequestForm userId={me.id} phone={me.phone} email={me.email_verified ? me.email : null} onDone={setDone} />
      ) : (
        <div className="app-panel h-48 animate-pulse" aria-busy />
      )}
    </div>
  );
}

function RequestForm({ userId, phone, email, onDone }: { userId: string; phone: string; email: string | null; onDone: (e: Enquiry) => void }) {
  const [f, setF] = useState<Input>({ need: "", area: "", timing: "This week", method: "phone", value: fmtPhone(phone), best_time: "Any time", notes: "", consent: false });
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Input>(k: K, v: Input[K]) => (setErr(null), setF((x) => ({ ...x, [k]: v })));
  // switching method fills in the matching contact detail from the account
  const pickMethod = (m: Method) => (setErr(null), setF((x) => ({ ...x, method: m, value: m === "email" ? (email ?? "") : fmtPhone(phone) })));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      onDone(await createEnquiry(userId, f));
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Panel as="section" className="grid gap-4 p-5 sm:p-6">
      <h2 className="text-[17px] font-medium text-ink">Ask FMD Edge</h2>
      <form onSubmit={submit} className="grid gap-4">
        {err && <Notice kind="error">{err}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What do you need help with?">
            <select className={fieldCls} value={f.need} onChange={(e) => set("need", e.target.value)}>
              <option value="">Choose one</option>
              {NEEDS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Your area or city">
            <input className={fieldCls} value={f.area} onChange={(e) => set("area", e.target.value)} maxLength={80} placeholder="e.g. Jayanagar, Bengaluru" autoComplete="address-level2" />
          </Field>
          <Field label="When would you like help?">
            <select className={fieldCls} value={f.timing} onChange={(e) => set("timing", e.target.value)}>
              {TIMINGS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Best time to reach you">
            <select className={fieldCls} value={f.best_time} onChange={(e) => set("best_time", e.target.value)}>
              {BEST_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13.5px] text-ink-3">How should we contact you?</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(METHODS) as Method[]).map((m) => (
              <label key={m} className={`cursor-pointer rounded-full border px-4 py-2 text-[14px] has-[input:focus-visible]:border-[var(--accent)] ${f.method === m ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2"}`}>
                <input type="radio" name="method" className="sr-only" checked={f.method === m} onChange={() => pickMethod(m)} />
                {METHODS[m]}
              </label>
            ))}
          </div>
          <Field label={f.method === "email" ? "Email address" : "Mobile number"}>
            <input className={`${fieldCls} sm:max-w-[320px]`} value={f.value} onChange={(e) => set("value", e.target.value)} inputMode={f.method === "email" ? "email" : "tel"} />
          </Field>
        </fieldset>
        <Field label="Anything else? (optional)" hint="Only what helps us arrange care, like access needs. Please don't add your medical history here.">
          <textarea className={`${fieldCls} h-24 resize-y py-2.5`} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
        </Field>
        <p className="rounded-2xl border border-line px-4 py-3 text-[13.5px] text-ink-2">
          Your FMD Edge coordinator uses these details only to arrange this request. A clinic sees them only after you approve that clinic.
        </p>
        <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-ink">
          <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />I agree to FMD Edge contacting me about this request.
        </label>
        <div>
          <Button type="submit">Send request</Button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------- /concierge/enquiries ---------------- */

export function EnquiriesPage() {
  const me = useRequireMe();
  const [list, setList] = useState<Enquiry[] | null>(null);
  const userId = me?.id;
  useEffect(() => {
    if (!userId) return;
    const load = () => listEnquiries(userId).then(setList);
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [userId]);
  if (!me || !list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-5">
      <Link href="/concierge" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> FMD Edge
      </Link>
      <h1 className="text-[24px] font-medium text-ink">Your FMD Edge requests</h1>
      {list.length === 0 ? (
        <Panel className="grid justify-items-start gap-3 p-6">
          <p className="text-[15px] text-ink-2">No requests yet.</p>
          <ButtonLink href="/concierge">Ask FMD Edge</ButtonLink>
        </Panel>
      ) : (
        <ul className="grid gap-3">
          {list.map((e) => (
            <li key={e.ref}>
              <Link href={`/concierge/enquiries/${e.ref}`} className="app-panel flex flex-wrap items-center gap-3 p-5 hover:border-line-strong">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">{e.need}</span>
                  <span className="block text-[13.5px] text-ink-3">
                    {e.ref} · {e.area} · sent {when(Date.parse(e.created_at))}
                  </span>
                </span>
                <Tag tone={TONE[e.status]}>{STATUS[e.status]}</Tag>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- /concierge/enquiries/[ref] ---------------- */

export function EnquiryPage() {
  const { ref } = useParams<{ ref: string }>();
  const me = useRequireMe();
  const [e, setE] = useState<Enquiry | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const userId = me?.id;
  const load = useCallback(() => {
    if (userId) getEnquiry(userId, ref).then(setE);
  }, [userId, ref]);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);
  if (!me || e === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (e === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that request</h1>
        <ButtonLink href="/concierge/enquiries" variant="secondary">
          Your requests
        </ButtonLink>
      </Panel>
    );
  const run = async (fn: () => Promise<Enquiry>) => {
    setErr(null);
    try {
      setE(await fn());
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  const isOpen = !["confirmed", "closed", "cancelled"].includes(e.status);

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-5">
      <Link href="/concierge/enquiries" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Your requests
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">{e.need}</h1>
          <p className="text-[13.5px] text-ink-3">
            {e.ref} · {e.area} · {e.timing}
          </p>
        </div>
        <Tag tone={TONE[e.status]}>{STATUS[e.status]}</Tag>
      </div>
      {err && <Notice kind="error">{err}</Notice>}

      {e.proposals.length > 0 && (
        <Panel as="section" className="grid gap-3 p-5 sm:p-6">
          <h2 className="text-[16px] font-medium text-ink">Options for you to approve</h2>
          <p className="text-[13.5px] text-ink-3">Nothing is booked or paid until you accept every part.</p>
          <ul className="grid gap-2.5">
            {e.proposals.map((p) => (
              <li key={p.id} className="grid gap-1.5 rounded-2xl border border-line p-4">
                <p className="flex flex-wrap items-center justify-between gap-2 text-[15px] font-medium text-ink">
                  {p.title}
                  {p.status !== "pending" && <Tag tone={p.status === "accepted" ? "ok" : "muted"}>{p.status === "accepted" ? "You accepted" : "You declined"}</Tag>}
                </p>
                <p className="text-[14px] text-ink-2">{p.detail}</p>
                {p.status === "pending" && e.status === "awaiting_you" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => run(() => respond(me.id, e.ref, p.id, true))} aria-label={`Accept: ${p.title}`}>
                      <Check className="size-4" strokeWidth={2} /> Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => run(() => respond(me.id, e.ref, p.id, false))} aria-label={`Decline: ${p.title}`}>
                      <X className="size-4" strokeWidth={2} /> Decline
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel as="section" className="grid gap-3 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">Messages</h2>
        {e.messages.length === 0 && <p className="text-[14px] text-ink-3">Your coordinator will write here once they&apos;ve reached you.</p>}
        <ol className="grid gap-3">
          {e.messages.map((m, i) => (
            <li key={i} className={`grid max-w-[85%] gap-0.5 ${m.from === "you" ? "ml-auto justify-items-end" : ""}`}>
              <p className={`rounded-2xl px-4 py-2.5 text-[14.5px] text-ink ${m.from === "you" ? "bg-[var(--accent-soft)]" : "border border-line"}`}>{m.text}</p>
              <p className="text-[12px] text-ink-3">
                {m.from === "you" ? "You" : "Your coordinator"} · {when(Date.parse(m.at))}
              </p>
            </li>
          ))}
        </ol>
        {isOpen && (
          <div className="flex gap-2">
            <input className={`${fieldCls} min-w-0 flex-1`} value={text} onChange={(x) => setText(x.target.value)} maxLength={500} placeholder="Write to your coordinator" aria-label="Message to your coordinator" />
            <Button onClick={() => run(async () => (await sendMessage(me.id, e.ref, text), setText(""), (await getEnquiry(me.id, e.ref))!))}>Send</Button>
          </div>
        )}
      </Panel>

      <Panel as="section" className="grid gap-3 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">What&apos;s happened</h2>
        <ol className="grid gap-3 border-l border-line pl-4">
          {[...e.events].reverse().map((v, i) => (
            <li key={i} className="relative">
              <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border border-line bg-[var(--surface-elevated)]" />
              <p className="text-[14.5px] text-ink">{STATUS[v.status]}</p>
              <p className="text-[12.5px] text-ink-3">
                {v.by === "you" ? "You" : "Your coordinator"} · {when(Date.parse(v.at))}
              </p>
              {v.note && <p className="text-[13.5px] text-ink-2">{v.note}</p>}
            </li>
          ))}
        </ol>
      </Panel>

      {isOpen &&
        (sure ? (
          <Panel className="flex flex-wrap items-center gap-3 p-4">
            <p className="flex-1 text-[14px] text-ink-2">Cancel this request? Your coordinator stops working on it.</p>
            <Button variant="secondary" size="sm" onClick={() => setSure(false)}>
              Keep it
            </Button>
            <Button size="sm" onClick={() => run(() => cancelEnquiry(me.id, e.ref)).then(() => setSure(false))}>
              Cancel request
            </Button>
          </Panel>
        ) : (
          <button type="button" onClick={() => setSure(true)} className="w-fit text-[13.5px] text-ink-3 hover:text-ink">
            Cancel my request
          </button>
        ))}
    </div>
  );
}
