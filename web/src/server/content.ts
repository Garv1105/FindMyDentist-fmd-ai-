import { randomUUID } from "node:crypto";
import { all, audit, one, run, tx } from "./db.ts";
import { requireRole, type Auth } from "./auth.ts";
import { bad, forbidden, HttpError, notFound } from "./http.ts";
import { REPORT_CATEGORIES, TOPICS } from "../lib/catalog.ts";

/**
 * Content hub (PRD §4.7, Annex C, D).
 * - Only verified dentists publish; everything is reviewed before it is public.
 * - Case content needs a consent reference, de-identification and clinical-review attestations.
 * - Sponsorship is set by staff only and always labelled; it never changes organic ranking.
 * - Personalisation uses explicit interests and follows only, and every item says why it's shown.
 */

type PostRow = {
  id: string;
  author_user_id: string | null;
  author_dentist_id: string | null;
  kind: "education" | "post" | "poll" | "case";
  topic: string;
  title: string;
  body: string;
  status: "in_review" | "published" | "rejected" | "removed";
  sponsored_by: string | null;
  moderation_note: string;
  is_demo: number;
  created_at: number;
  published_at: number | null;
};

const isModerator = (a: Auth) => a.roles.some((r) => r === "moderator" || r === "fmd_ops" || r === "super_admin");

/** The dentist profile an author account may publish as: claimed and verified. */
function verifiedProfileOf(a: Auth) {
  return one<{ id: string; name: string }>("SELECT id, name FROM dentists WHERE user_id = ? AND verification_status = 'verified' LIMIT 1", a.user.id);
}

export function createPost(a: Auth, input: Record<string, unknown>) {
  const profile = verifiedProfileOf(a);
  if (!profile) throw new HttpError(403, "not_verified", "Only verified dentists can publish. Claim and verify your profile first.");
  const kind = input.kind;
  if (kind !== "education" && kind !== "post" && kind !== "poll" && kind !== "case") throw bad("Choose a post type.");
  const topic = typeof input.topic === "string" && (TOPICS as readonly string[]).includes(input.topic) ? input.topic : null;
  if (!topic) throw bad("Choose a topic.");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (title.length < 5 || title.length > 120) throw bad("Title must be 5–120 characters.");
  if (body.length < 20 || body.length > 4000) throw bad("Text must be 20–4,000 characters.");
  let options: string[] = [];
  if (kind === "poll") {
    options = Array.isArray(input.options) ? input.options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (options.length < 2 || options.length > 5 || options.some((o) => o.length > 80)) throw bad("Polls need 2–5 options of up to 80 characters.");
  }
  // MAIN-44 / Annex C: no identifiable case material without documented consent and review
  const consentRef = typeof input.caseConsentRef === "string" ? input.caseConsentRef.trim() : "";
  if (kind === "case") {
    if (consentRef.length < 4) throw bad("Case posts need the patient consent reference.");
    if (input.caseDeidentified !== true) throw bad("Confirm the case has been de-identified.");
    if (input.caseClinicallyReviewed !== true) throw bad("Confirm the clinical content has been reviewed.");
  }
  const id = randomUUID();
  tx(() => {
    run(
      `INSERT INTO posts (id, author_user_id, author_dentist_id, kind, topic, title, body, status, case_consent_ref, case_deidentified, case_clinically_reviewed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'in_review', ?, ?, ?, ?)`,
      id, a.user.id, profile.id, kind, topic, title, body, kind === "case" ? consentRef : null, kind === "case" ? 1 : 0, kind === "case" ? 1 : 0, Date.now(),
    );
    options.forEach((label, i) => run("INSERT INTO poll_options (id, post_id, label, position) VALUES (?, ?, ?, ?)", randomUUID(), id, label, i));
    audit(a.user.id, "post.submitted", "post", id, { kind, consentRef: kind === "case" ? consentRef : undefined });
  });
  return { id, status: "in_review" as const };
}

/* ---------------- moderation ---------------- */

export function reviewQueue(a: Auth) {
  if (!isModerator(a)) throw forbidden();
  const posts = all<PostRow & { author: string | null; case_consent_ref: string | null }>(
    "SELECT p.*, d.name AS author FROM posts p LEFT JOIN dentists d ON d.id = p.author_dentist_id WHERE p.status = 'in_review' ORDER BY p.created_at",
  );
  const reports = all<{ id: string; target_type: string; target_id: string; category: string; note: string; created_at: number; title: string | null }>(
    `SELECT r.id, r.target_type, r.target_id, r.category, r.note, r.created_at, COALESCE(p.title, c.body, j.title) AS title
     FROM reports r LEFT JOIN posts p ON r.target_type = 'post' AND p.id = r.target_id LEFT JOIN comments c ON r.target_type = 'comment' AND c.id = r.target_id
     LEFT JOIN jobs j ON r.target_type = 'job' AND j.id = r.target_id
     WHERE r.status = 'open' ORDER BY r.created_at`,
  );
  return {
    posts: posts.map((p) => ({ id: p.id, kind: p.kind, topic: p.topic, title: p.title, body: p.body, author: p.author, caseConsentRef: p.case_consent_ref, createdAt: p.created_at })),
    reports: reports.map((r) => ({ ...r, categoryLabel: REPORT_CATEGORIES[r.category as keyof typeof REPORT_CATEGORIES] ?? r.category })),
  };
}

export function moderatePost(a: Auth, id: string, input: Record<string, unknown>) {
  if (!isModerator(a)) throw forbidden();
  const decision = input.decision;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  if (decision !== "publish" && decision !== "reject" && decision !== "remove") throw bad("Choose publish, reject or remove.");
  if (decision !== "publish" && note.length < 3) throw bad("Give the reason the author will see.");
  return tx(() => {
    const p = one<PostRow>("SELECT * FROM posts WHERE id = ?", id);
    if (!p) throw notFound("Post not found.");
    if (decision === "publish" && p.status !== "in_review") throw new HttpError(409, "invalid", "Only posts in review can be published.");
    const status = decision === "publish" ? "published" : decision === "reject" ? "rejected" : "removed";
    run("UPDATE posts SET status = ?, moderation_note = ?, published_at = COALESCE(published_at, ?) WHERE id = ?", status, note, decision === "publish" ? Date.now() : null, id);
    if (decision === "remove") run("UPDATE reports SET status = 'actioned', decided_by = ?, decision_note = ?, decided_at = ? WHERE target_type = 'post' AND target_id = ? AND status = 'open'", a.user.id, note, Date.now(), id);
    audit(a.user.id, `post.${status}`, "post", id, { note });
    return { id, status };
  });
}

/** Sponsored labelling is a staff action (paid placement contract), never set by authors. */
export function setSponsor(a: Auth, id: string, sponsor: unknown) {
  requireRole(a, "fmd_ops", "super_admin");
  const s = typeof sponsor === "string" && sponsor.trim() ? sponsor.trim().slice(0, 80) : null;
  run("UPDATE posts SET sponsored_by = ? WHERE id = ?", s, id);
  audit(a.user.id, "post.sponsor_set", "post", id, { sponsor: s });
}

export function decideReport(a: Auth, id: string, input: Record<string, unknown>) {
  if (!isModerator(a)) throw forbidden();
  const action = input.action;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  if (action !== "remove" && action !== "dismiss") throw bad("Choose remove or dismiss.");
  if (note.length < 3) throw bad("Record the reason.");
  tx(() => {
    const r = one<{ target_type: string; target_id: string; status: string }>("SELECT target_type, target_id, status FROM reports WHERE id = ?", id);
    if (!r) throw notFound("Report not found.");
    if (r.status !== "open") throw new HttpError(409, "decided", "Already decided.");
    if (action === "remove") {
      if (r.target_type === "post") run("UPDATE posts SET status = 'removed', moderation_note = ? WHERE id = ?", note, r.target_id);
      if (r.target_type === "comment") run("UPDATE comments SET status = 'removed' WHERE id = ?", r.target_id);
      if (r.target_type === "job") run("UPDATE jobs SET status = 'removed' WHERE id = ?", r.target_id);
    }
    run(
      "UPDATE reports SET status = ?, decided_by = ?, decision_note = ?, decided_at = ? WHERE target_type = ? AND target_id = ? AND status = 'open'",
      action === "remove" ? "actioned" : "dismissed", a.user.id, note, Date.now(), r.target_type, r.target_id,
    );
    audit(a.user.id, `report.${action}`, r.target_type, r.target_id, { note });
  });
}

/* ---------------- feed & personalisation ---------------- */

export function interestsOf(userId: string) {
  return all<{ topic: string }>("SELECT topic FROM user_interests WHERE user_id = ?", userId).map((r) => r.topic);
}

export function setInterests(a: Auth, topics: unknown) {
  const list = Array.isArray(topics) ? topics.filter((t): t is string => (TOPICS as readonly string[]).includes(t)) : [];
  tx(() => {
    run("DELETE FROM user_interests WHERE user_id = ?", a.user.id);
    for (const t of new Set(list)) run("INSERT INTO user_interests (user_id, topic) VALUES (?, ?)", a.user.id, t);
  });
  return interestsOf(a.user.id);
}

/**
 * tab=foryou: interests and follows first, then general education so the feed isn't a filter bubble (MAIN-40).
 * Each item carries `reason` (ANX-D-03). Sponsored items are labelled and never boosted.
 */
export function feed(a: Auth | null, f: { tab?: string; topic?: string; q?: string } = {}) {
  const interests = a ? interestsOf(a.user.id) : [];
  const followed = new Set(a ? all<{ dentist_id: string }>("SELECT dentist_id FROM follows WHERE user_id = ?", a.user.id).map((r) => r.dentist_id) : []);
  const saved = new Set(a ? all<{ post_id: string }>("SELECT post_id FROM post_saves WHERE user_id = ?", a.user.id).map((r) => r.post_id) : []);
  const liked = new Set(a ? all<{ post_id: string }>("SELECT post_id FROM post_reactions WHERE user_id = ?", a.user.id).map((r) => r.post_id) : []);
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 80);

  let rows = all<PostRow & { author: string | null; author_photo: string | null; verified: string | null }>(
    `SELECT p.*, d.name AS author, d.photo AS author_photo, d.verification_status AS verified
     FROM posts p LEFT JOIN dentists d ON d.id = p.author_dentist_id WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 200`,
  );
  if (f.topic) rows = rows.filter((r) => r.topic === f.topic);
  if (q) rows = rows.filter((r) => `${r.title} ${r.body} ${r.topic}`.toLowerCase().includes(q));
  if (f.tab === "following") rows = rows.filter((r) => r.author_dentist_id && followed.has(r.author_dentist_id));
  if (f.tab === "saved") rows = rows.filter((r) => saved.has(r.id));

  const reasonFor = (r: PostRow) =>
    q
      ? `Matches your search “${q}”`
      : r.author_dentist_id && followed.has(r.author_dentist_id)
        ? "From a dentist you follow"
        : interests.includes(r.topic)
          ? `You're interested in ${r.topic}`
          : "General dental education";
  const rank = (r: PostRow) => (r.author_dentist_id && followed.has(r.author_dentist_id) ? 2 : 0) + (interests.includes(r.topic) ? 1 : 0);
  if (f.tab !== "saved") rows.sort((x, y) => rank(y) - rank(x) || (y.published_at ?? 0) - (x.published_at ?? 0));

  const ids = rows.slice(0, 30).map((r) => r.id);
  const counts = (table: string) => {
    const m = new Map<string, number>();
    if (!ids.length) return m;
    for (const c of all<{ post_id: string; n: number }>(`SELECT post_id, COUNT(*) AS n FROM ${table} WHERE post_id IN (${ids.map(() => "?").join(",")}) GROUP BY post_id`, ...ids)) m.set(c.post_id, c.n);
    return m;
  };
  const likes = counts("post_reactions");
  const commentCounts = (() => {
    const m = new Map<string, number>();
    if (!ids.length) return m;
    for (const c of all<{ post_id: string; n: number }>(`SELECT post_id, COUNT(*) AS n FROM comments WHERE status = 'visible' AND post_id IN (${ids.map(() => "?").join(",")}) GROUP BY post_id`, ...ids)) m.set(c.post_id, c.n);
    return m;
  })();

  return {
    interests,
    items: rows.slice(0, 30).map((r) => ({
      id: r.id,
      kind: r.kind,
      topic: r.topic,
      title: r.title,
      body: r.body,
      author: r.author_dentist_id ? { dentistId: r.author_dentist_id, name: r.author, photo: r.author_photo, verified: r.verified === "verified", followed: followed.has(r.author_dentist_id) } : null,
      sponsoredBy: r.sponsored_by,
      publishedAt: r.published_at,
      likes: likes.get(r.id) ?? 0,
      comments: commentCounts.get(r.id) ?? 0,
      liked: liked.has(r.id),
      saved: saved.has(r.id),
      poll: r.kind === "poll" ? pollOf(r.id, a) : null,
      reason: reasonFor(r),
      demo: r.is_demo === 1,
    })),
  };
}

function pollOf(postId: string, a: Auth | null) {
  const opts = all<{ id: string; label: string; votes: number }>(
    "SELECT o.id, o.label, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes FROM poll_options o WHERE o.post_id = ? ORDER BY o.position",
    postId,
  );
  const mine = a ? one<{ option_id: string }>("SELECT option_id FROM poll_votes WHERE post_id = ? AND user_id = ?", postId, a.user.id)?.option_id ?? null : null;
  // results are shown only after voting so they don't steer the answer
  return { options: opts.map((o) => ({ id: o.id, label: o.label, votes: mine ? o.votes : null })), myVote: mine, total: mine ? opts.reduce((s, o) => s + o.votes, 0) : null };
}

/* ---------------- engagement ---------------- */

function published(id: string) {
  const p = one<{ id: string; author_dentist_id: string | null }>("SELECT id, author_dentist_id FROM posts WHERE id = ? AND status = 'published'", id);
  if (!p) throw notFound("Post not found.");
  return p;
}

export function toggle(a: Auth, id: string, what: "like" | "save") {
  published(id);
  const table = what === "like" ? "post_reactions" : "post_saves";
  const exists = one(`SELECT 1 FROM ${table} WHERE post_id = ? AND user_id = ?`, id, a.user.id);
  if (exists) run(`DELETE FROM ${table} WHERE post_id = ? AND user_id = ?`, id, a.user.id);
  else run(`INSERT INTO ${table} (post_id, user_id, created_at) VALUES (?, ?, ?)`, id, a.user.id, Date.now());
  return { on: !exists };
}

export function toggleFollow(a: Auth, dentistId: string) {
  if (!one("SELECT 1 FROM dentists WHERE id = ?", dentistId)) throw notFound("Dentist not found.");
  const exists = one("SELECT 1 FROM follows WHERE user_id = ? AND dentist_id = ?", a.user.id, dentistId);
  if (exists) run("DELETE FROM follows WHERE user_id = ? AND dentist_id = ?", a.user.id, dentistId);
  else run("INSERT INTO follows (user_id, dentist_id, created_at) VALUES (?, ?, ?)", a.user.id, dentistId, Date.now());
  return { following: !exists };
}

export function vote(a: Auth, postId: string, optionId: unknown) {
  published(postId);
  const opt = one("SELECT 1 FROM poll_options WHERE id = ? AND post_id = ?", String(optionId), postId);
  if (!opt) throw bad("Choose an option.");
  if (one("SELECT 1 FROM poll_votes WHERE post_id = ? AND user_id = ?", postId, a.user.id)) throw new HttpError(409, "voted", "You've already voted.");
  run("INSERT INTO poll_votes (post_id, user_id, option_id) VALUES (?, ?, ?)", postId, a.user.id, String(optionId));
  return pollOf(postId, a);
}

export function comments(postId: string) {
  published(postId);
  return all<{ id: string; body: string; author: string; created_at: number }>(
    "SELECT c.id, c.body, u.name AS author, c.created_at FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? AND c.status = 'visible' ORDER BY c.created_at",
    postId,
  ).map((c) => ({ ...c, author: c.author.split(" ")[0] })); // first name only in public threads
}

export function addComment(a: Auth, postId: string, body: unknown) {
  published(postId);
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length < 2 || text.length > 1000) throw bad("Comments must be 2–1,000 characters.");
  const recent = one<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?", a.user.id, Date.now() - 60_000)!.n;
  if (recent >= 5) throw new HttpError(429, "rate_limited", "Please slow down a little.");
  run("INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)", randomUUID(), postId, a.user.id, text, Date.now());
  return comments(postId);
}

export function report(a: Auth, input: Record<string, unknown>) {
  const type = input.targetType;
  if (type !== "post" && type !== "comment" && type !== "job") throw bad("Unknown item.");
  const category = typeof input.category === "string" && input.category in REPORT_CATEGORIES ? input.category : null;
  if (!category) throw bad("Choose why you're reporting this.");
  const targetId = typeof input.targetId === "string" ? input.targetId : "";
  const table = type === "post" ? "posts" : type === "comment" ? "comments" : "jobs";
  if (!one(`SELECT 1 FROM ${table} WHERE id = ?`, targetId)) throw notFound("Item not found.");
  try {
    run(
      "INSERT INTO reports (id, target_type, target_id, reporter_id, category, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      randomUUID(), type, targetId, a.user.id, category, typeof input.note === "string" ? input.note.trim().slice(0, 500) : "", Date.now(),
    );
  } catch {
    throw new HttpError(409, "reported", "You've already reported this. Our moderators will review it.");
  }
  return { received: true };
}

/** An author's own submissions with moderation outcome and reason. */
export function myPosts(a: Auth) {
  return all<{ id: string; title: string; kind: string; status: string; moderation_note: string; created_at: number }>(
    "SELECT id, title, kind, status, moderation_note, created_at FROM posts WHERE author_user_id = ? ORDER BY created_at DESC",
    a.user.id,
  );
}
