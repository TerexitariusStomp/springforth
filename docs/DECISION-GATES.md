# Decision gates & commons-design map

Two maps for reading the pilot honestly: which frozen parameter gates
which decision, and how the operating design lines up with Ostrom's
design principles for durable commons.

## Decision gates

The charter freezes parameters at round-open; each one exists to make
a specific decision checkable afterward. If a parameter isn't listed
here, it isn't gating anything — that's a finding, not an omission.

| Frozen parameter | Gates the decision | Evidence in the export |
|---|---|---|
| `minParticipants` / `maxParticipants` | Did quorum mean what we said it meant? | `declaration.threshold`, `quorum.committed[]` |
| `deadline` | Was the window honored or moved? | `declaration.deadline`, `declaration.status` |
| attestation window (charter §) | Were edges counted inside the frozen window? | `attestation_edge.at` vs `quorum.activated_at` |
| ≥3 distinct attesters per completion | Is "delivered" attested or asserted? | `attestation_edge.attesterCount` |
| match cap / `skimBps` / `upstreamSplitBps` | Did the money do what the fee schedule claimed? | `match_flow` lanes (`skimBps`, `upstreamSplitBps` on `matching_fund`; `revshare` when nonzero) |
| zero-match fallback (disclosed) | Is "no matcher" a result or a failure? | `readout.result` — `null` is a first-class outcome |
| cohort/arm/facilitation fields | Platform effect vs organizer effect vs baseline? | `declaration.cohort/arm/facilitation`, `funnelByArm` in `/metrics`, `baseline_report` records |

A parameter that changes mid-round is a charter amendment — it must be
a ledgered event, not an edit. The export is the audit trail for
whether that happened.

## Ostrom design principles → implementation

| Principle | Where it lives | Honest gap |
|---|---|---|
| 1. Clearly defined boundaries | `possibility` cards + cohort field; membership is declared actors | Cohort boundary is self-declared — no sybil resistance beyond wallet binding |
| 2. Proportional equivalence (benefits ↔ costs) | `commitment` ("I bring") + `match_flow` lanes; pledge↔need binding | Costs are self-reported hours (`coordination_effort`) — no verification |
| 3. Collective-choice arrangements | Council seats auto-seat at quorum; `POST /decisions` consent/advice/duocracy | Council is small-N; decisions are advice-weighted, not voting |
| 4. Monitoring | Append-only ledger + ops export + OTS anchors; `dispute` records make contestation visible | Monitoring is platform-mediated only — offline coordination stays invisible except via labeled `ops-report` self-reports |
| 5. Graduated sanctions | `dispute.state` open→resolved/dismissed; failed `test_resolution`s are recorded | No automated sanction ladder — resolution is human |
| 6. Conflict-resolution mechanisms | Disputes + council decisions + `resolvedBy` on redemptions | Resolution authority isn't yet codified per-cohort |
| 7. Recognition of self-organization | `ops-report`/`baseline_report`/`readout` lanes let the ops leg file what happened off-platform, labeled | Self-reports are claims — the ledger can't check them |
| 8. Nested enterprises | `cohort` field + per-arm funnel cuts; CLC pools are the nested exchange layer underneath | One cohort live; nesting is designed, not yet exercised |

## What this map is for

A funder or reviewer asking "is this a real commons or a platform
experiment" can check each row against the export. Rows marked "honest
gap" are where the pilot is weaker than the principle — stated in
advance so the readout can't be accused of discovering them late.

## Evidence-gate ladder (review framework)

Borrowed from the Beacon review's decision sequence — each gate is a
**prerequisite**, not a point total. Green upstream never compensates
for Red downstream.

| Gate | Question | Export evidence | Status rule |
|---|---|---|---|
| Distribution | Can the local graph be reached? | `exposure`, `access_exclusion` | G: coverage > exclusion; R: blocked channel dominates |
| Desirability | Do people want to interact? | `interest`, `question`, `commitment` (OIR) | G: `oir` > threshold |
| Viability | Does it create value? | `outcome_report` (VER/NPOR/energy) | G: `viableRateSurveyed` > floor |
| Repeat | Does behavior return? | repeat `commitment`, `resilienceRate` | G: repeat > novelty-window rate |
| Organicity | Does it work without facilitation? | `intervention`, `adr`, `siir`, `orr` | R if `adr` > 0.5 — operator artifact |
| Replication | Does it repeat across groups? | `funnelByArm`, `declaredByCohort` | G: second cohort replicates |
| Geography | Does the mechanism travel? | `place`/`h3` per-cohort comparison | G: second site replicates |

## Diagnostic matrix

Symptom → first question → what *not* to assume:

| Symptom | Ask first | Don't assume |
|---|---|---|
| Low `declared`→`quorum` | Is the ask legible / threshold reachable? | No demand |
| High quorum, low completed | Is attestation legible, evidence lane open? | Delivery failure |
| High `adr` | How much is operator intervention? | Product pull |
| High completed, low `surveyed` | Is the survey instrument being filed? | Happy participants |
| Many `exit` records | Is the cost side (`costReport`) too high? | Churn noise |
| Zero `access_exclusion` | Is exclusion actually zero, or unobserved? | Universal reach |

## Amendment governance

Post-hoc rule changes are `amendment` records — visible by
construction, never silent edits:

- Any metric, threshold, param, or cohort-membership change after
  data collection begins is filed via `POST /ops/amendment`.
- A post-hoc cohort exclusion is an amendment, not a deletion —
  the ledger can't delete, which is the point.
- `independent: false` when the approver's work is scored by the
  metric being redefined (growth owners don't redefine their own
  proof criteria); filed visible, not forbidden.
- `effectiveSeq` pins the ledger position where the new rule
  applies — pre- and post-amendment data stay separable.
