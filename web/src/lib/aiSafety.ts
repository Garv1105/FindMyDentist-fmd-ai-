/**
 * FMD AI safety rules (PDR §4.2, §13), shared by every place an answer is produced. A model is never trusted to
 * apply them itself. Escalation and refusal wording must be reviewed by a dental professional before launch.
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

export const URGENT_REPLY =
  "What you describe can need urgent care. Please contact a dentist today. If there is swelling spreading to your eye or neck, difficulty breathing or swallowing, heavy bleeding that won't stop, or a serious injury, go to the nearest emergency department or call 112 now. FMD AI can't assess emergencies and isn't monitoring your symptoms.";

/* ---------------- output guard ---------------- */

export const BLOCK: RegExp[] = [
  /\b\d+\s?(mg|ml|mcg)\b/i, // dosing
  /\b(take|start|prescribe)\b.*\b(antibiotic|amoxicillin|ibuprofen|paracetamol|painkiller)s?\b/i,
  /\byou (definitely |certainly )?(have|need) (a |an )?(root canal|extraction|implant|cavity|infection|abscess)\b/i,
];
export const DISCLAIMER = "This is general information, not a diagnosis. A dentist needs to examine you to know what's going on.";

/** No dosing, no definitive diagnosis, and the disclaimer always present. */
export function guardText(text: string): string {
  let out = text.trim().slice(0, 2000);
  if (BLOCK.some((r) => r.test(out)))
    out = "I can't recommend medicines or say what treatment you need. A dentist can examine you and advise safely. I can help you find one, or explain what to ask at your visit.";
  return out.includes("not a diagnosis") ? out : `${out}\n\n${DISCLAIMER}`;
}
