/**
 * Patient messaging adapter (SMS / WhatsApp / email). OD-14: no provider chosen yet.
 * The development adapter NEVER pretends to deliver: it reports "not_sent" with the reason, so the
 * AI manager and staff see the truth (PRD §7.3 Verify: no success claimed for an unverified action).
 */
export type SendResult = { status: "sent" | "not_sent" | "failed"; detail: string; providerRef?: string };

type Send = (to: { phone: string; email: string }, channel: string, body: string) => SendResult;

export const messaging: { configured: boolean; name: string; send: Send } = {
  configured: false,
  name: "none",
  send: () => ({ status: "not_sent", detail: "No SMS/WhatsApp/email provider is configured yet (OD-14). Message kept as a draft." }),
};
