import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { currentConsents, type Auth } from "./auth.ts";
import { aiProvider, type ChatTurn, type NavAction } from "./adapters/ai.ts";
import { bad, HttpError, notFound } from "./http.ts";
import { SPECIALTIES } from "../lib/catalog.ts";

/**
 * Public FMD AI: advises and navigates; it never acts (PRD §4.10).
 * The only thing a reply can carry is a navigation suggestion from an allow-list. There are no tools
 * that book, message, pay or submit — so no prompt can make it do those things.
 */

/* ---------------- escalation (SAF-04; wording to be clinically reviewed, SAF-01) ---------------- */

const URGENT: RegExp[] = [
  /swell\w*.*\b(eye|neck|throat|jaw|face)\b|\b(eye|neck|face)\b.*swell/,
  /(difficult|hard|trouble|can'?t)\s*(to\s*)?(breath|swallow|open (my )?mouth)/,
  /(won'?t|doesn'?t|can'?t|not) stop(ped)? bleeding|bleeding (heavily|a lot)/,
  /(knocked|fell|broke|broken).*(tooth|teeth|jaw)|tooth (fell|came) out|accident|injur/,
  /(high )?fever.*(tooth|swell|pain)|(tooth|swell|pain).*fever/,
];
export const isUrgent = (text: string) => URGENT.some((r) => r.test(text.toLowerCase()));

const URGENT_REPLY =
  "What you describe can need urgent care. Please contact a dentist today. If there is swelling spreading to your eye or neck, difficulty breathing or swallowing, heavy bleeding that won't stop, or a serious injury, go to the nearest emergency department or call 112 now. FMD AI can't assess emergencies and isn't monitoring your symptoms.";

/* ---------------- output guard ---------------- */

const BLOCK: RegExp[] = [
  /\b\d+\s?(mg|ml|mcg)\b/i, // dosing
  /\b(take|start|prescribe)\b.*\b(antibiotic|amoxicillin|ibuprofen|paracetamol|painkiller)s?\b/i,
  /\byou (definitely |certainly )?(have|need) (a |an )?(root canal|extraction|implant|cavity|infection|abscess)\b/i,
];
const DISCLAIMER = "This is general information, not a diagnosis. A dentist needs to examine you to know what's going on.";

/** Applied to every provider's output: no dosing, no definitive diagnosis, allow-listed actions only. */
export function guardReply(text: string, actions: unknown[]): { text: string; actions: NavAction[] } {
  let out = text.trim().slice(0, 2000);
  if (BLOCK.some((r) => r.test(out)))
    out = "I can't recommend medicines or say what treatment you need. A dentist can examine you and advise safely. I can help you find one, or explain what to ask at your visit.";
  if (!out.includes("not a diagnosis")) out = `${out}\n\n${DISCLAIMER}`;
  const safe = actions
    .filter((a): a is NavAction => {
      const x = a as NavAction;
      return (
        x?.type === "navigate" &&
        ["dentists", "concierge", "records", "appointments"].includes(x.target) &&
        typeof x.label === "string" &&
        (x.specialty === undefined || (SPECIALTIES as readonly string[]).includes(x.specialty))
      );
    })
    .slice(0, 3)
    .map((a) => ({ type: "navigate" as const, label: a.label.slice(0, 60), target: a.target, ...(a.specialty ? { specialty: a.specialty } : {}) }));
  return { text: out, actions: safe };
}

/* ---------------- rate limiting ---------------- */

// ponytail: in-memory per-key window; move to Redis/DB when running more than one server instance
const hits = new Map<string, number[]>();
function rateLimit(key: string, max = 30, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (list.length >= max) throw new HttpError(429, "rate_limited", "You're sending messages quickly. Please wait a few minutes.");
  list.push(now);
  hits.set(key, list);
}

/* ---------------- conversation ---------------- */

export async function chat(a: Auth | null, input: Record<string, unknown>, clientKey: string) {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) throw bad("Type a message.");
  if (message.length > 1000) throw bad("Messages can be up to 1,000 characters.");
  rateLimit(a ? `u:${a.user.id}` : `ip:${clientKey}`);

  // history is stored only for signed-in users who opted in (MAIN-13, consent ai_history)
  const store = !!a && currentConsents(a.user.id).ai_history;
  let conversationId = typeof input.conversationId === "string" ? input.conversationId : null;
  let history: ChatTurn[] = [];
  if (store && conversationId) {
    const c = one<{ user_id: string }>("SELECT user_id FROM ai_conversations WHERE id = ?", conversationId);
    if (!c || c.user_id !== a!.user.id) throw notFound("Conversation not found.");
    history = all<ChatTurn>("SELECT role, text FROM ai_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 12", conversationId).reverse();
  } else if (Array.isArray(input.history)) {
    // unsaved conversations: the client sends recent turns back; treated strictly as untrusted text
    history = input.history
      .filter((t): t is ChatTurn => (t?.role === "user" || t?.role === "assistant") && typeof t?.text === "string")
      .slice(-12)
      .map((t) => ({ role: t.role, text: t.text.slice(0, 1000) }));
  }
  history.push({ role: "user", text: message });

  const provider = aiProvider();
  const urgent = isUrgent(message);
  let reply: { text: string; actions: NavAction[] };
  if (urgent) {
    reply = { text: URGENT_REPLY, actions: [{ type: "navigate", label: "Find a dentist now", target: "dentists" }] };
  } else {
    try {
      const raw = await provider.reply(history, { role: a?.user.account_type ?? "guest", language: a?.user.language ?? "en" });
      reply = guardReply(raw.text, raw.actions);
    } catch {
      throw new HttpError(503, "ai_unavailable", "FMD AI is unavailable right now. You can still search for dentists and book directly.");
    }
  }

  if (store) {
    tx(() => {
      const now = Date.now();
      if (!conversationId) {
        conversationId = randomUUID();
        run("INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", conversationId, a!.user.id, message.slice(0, 60), now, now);
      } else run("UPDATE ai_conversations SET updated_at = ? WHERE id = ?", now, conversationId);
      run("INSERT INTO ai_messages (id, conversation_id, role, text, created_at) VALUES (?, ?, 'user', ?, ?)", randomUUID(), conversationId, message, now);
      run(
        "INSERT INTO ai_messages (id, conversation_id, role, text, actions, urgent, provider, created_at) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)",
        randomUUID(), conversationId, reply.text, JSON.stringify(reply.actions), urgent ? 1 : 0, provider.name, now + 1,
      );
    });
  }
  // usage telemetry without message content (ANL-01; no sensitive text in analytics)
  audit(a?.user.id ?? null, "assistant.reply", "assistant", conversationId, { urgent, provider: provider.name, stored: store });

  return { conversationId: store ? conversationId : null, stored: store, urgent, provider: { name: provider.name, configured: provider.configured }, reply };
}

export function listConversations(a: Auth) {
  return all<{ id: string; title: string; updated_at: number }>("SELECT id, title, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50", a.user.id);
}

export function getConversation(a: Auth, id: string) {
  const c = one<{ user_id: string; title: string }>("SELECT user_id, title FROM ai_conversations WHERE id = ?", id);
  if (!c || c.user_id !== a.user.id) throw notFound("Conversation not found.");
  return {
    id,
    title: c.title,
    messages: all<{ role: string; text: string; actions: string; urgent: number }>(
      "SELECT role, text, actions, urgent FROM ai_messages WHERE conversation_id = ? ORDER BY created_at",
      id,
    ).map((m) => ({ role: m.role, text: m.text, actions: JSON.parse(m.actions) as NavAction[], urgent: m.urgent === 1 })),
  };
}

export function deleteConversation(a: Auth, id: string) {
  const c = one<{ user_id: string }>("SELECT user_id FROM ai_conversations WHERE id = ?", id);
  if (!c || c.user_id !== a.user.id) throw notFound("Conversation not found.");
  tx(() => {
    run("DELETE FROM ai_messages WHERE conversation_id = ?", id);
    run("DELETE FROM ai_conversations WHERE id = ?", id);
    audit(a.user.id, "assistant.conversation_deleted", "assistant", id);
  });
}
