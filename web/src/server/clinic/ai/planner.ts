import { TOPICS } from "../../../lib/catalog.ts";

/**
 * Provider-agnostic planner interface (PRD §7.5). A model-backed planner can replace the dev planner;
 * either way it can only choose tools from the registry, and the engine — not the planner — applies
 * permissions and approvals. The instruction is never allowed to change those rules.
 */
export type PlanStep = { tool: string; input: Record<string, unknown> };
export type Plan = { intent: string; steps: PlanStep[] } | { intent: "clarify"; question: string; steps: [] };

export interface Planner {
  name: string;
  configured: boolean;
  plan(instruction: string): Plan;
}

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

/** DEVELOPMENT planner: deterministic keyword routing to fixed playbooks. Not a language model. */
export const devPlanner: Planner = {
  name: "dev-playbooks",
  configured: false,
  plan(instruction) {
    const s = instruction.toLowerCase();
    const n = Number(s.match(/(\d+)\s*(day|month)/)?.[1]);
    if (has(s, "recall", "due for", "haven't visited", "follow-up list", "follow up list"))
      return {
        intent: "recall",
        steps: [
          { tool: "recall.list", input: has(s, "month") && n ? { months: n } : {} },
          { tool: "messages.draft_recall", input: {} },
          ...(has(s, "send", "message", "remind", "sms", "whatsapp") ? [{ tool: "messages.send", input: {} }] : []),
        ],
      };
    if (has(s, "unconfirmed", "confirm", "front desk", "tomorrow"))
      return {
        intent: "front_desk",
        steps: [
          { tool: "appointments.unconfirmed", input: has(s, "day") && n ? { days: n } : {} },
          ...(has(s, "task", "follow") ? [{ tool: "tasks.create_followups", input: {} }] : []),
        ],
      };
    if (has(s, "payment", "collection", "sheet", "cash", "missing invoice", "missing entries", "billing"))
      return { intent: "payments", steps: [{ tool: "payments.daily_sheet", input: {} }, { tool: "billing.missing_entries", input: {} }, ...(has(s, "task") ? [{ tool: "tasks.create_followups", input: {} }] : [])] };
    if (has(s, "stock", "inventory", "purchase", "reorder", "expir", "supplies"))
      return { intent: "inventory", steps: [{ tool: "inventory.review", input: {} }, ...(has(s, "order", "purchase", "reorder", "draft") ? [{ tool: "purchase_order.draft", input: {} }] : [])] };
    if (has(s, "gap", "free slot", "free time", "availability", "empty"))
      return { intent: "schedule", steps: [{ tool: "schedule.gaps", input: has(s, "day") && n ? { days: n } : {} }] };
    if (has(s, "handover", "summary", "end of day", "how did today"))
      return { intent: "handover", steps: [{ tool: "handover.summary", input: {} }] };
    if (has(s, "post", "caption", "content", "article")) {
      const topic = TOPICS.find((t) => s.includes(t.toLowerCase())) ?? null;
      if (!topic) return { intent: "clarify", question: `Which topic should the post cover? (${TOPICS.join(", ")})`, steps: [] };
      return {
        intent: "content",
        steps: [
          {
            tool: "content.submit",
            input: {
              topic,
              title: `${topic}: what patients often ask`,
              body: `A short, plain-language note on ${topic.toLowerCase()} from our clinic. Every mouth is different, so book a check-up for advice that fits you. [Draft generated for review: edit before approving.]`,
            },
          },
        ],
      };
    }
    return {
      intent: "clarify",
      question:
        "I can help with: unconfirmed appointments, recall lists and messages, today's payment sheet and missing invoices, stock and purchase-order drafts, schedule gaps, handover summaries, or drafting a post. What would you like me to do?",
      steps: [],
    };
  },
};
