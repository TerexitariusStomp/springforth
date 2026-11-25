# Competitive position — honest, not promotional

Where this evidence layer sits against the impact-attestation
ecosystem, and what we deliberately don't try to be.

| | Karma GAP | Hypercerts | OSO | Verax | **Springforth export** |
|---|---|---|---|---|---|
| Layer | on-chain grantee accountability | impact certificates (ERC-1155) | OSS metrics pipeline | attestation registry | recomputable evidence substrate |
| Whole-cut recomputability | no — per-attestation | no | no | no | **yes — `file_sha256` + manifest** |
| Anchored timestamps | chain-native | chain-native | no | chain-native | **OTS/Bitcoin + ledger-head anchors** |
| Inclusion proofs | no | no | no | no | **`/ledger/proof` (SCITT-style)** |
| Signed export | no | n/a | no | n/a | **Ed25519 manifest + well-known JWKS** |
| One-command verifier | no | no | no | no | **`scripts/verify-export.mjs`** |
| Disclosure control (k≥5) | no | no | no | no | **yes** |
| Denominator/funnel honesty | milestones only | claims only | activity only | attestations only | **declared→quorum→completed→expired** |
| On-chain composability | **yes (EAS)** | **yes (tokenized)** | API | **yes** | records EAS-mintable in shape only |
| Marketplace | no | **yes** | no | no | no |
| Dashboard UX | **yes** | **yes** | **yes** | minimal | plain JSON/NDJSON |

## What we surpass on

- **Verifiability without a chain**: a reviewer takes one file and
  independently recomputes the entire record — hash, ledger prefix,
  signature, anchors. GAP/EAS data is queryable but requires
  indexing an ecosystem to verify; ours is a single NDJSON + a
  5-check script.
- **Denominators**: failures, expiries, disputes, non-responses are
  records. Impact dashboards show the numerator.
- **Disclosure control**: k≥5 cell suppression is the documented
  privacy standard; nobody else in this space enforces it.
- **Epistemic honesty**: `null` metrics with named gaps rather
  than plausible-looking numbers from thin data.

## What we deliberately don't compete on

- **On-chain composability** — EAS/Verax attestations compose into
  contracts and indexers. Our `attestation_edge`/`outcome_report`
  records carry EAS-mintable field shapes so the export *feeds*
  that layer rather than duplicating it.
- **Tokenization/marketplace** — Hypercerts' contribution.
- **Dashboards** — GAP/OSO's contribution; we expose JSON/NDJSON.

Position: the verification and evidence substrate other layers
*consume* — a transparency-service-shaped export, not another
dashboard. CIDS-aligned `outcome_report` field names keep records
portable into the Common Impact Data Standard ecosystem.
