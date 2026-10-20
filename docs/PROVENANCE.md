# Mechanism Provenance

Every mechanism in Springforth traces to **published public prior art**.
This file is the citation index: each row names the mechanism, where it
is used in the code, and the public source it derives from. Nothing in
this repository derives from privately shared material.

## Coordination layer

| Mechanism | Where | Public source |
|---|---|---|
| Possibility cards + quorum activation | `core/entities.ts`, `coordination/possibility.ts` | Crowdsurfing GDD v1.0 |
| Dominant-assurance credits | `core/entities.ts` `AssuranceCredit`, sweep in `edge` | Tabarrok, "The Private Provision of Public Goods via Dominant Assurance Contracts", *Journal of Public Economics* 72 (1999) |
| Mutual recognition `min(a→b, b→a)` | `coordination/possibility.ts` `trustEdges` | Crowdsurfing GDD v1.0 |
| EigenTrust propagation | `coordination/possibility.ts` `eigenTrust` | Kamvar, Schlosser & Garcia-Molina, "The EigenTrust Algorithm for Reputation Management in P2P Networks" (WWW 2003) |
| Explainable overlap records | `coordination/resolve.ts` | evidence-card pattern — supporting + counter-evidence shown together |
| H3 geospatial targeting | `oracle`, `atlas-adapter` | uber/h3 (Apache-2.0) |
| Hash-chained audit ledger | `core/ledger.ts`, `edge/store.ts` | standard hash-chain / transparency-log design |
| OpenTimestamps anchoring | `edge` `/ledger/anchor` | opentimestamps.org public calendars |
| Commitment pools / CAVs | `clc-adapter` | Grassroots Economics Sarafu (AGPL — public upstream infra) |

## Funding layer

| Mechanism | Where | Public source |
|---|---|---|
| Quadratic matching `(Σ√cᵢ)²` | `funding/qf.ts` `allocateMatching` | Weyl, Buterin & Hitzig, "Liberal Radicalism" (2018); reference impl: gitcoinco/quadratic-funding (MIT) |
| Funding rounds on-chain | `chain-celo/allo.ts` | allo-protocol/allo-v2 (AGPL-3.0) — `DonationVotingMerkleDistributionDirectTransferStrategy` |
| Dominant-assurance pledges | `funding/assurance.ts` `refreshPledge` | Tabarrok 1998/1999 (same citation family as AssuranceCredit) |
| Retroactive allocation | `funding/retro.ts` `tallyRound` | Optimism RetroPGF; gitcoinco/easy-retro-pgf (MIT) |
| Trust-derived badgeholders | `funding/retro.ts` `badgeholders` | RetroPGF badgeholder model + our EigenTrust — the composition is ours |
| Impact claims | `funding/claims.ts`, `export-hypercerts` | hypercerts ATProto lexicon (hypercerts-org, MIT) — claims are records, not instruments |
| Attestations | `attest`, `chain-celo/eas.ts` | Ethereum Attestation Service (eas-sdk MIT; contracts on Celo) |
| Quadratic ballot tally `Σ√w` | `funding/retro.ts` | same LR lineage as donation matching |

## Export standards

| Format | Where | Spec |
|---|---|---|
| 360Giving grants JSON | `export-360giving` | standard.threesixtygiving.org (open standard) |
| IATI 2.03 activity XML | `export-iati` | iatistandard.org (open standard) |
| Hypercerts lexicon records | `export-hypercerts`, `funding/claims.ts` | hypercerts-org/hypercerts-lexicon (MIT) |
| EAS schema payloads | `attest` | attest.sh schema registry format |
| ICS calendar | `edge` `/possibilities/:id/ics` | RFC 5545 |

## What is *not* here, by design

- No pooled-capital vehicles: donations and pledges are **records of
  intent**; custody and distribution live inside audited public
  protocols (Allo) when used at all.
- No tranche or gate releases: outcomes are **attested**, not gated.
- No priced or fractional impact instruments: claims are evaluated via
  attestations, never traded.
- No actuarial projection: `oracle/trajectory.ts` is least-squares trend
  on actual readings — display math, clearly labelled.
