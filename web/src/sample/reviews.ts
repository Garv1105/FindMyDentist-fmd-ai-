/**
 * Patient feedback and reviews (plan part 10.1, PDR Annex G): sample data until the backend has it. Proposed API:
 *   GET  /me/feedback-invites → Invite[] · POST /me/feedback-invites/{booking_id}/snooze
 *   POST /feedback {booking_id, ratings, comment, visibility: "private" | "public"} → Review
 *   GET  /providers/{id}/reviews → {summary, items} · POST /reviews/{id}/report {reason, note}
 * Rules: only a completed visit booked through FMD can be reviewed, once. Ratings are about the experience
 * (getting an appointment, communication, environment, overall), never clinical outcomes. Private feedback goes only
 * to the clinic. Every public review shows, low ones included; FMD doesn't pay or reward reviews. At most one
 * invitation at a time, only for visits in the last 30 days, and "Not now" snoozes it for 14 days.
 */
import { listBookings } from "./bookings.ts";
import { read, write } from "./store.ts";

export const ASPECTS = { access: "Getting an appointment", communication: "Communication", environment: "Clinic environment", overall: "Overall experience" } as const;
export type Aspect = keyof typeof ASPECTS;
export type Ratings = Record<Aspect, number>;

export type Review = {
  id: string;
  dentist_id: string;
  booking_id: string | null;
  author: string;
  ratings: Ratings;
  comment: string;
  visibility: "private" | "public";
  verified_visit: boolean;
  at: string;
  response: { text: string; at: string } | null;
  mine?: boolean;
};
export type Invite = { booking_id: string; dentist_id: string; dentist: string; clinic: string; visit: string };

const iso = (t: number) => new Date(t).toISOString();
const DAY = 86_400_000;
const key = (what: string, userId: string) => `fmd-demo:${what}:${userId}`;

/** A few public reviews from other (fictitious) patients, low ones included. */
const OTHERS: Review[] = [
  { id: "rv-1", dentist_id: "aditi-sharma", booking_id: null, author: "Meera", ratings: { access: 5, communication: 5, environment: 4, overall: 5 }, comment: "Explained the X-ray clearly and gave me options with prices before starting.", visibility: "public", verified_visit: true, at: "2026-10-20T09:00:00.000Z", response: { text: "Thank you, Meera. We're glad the explanation helped.", at: "2026-10-21T09:00:00.000Z" } },
  { id: "rv-2", dentist_id: "aditi-sharma", booking_id: null, author: "Arun", ratings: { access: 2, communication: 4, environment: 3, overall: 3 }, comment: "Good dentist, but I waited 40 minutes past my booked time.", visibility: "public", verified_visit: true, at: "2026-10-02T09:00:00.000Z", response: { text: "Sorry about the wait, Arun. We've added a buffer between long appointments.", at: "2026-10-03T09:00:00.000Z" } },
  { id: "rv-3", dentist_id: "rohan-mehta", booking_id: null, author: "Sana", ratings: { access: 4, communication: 5, environment: 5, overall: 5 }, comment: "Clear plan for my aligners and a realistic timeline.", visibility: "public", verified_visit: true, at: "2026-09-15T09:00:00.000Z", response: null },
];

export async function feedbackInvites(userId: string, now = Date.now()): Promise<Invite[]> {
  const given = new Set((read<Review[]>(key("reviews", userId)) ?? []).map((r) => r.booking_id));
  const snoozed = read<Record<string, string>>(key("review-snooze", userId)) ?? {};
  const due = (await listBookings(userId, now))
    .filter((b) => b.status === "completed" && b.start && now - b.start < 30 * DAY && !given.has(b.id) && !(snoozed[b.id] && Date.parse(snoozed[b.id]) > now))
    .sort((a, b) => b.start! - a.start!);
  // one invitation at a time
  return due.slice(0, 1).map((b) => ({ booking_id: b.id, dentist_id: b.dentist.id, dentist: b.dentist.name, clinic: b.clinic.name, visit: iso(b.start!) }));
}

export async function snoozeInvite(userId: string, bookingId: string, now = Date.now()) {
  write(key("review-snooze", userId), { ...(read<Record<string, string>>(key("review-snooze", userId)) ?? {}), [bookingId]: iso(now + 14 * DAY) });
}

export function checkFeedback(r: { ratings: Partial<Ratings>; comment: string }): string | null {
  if ((Object.keys(ASPECTS) as Aspect[]).some((a) => !(r.ratings[a]! >= 1 && r.ratings[a]! <= 5))) return "Rate each of the four parts, from 1 to 5.";
  if (r.comment.length > 1000) return "Keep the comment under 1,000 characters.";
  if (/\b\d{10}\b|@\w+\.\w+/.test(r.comment)) return "Please don't include phone numbers or email addresses.";
  return null;
}

export async function submitFeedback(userId: string, name: string, bookingId: string, r: { ratings: Ratings; comment: string; visibility: "private" | "public" }, now = Date.now()): Promise<Review> {
  const b = (await listBookings(userId, now)).find((x) => x.id === bookingId);
  if (!b || b.status !== "completed") throw new Error("You can review a visit only after it's completed.");
  const mine = read<Review[]>(key("reviews", userId)) ?? [];
  if (mine.some((x) => x.booking_id === bookingId)) throw new Error("You've already given feedback on this visit.");
  const bad = checkFeedback(r);
  if (bad) throw new Error(bad);
  const review: Review = { id: `rv-${now.toString(36)}`, dentist_id: b.dentist.id, booking_id: bookingId, author: name.split(" ")[0], ratings: r.ratings, comment: r.comment.trim(), visibility: r.visibility, verified_visit: true, at: iso(now), response: null, mine: true };
  write(key("reviews", userId), [...mine, review]);
  return review;
}

export async function myFeedback(userId: string) {
  return (read<Review[]>(key("reviews", userId)) ?? []).map((r) => ({ ...r, mine: true }));
}

/** Public reviews for a dentist (yours included), newest first, with averages per aspect. */
export async function dentistReviews(userId: string | null, dentistId: string) {
  const mine = userId ? await myFeedback(userId) : [];
  const items = [...mine.filter((r) => r.visibility === "public"), ...OTHERS].filter((r) => r.dentist_id === dentistId).sort((a, b) => b.at.localeCompare(a.at));
  const avg = (a: Aspect) => (items.length ? Math.round((items.reduce((n, r) => n + r.ratings[a], 0) / items.length) * 10) / 10 : null);
  return { count: items.length, averages: Object.fromEntries((Object.keys(ASPECTS) as Aspect[]).map((a) => [a, avg(a)])) as Record<Aspect, number | null>, items };
}

export const REVIEW_REPORTS = { fake: "Looks fake or paid for", personal: "Shares someone's personal details", abusive: "Abusive or hateful", conflict: "Written by someone connected to the clinic", other: "Something else" } as const;

export async function reportReview(userId: string | null, reviewId: string, reason: keyof typeof REVIEW_REPORTS | "") {
  if (!userId) throw new Error("Log in to report a review.");
  if (!reason) throw new Error("Choose what's wrong.");
  const all = read<string[]>(key("review-reports", userId)) ?? [];
  if (all.includes(reviewId)) throw new Error("You've already reported this review.");
  write(key("review-reports", userId), [...all, reviewId]);
}
