/**
 * FMD AI's expressions: what the mascot shows, read from the meaning of what is being said. One engine for every app
 * that has FMD AI (FMD Main, FMD Clinic, later FMD Scholar), so the mascot reacts the same way everywhere.
 *
 * Two parts: a feeling, from the words (the person's draft while they type, else the latest answer), and a body
 * animation, from where the chat is. The mascot model has four body clips and no smile or frown face shapes, so a
 * feeling shows as the choice of clip plus a cue by its head (an aura and a small sign). When the model gains face
 * shapes, they key off the same Feeling.
 */

/** The mascot's body clips (AssistantMascot). */
export type Mood = "idle" | "listening" | "thinking" | "explaining";

/**
 * calm      nothing in particular
 * alert     something that may need care today (swelling with fever, bleeding that won't stop, a knocked-out tooth)
 * empathy   pain, sensitivity, worry or fear
 * cheer     good news: done, booked, approved, thanks
 * focused   numbers, costs, reports, bills
 * curious   it needs more detail before it can help
 */
export type Feeling = "calm" | "alert" | "empathy" | "cheer" | "focused" | "curious";

export type Phase = "idle" | "typing" | "waiting" | "answered";

// First match wins: the order is the priority (an urgent symptom outranks a cost in the same sentence).
// English plus the common Hindi words people use; matched on the lower-cased text.
const RULES: [Feeling, RegExp][] = [
  [
    "alert",
    /\b(urgent|emergency|call 112|swollen face|facial swelling|swelling (and|with) fever|fever|won'?t stop bleeding|bleeding (won'?t|doesn'?t|does not) stop|can'?t (open|breathe|swallow)|knocked[- ]out|broken jaw|abscess|severe)\b|तुरंत|सूजन|बुखार/,
  ],
  ["empathy", /\b(pain|painful|hurts?|hurting|ache|aching|sore|sensitiv\w*|throbb\w*|scared|afraid|anxious|nervous|worried|fear)\b|दर्द|डर/],
  ["cheer", /\b(thanks?|thank you|great|good news|well done|congrat\w*|booked|confirmed|approved|completed|all done|done)\b|धन्यवाद/],
  ["focused", /₹|\d+(\.\d+)?\s?%|\b(revenue|report|rate|cost|costs|price|fee|fees|insurance|emi|bill|bills|recalls?|no-?shows?|utili[sz]ation|budget)\b|खर्च/],
  ["curious", /\?\s*$|\b(tell me more|could you tell|can you share|which tooth|how long have)\b/],
];

/** The feeling a piece of text carries. `urgent` is the answer's own flag (FMD AI's triage), which always wins. */
export function feelingOf(text: string, { urgent = false }: { urgent?: boolean } = {}): Feeling {
  if (urgent) return "alert";
  const t = text.toLowerCase();
  for (const [feeling, re] of RULES) if (re.test(t)) return feeling;
  return "calm";
}

/** The body clip: thinking while it works, listening while you type, and once it answers, a pose that fits the
 *  feeling (gentle and attentive for pain, presenting for good news, numbers and urgent steps). */
export function moodFor(phase: Phase, feeling: Feeling): Mood {
  if (phase === "waiting") return "thinking";
  if (phase === "typing") return "listening";
  if (phase === "answered") return feeling === "empathy" ? "listening" : feeling === "curious" ? "thinking" : "explaining";
  return "idle";
}

/** How a feeling reads to someone using a screen reader (the cue itself is decorative). */
export const FEELING_LABEL: Record<Feeling, string> = {
  calm: "",
  alert: "FMD AI looks concerned: this may need care soon",
  empathy: "FMD AI looks sympathetic",
  cheer: "FMD AI looks pleased",
  focused: "FMD AI is focused on the numbers",
  curious: "FMD AI needs a little more detail",
};
