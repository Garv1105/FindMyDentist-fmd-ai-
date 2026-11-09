"use client";

import { BadgeCheck, Clock3, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Panel, Tag } from "@/components/app/kit";
import { Field, fieldCls, Sheet } from "@/components/app/Sheet";
import { getProfile, getSettings, setAiPermission, updateClinicSettings, updateProfile, type ClinicSettings, type DentistProfile } from "@/sample/team";
import { useClinic } from "../Shell";

const h2 = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[16px] font-medium text-ink";
const sub = "text-[13px] font-normal text-ink-3";
const seg = (on: boolean) => `shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] ${on ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:text-ink"}`;
const COUNCILS = ["Karnataka State Dental Council", "Tamil Nadu State Dental Council", "Maharashtra State Dental Council", "Delhi State Dental Council", "Kerala State Dental Council", "Dental Council of India"];
type Tab = "profile" | "clinic" | "ai";

export function Settings() {
  const { user } = useClinic();
  const isOwner = user.role === "clinic_owner";
  const tabs: [Tab, string][] = user.role === "dentist" ? [["profile", "My profile"]] : [["profile", "My profile"], ["clinic", "Clinic"], ["ai", "AI permissions"]];
  const [tab, setTab] = useState<Tab>("profile");
  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Settings" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={seg(tab === k)} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      )}
      {tab === "profile" && <MyProfile />}
      {tab === "clinic" && <ClinicTab isOwner={isOwner} />}
      {tab === "ai" && <AiTab isOwner={isOwner} />}
    </div>
  );
}

/* ---------------- my profile ---------------- */

function MyProfile() {
  const { user } = useClinic();
  const [profile, setProfile] = useState<DentistProfile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    getProfile(user.id).then(setProfile);
  }, [user.id]);

  return (
    <div className="flex flex-col gap-4">
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          Account <span className={sub}>how you sign in</span>
        </h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-ink-3">Name</dt>
          <dd className="text-ink">{user.name}</dd>
          <dt className="text-ink-3">Role</dt>
          <dd className="text-ink">{user.title}</dd>
          <dt className="text-ink-3">Mobile</dt>
          <dd className="text-ink">{user.phone}</dd>
        </dl>
      </Panel>

      {saved && (
        <p role="status" className="rounded-2xl border border-[color-mix(in_srgb,var(--tone-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--tone-ok)_8%,transparent)] px-4 py-3 text-[14.5px] text-ink">
          {saved}
        </p>
      )}

      {profile === undefined ? (
        <div aria-busy aria-label="Loading">
          <Panel className="h-[260px] motion-safe:animate-pulse" />
        </div>
      ) : profile === null ? (
        <Panel className="p-5">
          <Empty title="No dentist profile on this account" hint="Dentists keep the profile patients see on FMD here." />
        </Panel>
      ) : (
        <Panel as="section" className="p-4 sm:p-5">
          <div className={h2}>
            <h2>
              Dentist profile <span className={sub}>what patients see on FMD</span>
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" strokeWidth={1.75} /> Edit
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-[var(--accent-soft)] text-[18px] font-medium text-ink" aria-hidden>
              {user.initials}
            </span>
            <span className="min-w-0">
              <span className="block text-[18px] font-medium text-ink">{profile.displayName}</span>
              <span className="block text-[14px] text-ink-2">
                {profile.qualifications} · {profile.experienceYears} years
              </span>
            </span>
            {profile.registration.verified ? (
              <Tag tone="ok">
                <BadgeCheck className="mr-1 size-3.5" strokeWidth={2} /> Verified
              </Tag>
            ) : (
              <Tag tone="warn">
                <Clock3 className="mr-1 size-3.5" strokeWidth={2} /> Verification pending
              </Tag>
            )}
            <Tag tone={profile.visibleOnFmd ? "accent" : "muted"}>{profile.visibleOnFmd ? "Visible on FMD" : "Hidden from FMD"}</Tag>
          </div>
          <p className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-ink-2">{profile.bio}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[11rem_minmax(0,1fr)]">
            <dt className="text-ink-3">Registration</dt>
            <dd className="text-ink">
              {profile.registration.council} · {profile.registration.number}
            </dd>
            <dt className="text-ink-3">Specialities</dt>
            <dd className="text-ink">{profile.specialities.join(", ")}</dd>
            <dt className="text-ink-3">Services</dt>
            <dd className="text-ink">{profile.services.join(", ")}</dd>
            <dt className="text-ink-3">Languages</dt>
            <dd className="text-ink">{profile.languages.join(", ")}</dd>
            <dt className="text-ink-3">Consultation fee</dt>
            <dd className="text-ink">₹{profile.consultationFeeInr.toLocaleString("en-IN")}</dd>
            <dt className="text-ink-3">Timings</dt>
            <dd className="text-ink">{profile.timings}</dd>
          </dl>
          <p className="mt-3 text-[13px] text-ink-3">&quot;Verified&quot; shows only after FMD checks your council registration. Changing the number sends it back for checking.</p>
        </Panel>
      )}

      {editing && profile && (
        <EditProfile
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={async (p) => {
            const next = await updateProfile(user.id, p);
            setProfile(next);
            setEditing(false);
            setSaved(next.registration.verified ? "Profile saved." : "Profile saved. Your registration will be checked before the Verified badge shows (demo).");
          }}
        />
      )}
    </div>
  );
}

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function EditProfile({ profile, onClose, onSave }: { profile: DentistProfile; onClose: () => void; onSave: (p: DentistProfile) => Promise<void> }) {
  const [p, setP] = useState(profile);
  const [specialities, setSpecialities] = useState(profile.specialities.join(", "));
  const [services, setServices] = useState(profile.services.join(", "));
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [fee, setFee] = useState(String(profile.consultationFeeInr));
  const [error, setError] = useState("");
  const set = <K extends keyof DentistProfile>(k: K, v: DentistProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  return (
    <Sheet title="Edit your profile" onClose={onClose} wide>
      <form
        className="grid gap-3.5 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave({ ...p, specialities: list(specialities), services: list(services), languages: list(languages), consultationFeeInr: Number(fee) });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Field label="Name patients see">
          <input id="pf-name" className={fieldCls} value={p.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
        <Field label="Qualifications">
          <input id="pf-qual" className={fieldCls} value={p.qualifications} onChange={(e) => set("qualifications", e.target.value)} />
        </Field>
        <Field label="Dental council">
          <select id="pf-council" className={fieldCls} value={p.registration.council} onChange={(e) => set("registration", { ...p.registration, council: e.target.value })}>
            {COUNCILS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Registration number">
          <input id="pf-reg" className={fieldCls} value={p.registration.number} onChange={(e) => set("registration", { ...p.registration, number: e.target.value })} />
        </Field>
        <Field label="Specialities" hint="Separate with commas">
          <input id="pf-spec" className={fieldCls} value={specialities} onChange={(e) => setSpecialities(e.target.value)} />
        </Field>
        <Field label="Services" hint="Separate with commas">
          <input id="pf-serv" className={fieldCls} value={services} onChange={(e) => setServices(e.target.value)} />
        </Field>
        <Field label="Languages" hint="Separate with commas">
          <input id="pf-lang" className={fieldCls} value={languages} onChange={(e) => setLanguages(e.target.value)} />
        </Field>
        <Field label="Years of experience">
          <input id="pf-exp" className={fieldCls} type="number" min={0} max={60} value={p.experienceYears} onChange={(e) => set("experienceYears", Number(e.target.value))} />
        </Field>
        <Field label="Consultation fee (₹)">
          <input id="pf-fee" className={fieldCls} type="number" inputMode="numeric" min={0} step={50} value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Field label="Timings">
          <input id="pf-time" className={fieldCls} value={p.timings} onChange={(e) => set("timings", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="About you" hint="Up to 600 characters. Plain words; no promises of results.">
            <textarea id="pf-bio" className={`${fieldCls} min-h-[110px] py-2.5`} maxLength={600} value={p.bio} onChange={(e) => set("bio", e.target.value)} />
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-[14.5px] text-ink sm:col-span-2">
          <input type="checkbox" checked={p.visibleOnFmd} onChange={(e) => set("visibleOnFmd", e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Show my profile on FMD
        </label>
        {error && (
          <p role="alert" className="text-[14px] text-[var(--tone-bad)] sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">Save profile</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- clinic ---------------- */

type SettingsData = Awaited<ReturnType<typeof getSettings>>;
function useSettings() {
  const { clinic } = useClinic();
  const [data, setData] = useState<SettingsData | null>(null);
  const load = useCallback(() => getSettings(clinic.id).then(setData), [clinic.id]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, load };
}

const FIELDS: [keyof ClinicSettings, string][] = [
  ["name", "Clinic name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
  ["hours", "Opening hours"],
  ["saturday", "Saturday"],
  ["gstin", "GSTIN"],
];

function ClinicTab({ isOwner }: { isOwner: boolean }) {
  const { clinic, user } = useClinic();
  const { data, load } = useSettings();
  const [form, setForm] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!data)
    return (
      <div aria-busy aria-label="Loading">
        <Panel className="h-[260px] motion-safe:animate-pulse" />
      </div>
    );
  const f = form ?? data.clinic;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel as="section" className="p-4 sm:p-5">
        <h2 className={h2}>
          Clinic details <span className={sub}>{isOwner ? "shown on bills and on FMD" : "only the owner can change these"}</span>
        </h2>
        <form
          className="mt-3 grid gap-3.5 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await updateClinicSettings(clinic.id, f, user.role);
              setError("");
              setSaved(true);
              setForm(null);
              void load();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          {FIELDS.map(([k, label]) => (
            <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
              <Field label={label}>
                <input
                  id={`cs-${k}`}
                  className={fieldCls}
                  value={f[k]}
                  disabled={!isOwner}
                  onChange={(e) => {
                    setSaved(false);
                    setForm({ ...f, [k]: e.target.value });
                  }}
                />
              </Field>
            </div>
          ))}
          {error && (
            <p role="alert" className="text-[14px] text-[var(--tone-bad)] sm:col-span-2">
              {error}
            </p>
          )}
          {isOwner && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={!form}>
                Save changes
              </Button>
              {saved && <span className="text-[14px] text-[var(--tone-ok)]">Saved.</span>}
            </div>
          )}
        </form>
      </Panel>
      <div className="flex flex-col gap-4">
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>Chairs</h2>
          <ul className="mt-2">
            {data.chairs.map((c) => (
              <li key={`${c.branch}-${c.chair}`} className="flex justify-between gap-3 border-t border-line py-2 text-[14.5px] first:border-0">
                <span className="text-ink">
                  {c.chair} <span className="text-ink-3">· {c.branch === "main" ? "Main" : "Koramangala"}</span>
                </span>
                <span className="text-ink-2">{c.dentist}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel as="section" className="p-4 sm:p-5">
          <h2 className={h2}>
            GST by service <span className={sub}>confirm with your CA</span>
          </h2>
          <ul className="mt-2">
            {data.gst.map((g) => (
              <li key={g.service} className="flex justify-between gap-3 border-t border-line py-2 text-[14.5px] first:border-0">
                <span className="text-ink">{g.service}</span>
                <span className="tabular-nums text-ink-2">{g.rate}%</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line py-2 text-[14.5px]">
              <span className="text-ink">Everything else</span>
              <span className="text-ink-2">Exempt (0%)</span>
            </li>
          </ul>
          <p className="mt-2 text-[13px] text-ink-3">FMD doesn&apos;t give tax advice; your CA confirms these rates.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- AI permissions ---------------- */

function AiTab({ isOwner }: { isOwner: boolean }) {
  const { clinic, user } = useClinic();
  const { data, load } = useSettings();
  if (!data)
    return (
      <div aria-busy aria-label="Loading">
        <Panel className="h-[260px] motion-safe:animate-pulse" />
      </div>
    );
  return (
    <Panel as="section" className="p-4 sm:p-5">
      <h2 className={h2}>
        What FMD Manager may do <span className={sub}>{isOwner ? "the owner decides" : "set by the owner"}</span>
      </h2>
      <ul className="mt-2">
        {data.ai.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-4 border-t border-line py-3 first:border-0">
            <span className="min-w-0">
              <span className="block text-[15px] text-ink">{p.label}</span>
              <span className="block text-[13.5px] text-ink-3">{p.detail}</span>
            </span>
            <label className="inline-flex shrink-0 items-center gap-2 text-[13.5px] text-ink-2">
              <input
                type="checkbox"
                checked={p.allowed}
                disabled={!isOwner || p.locked}
                onChange={async (e) => {
                  await setAiPermission(clinic.id, p.id, e.target.checked, user.role);
                  void load();
                }}
                className="size-4 accent-[var(--accent)]"
              />
              {p.locked ? "Always off" : p.allowed ? "Allowed" : "Off"}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-ink-3">Whatever is switched on, anything that leaves the clinic still waits for a person to approve it.</p>
    </Panel>
  );
}
