# Analysis limits — what the pilot data can and cannot support

The epistemic boundary of the evidence layer, stated as rules for
anyone writing a readout or quoting `/metrics`.

## Small-n causal limits

Modern staggered-rollout estimators (Callaway–Sant'Anna 2021,
Sun–Abraham 2021, de Chaisemartin–d'Haultfœuille 2020) fix the
two-way-fixed-effects bias under staggered treatment timing — but
power analyses (Scannell, 2024) show even the most efficient
variants need **>250 units** for reasonable power at realistic
effect sizes, and at low power significant estimates are often
wrong-signed or massively exaggerated.

**Rule: `cohort`/`arm` data supports descriptive and feasibility
reporting only.** It records the contrast structure — so a later
adequately-powered analysis doesn't reconstruct it — but a pilot
of ~10–50 participants must not report arm-difference effect sizes
as causal estimates. Bayesian small-sample DiD (arXiv:2505.18391,
2025) with shrinkage priors is the method to reach for when the
data is that thin; flag estimates as model-dependent if used.

## Attestation is not outcome truth

`attestation_edge` records that ≥N participants claimed an outcome.
`outcome_report` records a self-report. Neither is ground truth:
fulfillment validity stays a separate layer (see VERIFICATION.md —
three validity model). A `viableRateSurveyed` computed from
surveys is a *reported* viable rate; name it that way.

## Self-reported lanes are labeled, not blended

`ops-report`, `coordination_effort`, `baseline_report`, and
`outcome_report` records are `selfReported: true` permanently. They
sit beside platform-observed records, never inside their
denominators. `exposure` is the only platform-observed behavioral
record — and it is self-*attributed* (`?actor=` is a claim), labeled
`attribution: 'self-asserted'`.

## Suppression is the floor, not a failure

Group cuts below n=5 render `{suppressed:true}` by disclosure-
control rule (k-anonymity, NIST SP 800-188). Quoting a suppressed
cell reconstructed from totals is a privacy breach of the
disclosure rule — not clever analysis.

## Evidence resets

Changing the mechanism mid-pilot (new arm, new facilitation mode,
new instrument) resets the evidence clock for what it changes.
Data does not carry forward to an adjacent hypothesis — file the
change as an `amendment` so the reset is visible, then measure the
new configuration on its own record.

## What the export *can* honestly claim

- Record integrity: the file is self-consistent and the ledger
  prefix replays (recompute + `/ledger/verify`).
- Provenance: who attested/filed, pseudonymized but stable.
- Existence: OTS anchors bound the cut to a timestamp.
- Feasibility: the funnel, response rates, coverage, churn,
  exclusions — the CONSORT-pilot reportable set.

It cannot claim: platform-caused outcomes, offline coordination
completeness, attestation truth, or portability to other cohorts.
