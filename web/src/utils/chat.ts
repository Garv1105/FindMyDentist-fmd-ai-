/**
 * Gemini for FMD AI: answers the questions the hardcoded rules (server/adapters/ai.ts) don't cover.
 * Server-only: reads GEMINI_API_KEY from the environment and calls the REST API directly (no SDK).
 * Safety rules are NOT trusted to the model: server/assistant.ts escalates emergencies before this runs and
 * guards every reply afterwards (no dosing, no definitive diagnosis, disclaimer added).
 */
import type { ChatTurn } from "../server/adapters/ai.ts";
import { SPECIALTIES } from "../lib/catalog.ts";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const SYSTEM_PROMPT = `You are FMD AI, the assistant on FindMyDentist (FMD), a platform in India that helps patients find verified dentists, understand dental problems in plain language, prepare for visits and keep their dental records.

How to answer:
- Answer dental and oral-health questions in simple, friendly language, in 2 to 5 short sentences (under 110 words). Plain text only: no markdown, bullet symbols or headings.
- Explain what a symptom or treatment commonly relates to, but never give a diagnosis and never say what the person definitely has or needs.
- Never recommend or name medicines, doses or antibiotics. Say a dentist can advise safely.
- When it helps, say which kind of dentist to see, using one of: ${SPECIALTIES.join(", ")}.
- You can't book, message clinics, take payments or see the user's records. Suggest they use FindMyDentist to find a dentist and request an appointment themselves.
- If the question is not about teeth, gums, the mouth or using FindMyDentist, say briefly that you can only help with dental care and invite a dental question.
- If something sounds urgent (spreading swelling, trouble breathing or swallowing, heavy bleeding, injury, high fever), tell them to contact a dentist today or call 112.`;

export const hasGemini = () => !!process.env.GEMINI_API_KEY;

/** The generateContent request body for a conversation (pure; exported for the test). */
export function geminiRequest(history: ChatTurn[]) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
    // thinkingBudget 0: short factual replies don't need it, and thinking tokens would eat the output budget
    generationConfig: { temperature: 0.4, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
  };
}

type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

/** Ask Gemini; resolves to null on any failure (missing key, timeout, API error, empty answer). */
export async function askGemini(history: ChatTurn[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(geminiRequest(history)),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.warn(`[gemini] ${res.status} ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text || null;
  } catch (e) {
    console.warn(`[gemini] ${(e as Error).message}`);
    return null;
  }
}
