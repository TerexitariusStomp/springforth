# Funding layer — mechanism spec

Springforth's funding layer answers one question: *once coordination has
surfaced real unmet needs, how does money find them?* Every mechanism is
published public prior art (see `docs/PROVENANCE.md`). The platform
**never custodies funds** — donations and pledges are ledger records of
intent; settlement rides public rails.

## The three mechanisms

### 1. Quadratic funding rounds (Liberal Radicalism)

A `FundingRound` has a sponsor matching fund and a set of eligible
financial need nodes (surfaced by the coordination layer — this is the
point: allocation happens on *verified demand*, not applications).

- Donors record `Donation`s against eligible needs during the round.
- Match per need = `(Σ√cᵢ)²` weight, scaled to the fund
  (`funding/qf.ts`). Breadth of support outweighs size of gift —
  ten donors of $10 beat one donor of $100.
- On close, the allocation is published: `/rounds/:id` preview,
  `/rounds/:id/export/360giving` (grants JSON), `/rounds/:id/export/iati`
  (activity XML).
- On-chain (phase 3): the round maps to an Allo pool
  (`chain-celo/allo.ts`); donations settle via the deployed
  DonationVotingMerkleDistribution strategy — custody lives in the
  audited public contract, not here.

### 2. Dominant-assurance pledges (Tabarrok 1998)

A `Pledge` commits funds against a possibility card — it **binds only at
quorum**.

- `pending → bound`: card reaches quorum (the same `quorumMet` that
  governs participation).
- `pending → refunded`: card expires — the pledge never moved; the
  pledger earns `AssuranceCredit` (willingness counted, money untouched).
- `bound → released`: card completes — funds can now move on whatever
  rail the pledger chooses.

Joining is dominant: you lose nothing by pledging on a card that never
activates. That is the whole mechanism — no escrow needed.

### 3. Retroactive allocation (RetroPGF)

A `RetroRound` distributes a sponsor fund across **attested impact
claims** — work already done and evidenced.

- The reviewer cohort is *derived*, not appointed: `badgeholders()`
  selects top-N actors by EigenTrust standing on the appreciation graph
  — the community's own recognition record decides who reviews.
- Ballots are quadratic: each badgeholder allocates points across
  claims; tally aggregates `Σ√points` per claim (`funding/retro.ts`).

## Claims & attestations

An `ImpactClaim` (hypercerts ATProto lexicon shape) records work done:
scope, timeframe, contributors, cited oracle checks + appreciations.
Attestations evaluate claims — EAS schema payloads
(`attest`, `chain-celo/eas.ts`). A claim is a *record*, evaluated by
humans — never a priced or fractional instrument.

## What this layer deliberately is not

- No capital pools, no reserves, no yield engines.
- No gated releases — attestation follows the work, not a schedule.
- No ownership splits or secondary markets.
- Forecasting is `oracle/trajectory.ts` — linear trend on readings,
  labelled as display math.

## Routes

| Route | Role |
|---|---|
| `GET/POST /rounds` | list / open a round (admin) |
| `GET /rounds/:id` | detail + live allocation preview (HTML/JSON) |
| `POST /rounds/:id/donate` | record a donation |
| `POST /rounds/:id/close` | allocate + close (admin) |
| `GET /rounds/:id/export/{360giving,iati}` | public-spec exports |
| `GET/POST /claims` | build claim from completed card / list |
| `POST /claims/:id/attest` | attester evaluation |
| `GET/POST /retro`, `POST /retro/:id/vote|tally` | retro rounds |
| `POST /possibilities/:id/pledge` | assurance pledge on a card |
| `GET /pledges` | pledge ledger view |
| `GET /possibilities/:id/report` | composed field report |
