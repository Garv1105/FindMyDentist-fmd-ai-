# FMD Clinic - Metric dictionary

Every number in FMD Clinic Reports comes from **one definition**, implemented once in `web/src/sample/reports.ts` (`METRICS` and `metric()`) and reused by tiles, drill-downs, comparisons and alerts. This page mirrors that code. If you change a formula, change both.

Source spec: `fmd-clinic-reports-prompt.md`. Departures from it: no waiting-time or overrun metrics, no refunds, no inventory, dark theme (see `docs/PRD_CHANGES.md`).

**Conventions:**
- All dates are IST calendar days.
- Money is in ₹, shown in Indian format (₹1,23,456).
- Percentages are rounded to one decimal place.
- A metric with no data (for example, a Sunday) shows **"—"**, never 0% or an error.
- Every report compares against the **previous period** (same length, immediately before) and the **same dates last year**, with a 12-week series (each point is the 7 days ending on that week's last day).

## Stage 1 metrics (Clinic Pulse)

| Metric | Formula | Numerator | Denominator | Excludes | Source |
|---|---|---|---|---|---|
| **Net revenue** | Σ (list fee − discount) on paid bills, by bill date | list fees − discounts | - | Void bills; GST | bills (`billing.ts`) |
| **Revenue per chair-hour** | Net revenue ÷ (attended chair-minutes ÷ 60) | net revenue | attended chair-hours | as for net revenue | bills + appointments |
| **Chair utilisation %** | Attended booked chair-minutes ÷ available chair-minutes × 100 | minutes of completed appointments | open chair-minutes = (opening hours − lunch) × chairs × open days (Mon–Sat) | Sundays; cancelled and no-show visits from the numerator | appointments, `CHAIRS`, `HOURS` |
| **No-show rate %** | No-shows ÷ (attended + no-shows) × 100 | no-shows | attended + no-shows | cancelled appointments | appointments |
| **New patients** | Patients whose first attended visit falls in the period | first attended visits | - | - | appointments |
| **Case acceptance %** (count and value) | Accepted plan items ÷ presented plan items × 100; also using ₹ estimates. Value is an `Estimate` | accepted items (or their ₹ estimates) | presented items (or their ₹ estimates) | - | treatment-plan items |
| **Recall overdue** | Patients past their recall due date with nothing booked | overdue recalls | - | opted-out patients, once opt-outs are recorded (not yet in the sample data) | patients |
| **Average rating** | Mean of patient ratings given in the period (1–5) | sum of ratings | number of ratings | - | feedback |

## Daily Operations (one day)

| Figure | Definition |
|---|---|
| Scheduled | Appointments on the day, not cancelled |
| Completed / No-show / Cancelled | Appointments with that status |
| Booked via FMD Main | Appointments the patient booked through FMD Main |
| Open items | Tomorrow's unconfirmed appointments; completed visits with no bill; unsigned clinical notes; patients in treatment with no next appointment |

## Daily Collection Sheet (one day)

| Figure | Definition |
|---|---|
| By payment method | Count and total of paid bills per mode (UPI, Cash, Card, Bank transfer, Insurance, EMI partner), with who received them |
| Cash variance | Cash counted at close − cash payments recorded. A non-zero variance needs a note |
| Discounts today | Discounted bills with amount, reason and approver |
| Sign-off | The owner signs the sheet off; it is then locked |

## Alerts (defaults)

The spec says targets aren't hard-coded: baselines are learnt from the first 90 days, then the owner sets targets. Until then, these defaults apply:

| Alert | Rule |
|---|---|
| No-show spike | This week's no-show rate ≥ 1.5 × the previous 8 weeks' rate |
| Cash variance | Any non-zero cash variance at a close in the last 7 days |
| Stalled treatment course | A patient in treatment whose follow-up is overdue |
| AI safety | External actions by the AI manager without a recorded approval. Must be 0 |

## Later stages

Utilisation, no-shows, patient base, new patients by source (stage 2); recall, case acceptance, pending treatment (stage 3); procedure mix, revenue summary, GST register (stage 4). Their metrics get added here as they're built.
