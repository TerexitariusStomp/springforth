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
