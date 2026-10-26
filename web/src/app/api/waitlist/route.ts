import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import nodemailer from "nodemailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // true for port 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, role, state, city } = body;

    // Server-side validation
    if (!name?.trim() || !email?.trim() || !role || !state) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanCity = city?.trim() || null;

    // 1. Save to Neon PostgreSQL
    try {
      await query(
        `INSERT INTO waitlist (name, email, role, state, city) 
         VALUES ($1, $2, $3, $4, $5)`,
        [cleanName, cleanEmail, role, state, cleanCity]
      );
    } catch (dbError: any) {
      // Handle unique constraint violation (duplicate email)
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "This email is already on the waitlist!" },
          { status: 409 }
        );
      }
      throw dbError;
    }

    // 2. Send Email via Google Workspace
    try {
      await transporter.sendMail({
        from: `"Find My Dentist" <${process.env.SMTP_USER}>`,
        to: cleanEmail,
        subject: "You're on the Find My Dentist waitlist 🦷",
        replyTo: process.env.SMTP_USER,
        text: `Hi ${cleanName},

        You're on the Find My Dentist waitlist.

        Thank you for joining. We're building a healthier, happier world through better dental care, and we're thrilled to have you onboard as a ${role}.

        We'll notify you as soon as we launch in ${state}${cleanCity ? ` (${cleanCity})` : ""}.

        — The Find My Dentist Team
        support@findmydentist.io`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>You're on the waitlist</title>
        <!--[if mso]>
        <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
        <![endif]-->
        </head>
        <body style="margin:0;padding:0;background-color:#f4f6fb;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
        <!-- preheader: hidden preview text -->
        <div style="display:none;font-size:1px;color:#f4f6fb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
            You're officially on the list. We'll email you the moment Find My Dentist launches in ${state}.
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6fb;">
            <tr>
            <td align="center" style="padding:40px 16px;">

                <!-- card -->
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(11,18,48,0.08);">

                <!-- header band -->
                <tr>
                    <td style="background-color:#03050f;padding:36px 40px;text-align:center;">
                    <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9fb2e0;font-weight:600;">
                        Find My Dentist
                    </p>
                    <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:26px;line-height:1.25;color:#ffffff;font-weight:600;letter-spacing:-0.3px;">
                        You're on the list 🎉
                    </h1>
                    </td>
                </tr>

                <!-- body -->
                <tr>
                    <td style="padding:40px 40px 8px 40px;">
                    <p style="margin:0 0 18px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#0b1230;">
                        Hi <strong>${cleanName}</strong>,
                    </p>
                    <p style="margin:0 0 18px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3a4360;">
                        Thank you for joining the waitlist. We're building a <strong style="color:#0b1230;">healthier, happier world through better dental care</strong>, and we're thrilled to have you onboard as a <strong style="color:#0b1230;">${role}</strong>.
                    </p>

                    <!-- highlight box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
                        <tr>
                        <td style="background-color:#f4f6fb;border-left:3px solid #2563eb;border-radius:8px;padding:18px 22px;">
                            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3a4360;">
                            We'll notify you the moment we launch in
                            <strong style="color:#0b1230;">${state}</strong>${cleanCity ? ` &middot; <span style="color:#0b1230;">${cleanCity}</span>` : ""}.
                            </p>
                        </td>
                        </tr>
                    </table>

                    <p style="margin:0 0 30px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3a4360;">
                        In the meantime, follow along for product updates and early previews.
                    </p>
                    </td>
                </tr>

                <!-- CTA button -->
                <tr>
                    <td align="center" style="padding:0 40px 40px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                        <td style="background-color:#2563eb;border-radius:999px;padding:14px 32px;">
                            <a href="https://findmydentist.io" target="_blank" style="display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                            Visit findmydentist.io
                            </a>
                        </td>
                        </tr>
                    </table>
                    </td>
                </tr>

                <!-- divider -->
                <tr>
                    <td style="padding:0 40px;">
                    <hr style="border:0;border-top:1px solid #e8ecf5;margin:0;" />
                    </td>
                </tr>

                <!-- footer -->
                <tr>
                    <td style="padding:28px 40px 36px 40px;">
                    <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#0b1230;font-weight:600;">
                        The Find My Dentist Team
                    </p>
                    <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a93ad;">
                        Questions? Reply to this email or write to
                        <a href="mailto:support@findmydentist.io" style="color:#2563eb;text-decoration:none;">support@findmydentist.io</a>
                    </p>
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;line-height:1.6;color:#a8b0c6;">
                        You received this email because you joined the Find My Dentist waitlist.
                    </p>
                    </td>
                </tr>

                </table>
                <!-- /card -->

                <!-- tiny legal below the card -->
                <p style="margin:24px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;line-height:1.6;color:#a8b0c6;text-align:center;">
                © 2026 Find My Dentist &middot; Pre-release &middot; Not clinical advice
                </p>

            </td>
            </tr>
        </table>
        </body>
        </html>
        `,
        });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Note: Data is saved in DB, so we can still return success or log it
    }

    return NextResponse.json(
      { success: true, message: "Successfully joined the waitlist!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}