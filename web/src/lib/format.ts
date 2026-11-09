/** Indian formats for FMD Main (PDR §17): dates and times in IST, rupees with Indian digit grouping. */
const TZ = "Asia/Kolkata";

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const feeRange = (f: { min: number; max: number }) => (f.min === f.max ? rupees(f.min) : `${rupees(f.min)} – ${rupees(f.max)}`);

/** "Tue, 10 Nov" */
export const dayLabel = (t: number) => new Date(t).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
/** "Tuesday, 10 November" */
export const longDay = (t: number) => new Date(t).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
/** "1:30 pm" */
export const timeLabel = (t: number) => new Date(t).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
/** "Tue, 10 Nov, 1:30 pm" */
export const when = (t: number) => `${dayLabel(t)}, ${timeLabel(t)}`;
/** "2026-11-10", the IST calendar date */
export const istDate = (t: number) => new Date(t + 5.5 * 3_600_000).toISOString().slice(0, 10);
/** noon IST on a calendar date, for labelling a whole day */
export const noonOf = (date: string) => Date.parse(`${date}T12:00:00+05:30`);
