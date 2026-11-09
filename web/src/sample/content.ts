/**
 * Explore: feed, posts, comments, reports, creating posts, following (plan parts 5.1–5.4, PDR §4.7, §4.8, §10,
 * Annex C, D): sample data until the backend has it. Proposed API:
 *   GET  /feed?tab=for_you|following|learn|reels&cursor → {items: FeedItem[], next_cursor}
 *   GET  /posts/{id} · POST/DELETE /posts/{id}/reactions · GET/POST /posts/{id}/comments · DELETE /comments/{id}
 *   POST /posts/{id}/vote {option} · POST /reports {target_type, target_id, category, note}
 *   POST /posts (draft) · PATCH /posts/{id} · POST /posts/{id}/submit · POST /posts/import-preview {url} · GET /me/posts
 *   GET /me/following · POST/DELETE /follows/{dentist_id}
 * Rules: every card says why it's shown. Declared interests come first; past searches are used only with the
 * personalisation consent. Sponsored posts are labelled, kept apart, and never in Following. No identifiable patient
 * case is submitted without documented consent and a de-identification check. Imports are links or official embeds
 * with the source and creator credited, never copied.
 */
import { getConsents } from "./privacy.ts";
import { read, write } from "./store.ts";

export type Kind = "article" | "image" | "video" | "poll";
export type Author = { id: string; name: string; specialty: string; verified: boolean; kind: "dentist" | "fmd" };
export type Post = {
  id: string;
  kind: Kind;
  topic: string;
  title: string;
  body: string;
  author: Author;
  published_at: string;
  media?: { src: string; alt: string; poster?: string; captions?: string };
  source?: { platform: string; url: string; credit: string };
  poll?: string[];
  sponsored_by?: string;
  is_case?: boolean;
  likes: number;
  demo: true;
};
export type FeedItem = Post & { reason: string; liked: boolean; saved: boolean; following: boolean; votes: number[] | null; myVote: number | null; comments: number };
export type Comment = { id: string; post_id: string; author: string; mine: boolean; body: string; at: string };
export type Tab = "for_you" | "following" | "learn" | "reels";

export const REPORT_REASONS = {
  misinformation: "Health misinformation",
  misleading_claims: "Misleading claims or guarantees",
  privacy_consent: "Privacy or patient consent",
  harassment: "Harassment or abuse",
  spam: "Spam or scam",
  copyright: "Copyright",
  inappropriate: "Inappropriate content",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const key = (what: string, userId: string) => `fmd-demo:${what}:${userId}`;

const DR = (id: string, name: string, specialty: string, verified = true): Author => ({ id, name, specialty, verified, kind: "dentist" });
const ADITI = DR("aditi-sharma", "Dr. Aditi Sharma", "General Dentist");
const ROHAN = DR("rohan-mehta", "Dr. Rohan Mehta", "Orthodontist");
const MEENAKSHI = DR("meenakshi-pillai", "Dr. Meenakshi Pillai", "Periodontist");
const FARAH = DR("farah-khan", "Dr. Farah Khan", "Pediatric Dentist");
const SNEHA = DR("sneha-iyer", "Dr. Sneha Iyer", "Implantologist");
const PRIYANKA = DR("priyanka-shah", "Dr. Priyanka Shah", "Implantologist");
const FMD: Author = { id: "fmd", name: "FMD Team", specialty: "FindMyDentist", verified: true, kind: "fmd" };

const CAPTIONS = "WEBVTT\n\n00:00.000 --> 00:04.000\n[Music]\n\n00:04.000 --> 00:10.000\n[Music] FindMyDentist: find a dentist, keep your records, ask FMD AI.\n";

/** The demo posts, by fictitious demo dentists, already reviewed. */
function posts(now: number): Post[] {
  const at = (d: number) => iso(now - d * day);
  const p = (x: Omit<Post, "demo" | "likes"> & { likes?: number }): Post => ({ likes: 0, ...x, demo: true });
  return [
    p({ id: "p-floss", kind: "article", topic: "Prevention", title: "Why flossing matters more than you think", body: "Brushing cleans about two thirds of each tooth's surface. The rest sits between teeth, where plaque builds up and gum problems often begin. Floss or use interdental brushes once a day, gently, and ask your dentist to show you the right size for your gaps.", author: ADITI, published_at: at(1), likes: 42 }),
    p({ id: "p-aligners", kind: "image", topic: "Orthodontics", title: "Braces or clear aligners: how dentists decide", body: "Both move teeth with steady, gentle pressure. Aligners are removable and discreet but only work if worn 20–22 hours a day. Braces suit more complex movements. The right choice depends on your bite, your habits and what an assessment shows.", author: ROHAN, published_at: at(2), likes: 87, media: { src: "/img/tx-aligners.png", alt: "Illustration of a clear aligner tray beside a tooth" } }),
    p({ id: "p-reel", kind: "video", topic: "Using FMD", title: "Meet FMD in 10 seconds", body: "Find dentists you can check, keep your dental records in one private place, and ask FMD AI in plain words.", author: FMD, published_at: at(2), likes: 15, media: { src: "/frames/fmd.mp4", alt: "FMD brand animation", captions: CAPTIONS } }),
    p({ id: "p-gums-poll", kind: "poll", topic: "Gum health", title: "Quick poll: do your gums bleed when you brush?", body: "Bleeding gums are common and often get better with gentler, more thorough cleaning, but they're worth mentioning at your next check-up. Answer to see how others responded.", author: MEENAKSHI, published_at: at(3), likes: 23, poll: ["Never", "Sometimes", "Often", "Not sure"] }),
    p({ id: "p-sponsored", kind: "image", topic: "Implants", title: "Implant check-ups: what to expect each year", body: "An implant needs the same care as a natural tooth: cleaning around it every day and a yearly check of the gum and bone around it.", author: PRIYANKA, published_at: at(4), likes: 9, media: { src: "/img/tx-implants.png", alt: "Illustration of a dental implant" }, sponsored_by: "Demo Implant Systems" }),
    p({ id: "p-kids", kind: "article", topic: "Kids", title: "Your child's first dental visit", body: "A first visit around the first tooth or first birthday helps children get comfortable early. It's mostly a gentle look, advice on brushing and diet, and a chance for parents to ask questions.", author: FARAH, published_at: at(5), likes: 31 }),
    p({ id: "p-cleaning", kind: "image", topic: "Prevention", title: "What happens at a professional cleaning", body: "Scaling removes the hardened plaque (tartar) that brushing can't. Polishing smooths the surface so plaque sticks less. It usually takes 30–45 minutes and shouldn't hurt; tell the hygienist if anything feels sharp.", author: ADITI, published_at: at(6), likes: 19, media: { src: "/img/tx-cleaning.png", alt: "Illustration of teeth being cleaned" } }),
    p({ id: "p-implant-steps", kind: "article", topic: "Implants", title: "What happens during implant treatment", body: "Implant treatment is staged: assessment and imaging, placing the implant, a healing period while bone bonds to it, then the crown. Timelines vary from a few months upwards depending on bone and gum health.", author: SNEHA, published_at: at(8), likes: 26 }),
    p({ id: "p-case-gap", kind: "image", topic: "Cosmetic", title: "Case: closing a small front gap with bonding", body: "A patient asked about a small gap between the front teeth. We closed it in one visit with tooth-coloured bonding, without drilling. Shared with the patient's written consent; identifying details removed.", author: ADITI, published_at: at(10), likes: 54, media: { src: "/img/tx-whitening.png", alt: "Illustration of a smile after cosmetic bonding" }, is_case: true }),
  ];
}

/* ---------------- per-person state ---------------- */

type Mine = {
  liked: string[];
  following: string[];
  votes: Record<string, number>;
  comments: Comment[];
  reports: { target: string; reason: ReportReason; note: string; at: string }[];
  drafts: Draft[];
};
const EMPTY: Mine = { liked: [], following: [], votes: {}, comments: [], reports: [], drafts: [] };
const load = (userId: string | null): Mine => (userId ? { ...EMPTY, ...read<Mine>(key("content", userId)) } : EMPTY);
const save = (userId: string, m: Mine) => write(key("content", userId), m);

/** Saved posts live with the other saves (sample/saved.ts) so the Saved page lists them together. */
const savedPosts = (userId: string | null) => (userId ? (read<string[]>(`fmd-demo:saved-post:${userId}`) ?? []) : []);

/** The demo: each poll starts with some votes from others. */
const BASE_VOTES: Record<string, number[]> = { "p-gums-poll": [41, 63, 18, 12] };

/* ---------------- personalisation ---------------- */

const SEARCH_KEY = (userId: string) => `fmd-demo:last-search:${userId}`;

/** Remembers a dentist search for the feed, only with the personalisation consent (Annex D). */
export async function noteSearch(userId: string | null, q: string) {
  if (!userId || !q.trim()) return;
  const consents = await getConsents(userId, new Date().toISOString());
  if (consents.some((c) => c.purpose === "personalisation" && c.granted)) write(SEARCH_KEY(userId), q.trim().toLowerCase().slice(0, 60));
}

const TOPIC_WORDS: [RegExp, string[]][] = [
  [/brace|align|crooked|straight|ortho/, ["Orthodontics"]],
  [/gum|bleed|perio/, ["Gum health"]],
  [/implant|missing/, ["Implants"]],
  [/kid|child|baby/, ["Kids"]],
  [/clean|floss|brush|prevent/, ["Prevention"]],
  [/white|smile|cosmetic|gap/, ["Cosmetic"]],
];

/* ---------------- the feed ---------------- */

function decorate(p: Post, userId: string | null, m: Mine, reason: string): FeedItem {
  const base = BASE_VOTES[p.id];
  const mine = m.votes[p.id];
  const votes = p.poll && mine !== undefined ? base.map((n, i) => n + (i === mine ? 1 : 0)) : null; // results only after voting
  return {
    ...p,
    reason,
    liked: m.liked.includes(p.id),
    likes: p.likes + (m.liked.includes(p.id) ? 1 : 0),
    saved: savedPosts(userId).includes(p.id),
    following: m.following.includes(p.author.id),
    votes,
    myVote: mine ?? null,
    comments: m.comments.filter((c) => c.post_id === p.id).length + (p.id === "p-floss" ? 2 : 0),
  };
}

export async function feed(userId: string | null, tab: Tab, now = Date.now()): Promise<FeedItem[]> {
  const m = load(userId);
  const consent = userId ? (await getConsents(userId, iso(now))).some((c) => c.purpose === "personalisation" && c.granted) : false;
  const search = userId && consent ? read<string>(SEARCH_KEY(userId)) : null;
  const searchTopics = search ? TOPIC_WORDS.filter(([re]) => re.test(search)).flatMap(([, t]) => t) : [];
  const own = published(userId, m, now);
  const all = [...own, ...posts(now)];
  const organic = all.filter((p) => !p.sponsored_by);
  const ad = all.find((p) => p.sponsored_by);

  const why = (p: Post): string => {
    if (own.some((x) => x.id === p.id)) return "Your post.";
    if (m.following.includes(p.author.id)) return `From ${p.author.name}, whom you follow.`;
    if (searchTopics.includes(p.topic)) return `Because you searched for “${search}”. You can turn this off in Privacy and data.`;
    return "General dental education, shown to everyone.";
  };

  let list: Post[];
  if (tab === "following") list = organic.filter((p) => m.following.includes(p.author.id));
  else if (tab === "learn") list = organic.filter((p) => p.kind === "article" || p.kind === "image");
  else if (tab === "reels") list = organic.filter((p) => p.kind === "video");
  else {
    // matches for the last search first, then everything else newest first: never only the past searches
    const rank = (p: Post) => (searchTopics.includes(p.topic) ? 0 : m.following.includes(p.author.id) ? 1 : 2);
    list = [...organic].sort((a, b) => rank(a) - rank(b) || b.published_at.localeCompare(a.published_at));
    // one sponsored post, labelled, in the third place; never in Following
    if (ad && list.length >= 2) list.splice(2, 0, ad);
  }
  return list.map((p) => decorate(p, userId, m, p.sponsored_by ? `Sponsored by ${p.sponsored_by}: a paid placement, not a clinical endorsement.` : why(p)));
}

export async function getPost(userId: string | null, id: string, now = Date.now()): Promise<FeedItem | null> {
  const m = load(userId);
  const p = [...published(userId, m, now), ...posts(now)].find((x) => x.id === id);
  return p ? decorate(p, userId, m, p.sponsored_by ? `Sponsored by ${p.sponsored_by}: a paid placement.` : "") : null;
}

/* ---------------- interactions ---------------- */

const needUser = (userId: string | null): string => {
  if (!userId) throw new Error("Log in to do that.");
  return userId;
};

export async function toggleLike(userId: string | null, postId: string) {
  const u = needUser(userId);
  const m = load(u);
  save(u, { ...m, liked: m.liked.includes(postId) ? m.liked.filter((x) => x !== postId) : [...m.liked, postId] });
}

export async function toggleFollow(userId: string | null, dentistId: string) {
  const u = needUser(userId);
  const m = load(u);
  const on = !m.following.includes(dentistId);
  save(u, { ...m, following: on ? [...m.following, dentistId] : m.following.filter((x) => x !== dentistId) });
  return on;
}

export async function following(userId: string) {
  const m = load(userId);
  const authors = new Map(posts(Date.now()).map((p) => [p.author.id, p.author]));
  return m.following.map((id) => authors.get(id) ?? { id, name: id, specialty: "", verified: false, kind: "dentist" as const });
}

export async function vote(userId: string | null, postId: string, option: number) {
  const u = needUser(userId);
  const m = load(u);
  if (m.votes[postId] !== undefined) throw new Error("You've already answered this poll.");
  save(u, { ...m, votes: { ...m.votes, [postId]: option } });
}

/** A couple of earlier comments on the demo, so the thread isn't empty. */
const DEMO_COMMENTS: Comment[] = [
  { id: "c-1", post_id: "p-floss", author: "Ravi", mine: false, body: "Interdental brushes were much easier for me than floss.", at: "2026-11-08T09:00:00.000Z" },
  { id: "c-2", post_id: "p-floss", author: "Dr. Aditi Sharma", mine: false, body: "Good choice. Whatever you'll use every day is the right one.", at: "2026-11-08T11:00:00.000Z" },
];

export async function comments(userId: string | null, postId: string) {
  return [...DEMO_COMMENTS.filter((c) => c.post_id === postId), ...load(userId).comments.filter((c) => c.post_id === postId)];
}

export async function addComment(userId: string | null, name: string, postId: string, body: string) {
  const u = needUser(userId);
  const text = body.trim();
  if (!text) throw new Error("Write something first.");
  if (text.length > 500) throw new Error("Keep comments under 500 characters.");
  const m = load(u);
  save(u, { ...m, comments: [...m.comments, { id: newId("c"), post_id: postId, author: name, mine: true, body: text, at: iso(Date.now()) }] });
}

export async function deleteComment(userId: string | null, id: string) {
  const u = needUser(userId);
  const m = load(u);
  save(u, { ...m, comments: m.comments.filter((c) => c.id !== id) });
}

export async function report(userId: string | null, target: string, reason: ReportReason | "", note: string) {
  const u = needUser(userId);
  if (!reason) throw new Error("Choose what's wrong.");
  if (reason === "other" && !note.trim()) throw new Error("Tell us what's wrong.");
  const m = load(u);
  if (m.reports.some((r) => r.target === target)) throw new Error("You've already reported this. FMD's team is reviewing it.");
  save(u, { ...m, reports: [...m.reports, { target, reason, note: note.trim(), at: iso(Date.now()) }] });
}

/* ---------------- creating posts ---------------- */

export type DraftStatus = "draft" | "in_review" | "scheduled" | "published" | "rejected";
export type Draft = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  topic: string;
  tags: string[];
  media: { name: string; type: string; alt: string; captions: string | null } | null;
  source: { platform: string; url: string; credit: string } | null;
  poll: string[];
  is_case: boolean;
  consent: { kind: "upload" | "clinic_record"; ref: string } | null;
  deidentified: string[];
  owns: boolean;
  status: DraftStatus;
  publish_at: string | null;
  submitted_at: string | null;
  reason: string | null;
};

export const DEID_CHECKS = [
  "No face, or the patient agreed to show it",
  "No name, initials, date of birth or ID number",
  "No dates, clinic records or X-ray labels that identify them",
  "No tattoos, jewellery or other marks that identify them",
];

/** Where a link can come from: official embeds or links only, credited (Annex C). */
const PLATFORMS: [RegExp, string][] = [
  [/^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/, "YouTube"],
  [/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+/, "Instagram"],
  [/^https:\/\/(www\.)?linkedin\.com\/posts\//, "LinkedIn"],
];

/** What an import link can become: an attributed link or embed, never a copied file. */
export function importPreview(url: string): { platform: string; url: string } | { error: string } {
  const u = url.trim();
  const hit = PLATFORMS.find(([re]) => re.test(u));
  if (hit) return { platform: hit[1], url: u };
  return { error: "FMD can only link to YouTube, Instagram or LinkedIn posts for now. If you own the video or image, upload it instead." };
}

/** The first problem stopping a post from going to review, or null. */
export function checkDraft(d: Draft): string | null {
  if (!d.title.trim()) return "Give the post a title.";
  if (!d.body.trim()) return "Write the text of the post.";
  if ((d.kind === "image" || d.kind === "video") && !d.media && !d.source) return "Add the image or video, or link to it.";
  if (d.media && d.kind === "image" && !d.media.alt.trim()) return "Describe the image for people who can't see it (alt text).";
  if (d.kind === "poll" && (d.poll.filter((o) => o.trim()).length < 2 || d.poll.length > 4)) return "A poll needs 2 to 4 answers.";
  if (d.source && !d.source.credit.trim()) return "Credit the creator of the linked post.";
  if (d.is_case && !d.consent) return "Patient case posts need the patient's documented consent.";
  if (d.is_case && DEID_CHECKS.some((c) => !d.deidentified.includes(c))) return "Tick every privacy check before sharing a patient case.";
  if (!d.owns) return "Confirm you own this content or have permission to share it.";
  return null;
}

export const newDraft = (): Draft => ({
  id: newId("draft"),
  kind: "article",
  title: "",
  body: "",
  topic: "Prevention",
  tags: [],
  media: null,
  source: null,
  poll: ["", ""],
  is_case: false,
  consent: null,
  deidentified: [],
  owns: false,
  status: "draft",
  publish_at: null,
  submitted_at: null,
  reason: null,
});

/** demo: FMD's reviewers decide this long after a post is submitted */
export const REVIEW_MS = 20_000;

/** Moves demo posts along: review finishes, scheduled posts go live. */
function advance(d: Draft, now: number): Draft {
  if (d.status === "in_review" && now - Date.parse(d.submitted_at!) >= REVIEW_MS)
    return d.publish_at && Date.parse(d.publish_at) > now ? { ...d, status: "scheduled" } : { ...d, status: "published", publish_at: d.publish_at ?? iso(now) };
  if (d.status === "scheduled" && Date.parse(d.publish_at!) <= now) return { ...d, status: "published" };
  return d;
}

function published(userId: string | null, m: Mine, now: number): Post[] {
  if (!userId) return [];
  return m.drafts
    .map((d) => advance(d, now))
    .filter((d) => d.status === "published")
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      topic: d.topic,
      title: d.title,
      body: d.body,
      author: { id: `me-${userId}`, name: "You", specialty: "", verified: true, kind: "dentist" as const },
      published_at: d.publish_at!,
      ...(d.kind === "poll" ? { poll: d.poll.filter((o) => o.trim()) } : {}),
      ...(d.source ? { source: d.source } : {}),
      is_case: d.is_case,
      likes: 0,
      demo: true as const,
    }));
}

/** A demo of a post the reviewers turned down, with the reason. */
const REJECTED: Draft = {
  ...newDraft(),
  id: "draft-rejected",
  kind: "image",
  title: "Whitening before and after",
  body: "Two shades whiter after one session!",
  topic: "Cosmetic",
  media: { name: "before-after.jpg", type: "image/jpeg", alt: "Before and after whitening", captions: null },
  is_case: false,
  owns: true,
  status: "rejected",
  submitted_at: "2026-11-01T10:00:00.000Z",
  reason: "Before-and-after photos show a patient, so they need the patient's documented consent and the privacy checks. Results also vary, so avoid promising a number of shades.",
};

export async function myPosts(userId: string, now = Date.now()): Promise<Draft[]> {
  const m = load(userId);
  const drafts = m.drafts.map((d) => advance(d, now));
  return [...drafts, REJECTED].sort((a, b) => (b.submitted_at ?? "9").localeCompare(a.submitted_at ?? "9"));
}

/** Saves a draft, or sends it to FMD's review (`submit`), optionally to publish later. */
export async function saveDraft(userId: string, d: Draft, submit: boolean, now = Date.now()): Promise<Draft> {
  if (submit) {
    const problem = checkDraft(d);
    if (problem) throw new Error(problem);
    if (d.publish_at && Date.parse(d.publish_at) <= now) throw new Error("Choose a time in the future to publish, or publish after review.");
  }
  const next: Draft = submit ? { ...d, status: "in_review", submitted_at: iso(now) } : { ...d, status: "draft" };
  const m = load(userId);
  save(userId, { ...m, drafts: [...m.drafts.filter((x) => x.id !== d.id), next] });
  return next;
}

export async function deleteDraft(userId: string, id: string) {
  const m = load(userId);
  save(userId, { ...m, drafts: m.drafts.filter((x) => x.id !== id) });
}
