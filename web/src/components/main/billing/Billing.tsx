"use client";

import { ArrowLeft, Check, CircleCheck, CircleX, Download, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag, type Tone } from "@/components/app/kit";
import { Notice } from "@/components/Page";
import { rupees, when } from "@/lib/format";
import { useMe, useRequireMe } from "@/lib/me";
import {
  cancelMembership,
  checkout,
  getMembership,
  getPayment,
  GRACE_DAYS,
  listPayments,
  PLANS,
  priceOf,
  receiptPdf,
  REFUND_TERMS,
  SCHOLAR_EXTRA,
  setAutoRenew,
  usage,
  type MembershipView,
  type Payment,
  type PlanId,
} from "@/sample/billing";
import { getAccountType } from "@/sample/onboarding";
import { track } from "@/lib/analytics";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const planName = (id: PlanId) => PLANS.find((p) => p.id === id)!.name;

/* ---------------- /plans ---------------- */

export function PlansPage() {
  const me = useMe();
  const [type, setType] = useState<string | null>(null);
  useEffect(() => {
    if (me) getAccountType(me.id).then(setType);
  }, [me]);
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
          Plans <Tag tone="muted">Demo · no real payments</Tag>
        </h1>
        <p className="mt-1 max-w-[680px] text-[14.5px] text-ink-3">Patients use FMD free. Memberships for dentists, students and companies are yearly. Prices are shown with GST before you pay.</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const price = priceOf(p);
          const yours = type === p.id;
          return (
            <li key={p.id}>
              <Panel className={`flex h-full flex-col gap-3 p-5 ${yours ? "!border-[var(--accent)]" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[17px] font-medium text-ink">{p.name}</h2>
                  {yours && <Tag tone="accent">Your account type</Tag>}
                </div>
                <p className="text-[24px] font-medium text-ink">
                  {p.yearly ? rupees(p.yearly) : "Free"}
                  {p.yearly > 0 && <span className="text-[14px] font-normal text-ink-3"> a year + GST</span>}
                </p>
                {p.yearly > 0 && (
                  <p className="text-[13px] text-ink-3">
                    {rupees(price.base)} + {rupees(price.gst)} GST (18%) = {rupees(price.total)}. Renews yearly; you can turn that off.
                  </p>
                )}
                <ul className="grid gap-1.5 text-[14px] text-ink-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-[var(--tone-ok)]" strokeWidth={2} /> {f}
                    </li>
                  ))}
                </ul>
                <ul className="grid gap-1 text-[13px] text-ink-3">
                  {p.limits.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  {p.yearly ? (
                    <ButtonLink href={`/checkout/${p.id}`} variant={yours ? "primary" : "secondary"}>
                      Choose {p.name.toLowerCase()}
                    </ButtonLink>
                  ) : (
                    <p className="text-[13.5px] text-ink-3">Nothing to pay.</p>
                  )}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-ink-3">
        {REFUND_TERMS} An FMD Main membership is separate from an FMD Clinic subscription. Students: {SCHOLAR_EXTRA.note.toLowerCase()} (tentatively {rupees(SCHOLAR_EXTRA.price)}).
      </p>
    </div>
  );
}

/* ---------------- /checkout/[plan] ---------------- */

export function CheckoutPage() {
  const { plan: planId } = useParams<{ plan: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const me = useRequireMe();
  const plan = PLANS.find((p) => p.id === planId && p.yearly > 0);
  // one payment per attempt, however many taps; a retry after a failure is a new attempt with a new key
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [p, setP] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const payId = params.get("payment");
  useEffect(() => {
    if (!me || !payId) return;
    const t = setInterval(() => getPayment(me.id, payId).then((x) => x && setP(x)), 1000);
    getPayment(me.id, payId).then((x) => x && setP(x));
    return () => clearInterval(t);
  }, [me, payId]);
  useEffect(() => {
    if (p?.status === "paid") track("membership_paid", { plan: p.plan });
  }, [p?.status, p?.plan]);
  if (!me) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  if (!plan)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">That plan doesn&apos;t need a payment</h1>
        <ButtonLink href="/plans" variant="secondary">
          Plans
        </ButtonLink>
      </Panel>
    );
  const price = priceOf(plan);
  // the demo stands in for the gateway's page: the person chooses what the "bank" does
  const pay = async (outcome: "success" | "failure") => {
    setBusy(true);
    const r = await checkout(me.id, plan.id, key, outcome);
    setBusy(false);
    router.replace(`/checkout/${plan.id}?payment=${r.id}`);
  };
  if (p)
    return (
      <Panel className="mx-auto grid w-full max-w-[560px] justify-items-start gap-3 p-6">
        {p.status === "pending" ? (
          <>
            <LoaderCircle className="size-8 animate-spin text-ink-3" strokeWidth={1.5} />
            <h1 className="text-[20px] font-medium text-ink">Confirming your payment…</h1>
            <p className="text-[14.5px] text-ink-2">We&apos;re waiting for the payment provider to confirm. Please don&apos;t pay again: this page updates by itself.</p>
          </>
        ) : p.status === "paid" ? (
          <>
            <CircleCheck className="size-8 text-[var(--tone-ok)]" strokeWidth={1.5} />
            <h1 className="text-[20px] font-medium text-ink">Payment received</h1>
            <p className="text-[14.5px] text-ink-2">
              Your {plan.name.toLowerCase()} membership is active. Receipt {p.invoice}.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/membership">Your membership</ButtonLink>
              <ButtonLink href="/billing" variant="secondary">
                Receipts
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <CircleX className="size-8 text-[var(--tone-bad)]" strokeWidth={1.5} />
            <h1 className="text-[20px] font-medium text-ink">The payment didn&apos;t go through</h1>
            <p className="text-[14.5px] text-ink-2">No money was taken. Try again, or use a different payment method.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => (setKey(crypto.randomUUID()), setP(null), router.replace(`/checkout/${plan.id}`))}>Try again</Button>
              <ButtonLink href={`/help/contact?topic=payments&about=${p.id}`} variant="secondary">
                Get help with this payment
              </ButtonLink>
            </div>
          </>
        )}
      </Panel>
    );

  const rows: [string, ReactNode][] = [
    ["Plan", `${plan.name} membership, 1 year`],
    ["Price", rupees(price.base)],
    ["GST (18%)", rupees(price.gst)],
    ["Total today", <span key="t" className="font-medium">{rupees(price.total)}</span>],
    ["Renews", "Yearly, at the same price unless we tell you first. You can turn renewal off any time."],
    ["Refunds", REFUND_TERMS],
  ];
  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-5">
      <Link href="/plans" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Plans
      </Link>
      <h1 className="text-[24px] font-medium text-ink">Check and pay</h1>
      <Panel className="p-5 sm:p-6">
        <dl className="grid gap-2.5 text-[14.5px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-0.5 sm:grid-cols-[120px_1fr]">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel className="grid gap-3 p-5">
        <p className="text-[14px] text-ink-2">In the real app this opens the payment provider (UPI, card or net banking). This demo lets you choose what happens:</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => pay("success")} disabled={busy}>
            Pay {rupees(price.total)} (demo)
          </Button>
          <Button variant="secondary" onClick={() => pay("failure")} disabled={busy}>
            Simulate a failed payment
          </Button>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- /membership ---------------- */

const STATUS: Record<NonNullable<MembershipView>["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  grace: { label: "Payment due", tone: "warn" },
  expired: { label: "Ended", tone: "muted" },
  cancelled: { label: "Won't renew", tone: "muted" },
};

export function MembershipPage() {
  const me = useRequireMe();
  const [m, setM] = useState<MembershipView | undefined>(undefined);
  const [type, setType] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const [now, setNow] = useState(0);
  const userId = me?.id;
  const load = useCallback(() => {
    if (!userId) return;
    getMembership(userId).then((x) => (setM(x), setNow(Date.now())));
    getAccountType(userId).then(setType);
  }, [userId]);
  useEffect(load, [load]);
  if (!me || m === undefined) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const plan = m?.plan ?? (type as PlanId | null);
  const meters = usage(m?.status === "active" || m?.status === "grace" ? m.plan : null, now);

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-5">
      <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
        Membership <Tag tone="muted">Demo</Tag>
      </h1>
      {note && <Notice kind="success">{note}</Notice>}
      <Panel className="grid gap-3 p-5 sm:p-6">
        {m ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[18px] font-medium text-ink">{planName(m.plan)} membership</h2>
              <Tag tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Tag>
            </div>
            <p className="text-[14.5px] text-ink-2">
              {m.status === "active" && (m.auto_renew ? `Renews on ${day(m.renews_at)}.` : `Ends on ${day(m.renews_at)}; renewal is off.`)}
              {m.status === "grace" && `Your renewal payment is due. Benefits continue until ${day(m.grace_until!)} (${GRACE_DAYS}-day grace period).`}
              {m.status === "cancelled" && `You cancelled. Benefits continue until ${day(m.renews_at)}.`}
              {m.status === "expired" && "This membership has ended. Your account works as a free account."}
            </p>
            <ul className="grid gap-1.5 text-[14px] text-ink-2">
              {PLANS.find((p) => p.id === m.plan)!.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--tone-ok)]" strokeWidth={2} /> {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {(m.status === "grace" || m.status === "expired") && <ButtonLink href={`/checkout/${m.plan}`}>Renew now</ButtonLink>}
              {m.status === "active" && (
                <Button variant="secondary" onClick={() => setAutoRenew(me.id, !m.auto_renew).then(load)}>
                  {m.auto_renew ? "Turn off renewal" : "Turn on renewal"}
                </Button>
              )}
              {m.status === "active" && !sure && (
                <Button variant="secondary" onClick={() => setSure(true)}>
                  Cancel membership
                </Button>
              )}
              <ButtonLink href="/billing" variant="secondary">
                Payments and receipts
              </ButtonLink>
            </div>
            {sure && (
              <div className="grid gap-2 rounded-2xl border border-line p-4">
                <p className="text-[14px] text-ink-2">{REFUND_TERMS}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSure(false)}>
                    Keep it
                  </Button>
                  <Button size="sm" onClick={() => cancelMembership(me.id).then((r) => (setSure(false), setNote(r.refunded ? "Cancelled and refunded in full. Refunds reach your account in 5–7 working days." : "Cancelled. It won't renew."), load()))}>
                    Cancel membership
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-medium text-ink">{plan && plan !== "patient" ? `${planName(plan)}: not paid yet` : "Free account"}</h2>
            <p className="text-[14.5px] text-ink-2">
              {plan && plan !== "patient" ? "Your account works as a free account until you pay for your membership." : "Patients use FMD free. Nothing to pay."}
            </p>
            <div>
              <ButtonLink href={plan && plan !== "patient" ? `/checkout/${plan}` : "/plans"} variant={plan && plan !== "patient" ? "primary" : "secondary"}>
                {plan && plan !== "patient" ? `Pay for ${planName(plan).toLowerCase()} membership` : "See plans"}
              </ButtonLink>
            </div>
          </>
        )}
      </Panel>

      <Panel as="section" className="grid gap-4 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">Your usage</h2>
        {meters.map((u) => {
          const pct = Math.round((u.used / u.limit) * 100);
          return (
            <div key={u.feature} className="grid gap-1.5">
              <div className="flex flex-wrap justify-between gap-2 text-[14px]">
                <span className="text-ink">{u.feature}</span>
                <span className="text-ink-2">
                  {u.used} of {u.limit}
                  {u.resets_at && ` · resets ${day(u.resets_at)}`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-glass)]" role="meter" aria-label={u.feature} aria-valuenow={u.used} aria-valuemin={0} aria-valuemax={u.limit}>
                <div className={`h-full rounded-full ${pct >= 80 ? "bg-[var(--tone-warn)]" : "bg-[var(--accent)]"}`} style={{ width: `${pct}%` }} />
              </div>
              {pct >= 80 && (
                <p className="text-[13px] text-ink-2">
                  You&apos;ve used {pct}% this month. {m?.plan === "student" ? `After the limit, extra use is planned (tentatively ${rupees(SCHOLAR_EXTRA.price)}); it isn't on sale yet.` : ""}
                </p>
              )}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

/* ---------------- /billing ---------------- */

const PAY_STATUS: Record<Payment["status"], { label: string; tone: Tone }> = { pending: { label: "Confirming", tone: "accent" }, paid: { label: "Paid", tone: "ok" }, failed: { label: "Failed", tone: "bad" } };

export function BillingPage() {
  const me = useRequireMe();
  const [list, setList] = useState<Payment[] | null>(null);
  const userId = me?.id;
  useEffect(() => {
    if (userId) listPayments(userId).then(setList);
  }, [userId]);
  if (!me || !list) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const download = (p: Payment) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(receiptPdf(p, me.full_name));
    a.download = `${p.invoice}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-5">
      <Link href="/membership" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Membership
      </Link>
      <h1 className="text-[24px] font-medium text-ink">Payments and receipts</h1>
      {list.length === 0 ? (
        <Panel className="p-6 text-[15px] text-ink-2">No payments yet.</Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium text-ink">
                    {planName(p.plan)} membership · {rupees(p.amount + p.gst)}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    {when(Date.parse(p.created_at))} · {p.invoice ?? p.id}
                  </p>
                </div>
                <Tag tone={PAY_STATUS[p.status].tone}>{PAY_STATUS[p.status].label}</Tag>
                {p.status === "paid" && (
                  <Button variant="secondary" size="sm" onClick={() => download(p)}>
                    <Download className="size-4" strokeWidth={1.75} /> Receipt
                  </Button>
                )}
                {p.status === "failed" && (
                  <ButtonLink href={`/checkout/${p.plan}`} size="sm">
                    Retry
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-[12.5px] text-ink-3">Receipts show the GST charged. A failed payment never takes money; if your bank shows a charge, it&apos;s reversed within 5–7 working days.</p>
    </div>
  );
}
