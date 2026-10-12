/**
 * OTP delivery adapter (OD-14: SMS/email vendor not chosen).
 * Without a configured vendor this is a DEVELOPMENT adapter: it logs the code to the
 * server console and lets the API echo it back outside production. It never claims delivery.
 */
export type OtpDelivery = { configured: boolean; channel: "dev-console" | "sms" | "email" };

export function deliverOtp(target: string, code: string): OtpDelivery {
  // Real vendors plug in here (e.g. SMS with DLT-registered template, transactional email).
  if (process.env.NODE_ENV !== "test") console.info(`[otp:dev] ${target} → ${code} (no SMS/email provider configured)`);
  return { configured: false, channel: "dev-console" };
}

/** Echo the code to the client only in development with no vendor configured. */
export const exposeDevCode = () => process.env.NODE_ENV !== "production";
