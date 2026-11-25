# Survey & reporting instrument — CONSORT-pilot structure

How `outcome_report`, `baseline_report`, `amendment`, and `readout`
records compose into a pilot-trial report aligned with the CONSORT
extension for pilot and feasibility trials (Eldridge et al., *BMJ*
2016;355:i5239). The governing rule: **a pilot reports feasibility —
recruitment, retention, response rates, deviations, harms — not
effect sizes.** Causal contrast needs an arm and n>250 (see
ANALYSIS-LIMITS); at pilot scale the funnel *is* the result.

## Participant flow = the manifest funnel

CONSORT's flow diagram maps mechanically onto `manifest.funnel`:

| CONSORT stage | Funnel field | Record |
|---|---|---|
| Assessed for eligibility | `exposed` (exposure records) | `exposure` |
| Enrolled | `declared` | `declaration` |
| Allocated / received intervention | `quorum` | `quorum` |
| Completed protocol | `completed` | `declaration.status` |
| Discontinued | `expired`, `exits` | `exit` |
| Analyzed (outcome data) | `surveyed` | `outcome_report` |
| Protocol deviations | `amendments` | `amendment` |
| Harms / negative tail | `disputed`, negative outcomes | `dispute` |

## The outcome_report instrument

One record per participant per completed possibility:

```json
{
  "possibilityId": "<id>",
  "actor": "<participant id>",
  "outcome": "positive|neutral|negative",
  "energyDelta": -2..+2,                    // depleted ↔ energized
  "wouldRepeat": true|false,
  "incremental": "true|false|unknown",      // "would this have
                                            //  happened without the
                                            //  platform?"
  "costReport": "<free text — time, money, social cost>",
  "collector": "self|enumerator|ops",       // who administered it
  "lang": "<bcp-47 — sw|en|fr|...>"
}
```

- `collector`/`lang` follow the Sarafu 2025 survey method —
  trained local enumerators administering instruments in community
  languages out-perform in-app self-report in this population.
  A filed report says who administered it; never infer coverage.
- `incremental` is the IER probe — the single most causally
  informative question and the cheapest to ask.
- `wouldRepeat` is the repeat-intention proxy (revealed preference
  shows up later as a repeat `commitment`; the survey catches
  intention where behavior is too slow to observe).
- `energyDelta` is the support-vs-depletion probe — a coordination
  mechanism that costs more energy than it returns has negative
  value even when it produces outcomes.
- `costReport` captures what the outcome cost the participant —
  the review's "cost bearer" dimension.

## Filing and non-response

`POST /ops/outcome` files a report (ops-leg auth). The `surveyed`
funnel count makes **non-response visible**: a survey answered only
by the happy is worse than none — report `surveyed / completed` as
the coverage denominator, never the raw positive rate.

`baseline_report` uses the same `collector` field and is filed
*before* the platform arm — the phase-1 baseline as data.

## The readout record

The pilot's final report is itself a ledgered artifact. Fields map
to the review's "final board line":

- `decision: scale|refine|stop|insufficient-evidence` — the
  three-answer epistemology (yes/no/not-enough), extended with the
  operating options.
- `confidence: high|medium|low`, `nextEvidence`, `decisionOwner`,
  `reviewDate` — what the next proof would be and who owns it.
- `sampleRationale` — CONSORT's required justification for n
  relative to feasibility objectives.

## Amendments = protocol deviations

Any metric/threshold/param change after data collection begins is a
`POST /ops/amendment` record — subject, field, old/new value, reason,
approver, `independent` flag, `effectiveSeq`. A post-hoc cohort
exclusion is filed as an amendment, never silent. Amendments whose
approver has a stake in the measured outcome must be filed with
`independent: false` — visible, not forbidden.

## What this deliberately does not produce

- Causal effect sizes (n too small — ANALYSIS-LIMITS)
- Coverage inference from non-response (reported, not modeled)
- Inferred outcome for non-respondents (null, never imputed)
