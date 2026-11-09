import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/Page";
import { NOTICE_VERSION } from "@/sample/privacy";

/**
 * Terms of Use and Privacy Notice: placeholder drafts that set out what the real documents must cover (PDR §13,
 * DPDP Act). FMD's lawyers write the binding text; until then every page says it's a draft.
 */
function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto grid w-full max-w-[760px] gap-5 pb-8">
      <h1 className="text-[26px] font-medium text-ink">{title}</h1>
      <Notice kind="info">Draft for legal review: not yet the binding text. Version {NOTICE_VERSION}.</Notice>
      <div className="grid gap-5 text-[15px] leading-relaxed text-ink-2 [&_h2]:text-[17px] [&_h2]:font-medium [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </article>
  );
}

export function TermsPage() {
  return (
    <Doc title="Terms of Use">
      <section>
        <h2>What FMD is</h2>
        <p>FindMyDentist (FMD) helps you learn about dental care, find dentists and clinics, book visits, keep your dental records, and get help from FMD Edge. FMD doesn&apos;t treat anyone: dentists and clinics do, under their own professional duties.</p>
      </section>
      <section>
        <h2>FMD AI is not a dentist</h2>
        <p>FMD AI gives general information, not a diagnosis or a prescription. It never books, pays or messages anyone for you. In an emergency, call 112.</p>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be 18 or older to have an account.</li>
          <li>Keep your password and codes to yourself. Tell us if you think someone else used your account.</li>
          <li>Dentists must give accurate registration details. Profiles show “Verified” only after FMD checks them.</li>
        </ul>
      </section>
      <section>
        <h2>Bookings, payments and refunds</h2>
        <p>Each clinic sets its own fees, booking rules and cancellation terms, and you see them before you confirm. Membership prices, GST, renewal and refunds are shown before you pay.</p>
      </section>
      <section>
        <h2>What you post</h2>
        <p>Posts, comments and reviews must be honest and lawful. Patient cases need the patient&apos;s documented consent. We may remove content that breaks these rules, and you can report content that does.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>We&apos;ll tell you before these terms change in ways that matter. Questions: use Help in the app.</p>
      </section>
    </Doc>
  );
}

export function PrivacyNoticePage() {
  return (
    <Doc title="Privacy Notice">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: your name, mobile number, and email if you add one.</li>
          <li>What you choose to add: records, appointments, messages, posts, and your dental history if you turn it on.</li>
          <li>How you use FMD, only as far as needed to run and improve it. Never your health details in analytics.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <p>To provide FMD to you, keep your account safe, and do what you ask, like booking a visit or sharing a record. Anything else, like offers, saving AI chats or personalising what you see, needs your consent, which you can withdraw in{" "}
          <Link href="/account/privacy" className="font-medium text-ink underline underline-offset-4">
            Privacy and data
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>Who sees it</h2>
        <p>A clinic or dentist sees your records only when you share them or book with them. We use trusted service providers (hosting, messaging, payments) under contract. We never sell your information, and we don&apos;t use your records to train outside AI models.</p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>You can see, download, correct and delete your information, and withdraw consent, from your account. Some records, like payment invoices, must be kept for as long as the law requires.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Use Help in the app. A grievance officer&apos;s details will be listed here, as Indian law requires.</p>
      </section>
    </Doc>
  );
}
