/**
 * Product analytics (PDR §16): the event dictionary and one function to send events. The dictionary is the
 * contract: each event lists exactly which properties it may carry, so nothing else (a search phrase, a symptom, a
 * record's name, a free-text note) can slip through. Health details never go to analytics.
 * Delivery is a stub until the analytics vendor is chosen: events are kept in memory and logged in development.
 */
type Prop = "bool" | "number" | readonly string[];

export const EVENTS = {
  sign_up_completed: { about: "Account created", props: {} },
  onboarding_completed: { about: "Account type chosen", props: { account_type: ["patient", "dentist", "student", "company"] } },
  dentist_search: { about: "A dentist search ran", props: { filters: "number", near_me: "bool", results: "number" } },
  profile_viewed: { about: "A dentist's profile opened", props: { dentist_id: "string-id" } },
  booking_confirmed: { about: "A booking or request was made", props: { mode: ["live", "request"], for_someone_else: "bool" } },
  ai_message_sent: { about: "A question to FMD AI", props: { language: ["en", "hi", "te", "kn", "ta"], has_attachment: "bool" } },
  ai_feedback: { about: "An answer rated", props: { helpful: "bool" } },
  post_liked: { about: "A post liked", props: { kind: ["article", "image", "video", "poll"] } },
  edge_request_sent: { about: "An FMD Edge request", props: { contact: ["phone", "whatsapp", "email"] } },
  membership_paid: { about: "A membership payment confirmed", props: { plan: ["dentist", "student", "company"] } },
} as const satisfies Record<string, { about: string; props: Record<string, Prop | "string-id"> }>;
export type EventName = keyof typeof EVENTS;

const sent: { name: EventName; props: Record<string, unknown>; at: string }[] = [];

/** Keeps only the properties the dictionary allows, with the right kind of value. */
export function clean(name: EventName, props: Record<string, unknown>) {
  const allowed = EVENTS[name].props as Record<string, Prop | "string-id">;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    const rule = allowed[k];
    if (!rule) continue;
    if (rule === "bool" && typeof v === "boolean") out[k] = v;
    else if (rule === "number" && typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (rule === "string-id" && typeof v === "string" && /^[a-z0-9-]{1,64}$/.test(v)) out[k] = v;
    else if (Array.isArray(rule) && rule.includes(v as string)) out[k] = v;
  }
  return out;
}

export function track(name: EventName, props: Record<string, unknown> = {}) {
  const e = { name, props: clean(name, props), at: new Date().toISOString() };
  sent.push(e);
  if (process.env.NODE_ENV !== "production") console.debug("[analytics]", e.name, e.props);
}

/** what has been sent in this tab (for tests and the team's checks) */
export const sentEvents = () => [...sent];
