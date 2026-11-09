/**
 * The unified treatment journey (plan part 3.3, PDR Annex B, §4.3): sample data until the backend has it.
 * Proposed API:
 *   GET  /me/journeys → JourneySummary[]       GET /journeys/{id} → Journey
 *   POST /journeys/{id}/plans/{version}/acknowledge → Journey
 * Rules: a patient sees only what the clinic released, and the clinic's record is the source of truth. Acknowledging
 * a plan in the app tells the clinic it was read; it is not consent to treatment. Payment status comes from the
 * clinic's invoices, never guessed.
 */
import { read, write } from "./store.ts";

export type StageStatus = "completed" | "scheduled" | "waiting" | "planned" | "cancelled";
export const STAGE_STATUS: Record<StageStatus, string> = { completed: "Done", scheduled: "Booked", waiting: "Waiting for you", planned: "Planned", cancelled: "Cancelled" };

export type StageKey = "discover" | "consultation" | "plan" | "consent" | "visits" | "documents" | "payment" | "warranty" | "recall" | "closure";
export type Stage = { key: StageKey; title: string; status: StageStatus; date: string | null; text: string; action?: { label: string; href: string } };

export type PlanVersion = { version: number; issued: string; items: { label: string; amount: number }[]; note: string };

export type Journey = {
  id: string;
  title: string;
  clinic: { id: string; name: string; area: string };
  dentist: { id: string; name: string };
  status: "in_progress" | "completed";
  started: string;
  stages: Stage[];
  plans: PlanVersion[];
  acknowledged: { version: number; at: string } | null;
  record_ids: string[];
  certificate_id: string | null;
};

const day = 86_400_000;
const date = (t: number) => new Date(t + 5.5 * 3_600_000).toISOString().slice(0, 10);
const ackKey = (userId: string) => `fmd-demo:journey-acks:${userId}`;

function build(now: number, acks: Record<string, { version: number; at: string }>): Journey[] {
  const d = (daysAgo: number) => date(now - daysAgo * day);
  const ack = acks["j-rct"] ?? null;
  const latest = 2;
  const rct: Journey = {
    id: "j-rct",
    title: "Root canal and crown, lower left first molar",
    clinic: { id: "kor", name: "Demo Dental Studio", area: "Koramangala" },
    dentist: { id: "aditi-sharma", name: "Dr. Aditi Sharma" },
    status: "in_progress",
    started: d(30),
    plans: [
      { version: 1, issued: d(24), items: [{ label: "Root canal treatment, tooth 36", amount: 6500 }, { label: "Metal-ceramic crown, tooth 36", amount: 5500 }], note: "Replaced by version 2." },
      {
        version: 2,
        issued: d(20),
        items: [
          { label: "Root canal treatment, tooth 36 (2 visits)", amount: 6500 },
          { label: "Zirconia crown, tooth 36", amount: 7000 },
        ],
        note: "Changed to a zirconia crown after you asked for a tooth-coloured option. X-rays during treatment are included. Your dentist confirms the cost at each visit.",
      },
    ],
    acknowledged: ack,
    record_ids: ["rec-summary", "rec-xray", "rec-plan", "rec-inv-cons", "rec-rx"],
    certificate_id: null,
    stages: [
      { key: "discover", title: "Found a dentist", status: "completed", date: d(30), text: "You found Dr. Aditi Sharma on FMD after searching for tooth pain." },
      { key: "consultation", title: "Consultation", status: "completed", date: d(24), text: "Examination and an X-ray of the lower left side.", action: { label: "View appointment", href: "/appointments/demo-past-01" } },
      {
        key: "plan",
        title: "Estimate and treatment plan",
        status: ack?.version === latest ? "completed" : "waiting",
        date: d(20),
        text: ack?.version === latest ? `Version ${latest} of your plan, from the clinic.` : `The clinic shared version ${latest} of your plan. Read it, ask the clinic anything, then acknowledge it.`,
      },
      { key: "consent", title: "Consent", status: "planned", date: null, text: "The clinic asks for your consent at the treatment visit, after explaining the risks and options." },
      {
        key: "visits",
        title: "Treatment visits",
        status: "waiting",
        date: null,
        text: "Visit 1 of 3: root canal treatment, about 60 minutes. Not booked yet.",
        action: { label: "Book this visit", href: "/book/aditi-sharma" },
      },
      { key: "documents", title: "Documents and invoices", status: "completed", date: d(20), text: "5 documents from the clinic are in your records.", action: { label: "Open records", href: "/records?episode=j-rct" } },
      { key: "payment", title: "Payment", status: "planned", date: null, text: "Consultation: ₹500 paid (from the clinic's invoice). Treatment: not invoiced yet." },
      { key: "warranty", title: "Warranty", status: "planned", date: null, text: "The clinic plans to issue a warranty certificate for the crown once it's fitted." },
      { key: "recall", title: "Follow-up", status: "planned", date: null, text: "A check-up 6 months after the crown is fitted." },
      { key: "closure", title: "Finished", status: "planned", date: null, text: "The journey closes after the follow-up visit." },
    ],
  };
  const fill: Journey = {
    id: "j-fill",
    title: "Filling, upper right second premolar",
    clinic: { id: "kor", name: "Demo Dental Studio", area: "Koramangala" },
    dentist: { id: "venkat-rao", name: "Dr. Venkat Rao" },
    status: "completed",
    started: d(250),
    plans: [{ version: 1, issued: d(245), items: [{ label: "Composite filling, tooth 15", amount: 1800 }], note: "" }],
    acknowledged: { version: 1, at: `${d(244)}T10:00:00.000Z` },
    record_ids: ["rec-inv-fill", "rec-cert"],
    certificate_id: "cert-0147",
    stages: [
      { key: "discover", title: "Found a dentist", status: "completed", date: d(250), text: "You booked Dr. Venkat Rao for a sensitive tooth." },
      { key: "consultation", title: "Consultation", status: "completed", date: d(245), text: "Small cavity found in tooth 15." },
      { key: "plan", title: "Estimate and treatment plan", status: "completed", date: d(245), text: "Version 1 acknowledged." },
      { key: "consent", title: "Consent", status: "completed", date: d(241), text: "The clinic recorded your consent at the visit." },
      { key: "visits", title: "Treatment visits", status: "completed", date: d(241), text: "Filling done in one visit." },
      { key: "documents", title: "Documents and invoices", status: "completed", date: d(241), text: "Invoice and warranty certificate are in your records.", action: { label: "Open records", href: "/records?episode=j-fill" } },
      { key: "payment", title: "Payment", status: "completed", date: d(241), text: "₹1,800 paid (from the clinic's invoice)." },
      { key: "warranty", title: "Warranty", status: "completed", date: d(240), text: "Certificate WC-2026-0147, valid for 2 years.", action: { label: "View certificate", href: "/certificates/cert-0147" } },
      {
        key: "recall",
        title: "Follow-up",
        status: "waiting",
        date: d(-124),
        text: "6-month check-up done. The 12-month check-up keeps your warranty valid.",
        action: { label: "Book a check-up", href: "/book/venkat-rao" },
      },
      { key: "closure", title: "Finished", status: "completed", date: d(241), text: "Treatment complete. Follow-ups continue under the warranty." },
    ],
  };
  return [rct, fill];
}

export async function listJourneys(userId: string, now = Date.now()) {
  return build(now, read(ackKey(userId)) ?? {});
}

export async function getJourney(userId: string, id: string, now = Date.now()) {
  return (await listJourneys(userId, now)).find((j) => j.id === id) ?? null;
}

/** The step a person should look at next: the first one waiting for them, else the first not done. */
export const currentStage = (j: Journey) => j.stages.find((s) => s.status === "waiting") ?? j.stages.find((s) => s.status !== "completed") ?? j.stages.at(-1)!;

export async function acknowledgePlan(userId: string, journeyId: string, version: number, now = Date.now()) {
  const j = await getJourney(userId, journeyId, now);
  if (!j) throw new Error("We couldn't find that treatment.");
  if (version !== Math.max(...j.plans.map((p) => p.version))) throw new Error("Only the latest version of the plan can be acknowledged.");
  write(ackKey(userId), { ...(read<Record<string, unknown>>(ackKey(userId)) ?? {}), [journeyId]: { version, at: new Date(now).toISOString() } });
  return (await getJourney(userId, journeyId, now))!;
}
