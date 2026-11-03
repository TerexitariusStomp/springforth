# AI4PG proposal skeleton — target ≤1,000 words / 4 pages

> Verify program status before submission — recerts.org lists "now open, rolling review" but the posted deadline was Feb 2026.

**Title:** Ledger-resolved markets for public-goods match allocation

**Authors:** Springforth (platform) + ops leg (Kilifi pilot executor) — confirm co-authorship line with Lin Jiaze.

---

## Problem

Match allocation in small-scale public-goods rounds is curator-bound or uniform. Curators gatekeep by network position; uniform splits ignore the only reliable feasibility signal in the round — the participants' own knowledge. Meanwhile the Artizen collapse showed the deeper failure: match *promised* before it was *held*. Existing fixes address existence (escrow, yield-only endowments) but leave allocation opaque. Information about whether a declared action can actually be delivered sits with the cohort and is never elicited.

## Method

We attach a completion-probability market to each approved *possibility* in a chartered commitment-pooling round (love.fund × Kilifi pilot, opening November 2026):

- **Resolution is objective and append-only.** A market resolves YES when the possibility's completion is attested on a public hash-chained ledger: ≥3 distinct attestors, no self-attestation, disputes resolve by flag events (a flagged event is non-resolution, never an edit). Kleros serves as the backstop arbiter; the ledger is the primary oracle.
- **Allocation weight is frozen at activation.** A possibility's share of the match pool equals its market price at its quorum event — written to the ledger as a frozen parameter, identical in discipline to the round's other frozen parameters (threshold, cap, attestation window). Prices decide *distribution only*; dominant-assurance escrow guarantees *existence*, so market failure cannot create an unfunded liability.
- **Scale path.** For rounds where possibility count outgrows per-market attention: pairwise juror comparisons + a market anchor recovered to a weight vector on the simplex (GG24 deep-funding lineage — the market feature carried the dominant signal, ~51% degradation on removal).

## Evaluation

The pilot itself is the experiment — a real cohort (Kilifi/Mida Creek coastal crews) with a chartered ops leg, published round rules, and a public daily NDJSON export whose integrity is recomputable (`sed '$d' | sha256sum`).

- **Primary metric:** calibration of market prices against attested outcomes (Brier score per possibility, by group), published in the round readout (D+13).
- **Zero-match baseline:** if no match is signed, markets run as pure information instruments — the calibration result still lands, making the failure mode informative rather than silent.
- **Adversarial surface, disclosed:** self-trading treated as information (hedging = signal); attestation gaming bounded by the distinct-attestor floor and a published attester-concentration metric; thin markets reported as thin.

## Deliverables (all AGPL / CC-BY)

1. Mechanism spec: market construction, resolution oracle, quorum-frozen allocation rule, dispute semantics.
2. Live deployment in the November pilot + the calibration dataset (prices → attested outcomes, timestamped, pseudonymized) — the first public dataset of its kind for funding allocation.
3. Analysis in the published round readout and a post-mortem, including what we got wrong — the charter requires it.
4. Reference tooling: the ops readout script consuming the export and computing calibration.

## Budget & timeline

$10,000 — market venue integration, resolution wiring, ops tooling, analysis. The pilot is already chartered and staffed at $0 ops cost; this grant funds the market layer and its evaluation, not the round. Rolling review: submission early November → decision early December; the readout lands inside the grant window.

## Fit (AI4PG research areas)

01 AI-powered allocation · 02 impact prediction & evaluation · 05 optimal funding strategies · 12 blockchain + AI transparent funding · 14 human-AI collaboration in allocation. The mechanism is human-market elicitation evaluated by reproducible computation — exactly the "transparent allocation" seam this call names.

---

*Word count target: ~600 in this skeleton; expand method §3 (pairwise estimator) and evaluation §4 (pre-registered interpretations) with the Devansh review comments before submission.*
