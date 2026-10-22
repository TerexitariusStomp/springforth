# Coordinated value — valuation methodology

Why this page exists: treasury-facing feedback from hackathon mentor
Chryssi — *"a recurring theme is turning environmental/climate units into
monetary value to capture the risk, cost or value creation."* This document
is the methodology behind every "Coordinated value (est.)" figure shown on
the cards, `/metrics`, and `/rounds`.

## The three provenance tiers

Every figure rendered is exactly one of:

| Tier | What | Example | Label |
|---|---|---|---|
| **Ledger-derived** | Donations and matching-fund allocations already on record | `£135 committed` | none needed — on the ledger |
| **Participant-declared** | Hours pledged at join; budgets declared on needs/offers | `9h declared`, `in-kind £120 (declared)` | *declared* |
| **Cited estimate** | External published rates applied to declared inputs | `£14.43/h (ONS HHSA 2017)` | *est.* + source |

Nothing is invented. If an input has no cited source it renders as its raw
unit (e.g. hours shown without a £ conversion) or is omitted entirely —
Kenya cards currently carry no volunteer-time £ figure because no cited
Kenyan rate has been verified yet.

## The formula

Per possibility card, per currency:

```
total = committed + matched + inKind + volunteerTime
committed     = Σ donations to the card's need nodes          (ledger)
matched       = Σ matching-fund allocation on those needs      (derived)
inKind        = Σ declared budgets on the card's offer nodes   (declared)
volunteerTime = Σ participant-declared hours × cited hour rate (est.)
```

Two declared figures sit **outside** the total — they frame cost and risk,
not value created:

```
asked       = Σ declared budgets on the card's open need nodes (declared)
riskAvoided = declared households protected × cited per-home damage (est.)
```

And two derived ratios answer "how much does £1 in become":

```
leverage    = total ÷ committed          — value mobilized per £1 in
riskPerUnit = riskAvoided ÷ total        — est. £ risk mitigated per £1
```

Totals are computed and rendered **per ISO currency and never converted**.
Mixed-currency contributions display side by side; no FX rate is assumed.

## Sources (all published, all verifiable)

| Figure | Value | Source |
|---|---|---|
| Volunteer time rate | £14.43/hour | ONS Household Satellite Accounts (2017), cited by NCVO; method per DCMS *Estimating the economic and social value of volunteering* — replacement-cost method |
| Avg flood damage per home | £30,000 | Environment Agency flood-warning guidance; corroborated by ABI 2025 claims data (avg domestic flood payout £30k, +60% YoY). Also feeds `riskAvoided = homes × rate` |
| Avg flood damage per business | £82,000 | Environment Agency |
| Properties at flood risk in England | 5.2M | Environment Agency |
| Avg annual UK flood damages | £2.2bn | Environment Agency Long-Term Investment Scenarios (LTIS), 2023 — cited on GB cards' scenario block as the macro context |

## Which rate applies where

The volunteer-time rate is applied only to cards whose declared place
resolves to Great Britain (keyword match on the card's `place` field). Other
scenes show their declared hours without a money conversion — honest, not
empty.

## Framework alignment

Per advisor guidance (see `NOTES-CHRYSSI-2026-10-22.md`), the methodology
maps to named standards rather than ad-hoc claims:

- **ISO 14008** — monetary valuation of environmental impacts and
  related aspects; our per-currency totals and `riskAvoided` follow its
  principle of explicit, documented valuation methods.
- **Transition pathways / scenario framing** — `riskAvoided` and
  `riskPerUnit` are scenario deltas: damages under the un-coordinated
  path vs. the activated path, stated against the funder's objective.
- **Capitals Coalition / Value Accounting Network** — the four-capitals
  frame (natural, social, human, produced/financial) with the
  *impacts-and-dependencies* principle: each valuation component carries
  a `capital` tag (`financial` / `human` / `social` / `natural`), and the
  card renders mobilized value + damage avoided as **impacts** against
  the declared ask as the **dependency**. Canonical-method lineage:
  Natural Capital Protocol, Social & Human Capital Protocol, Social
  Value International, UN SEEA.
  https://capitalscoalition.org/approach/ ·
  https://capitalscoalition.org/project/value-accounting-network/
- **Damage-avoidance framing** (cf. rebalance.earth) — `riskAvoided`
  answers "reduce damages"; `volunteerTime`/`inKind`/`matched` answer
  "benefits created and yield enhanced." The card's *Two pathways* block
  is their degraded→restored frame: environmental → operational →
  financial risk lanes, underwritten by "exposure grows with evidence."
  https://rebalance.earth/investment-strategy
- **Verifier-replay rule** — every rendered figure must be re-derivable:
  declared inputs name their declarer (ledger), estimates name their
  published source, and the formula above is the whole computation.
  Enforced in-page: every figure expands into a replay `<details>`
  listing inputs, formula and source, and each card carries a
  ledger-linked audit trail a third party can re-walk.

## Limitations (stated, not hidden)

- **Declared ≠ verified.** Hours, protected-household counts and in-kind budgets are self-reported by
  participants; they are inputs to an estimate, not audited facts. The
  ledger records who declared them and when.
- **Population averages.** The £30k/£82k flood figures are national
  averages, not property-level assessments. `riskAvoided` = declarer-stated
  protected homes × £30k — an honest estimate of losses mitigated, shown
  **outside** the total (losses avoided ≠ money moved). Realised savings
  still need before/after claim evidence (open issue).
- **Vintage.** The ONS rate is from the 2017 Household Satellite Accounts;
  it is the most recent published UK figure but understates current wages.
- **Derived ≠ recorded.** Valuation is computed at render time and never
  written to the audit ledger — the ledger stays a record of events, not
  estimates.

## Where it shows

- `/possibilities` — "Coordinated value (est.)" block on each card,
  capital-grouped (impacts vs dependencies) with an in-page
  verifier-replay `<details>` per figure
- `/possibilities` — "Two pathways" scenario block per card (baseline vs
  activated, EA LTIS £2.2bn macro context on GB cards)
- `/metrics` — `valueByCurrency` + `declaredHoursTotal` aggregates
- `/impact#results` — `completionRate`, `evidenceCoverage` and the
  Kickstarter ~41.57% published success-rate benchmark alongside
  `quorumRate`
- `/rounds` — committed totals per currency
- Card "Verified context" — the cited risk/cost benchmarks
- Implementation: `packages/core/src/valuation.ts` (pure, unit-tested)
