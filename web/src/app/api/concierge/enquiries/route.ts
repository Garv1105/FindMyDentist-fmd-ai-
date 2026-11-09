import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { CONCIERGE } from "@/lib/concierge";
import { query } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ponytail: created on first request instead of a migration; move to a migration if the schema grows
let ready: Promise<unknown> | null = null;
const ensureTable = () =>
  (ready ??= query(`CREATE TABLE IF NOT EXISTS concierge_enquiries (
    id SERIAL PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_method TEXT NOT NULL,
    contact_value TEXT NOT NULL,
    need TEXT NOT NULL,
    area TEXT NOT NULL,
    timing TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e) => {
    ready = null;
    throw e;
  }));

const bad = (message: string) => NextResponse.json({ message }, { status: 400 });

export async function POST(request: Request) {
  try {
    const b = await request.json();
    const name = String(b.name ?? "").trim();
    const area = String(b.area ?? "").trim();
    const value = String(b.contactValue ?? "").trim();
    const method = b.contactMethod;
    if (!name || !area) return bad("Please fill in your name and area.");
    if (!CONCIERGE.needs.includes(b.need)) return bad("Please choose a care need.");
    if (!CONCIERGE.timings.includes(b.timing)) return bad("Please choose a preferred timing.");
    if (!CONCIERGE.contactMethods.includes(method)) return bad("Please choose how we should contact you.");
    if (method === "email" ? !EMAIL_RE.test(value) : !/^\d{10}$/.test(value.replace(/[\s-]/g, "")))
      return bad(method === "email" ? "Please enter a valid email address." : "Please enter a valid 10-digit mobile number.");
    if (b.consent !== true) return bad("Please tick the consent box.");

    await ensureTable();
    const reference = `FE-${randomBytes(3).toString("hex").toUpperCase()}`;
    await query(
      `INSERT INTO concierge_enquiries (reference, name, contact_method, contact_value, need, area, timing)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [reference, name, method, value, b.need, area, b.timing],
    );

    // tell the team; a mail failure must not lose the saved enquiry
    try {
      await transporter.sendMail({
        from: `"Find My Dentist" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        subject: `FMD Edge enquiry ${reference}: ${b.need}`,
        text: `Reference: ${reference}\nName: ${name}\nContact: ${method} - ${value}\nNeed: ${b.need}\nArea: ${area}\nTiming: ${b.timing}`,
      });
    } catch (mailErr) {
      console.error("FMD Edge team email failed:", mailErr);
    }

    return NextResponse.json({ reference });
  } catch (e) {
    console.error("FMD Edge enquiry failed:", e);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
