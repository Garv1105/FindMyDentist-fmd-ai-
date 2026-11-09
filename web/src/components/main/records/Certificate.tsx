"use client";

import { ArrowLeft, BadgeCheck, Check, Copy, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, Panel, Tag, type Tone } from "@/components/app/kit";
import { useRequireMe } from "@/lib/me";
import { certificatePdf, getCertificate, verify, verifyPath, type CertStatus, type Certificate, type PublicCertificate } from "@/sample/certificates";

const STATUS: Record<CertStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  expired: { label: "Expired", tone: "muted" },
  amended: { label: "Amended", tone: "accent" },
  voided: { label: "Voided by the clinic", tone: "bad" },
  disputed: { label: "Under dispute", tone: "warn" },
};
const dateLabel = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Coverage, exclusions and conditions get the same weight on the page (PDR Annex A2). */
function Terms({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "bad" | "warn" }) {
  const mark = { ok: "Covered", bad: "Not covered", warn: "You need to" }[tone];
  return (
    <Panel as="section" className="grid content-start gap-2.5 p-5">
      <h2 className="flex items-center justify-between gap-2 text-[15.5px] font-medium text-ink">
        {title} <Tag tone={tone}>{mark}</Tag>
      </h2>
      <ul className="grid list-disc gap-1.5 pl-5 text-[14px] text-ink-2">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------------- /certificates/[id] ---------------- */

export function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const me = useRequireMe();
  const [c, setC] = useState<Certificate | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    getCertificate(id).then(setC);
  }, [id]);
  if (!me || c === undefined) return <div className="app-panel h-64 animate-pulse" aria-busy />;
  if (c === null)
    return (
      <Panel className="grid justify-items-start gap-3 p-6">
        <h1 className="text-[19px] font-medium text-ink">We couldn&apos;t find that certificate</h1>
        <ButtonLink href="/records" variant="secondary">
          Records
        </ButtonLink>
      </Panel>
    );

  const verifyUrl = `${location.origin}${verifyPath(c)}`;
  const pdf = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(certificatePdf(c, me.full_name, location.origin));
    a.download = `${c.number}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const rows: [string, ReactNode][] = [
    ["Issued by", `${c.clinic.name}, ${c.clinic.address}`],
    ["Treating dentist", c.dentist.name],
    ["Patient", me.full_name],
    ["Treatment", `${c.treatment}, ${c.site}`],
    ["Treated", dateLabel(c.treatment_date)],
    ["Issued", dateLabel(c.issue_date)],
    ["Valid until", dateLabel(c.valid_until)],
  ];

  return (
    <div className="mx-auto grid w-full max-w-[900px] gap-5">
      <Link href="/records?type=certificate" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Records
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[22px] font-medium text-ink">
            Warranty certificate {c.number} <Tag tone="muted">Demo</Tag>
          </h1>
          <p className="mt-1 text-[14px] text-ink-3">The clinic issued these terms. FMD shows them exactly as issued.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Tag>
          <Tag tone="muted">Version {c.version}</Tag>
        </div>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="p-5 sm:p-6">
          <dl className="grid gap-2.5 text-[14.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-0.5 sm:grid-cols-[140px_1fr]">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel className="grid gap-3 p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
            <ShieldCheck className="size-4" strokeWidth={1.75} /> Check it&apos;s genuine
          </h2>
          <p className="text-[13.5px] text-ink-2">Anyone can check this certificate with its code. The check shows the clinic, treatment type and dates, never your name or health details.</p>
          <p className="rounded-xl border border-line px-3 py-2 text-center font-mono text-[15px] tracking-wider text-ink">{c.code}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.75} />}
              {copied ? "Link copied" : "Copy check link"}
            </Button>
            <ButtonLink href={verifyPath(c)} variant="secondary" size="sm">
              Open the check
            </ButtonLink>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Terms title="What's covered" items={c.covered} tone="ok" />
        <Terms title="What isn't" items={c.exclusions} tone="bad" />
        <Terms title="Conditions" items={c.conditions} tone="warn" />
      </div>

      <Panel as="section" className="grid gap-3 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">Follow-up visits the clinic requires</h2>
        <ul className="grid gap-2 text-[14px]">
          {c.followups.map((f) => (
            <li key={f.label} className="flex flex-wrap items-center gap-2">
              <span className="text-ink">{f.label}</span>
              <span className="text-ink-3">due {dateLabel(f.due)}</span>
              <Tag tone={f.done ? "ok" : "muted"}>{f.done ? "Done" : "Not yet"}</Tag>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel as="section" className="grid gap-3 p-5 sm:p-6">
        <h2 className="text-[16px] font-medium text-ink">Version history</h2>
        <ol className="grid gap-2 text-[14px]">
          {[...c.versions].reverse().map((v) => (
            <li key={v.version}>
              <span className="font-medium text-ink">Version {v.version}</span> <span className="text-ink-3">· {dateLabel(v.at)}</span>
              <p className="text-ink-2">{v.change}</p>
            </li>
          ))}
        </ol>
        <p className="text-[12.5px] text-ink-3">Corrections never overwrite the certificate: each one is a new version from the clinic.</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button onClick={pdf}>
          <Download className="size-4" strokeWidth={1.75} /> Download PDF
        </Button>
        <ButtonLink href={`/clinics/${c.clinic.id}`} variant="secondary">
          Contact the clinic about this
        </ButtonLink>
        <ButtonLink href={`/journey/${c.journey_id}`} variant="secondary">
          See the treatment
        </ButtonLink>
      </div>
    </div>
  );
}

/* ---------------- /verify/[code] (public) ---------------- */

export function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const [c, setC] = useState<PublicCertificate | null | undefined>(undefined);
  useEffect(() => {
    verify(decodeURIComponent(code)).then(setC);
  }, [code]);
  if (c === undefined) return <div className="app-panel h-48 animate-pulse" aria-busy />;
  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-5">
      <h1 className="text-[22px] font-medium text-ink">Check a warranty certificate</h1>
      {c ? (
        <Panel className="grid gap-4 p-6">
          <p className="flex items-center gap-2 text-[17px] font-medium text-[var(--tone-ok)]">
            <BadgeCheck className="size-5" strokeWidth={1.75} /> This is a genuine certificate on FMD
          </p>
          <dl className="grid gap-2.5 text-[14.5px]">
            {(
              [
                ["Certificate", c.number],
                ["Issued by", c.clinic],
                ["Treatment type", c.category],
                ["Issued", dateLabel(c.issue_date)],
                ["Valid until", dateLabel(c.valid_until)],
                ["Status", <Tag key="s" tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Tag>],
                ["Version", String(c.version)],
              ] as [string, ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12.5px] text-ink-3">For privacy, this check never shows the patient or their treatment details. The clinic sets and honours the warranty terms. Demo certificate.</p>
        </Panel>
      ) : (
        <Panel className="grid gap-2 p-6">
          <p className="flex items-center gap-2 text-[17px] font-medium text-ink">
            <ShieldAlert className="size-5 text-[var(--tone-warn)]" strokeWidth={1.75} /> No certificate has this code
          </p>
          <p className="text-[14px] text-ink-2">Check the code on the certificate and try again. If it still doesn&apos;t match, ask the clinic that issued it.</p>
        </Panel>
      )}
    </div>
  );
}
