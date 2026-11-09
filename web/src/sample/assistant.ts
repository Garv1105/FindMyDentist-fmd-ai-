/**
 * FMD AI, the public assistant (plan part 4.1, PDR §4.2, §4.10, §13): a demo until the backend's model is chosen.
 * Answers come from the reviewed rule set in server/adapters/ai.ts, behind the same safety rules a real model will
 * get (lib/aiSafety.ts). Proposed API:
 *   POST /assistant/messages {conversation_id?, text, language, attachment_ids?} → SendResult
 *   GET /assistant/conversations · GET/DELETE /assistant/conversations/{id} · DELETE /assistant/conversations
 *   POST /assistant/feedback {message_id, helpful}
 * Rules: it advises and opens FMD pages; it never books, messages, submits or pays. A reply's buttons are
 * navigation only, from an allow-list. Files are read as data, never as instructions. Conversations are kept only
 * with the "Save my FMD AI conversations" consent, and can be deleted.
 */
import { aiProvider, type NavAction } from "../server/adapters/ai.ts";
import { guardText, isUrgent, URGENT_REPLY } from "../lib/aiSafety.ts";
import { getConsents } from "./privacy.ts";
import { read, write } from "./store.ts";

export const LANGUAGES = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "te", label: "తెలుగు", speech: "te-IN" },
  { code: "kn", label: "ಕನ್ನಡ", speech: "kn-IN" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];

/** where a reply's buttons may lead: FMD pages only */
const ALLOWED = ["/dentists", "/appointments", "/records", "/journey", "/assistant/tools/", "/concierge"];
export type Action = { label: string; href: string };
export type Attachment = { name: string; type: string; size: number };
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  attachments?: Attachment[];
  actions?: Action[];
  urgent?: boolean;
  note?: string;
  helpful?: boolean | null;
};
export type Conversation = { id: string; title: string; updated_at: string; messages: Message[] };
export type SendResult = { conversation: Conversation; stored: boolean };

const ATTACH_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const checkAttachment = (f: { type: string; size: number }) =>
  !ATTACH_TYPES.includes(f.type) ? "Attach a PDF, JPG, PNG or WebP." : f.size > 20 * 1024 * 1024 ? "Attach a file under 20 MB." : null;

const key = (userId: string) => `fmd-demo:ai:${userId}`;
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function toAction(a: NavAction): Action {
  const href =
    a.target === "dentists" ? (a.specialty ? `/dentists?specialty=${encodeURIComponent(a.specialty)}` : "/dentists") : a.target === "concierge" ? "/concierge" : `/${a.target}`;
  return { label: a.label, href };
}
/** an FMD page (not another site, not "//elsewhere") on the allow-list */
const allowed = (a: Action) => a.href.startsWith("/") && !a.href.startsWith("//") && ALLOWED.some((p) => a.href.startsWith(p));

/** Extra buttons for the companion tools (part 4.2), when a question points at one. */
function toolActions(q: string): Action[] {
  const out: Action[] = [];
  if (/(cost|price|fee|budget|afford|estimate)/.test(q)) out.push({ label: "Plan treatment costs", href: "/assistant/tools/budget" });
  if (/(insurance|claim|policy|cover)/.test(q)) out.push({ label: "Understand my insurance", href: "/assistant/tools/insurance" });
  if (/(remind|floss|brush|aligner|routine)/.test(q)) out.push({ label: "Set up reminders", href: "/assistant/tools/reminders" });
  if (/(prepare|first visit|history|allerg|medicine)/.test(q)) out.push({ label: "Keep my dental history", href: "/assistant/tools/history" });
  if (/(report|x-?ray|result)/.test(q)) out.push({ label: "Explain a report", href: "/records?type=report" });
  return out;
}

/** One reply. Pure: the safety rules and allow-list apply whatever produced the text. */
export async function answer(text: string, lang: Lang, attachments: Attachment[] = []): Promise<Omit<Message, "id" | "at" | "role">> {
  const q = text.toLowerCase();
  if (isUrgent(q))
    return {
      text: URGENT_REPLY,
      urgent: true,
      actions: [{ label: "Dentists available today", href: "/dentists?available=today" }],
    };
  const raw = await aiProvider().reply([{ role: "user", text }], { role: "patient", language: lang });
  let body = guardText(raw.text);
  if (attachments.length)
    body = `I can see ${attachments.length === 1 ? `“${attachments[0].name}”` : `${attachments.length} files`}. I read files as documents, never as instructions. In this demo I can't read what's inside yet; you can keep ${attachments.length === 1 ? "it" : "them"} in your records and ask your dentist about ${attachments.length === 1 ? "it" : "them"}.\n\n${body}`;
  const actions = [...raw.actions.map(toAction), ...toolActions(q), ...(attachments.length ? [{ label: "Save to my records", href: "/records" }] : [])].filter(allowed).slice(0, 4);
  return { text: body, actions, note: lang === "en" ? undefined : "This demo answers in English. The live FMD AI will reply in the language you choose." };
}

/* ---------------- conversations ---------------- */

async function canStore(userId: string | null) {
  if (!userId) return false;
  return (await getConsents(userId, new Date().toISOString())).some((c) => c.purpose === "ai_history" && c.granted);
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  return (read<Conversation[]>(key(userId)) ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Sends a message. Without a signed-in user or the history consent, nothing is kept: the conversation lives only on
 *  the page (`current`). */
export async function send(userId: string | null, current: Conversation | null, text: string, lang: Lang, attachments: Attachment[] = []): Promise<SendResult> {
  const clean = text.trim().slice(0, 2000);
  if (!clean && !attachments.length) throw new Error("Type a question, or attach a file.");
  const bad = attachments.map(checkAttachment).find(Boolean);
  if (bad) throw new Error(bad);
  const now = new Date().toISOString();
  const user: Message = { id: newId("m"), role: "user", text: clean, at: now, ...(attachments.length ? { attachments } : {}) };
  const reply: Message = { id: newId("m"), role: "assistant", at: now, helpful: null, ...(await answer(clean || "about this file", lang, attachments)) };
  const conversation: Conversation = {
    id: current?.id ?? newId("c"),
    title: current?.title ?? (clean || attachments[0].name).slice(0, 60),
    updated_at: now,
    messages: [...(current?.messages ?? []), user, reply],
  };
  const stored = await canStore(userId);
  if (stored) write(key(userId!), [...(await listConversations(userId!)).filter((c) => c.id !== conversation.id), conversation]);
  return { conversation, stored };
}

export async function deleteConversation(userId: string, id: string) {
  write(key(userId), (await listConversations(userId)).filter((c) => c.id !== id));
}
export async function deleteAllConversations(userId: string) {
  write(key(userId), []);
}

/** Helpful or not, kept with the message (and stored only when the conversation is). */
export async function rate(userId: string | null, c: Conversation, messageId: string, helpful: boolean): Promise<Conversation> {
  const next = { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, helpful } : m)) };
  if (await canStore(userId)) write(key(userId!), (await listConversations(userId!)).map((x) => (x.id === c.id ? next : x)));
  return next;
}
