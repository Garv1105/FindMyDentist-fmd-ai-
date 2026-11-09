# FMD Clinic - Metric dictionary

Every number in FMD Clinic Reports comes from **one definition**, implemented once in `web/src/sample/reports.ts` (`METRICS` and `metric()`) and reused by tiles, drill-downs, comparisons and alerts. This page mirrors that code. If you change a formula, change both.

Source spec: `fmd-clinic-reports-prompt.md`. Departures from it: no waiting-time or overrun metrics, no refunds (a wrong bill is voided), no inventory, dark theme (see `docs/PRD_CHANGES.md`).

**Conventions:**
- All dates are IST calendar days.
- Money is in ₹, shown in Indian format (₹1,23,456).
- Percentages are rounded to one decimal place.
- A metric with no data (for example, a Sunday) shows **"—"**, never 0% or an error.
- Every report compares against the **previous period** (same length, immediately before) and the **same dates last year**, with a 12-week series (each point is the 7 days ending on that week's last day).

## Metrics

Generated from `METRICS` in `web/src/sample/reports.ts`; regenerate this section whenever a definition changes. No-show rate follows the spec: no-shows ÷ (attended + no-shows + late cancels), clinic cancellations excluded. Values marked (Estimate) are never mixed with invoiced amounts.

### Clinic Pulse

| Metric | Formula | Numerator | Denominator | Excludes | Unit |
|---|---|---|---|---|---|
| **Net revenue** | Sum of list fees on paid bills − discounts, excluding GST, by bill date | list fees − discounts on paid bills | – | Void bills; GST | ₹ |
| **Revenue per chair-hour** | Net revenue ÷ (attended chair-minutes ÷ 60) | net revenue | attended chair-hours | – | ₹ |
| **Chair utilisation** | Attended booked chair-minutes ÷ available chair-minutes × 100. Available = opening hours − lunch, for each chair (Saturdays 9–1, Sundays closed) | minutes of completed appointments | open chair-minutes | – | % |
| **No-show rate** | No-shows ÷ (attended + no-shows + late cancels) × 100. Late cancel = the patient cancelled with less than 24 hours' notice | no-shows | attended + no-shows + late cancels | Visits the clinic cancelled; patient cancels with 24+ hours' notice | % |
| **New patients** | Patients whose first attended visit falls in the period | first attended visits | – | – | count |
| **Case acceptance** (Estimate) | Accepted treatment-plan items ÷ presented items × 100; also by ₹ estimate | accepted plan items | presented plan items | – | % |
| **Recall overdue** | Recalls past their due date (in the 12 months to the period end) with nothing booked, contacted or not | overdue recalls | – | Patients who opted out | count |
| **Average rating** | Mean of patient ratings given in the period (1–5) | sum of ratings | number of ratings | – | 1–5 |

### Schedule: utilisation and no-shows

| Metric | Formula | Numerator | Denominator | Excludes | Unit |
|---|---|---|---|---|---|
| **Dentist utilisation** | Attended minutes in dentists' chairs ÷ the dentists' open chair-minutes × 100 | minutes of completed appointments with a dentist | dentists' open chair-minutes | The hygienist's chair | % |
| **Empty chair-hours** | (Open chair-minutes − minutes booked, cancelled visits excluded) ÷ 60 | open chair-minutes not booked | – | Lunch, Saturday afternoons, Sundays | hours |
| **Next free 30-min slot** | Days from today to each dentist's first free slot of 30 minutes or more, averaged across dentists. As of now, not for the period | days to the first free slot, summed | dentists | – | days |
| **Late cancels (<24 h)** | Patient cancellations with less than 24 hours' notice ÷ scheduled appointments × 100 | patient cancels with < 24 h notice | all appointments booked for the period, cancelled ones included | – | % |
| **Lost chair-hours** | Booked minutes of no-shows + late cancels ÷ 60 | minutes of no-shows and late cancels | – | – | hours |
| **Lost revenue** (Estimate) | List fees of the treatments booked in no-shows + late cancels | list fees of missed visits | – | Discounts and GST (not known for a visit that didn't happen) | ₹ |
| **Rebooked within 14 days** | No-shows + late cancels that booked again within 14 days ÷ no-shows + late cancels × 100 | missed visits rebooked within 14 days | no-shows + late cancels | – | % |

### Patients

| Metric | Formula | Numerator | Denominator | Excludes | Unit |
|---|---|---|---|---|---|
| **Active patients** | Patients with at least one attended visit in the 18 months up to the end of the period | patients seen in the last 18 months | – | – | count |
| **Returning** | Patients seen in the period who had visited within the 18 months before (not new, not reactivated) | returning patients seen | – | – | count |
| **Reactivated** | Patients seen in the period whose previous visit was more than 18 months earlier | reactivated patients seen | – | – | count |
| **Lapsed** | Patients whose 18 months since their last visit ran out in the period, with nothing booked | patients who lapsed | – | – | count |
| **Recall completion** | Recalls due in the period that were attended by the due date + 30 days ÷ recalls due × 100 | recalls attended within 30 days of due | recalls due (whose 30 days have passed) | Patients who opted out | % |
| **Recall → booking** | Recalls contacted that led to a visit ÷ recalls contacted × 100 | contacted recalls that came in | recalls contacted | – | % |

### Treatment

| Metric | Formula | Numerator | Denominator | Excludes | Unit |
|---|---|---|---|---|---|
| **Pending treatment** (Estimate) | ₹ estimate of accepted plan items not completed and not scheduled (including unfinished multi-visit courses) | estimates of accepted, unscheduled items | – | – | ₹ |
| **Days to accept** | Median days between presenting a plan item and the patient accepting it | days to accept (median) | – | – | days |

### Money

| Metric | Formula | Numerator | Denominator | Excludes | Unit |
|---|---|---|---|---|---|
| **Gross revenue** | Sum of list fees on paid bills, by bill date | list fees on paid bills | – | Void bills; GST | ₹ |
| **Discounts** | Sum of discounts on paid bills | discounts | – | Void bills | ₹ |
| **Realised fee** | Net revenue ÷ gross revenue × 100: how much of the list fee is actually charged | net revenue | gross revenue | – | % |
| **Revenue per visit** | Net revenue ÷ attended visits | net revenue | attended visits | – | ₹ |
| **Revenue per new patient** | Net revenue ÷ new patients in the period | net revenue | new patients | – | ₹ |
| **Revenue per active patient** | Net revenue ÷ active patients at the period end | net revenue | active patients | – | ₹ |
| **GST collected** | Sum of GST on paid bills (rate per service as set by the clinic and confirmed by its CA) | GST on paid bills | – | Void bills | ₹ |
| **Exempt value** | List fee − discount on bill lines with a 0% GST rate | taxable value of exempt lines | – | Void bills | ₹ |

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
