import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Page } from "@/components/Page";

export const metadata: Metadata = {
  title: "Legal — FindMyDentist",
  description: "FMD's AI disclaimer, privacy notice, terms of use and company information.",
};

// Privacy wording is the same draft shown at sign-up; nothing here is invented legal text.
function Doc({ id, title, status, children }: { id: string; title: string; status?: string; children: ReactNode }) {
  return (
    <section id={id} className="glass scroll-mt-28 rounded-[28px] p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-light tracking-[-0.02em] text-ink">{title}</h2>
        {status && <span className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{status}</span>}
      </div>
      <div className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-ink-3">{children}</div>
    </section>
  );
}

export default function Legal() {
  return (
    <Page>
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 text-[34px] font-extralight tracking-[-0.03em] text-ink sm:text-[42px]">Policies and company information</h1>
      <p className="mt-2 max-w-2xl text-[13.5px] text-ink-4">FMD is in pre-release. Documents marked draft are pending legal review and will be replaced by final versions.</p>

      <div className="mt-10 space-y-4">
        <Doc id="ai-disclaimer" title="AI disclaimer">
          <p>
            FMD AI provides educational information about dental health. It helps you describe a concern, understand common treatment options and
            learn which kind of dental professional may help. It does not diagnose conditions and is not a substitute for assessment by a
            registered dental professional.
          </p>
          <p>FMD AI never books appointments, contacts clinics or makes payments on your behalf. Every decision and confirmation stays with you.</p>
          <p>
            The AI clinic manager in FMD Clinic OS (beta) assists clinic teams with administrative work only. Actions that leave the clinic, such as
            messages to patients, require approval from a permitted team member. FMD does not provide clinical treatment; care is delivered by
            qualified providers.
          </p>
          <p>If you have severe pain, swelling or bleeding, contact a dentist or emergency care directly.</p>
        </Doc>

        <Doc id="privacy" title="Privacy notice" status="Draft">
          <p>
            We keep your contact details to sign you in and, if you allow it, to send appointment updates. Health details you add (records, assistant
            conversations) are stored separately, shared only when you choose, and never used for advertising. You can export your data or request
            deletion from your account.
          </p>
          <p>
            Details you send through a homepage form — a Clinic OS demo or early-access request, or the product-updates waitlist — are used only to
            respond to that request and are never sold. To be removed, email{" "}
            <a href="mailto:support@findmydentist.io" className="underline underline-offset-4">support@findmydentist.io</a>.
          </p>
        </Doc>

        <Doc id="terms" title="Terms of use" status="Draft">
          <p>
            The full terms of use are being finalised and are pending legal review. Until they are published, questions about using FMD can be sent
            to <a href="mailto:support@findmydentist.io" className="underline underline-offset-4">support@findmydentist.io</a>.
          </p>
        </Doc>

        <Doc id="company" title="Company information">
          <p>
            <span className="text-ink-2">FMD Private Limited</span> · FindMyDentist
            <br />A dentistry-focused ecosystem connecting patients, dentists, clinics, students and dental companies.
          </p>
          <p>
            Contact: <a href="mailto:support@findmydentist.io" className="underline underline-offset-4">support@findmydentist.io</a> ·{" "}
            <Link href="/help" className="underline underline-offset-4">Help centre</Link>
          </p>
        </Doc>
      </div>
    </Page>
  );
}
