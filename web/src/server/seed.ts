import { randomUUID } from "node:crypto";
import { all, one, run, tx } from "./db.ts";

/**
 * DEMO directory for development and design review. Every row is flagged is_demo = 1 and the UI
 * labels it "Demo profile". Names, clinics and phone numbers are fictitious; verification text
 * says plainly that no real check was performed.
 */
const DEMO_CHECK = "Demo data — no real verification has been performed.";

const CLINICS = [
  { key: "kor", name: "Demo Dental Studio", area: "Koramangala", address: "80 Feet Rd, Koramangala, Bengaluru (demo)", hours: "Mon–Sat · 10:00–19:30" },
  { key: "hsr", name: "Demo Ortho Care", area: "HSR Layout", address: "27th Main, HSR Layout, Bengaluru (demo)", hours: "Mon–Fri · 09:30–18:00" },
  { key: "jay", name: "Demo Implant Centre", area: "Jayanagar", address: "4th Block, Jayanagar, Bengaluru (demo)", hours: "Tue–Sun · 10:00–20:00" },
  { key: "ind", name: "Demo Smile Lounge", area: "Indiranagar", address: "100 Feet Rd, Indiranagar, Bengaluru (demo)", hours: "Mon–Sat · 11:00–20:00" },
  { key: "whf", name: "Demo Family Dental", area: "Whitefield", address: "ITPL Main Rd, Whitefield, Bengaluru (demo)", hours: "Mon–Sat · 09:00–18:00" },
];

const DENTISTS = [
  { name: "Dr. Aditi Sharma", photo: "/img/dr-1.png", specialty: "General Dentist", exp: 11, q: ["BDS", "MDS (Conservative Dentistry)"], l: ["English", "Hindi", "Kannada"], s: ["Consultation", "Teeth Cleaning", "Fillings", "Root Canal Treatment"], clinic: "kor", fee: "₹500 consultation (demo)", v: "verified" },
  { name: "Dr. Rohan Mehta", photo: "/img/dr-2.png", specialty: "Orthodontist", exp: 9, q: ["BDS", "MDS (Orthodontics)"], l: ["English", "Hindi"], s: ["Consultation", "Braces", "Clear Aligners"], clinic: "hsr", fee: "₹700 consultation (demo)", v: "verified", sponsor: "Demo Aligner Brand" },
  { name: "Dr. Sneha Iyer", photo: "/img/dr-3.png", specialty: "Implantologist", exp: 14, q: ["BDS", "MDS (Prosthodontics)", "Fellowship in Implantology"], l: ["English", "Tamil", "Kannada"], s: ["Consultation", "Dental Implants", "Extraction", "Crowns & Bridges"], clinic: "jay", fee: "₹800 consultation (demo)", v: "verified" },
  { name: "Dr. Karan Malhotra", photo: "/img/dr-4.png", specialty: "Cosmetic Dentist", exp: 7, q: ["BDS", "Certificate in Aesthetic Dentistry"], l: ["English", "Hindi", "Telugu"], s: ["Consultation", "Smile Design", "Veneers", "Teeth Whitening"], clinic: "ind", fee: "", v: "unverified" },
  { name: "Dr. Farah Khan", photo: "", specialty: "Pediatric Dentist", exp: 8, q: ["BDS", "MDS (Pedodontics)"], l: ["English", "Hindi", "Kannada"], s: ["Consultation", "Kids Dentistry", "Fillings", "Teeth Cleaning"], clinic: "whf", fee: "₹600 consultation (demo)", v: "verified" },
  { name: "Dr. Venkat Rao", photo: "", specialty: "Endodontist", exp: 16, q: ["BDS", "MDS (Endodontics)"], l: ["English", "Telugu", "Kannada"], s: ["Consultation", "Root Canal Treatment", "Fillings"], clinic: "kor", fee: "₹600 consultation (demo)", v: "pending" },
  { name: "Dr. Meenakshi Pillai", photo: "", specialty: "Periodontist", exp: 12, q: ["BDS", "MDS (Periodontics)"], l: ["English", "Malayalam", "Tamil"], s: ["Consultation", "Gum Treatment", "Teeth Cleaning"], clinic: "jay", fee: "₹600 consultation (demo)", v: "verified" },
  { name: "Dr. Arjun Desai", photo: "", specialty: "Oral Surgeon", exp: 10, q: ["BDS", "MDS (Oral & Maxillofacial Surgery)"], l: ["English", "Hindi", "Marathi"], s: ["Consultation", "Extraction", "Dental Implants"], clinic: "whf", fee: "", v: "unverified" },
  { name: "Dr. Kavya Reddy", photo: "", specialty: "Prosthodontist", exp: 6, q: ["BDS", "MDS (Prosthodontics)"], l: ["English", "Telugu", "Hindi"], s: ["Consultation", "Dentures", "Crowns & Bridges"], clinic: "ind", fee: "₹500 consultation (demo)", v: "verified" },
];

export function seedDemoDirectory() {
  if (one("SELECT 1 FROM dentists LIMIT 1")) {
    topUpDemoSlots();
    return false;
  }
  const now = Date.now();
  const c_live = new Set(["kor", "jay"]); // two demo clinics get a labelled demo schedule; the rest are request-only
  tx(() => {
    const clinicIds = new Map<string, string>();
    for (const c of CLINICS) {
      const id = randomUUID();
      clinicIds.set(c.key, id);
      run(
        "INSERT INTO clinics (id, name, city, area, address, phone, hours, is_demo, created_at) VALUES (?, ?, 'Bengaluru', ?, ?, '', ?, 1, ?)",
        id, c.name, c.area, c.address, c.hours, now,
      );
    }
    for (const d of DENTISTS) {
      const id = randomUUID();
      run(
        `INSERT INTO dentists (id, name, photo, specialty, experience_years, qualifications, languages, bio, verification_status, verification_checks, verified_at, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        id, d.name, d.photo, d.specialty, d.exp, JSON.stringify(d.q), JSON.stringify(d.l),
        `${d.name.replace("Dr. ", "")} is a demo ${d.specialty.toLowerCase()} profile used for design review.`,
        d.v, d.v === "verified" ? DEMO_CHECK : "", d.v === "verified" ? now : null, now,
      );
      run("INSERT INTO dentist_clinics (dentist_id, clinic_id, fee_note) VALUES (?, ?, ?)", id, clinicIds.get(d.clinic)!, d.fee);
      for (const s of d.s) run("INSERT INTO dentist_services (dentist_id, service) VALUES (?, ?)", id, s);
      if (d.sponsor)
        run("INSERT INTO placements (id, dentist_id, kind, sponsor, starts_at, ends_at) VALUES (?, ?, 'sponsored', ?, ?, ?)", randomUUID(), id, d.sponsor, now - 86400_000, now + 365 * 86400_000);
    }
    for (const key of c_live)
      run(
        "INSERT INTO clinic_booking_policies (clinic_id, live_schedule, schedule_source, min_notice_minutes, cancellation_terms) VALUES (?, 1, 'demo', 120, ?)",
        clinicIds.get(key)!,
        "Demo terms: free cancellation up to 4 hours before the appointment.",
      );
  });
  topUpDemoSlots();
  return true;
}

/** Keep 14 days of demo slots ahead (IST, Mon–Sat, 10:00–13:00 and 15:00–18:00, 30 min). */
export function topUpDemoSlots(now = Date.now()) {
  const pairs = all<{ dentist_id: string; clinic_id: string }>(
    "SELECT dc.dentist_id, dc.clinic_id FROM dentist_clinics dc JOIN clinic_booking_policies p ON p.clinic_id = dc.clinic_id WHERE p.schedule_source = 'demo'",
  );
  if (!pairs.length || one("SELECT 1 FROM slots WHERE starts_at > ? LIMIT 1", now + 7 * 86400_000)) return;
  const IST = 5.5 * 3600_000;
  const dayStart = (t: number) => Math.floor((t + IST) / 86400_000) * 86400_000 - IST; // midnight IST
  tx(() => {
    for (let day = 0; day < 14; day++) {
      const d0 = dayStart(now) + day * 86400_000;
      if (new Date(d0 + IST).getUTCDay() === 0) continue; // Sunday closed
      for (const h of [10, 10.5, 11, 11.5, 12, 12.5, 15, 15.5, 16, 16.5, 17, 17.5]) {
        const start = d0 + h * 3600_000;
        if (start < now) continue;
        for (const p of pairs) {
          if (one("SELECT 1 FROM slots WHERE dentist_id = ? AND starts_at = ?", p.dentist_id, start)) continue;
          run("INSERT INTO slots (id, clinic_id, dentist_id, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), p.clinic_id, p.dentist_id, start, start + 30 * 60_000, now);
        }
      }
    }
  });
}

/** DEMO educational posts by demo dentists, already reviewed. Labelled demo in the UI. */
const DEMO_POSTS: { by: string; kind: string; topic: string; title: string; body: string; options?: string[] }[] = [
  { by: "Dr. Aditi Sharma", kind: "education", topic: "Prevention", title: "Why flossing matters more than you think", body: "Brushing cleans about two thirds of each tooth's surface. The rest sits between teeth, where plaque builds up and gum problems often begin. Floss or use interdental brushes once a day, gently, and ask your dentist to show you the right size for your gaps." },
  { by: "Dr. Rohan Mehta", kind: "education", topic: "Orthodontics", title: "Braces or clear aligners: how dentists decide", body: "Both move teeth with steady, gentle pressure. Aligners are removable and discreet but only work if worn 20–22 hours a day. Braces suit more complex movements. The right choice depends on your bite, your habits and what an assessment shows." },
  { by: "Dr. Meenakshi Pillai", kind: "poll", topic: "Gum health", title: "Quick poll: do your gums bleed when you brush?", body: "Bleeding gums are common and often reversible with better cleaning, but they're worth mentioning at your next check-up. Answer to see how others responded.", options: ["Never", "Sometimes", "Often", "Not sure"] },
  { by: "Dr. Farah Khan", kind: "education", topic: "Kids", title: "Your child's first dental visit", body: "A first visit around the first tooth or first birthday helps children get comfortable early. It's mostly a gentle look, advice on brushing and diet, and a chance for parents to ask questions." },
  { by: "Dr. Sneha Iyer", kind: "education", topic: "Implants", title: "What happens during implant treatment", body: "Implant treatment is staged: assessment and imaging, placing the implant, a healing period while bone bonds to it, then the crown. Timelines vary from a few months upwards depending on bone and gum health." },
];

export function seedDemoContent() {
  if (one("SELECT 1 FROM posts LIMIT 1")) return false;
  const now = Date.now();
  tx(() => {
    DEMO_POSTS.forEach((p, i) => {
      const d = one<{ id: string }>("SELECT id FROM dentists WHERE name = ?", p.by);
      if (!d) return;
      const id = randomUUID();
      run(
        "INSERT INTO posts (id, author_dentist_id, kind, topic, title, body, status, is_demo, created_at, published_at) VALUES (?, ?, ?, ?, ?, ?, 'published', 1, ?, ?)",
        id, d.id, p.kind, p.topic, p.title, p.body, now - i * 86400_000, now - i * 86400_000,
      );
      (p.options ?? []).forEach((label, j) => run("INSERT INTO poll_options (id, post_id, label, position) VALUES (?, ?, ?, ?)", randomUUID(), id, label, j));
    });
  });
  return true;
}
