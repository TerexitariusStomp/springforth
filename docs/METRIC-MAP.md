# Metric map — review vocabulary → export records

Maps the independent-review metric vocabulary (Beacon systems review,
Prikhodko 2026) onto ops-export record types and `/metrics` fields.
Each entry is marked: **computed** (live), **derivable** (fields exist,
compute client-side), **gap** (schema exists, no data yet), or **N/A**
(deliberately not measured — see bottom).

## Event stream

| Review event | Export record | State |
|---|---|---|
| intention created | `declaration` | computed |
| intention response | `question`, `interest`, `commitment` | computed |
| coordination started | `commitment` (first join) | derivable |
| coordination completed / abandoned | `quorum` + `declaration.status` | computed |
| moved to external channel | `evidence via:'ops-report'` + `channel` | computed |
| encounter confirmed | `quorum` | computed |
| post-encounter survey | `outcome_report` | gap — schema live, needs filing |
| repeat intention | `interest`, repeat `commitment` | derivable |
| organic invite | `referral` | computed |
| ambassador intervention | `intervention` | gap — schema live |
| visibility narrowed | — | **N/A** (no per-actor visibility controls) |
| mute / hide / block | `pass_summary` (aggregate only) | computed |
| churn reason | `exit` | gap — schema live |
| platform incompatibility | `access_exclusion` | gap — schema live |

## Named metrics

| Review metric | Definition | `/metrics` field | State |
|---|---|---|---|
| VER (viable encounter rate) | attested + undisputed + positive outcome / completed | `viableRateSurveyed` | computed when surveyed; else null |
| Opportunity-to-VER | viable / relevant opportunities | funnel + `viableRateSurveyed` | derivable |
| DID (desired interaction density) | desired contacts / all | — | **N/A** (no contact-graph data) |
| IER (incremental encounter rate) | "wouldn't have happened anyway" | `outcome_report.incremental` | gap — needs surveys |
| Intent-to-Encounter | quorum+ / declared | `intentToEncounter` | computed |
| OIR (opportunity-to-intent) | intents / exposures | `oir` | computed once exposures accrue |
| SIIR (self-initiated intent) | non-facilitated / classified | `siir` | computed once `facilitation` tagged |
| ORR (organic repeat rate) | repeat actions on minimal-facilitation cards | `orr` | computed once an arm exists |
| ADR (ambassador dependency) | actions within 72h of intervention / all | `adr` | computed once interventions filed |
| Coordination cost | self-reported hours | `effortHours` + `coordination_effort` | computed once filed |
| NPOR (net-positive outcome) | positive / surveyed | `outcome_report` records | derivable |
| Negative outcome rate | negative / surveyed + disputes | `outcome_report` + `dispute` | derivable |
| Energy Delta | pre/post energy | `outcome_report.energyDelta` | gap |
| PFR (privacy friction) | — | — | **N/A** (would need per-actor privacy telemetry we don't collect) |
| Repeat (14/30-day) | repeat joins in window | derivable from `commitment.at` | derivable |
| Replication / Geography | per-cohort/per-place funnels | `funnelByArm` / `declaredByCohort` / `place` | computed (k≥5 suppressed) |

## Composite extras

| Metric | Definition | State |
|---|---|---|
| `organicInviteRate` | referred actors who joined/interested / referrals | computed |
| `concentration.top10pctShare` | top-decile actor share of joins | computed |
| `resilienceRate` | re-declaring actors / expired declarers | computed |
| `leveragePerHour` | completed / self-reported effort hours | null until effort data |

## Disclosure control

Every group-level cut enforces **k≥5 minimum-cell suppression**
(NIST SP 800-188 / Statistics Canada guidance) plus complementary-cell
suppression when a hidden cell is arithmetically recoverable from
totals. Suppressed groups render `{suppressed:true}`. At pilot scale
this hides most cohort breakdowns — that is the floor working as
designed, not missing data. Differential privacy was evaluated and
deferred: at pilot n the noise floor would swamp the signal;
k-anonymity is the correct layer.

## Deliberately not measured

- Actor-linked `pass` records (privacy invariant: demand-shape only)
- Dwell time / session telemetry (exposure = reach, never attention)
- Device-mix inference (`access_exclusion` is observer-filed only)
- Per-actor visibility changes (no such controls exist)
- Causal effect sizes at pilot n (see ANALYSIS-LIMITS)
