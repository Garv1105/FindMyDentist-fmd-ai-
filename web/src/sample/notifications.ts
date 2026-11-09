/**
 * Notifications (plan part 9.1, PDR §15): built from what happens elsewhere in the demo, until the backend sends them.
 * Proposed API: GET /me/notifications?cursor → Notification[] · POST /me/notifications/read {ids | all: true}
 * Rules: no clinical details in a notification's text (no treatments, symptoms or tooth numbers), since it can show on a
 * lock screen; each one opens the page it's about; which channels deliver them is set in Privacy and data.
 */
import { listBookings, isUpcoming } from "./bookings.ts";
import { listPayments } from "./billing.ts";
import { listEnquiries } from "./concierge.ts";
import { myPosts } from "./content.ts";
import { read, write } from "./store.ts";

export type Kind = "booking" | "reminder" | "edge" | "payment" | "security" | "post";
export type Notification = { id: string; kind: Kind; title: string; body: string; at: string; href: string; read: boolean };

const key = (userId: string) => `fmd-demo:notifications-read:${userId}`;
const DAY = 86_400_000;
const dayTime = (t: number) =>
  `${new Date(t).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;

export async function listNotifications(userId: string, signedUpAt: string, now = Date.now()): Promise<Notification[]> {
  const out: Omit<Notification, "read">[] = [];

  for (const b of await listBookings(userId, now)) {
    const last = b.events.at(-1)!;
    if (last.by === "clinic" && last.type === "rescheduled")
      out.push({ id: `bk-move-${b.id}`, kind: "booking", title: "The clinic changed your appointment time", body: `${b.clinic.name}: now ${b.start ? dayTime(b.start) : "to be confirmed"}.`, at: last.at, href: `/appointments/${b.id}` });
    if (last.by === "clinic" && last.type === "cancelled")
      out.push({ id: `bk-cncl-${b.id}`, kind: "booking", title: "The clinic cancelled an appointment", body: `${b.clinic.name}. You can book another time.`, at: last.at, href: `/appointments/${b.id}` });
    const confirmedByClinic = b.events.find((e) => e.type === "confirmed" && e.note?.startsWith("The clinic set a time"));
    if (confirmedByClinic)
      out.push({ id: `bk-conf-${b.id}`, kind: "booking", title: "Your appointment request is confirmed", body: `${b.clinic.name}: ${dayTime(b.start!)}.`, at: confirmedByClinic.at, href: `/appointments/${b.id}` });
    // a reminder the day before (the real one goes out by the channels you chose)
    if (isUpcoming(b, now) && b.start && b.start - now < DAY)
      out.push({ id: `bk-rem-${b.id}`, kind: "reminder", title: "Appointment tomorrow", body: `${b.clinic.name}, ${dayTime(b.start)}.`, at: new Date(b.start - DAY).toISOString(), href: `/appointments/${b.id}` });
  }

  for (const e of await listEnquiries(userId, now)) {
    if (e.status === "awaiting_you") {
      const ev = e.events.find((x) => x.status === "awaiting_you")!;
      out.push({ id: `edge-wait-${e.ref}`, kind: "edge", title: "FMD Edge has options for you", body: "Nothing is booked until you approve.", at: ev.at, href: `/concierge/enquiries/${e.ref}` });
    }
    const msg = e.messages.filter((m) => m.from === "coordinator").at(-1);
    if (msg) out.push({ id: `edge-msg-${e.ref}-${msg.at}`, kind: "edge", title: "New message from your FMD Edge coordinator", body: `Request ${e.ref}.`, at: msg.at, href: `/concierge/enquiries/${e.ref}` });
  }

  for (const p of await listPayments(userId, now)) {
    if (p.status === "failed") out.push({ id: `pay-fail-${p.id}`, kind: "payment", title: "A payment didn't go through", body: "No money was taken. You can try again.", at: p.settled_at!, href: "/billing" });
    if (p.status === "paid") out.push({ id: `pay-ok-${p.id}`, kind: "payment", title: "Payment received", body: `Receipt ${p.invoice} is ready.`, at: p.settled_at!, href: "/billing" });
  }

  for (const d of await myPosts(userId, now)) {
    if (d.status === "published" && d.submitted_at) out.push({ id: `post-pub-${d.id}`, kind: "post", title: "Your post is published", body: `“${d.title}” is live in Explore.`, at: d.publish_at ?? d.submitted_at, href: `/explore/${d.id}` });
    if (d.status === "rejected") out.push({ id: `post-rej-${d.id}`, kind: "post", title: "Your post wasn't approved", body: "See the reason and what to change.", at: d.submitted_at!, href: "/explore/mine" });
  }

  out.push({ id: "sec-welcome", kind: "security", title: "New sign-in to your account", body: "If this wasn't you, sign out other devices in your account.", at: signedUpAt, href: "/account" });

  const seen = new Set(read<string[]>(key(userId)) ?? []);
  return out
    .filter((n) => Date.parse(n.at) <= now)
    .map((n) => ({ ...n, read: seen.has(n.id) }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function markRead(userId: string, ids: string[]) {
  write(key(userId), [...new Set([...(read<string[]>(key(userId)) ?? []), ...ids])]);
}
