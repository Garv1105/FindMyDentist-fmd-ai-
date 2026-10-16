/**
 * Provider-agnostic model interface (PRD §1, §7.5; OD-14 vendor not chosen).
 * Business rules (safety, escalation, allowed actions, storage) live in server/assistant.ts and
 * apply to every provider — a model is never trusted to enforce them.
 */
import { askGemini, hasGemini } from "../../utils/chat.ts";

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type NavAction = { type: "navigate"; label: string; target: "dentists" | "concierge" | "records" | "appointments"; specialty?: string };
export type ProviderReply = { text: string; actions: NavAction[] };

export interface AiProvider {
  name: string;
  /** false = development stand-in; the UI says so */
  configured: boolean;
  reply(history: ChatTurn[], context: { role: string; language: string }): Promise<ProviderReply>;
}

/**
 * Hardcoded, rule-based answers for the common questions (written for review, not a language model).
 * Clinical wording must be reviewed by a dental professional before launch (SAF-01).
 * Returns null when no rule matches.
 */
function ruleReply(history: ChatTurn[]): ProviderReply | null {
  const q = history.filter((t) => t.role === "user").at(-1)?.text.toLowerCase() ?? "";
  if (/(cold|sensitiv|pain|hurt|ache|throb)/.test(q))
    return {
      text:
        "Sharp, short sensitivity to cold is often linked to exposed dentine, worn enamel or an early cavity. Pain that lingers after the cold is gone, throbs, or wakes you at night can point to irritation of the nerve. Only an examination can tell which. A general dentist or an endodontist (a root canal specialist) can assess it.",
      actions: [
        { type: "navigate", label: "Show endodontists", target: "dentists", specialty: "Endodontist" },
        { type: "navigate", label: "Show general dentists", target: "dentists", specialty: "General Dentist" },
      ],
    };
  if (/(implant|missing tooth|missing teeth|gap)/.test(q))
    return {
      text:
        "A dental implant replaces a tooth root with a titanium post; a crown is added once the bone has healed, usually over a few months. Bridges and dentures are other options. Which suits you depends on bone, gum health and medical history, which a dentist will assess.",
      actions: [{ type: "navigate", label: "See implantologists", target: "dentists", specialty: "Implantologist" }],
    };
  if (/(brace|align|crooked|straighten)/.test(q))
    return {
      text:
        "Braces and clear aligners both move teeth gradually. Aligners are removable and less visible; braces suit a wider range of cases. An orthodontist can explain options, timelines and costs after an assessment.",
      actions: [{ type: "navigate", label: "See orthodontists", target: "dentists", specialty: "Orthodontist" }],
    };
  if (/(whiten|stain|yellow)/.test(q))
    return {
      text:
        "Professional whitening lightens natural enamel using a bleaching gel, either in the clinic or with custom trays at home. It doesn't change crowns or fillings, and some people get temporary sensitivity. A dentist should check for cavities or gum problems first.",
      actions: [{ type: "navigate", label: "See cosmetic dentists", target: "dentists", specialty: "Cosmetic Dentist" }],
    };
  if (/(clean|scaling|polish|tartar)/.test(q))
    return {
      text:
        "A professional cleaning (scaling and polishing) removes hardened plaque (tartar) that brushing can't, usually in 30–45 minutes. Most people benefit every 6–12 months; your dentist will suggest what suits your gums.",
      actions: [{ type: "navigate", label: "See general dentists", target: "dentists", specialty: "General Dentist" }],
    };
  if (/(bleed|gum)/.test(q))
    return {
      text:
        "Gums that bleed when brushing are commonly linked to plaque build-up and gum inflammation. Gentle, thorough brushing and cleaning between teeth often help, but persistent bleeding should be checked. A periodontist specialises in gum health.",
      actions: [{ type: "navigate", label: "See periodontists", target: "dentists", specialty: "Periodontist" }],
    };
  if (/(child|kid|baby|toddler)/.test(q))
    return {
      text: "Children's teeth need check-ups from the first tooth or first birthday. A pediatric dentist is trained to care for children and make visits comfortable.",
      actions: [{ type: "navigate", label: "See pediatric dentists", target: "dentists", specialty: "Pediatric Dentist" }],
    };
  if (/(prepare|appointment|visit|first time)/.test(q))
    return {
      text:
        "Before your visit, note when symptoms started and what makes them better or worse, list your medicines and allergies, and bring previous X-rays or reports. You can keep these in your FMD records and choose to share them with the clinic.",
      actions: [
        { type: "navigate", label: "Open my records", target: "records" },
        { type: "navigate", label: "My appointments", target: "appointments" },
      ],
    };
  if (/(find|dentist|near me|book)/.test(q))
    return {
      text: "I can show you dentists by specialty, treatment and language. You'll see each profile, what FMD has verified, and the clinic's availability, and you choose whether to request an appointment.",
      actions: [{ type: "navigate", label: "Find a dentist", target: "dentists" }],
    };
  if (/(cost|price|fee|insurance|claim)/.test(q))
    return {
      text:
        "Fees vary by clinic and by what an examination finds, so any figure before a check-up is only an estimate. Ask the clinic for an itemised estimate. For insurance, your policy document and insurer decide what's covered. I can explain terms, but I can't confirm coverage.",
      actions: [{ type: "navigate", label: "Ask FMD Edge", target: "concierge" }],
    };
  return null;
}

const FALLBACK: ProviderReply = {
  text: "Tell me what you're noticing: where it hurts, for how long, and what makes it better or worse. I'll explain what it might relate to in plain language and help you find the right kind of dentist.",
  actions: [{ type: "navigate", label: "Find a general dentist", target: "dentists", specialty: "General Dentist" }],
};

/**
 * Hardcoded rules first; anything they don't cover goes to Gemini when GEMINI_API_KEY is set (utils/chat.ts).
 * If Gemini is missing or fails, the generic prompt-for-details reply is used, so chat never breaks.
 */
const provider: AiProvider = {
  name: hasGemini() ? "rules+gemini" : "dev-rules",
  configured: hasGemini(),
  async reply(history) {
    const rule = ruleReply(history);
    if (rule) return rule;
    const text = await askGemini(history);
    return text ? { text, actions: [{ type: "navigate", label: "Find a dentist", target: "dentists" }] } : FALLBACK;
  },
};

export function aiProvider(): AiProvider {
  return provider;
}
