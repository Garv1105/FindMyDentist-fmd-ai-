"use client";

import { ArrowLeft, BadgeCheck, Copy, Flag, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Chips, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { Notice } from "@/components/Page";
import { TOPICS } from "@/lib/catalog";
import { when } from "@/lib/format";
import type { Me } from "@/lib/fmd";
import { useMe, useRequireMe } from "@/lib/me";
import { CONCERNS, getInterests, lastSearch, resetPersonalisation, saveInterests, type Interests } from "@/sample/personalisation";
import { getConsents, setConsent } from "@/sample/privacy";
import { ASPECTS, dentistReviews, feedbackInvites, REVIEW_REPORTS, reportReview, snoozeInvite, submitFeedback, type Aspect, type Invite, type Ratings, type Review } from "@/sample/reviews";
import { REFERRALS } from "@/toggle";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** 1–5 as radio buttons with words, so it isn't stars-only (screen readers, colour) */
function Rate({ aspect, value, onChange }: { aspect: Aspect; value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-[14px] text-ink">{ASPECTS[aspect]}</legend>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`grid size-10 cursor-pointer place-items-center rounded-full border text-[14px] has-[input:focus-visible]:border-[var(--accent)] ${value === n ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2"}`}>
            <input type="radio" name={aspect} className="sr-only" checked={value === n} onChange={() => onChange(n)} aria-label={`${n} out of 5`} />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------------- feedback after a visit ---------------- */

/** The invitation, or the form once opened. Shown on My appointments and on the visit's page. */
export function FeedbackCard({ me, bookingId, onDone }: { me: Me; bookingId?: string; onDone?: () => void }) {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Partial<Ratings>>({});
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Review | null>(null);
  const load = useCallback(() => {
    feedbackInvites(me.id).then((l) => setInvite(l.find((i) => !bookingId || i.booking_id === bookingId) ?? null));
  }, [me.id, bookingId]);
  useEffect(load, [load]);
  if (done)
    return (
      <Notice kind="success">
        Thank you. {done.visibility === "public" ? "Your review is on the dentist's profile, marked as a verified visit." : "Your feedback went privately to the clinic."}
      </Notice>
    );
  if (!invite) return null;
  const send = async () => {
    setErr(null);
    try {
      setDone(await submitFeedback(me.id, me.full_name, invite.booking_id, { ratings: ratings as Ratings, comment, visibility }));
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Panel as="section" className="grid gap-4 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
          <Star className="size-4" strokeWidth={1.75} /> How was your visit to {invite.clinic}?
        </h2>
        <p className="text-[13.5px] text-ink-3">
          With {invite.dentist}, {when(Date.parse(invite.visit))}. About the experience, not the treatment&apos;s result. FMD doesn&apos;t pay or reward reviews.
        </p>
      </div>
      {!open ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            Give feedback
          </Button>
          <Button variant="secondary" size="sm" onClick={() => snoozeInvite(me.id, invite.booking_id).then(load)}>
            Not now
          </Button>
        </div>
      ) : (
        <>
          {err && <Notice kind="error">{err}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
              <Rate key={a} aspect={a} value={ratings[a] ?? 0} onChange={(n) => setRatings((r) => ({ ...r, [a]: n }))} />
            ))}
          </div>
          <Field label="Anything to add? (optional)" hint="Please don't include names, phone numbers or health details.">
            <textarea className={`${fieldCls} h-24 resize-y py-2.5`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[14px] text-ink">Who sees it?</legend>
            {(
              [
                ["private", "Only the clinic", "Private feedback to help them improve."],
                ["public", "Everyone, as a public review", "On the dentist's profile with your first name, marked as a verified visit."],
              ] as const
            ).map(([v, label, text]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 has-[input:focus-visible]:border-[var(--accent)] ${visibility === v ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line"}`}>
                <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} className="mt-1 size-4 accent-[var(--accent)]" />
                <span>
                  <span className="block text-[14.5px] text-ink">{label}</span>
                  <span className="block text-[13px] text-ink-3">{text}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <Button onClick={send}>Send feedback</Button>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---------------- reviews on a dentist's profile ---------------- */

export function ReviewsSection({ dentistId }: { dentistId: string }) {
  const me = useMe();
  const [data, setData] = useState<Awaited<ReturnType<typeof dentistReviews>> | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  const userId = me === undefined ? undefined : (me?.id ?? null);
  useEffect(() => {
    if (userId !== undefined) dentistReviews(userId, dentistId).then(setData);
  }, [userId, dentistId]);
  if (!data) return null;
  return (
    <Panel as="section" className="grid gap-3 p-5 sm:p-6">
      <h2 className="text-[17px] font-medium text-ink">Patient reviews ({data.count})</h2>
      {data.count === 0 ? (
        <p className="text-[14px] text-ink-3">No reviews yet. Only patients who visited through FMD can review.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-[13.5px] sm:grid-cols-4">
            {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
              <div key={a} className="rounded-xl border border-line px-3 py-2">
                <dt className="text-ink-3">{ASPECTS[a]}</dt>
                <dd className="text-[15px] font-medium text-ink">{data.averages[a]} / 5</dd>
              </div>
            ))}
          </dl>
          <ul className="grid gap-3">
            {data.items.map((r) => (
              <li key={r.id} className="grid gap-1 rounded-2xl border border-line p-4">
                <p className="flex flex-wrap items-center gap-2 text-[14px]">
                  <span className="font-medium text-ink">{r.mine ? "You" : r.author}</span>
                  {r.verified_visit && (
                    <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-2">
                      <BadgeCheck className="size-3.5" strokeWidth={1.75} /> Verified visit
                    </span>
                  )}
                  <span className="text-[12.5px] text-ink-3">{day(r.at)}</span>
                  <span className="ml-auto text-[13px] text-ink-2">Overall {r.ratings.overall} / 5</span>
                </p>
                {r.comment && <p className="text-[14px] text-ink-2">{r.comment}</p>}
                {r.response && (
                  <p className="mt-1 rounded-xl bg-[var(--surface-glass)] px-3 py-2 text-[13.5px] text-ink-2">
                    <span className="font-medium text-ink">The clinic replied:</span> {r.response.text}
                  </p>
                )}
                {!r.mine &&
                  (reported.includes(r.id) ? (
                    <p className="text-[12.5px] text-ink-3">Reported. Thanks.</p>
                  ) : (
                    <button type="button" onClick={() => setReporting(r.id)} className="inline-flex w-fit items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
                      <Flag className="size-3.5" strokeWidth={1.75} /> Report
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-[12.5px] text-ink-3">All reviews from verified visits are shown, including low ones. Ratings are about the experience, not clinical results.</p>
      {reporting && <ReportReview userId={me?.id ?? null} id={reporting} onClose={() => setReporting(null)} onDone={() => (setReported((x) => [...x, reporting]), setReporting(null))} />}
    </Panel>
  );
}

function ReportReview({ userId, id, onClose, onDone }: { userId: string | null; id: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<keyof typeof REVIEW_REPORTS | "">("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet title="Report this review" onClose={onClose}>
      <div className="grid gap-3">
        {err && <Notice kind="error">{err}</Notice>}
        {(Object.entries(REVIEW_REPORTS) as [keyof typeof REVIEW_REPORTS, string][]).map(([k, v]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[14.5px] text-ink">
            <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} className="size-4 accent-[var(--accent)]" />
            {v}
          </label>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => reportReview(userId, id, reason).then(onDone, (e: Error) => setErr(e.message))}>Send report</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- /account/personalisation ---------------- */

export function PersonalisationPage() {
  const me = useRequireMe();
  const [on, setOn] = useState<boolean | null>(null);
  const [i, setI] = useState<Interests | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const userId = me?.id;
  const signedUp = me?.created_at;
  const load = useCallback(() => {
    if (!userId || !signedUp) return;
    getConsents(userId, signedUp).then((c) => setOn(c.some((x) => x.purpose === "personalisation" && x.granted)));
    getInterests(userId).then(setI);
    lastSearch(userId).then(setSearch);
  }, [userId, signedUp]);
  useEffect(load, [load]);
  if (!me || on === null || !i) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const save = async (next: Interests) => {
    setI(next);
    await saveInterests(me.id, next);
    setNote("Saved. Explore uses these next time you open it.");
  };
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-5">
      <Link href="/account" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Account
      </Link>
      <h1 className="flex flex-wrap items-center gap-3 text-[24px] font-medium text-ink">
        Personalisation <Tag tone="muted">Demo</Tag>
      </h1>
      {note && <Notice kind="success">{note}</Notice>}
      <Panel className="flex flex-wrap items-center gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-ink">Personalise what I see {on ? <Tag tone="ok">On</Tag> : <Tag tone="muted">Off</Tag>}</p>
          <p className="text-[13.5px] text-ink-3">When off, Explore shows the same general dental education to everyone.</p>
        </div>
        <Button variant={on ? "secondary" : "primary"} size="sm" onClick={() => setConsent(me.id, "personalisation", !on).then(load)}>
          {on ? "Turn off" : "Turn on"}
        </Button>
      </Panel>
      <Panel className="grid gap-4 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">What you tell us</h2>
        <Chips label="Topics you'd like to see" options={TOPICS} value={i.topics} onChange={(topics) => save({ ...i, topics })} />
        <Chips label="Things you're dealing with (optional)" options={CONCERNS} value={i.concerns} onChange={(concerns) => save({ ...i, concerns })} />
      </Panel>
      <Panel className="grid gap-2 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">What we use</h2>
        <ul className="grid list-disc gap-1 pl-5 text-[14px] text-ink-2">
          <li>The topics and concerns above, first.</li>
          <li>Your last dentist search{search ? `: “${search}”` : " (none saved)"}.</li>
          <li>Dentists you follow, in the Following tab.</li>
        </ul>
        <p className="text-[13.5px] text-ink-3">We never use your records, appointments or FMD AI chats for this, and never for advertising. Sponsored posts are always labelled.</p>
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={() => resetPersonalisation(me.id).then(() => (load(), setNote("Reset. FMD has forgotten your interests and searches.")))}>
            Reset everything
          </Button>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- /account/invite ---------------- */

export function InvitePage() {
  const me = useRequireMe();
  const [copied, setCopied] = useState(false);
  if (!me) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  const preview = !REFERRALS && process.env.NODE_ENV !== "production";
  if (!REFERRALS && !preview)
    return (
      <Panel className="mx-auto grid w-full max-w-[640px] gap-2 p-6">
        <h1 className="text-[19px] font-medium text-ink">Inviting friends isn&apos;t open yet</h1>
        <p className="text-[14.5px] text-ink-2">We&apos;re checking it with legal and professional-ethics advisers first.</p>
      </Panel>
    );
  const code = `FMD-${me.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  const link = `${location.origin}/register?ref=${code}`;
  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-5">
      {preview && <Notice kind="info">Preview for the team: switched off on the live site (REFERRALS in toggle.ts) until legal review.</Notice>}
      <h1 className="text-[24px] font-medium text-ink">Invite friends to FMD</h1>
      <Panel className="grid gap-3 p-5 sm:p-6">
        <p className="text-[14.5px] text-ink-2">Share your link. Friends who join can find dentists, keep records and ask FMD AI.</p>
        <p className="break-all rounded-xl border border-line px-3 py-2 font-mono text-[14px] text-ink">{link}</p>
        <div>
          <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))}>
            <Copy className="size-4" strokeWidth={1.75} /> {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </Panel>
      <Panel className="grid gap-2 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">Terms</h2>
        <ul className="grid list-disc gap-1 pl-5 text-[14px] text-ink-2">
          <li>This invites people to FMD only. It isn&apos;t a referral to a dentist or a treatment.</li>
          <li>There are no rewards yet. Any future benefit will be explained here first.</li>
          <li>Dentists and clinics never earn anything for sending patients.</li>
        </ul>
      </Panel>
    </div>
  );
}
