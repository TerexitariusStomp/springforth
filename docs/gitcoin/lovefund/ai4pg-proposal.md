# AI4PG 2026 submission — final draft (~950 words)

> Submit via OpenReview: https://openreview.net/group?id=AI4PG/2026/Proposals
> Deadline: Feb 28, 2026 (extended). Program page shows "now open" — confirm on OpenReview before the final pass.
> Format: ≤4 pages, ≤1,000 words. Up to $10,000. Rolling review, ~4 weeks.

---

**Title:** Which oracle knows? Ledger-resolved markets, AI delegates, and human attestors for public-goods match allocation

**Authors:** Terexitarius (Springforth) + Lin Jiaze (ops leg, Kilifi pilot) — confirm co-authorship line before submit.

## Problem

Match allocation in small public-goods rounds is curator-bound or uniform. Curators gatekeep by network position; uniform splits ignore the only reliable feasibility signal in the round — the participants' own knowledge. The deeper failure, post-Artizen, is epistemic: nobody knows which allocation signal is *right*, because rounds rarely produce data a third party can re-check. Promises resolve on a website's word, and nobody publishes the disagreement between the prediction and the outcome.

## Method

We attach three independent prediction surfaces to each approved *possibility* in a chartered commitment-pooling round (love.fund × Kilifi pilot, opening mid-November), then score all three against the same objective resolution:

1. **Completion market.** One categorical market per possibility: "does P reach attested completion by close?" Venue: Seer (Gnosis conditional tokens, Kleros dispute backstop) or an internal LMSR fallback if liquidity/mobile UX fails the cohort. The market resolves on the ledger — never on a report.
2. **AI-delegate deliberation.** The same possibilities are deliberated inside Simocracy — whose agent-built "sims" (constitutioned ATProto digital twins, each record on the owner's own PDS) run capital-allocation rounds via the S-Process. We record each sim's pre-close confidence on each possibility's completion. This is the AI surface: does a constitutioned agent, given the same public evidence, price feasibility better or worse than a market?
3. **Human attestor signal.** Completion requires ≥3 distinct attestors, no self-attestation — and attesters may also register pre-resolution confidence. This is the incumbent oracle most funding rounds already trust implicitly; we make its accuracy measurable for the first time.

**The frozen rule.** A possibility's match weight = market price at its quorum event — written to the ledger as a frozen parameter, identical in discipline to the round's other frozen params (threshold, cap, attestation window). Prices decide *distribution only*; dominant-assurance escrow guarantees *existence* — market failure cannot create an unfunded liability.

**The resolution oracle.** A possibility resolves YES when completion is attested on a public hash-chained ledger: ≥3 distinct attestors, disputes resolve by flag events — a flagged event is non-resolution, never an edit. Kleros is the backstop arbiter; the ledger is the primary oracle.

## Evaluation

The pilot is the experiment: a real cohort (Kilifi/Mida Creek coastal crews) with an independent ops leg, published round rules, and a public daily NDJSON export whose integrity is recomputable (`sed '$d' | sha256sum`; manifest carries the ledger head).

- **Primary metric:** Brier score per prediction surface per possibility — market vs. sim vs. attestor — published in the round readout (D+13).
- **Secondary:** pairwise juror comparisons + a market anchor recovered to a weight vector on the simplex (GG24 deep-funding lineage — the market feature carried the dominant signal, ~51% degradation on removal). For rounds where possibility count outgrows per-market attention, this is the scale path; our result tests whether sims can substitute for the anchor.
- **Zero-match baseline:** if no match is signed, all three surfaces run as pure information instruments — the calibration result still lands, making the failure mode informative rather than silent.
- **Adversarial surface, disclosed:** self-trading treated as information (hedging = signal); attestation gaming bounded by the distinct-attestor floor and a published attester-concentration metric; thin markets reported as thin; sim predictions time-stamped on ATProto so they can't be edited after resolution.

## Deliverables (all AGPL / CC-BY)

1. Mechanism spec: market construction, resolution oracle, quorum-frozen allocation rule, sim-deliberation protocol, dispute semantics.
2. Live deployment in the November pilot + the calibration dataset — three prediction surfaces against attested outcomes, timestamped, pseudonymized, recomputable. No public dataset of this kind exists.
3. Analysis in the published round readout + post-mortem, including what we got wrong — the charter requires it.
4. Reference tooling: the ops readout script consuming the export and computing per-surface calibration.

## Budget & timeline

$10,000 — market venue integration, resolution wiring, sim-round setup on Simocracy, ops tooling, analysis. The pilot is already chartered and staffed at $0 ops cost; this grant funds the measurement layer, not the round. Submission → decision ~4 weeks on rolling review; the readout lands inside the grant window.

## Fit (AI4PG research areas)

01 AI-powered allocation · 02 impact prediction · 05 optimal funding strategies · 10 multi-agent coordination · 12 blockchain + AI transparent funding · 14 human-AI collaboration in allocation. The mechanism is comparative-oracle evaluation on recomputable infrastructure — the "transparent allocation" seam this call names, with three of the program's supporters (Seer, Gitcoin, Simocracy) as live surfaces.

---

## Pre-submission checklist

- [ ] Confirm cycle is still accepting on OpenReview (page says "now open"; deadline shows Feb 28, 2026 extended — if the 2025 cycle rolled, grab the 2026 group ID).
- [ ] Confirm Simocracy contact — the sim-round setup needs their S-Process surface; message via simocracy.org/contact before claiming the surface exists. If unavailable, the proposal still stands on surfaces 1+3; sims become the round-2 lane.
- [ ] Confirm co-authorship with Lin Jiaze.
- [ ] Confirm Seer is viable for a phone-first Kenyan cohort (Devansh's pending review answer) — else name the LMSR fallback.
- [ ] Word-count the final: keep under 1,000.
