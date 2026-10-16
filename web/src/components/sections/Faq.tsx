import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Reveal, SectionHeader } from "../ui";

// Answers describe what the product does today (see the Available / Beta / Roadmap labels above).
const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "What is FindMyDentist?",
    a: "FindMyDentist (FMD), by FMD Private Limited, is a dentistry-focused technology ecosystem connecting patients, dentists, clinics, students and dental companies. It includes FMD Main for patients, FMD Clinic OS for clinics, and FMD Intelligence — the AI layer across them.",
  },
  {
    q: "Who can use FMD?",
    a: "Patients looking for guidance and care, dentists building a professional presence, clinic teams managing their practice, dental students, and dental companies interested in partnering. Clinic staff join a clinic workspace through an invitation from the clinic owner.",
  },
  /* extra (not in homepage PDF):
  {
    q: "What is FMD Main?",
    a: "The patient-facing platform: FMD AI educational guidance, dentist and specialty discovery, dentist profiles and appointments, educational content from dentists, and a private dental-records vault.",
  },
  */
  {
    q: "What is FMD Clinic OS?",
    a: "Clinic-management software: appointments and scheduling, digital patient records, billing and payment recording, recalls and follow-ups, tasks, team, inventory and reports. Its AI clinic manager is in beta. Clinic OS is a separate subscription from dentist membership; current pricing is shown when you set up a clinic workspace.",
  },
  {
    q: "How does FMD use AI?",
    a: "Two ways. FMD AI helps patients understand dental concepts and options in plain language. The AI clinic manager (beta) helps clinic teams prepare administrative work: read-only and internal steps can run automatically for permitted users, while anything that leaves the clinic — such as messages to patients — waits for a person to approve it.",
  },
  /* extra (not in homepage PDF):
  {
    q: "Does FMD AI provide a dental diagnosis?",
    a: "No. FMD AI provides educational information and helps you understand what kind of dental professional may help. It does not diagnose conditions, and it never books, contacts clinics or pays on your behalf. Clinical decisions stay with registered dentists.",
  },
  */
  {
    q: "How can a dental clinic join FMD?",
    a: (
      <>
        <Link href="/#clinic-os-demo" className="underline underline-offset-4">Book a demo or join early access</Link>. Dentists with an FMD account can also create
        a clinic workspace directly from <Link href="/clinic" className="underline underline-offset-4">Clinic OS</Link>.
      </>
    ),
  },
  {
    q: "How does FMD protect patient information?",
    a: "Dental records are private to the patient and shared only when the patient chooses, with a specific dentist, through access that expires and can be revoked; every view is logged. Health details are stored separately from contact details and never used for advertising. Clinic OS uses role-based permissions and an audit trail for sensitive actions. You can export your data or request deletion from your account.",
  },
  {
    q: "Which products and features are available now?",
    a: "FMD is in pre-release. On this page every capability is marked Available, Beta or Roadmap, profiles and posts marked “demo” are not real, and concept previews are labelled as such.",
  },
  /* extra (not in homepage PDF):
  {
    q: "What is FMD Scholar?",
    a: "A dentistry-focused academic AI workspace for subject doubts, viva preparation, seminars and research. It is on the roadmap and will come with an active FMD student membership, with monthly usage limits.",
  },
  */
  /* extra (not in homepage PDF):
  {
    q: "How can I contact FMD?",
    a: (
      <>
        Email <a href="mailto:support@findmydentist.io" className="underline underline-offset-4">support@findmydentist.io</a> or visit the{" "}
        <Link href="/help" className="underline underline-offset-4">Help centre</Link>.
      </>
    ),
  },
  */
];

/** Brief §20. Native <details>: keyboard and screen-reader accessible with no JS. */
export default function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 pt-28 sm:pt-40">
      <Container className="max-w-[900px]">
        <SectionHeader center eyebrow="FAQ" title="Questions about FMD?" />
        <Reveal>
          <div className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[28px]">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 text-[15.5px] text-ink transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{q}</span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-3 transition-transform duration-300 group-open:rotate-45">
                    <Plus className="size-4" strokeWidth={1.5} />
                  </span>
                </summary>
                <div className="px-6 pb-6 pr-16 text-[14.5px] leading-relaxed text-ink-3">{a}</div>
              </details>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
