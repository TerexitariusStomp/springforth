# Call notes — Chryssi (cchorafa), 2026-10-22 4:30 PM UK

Sustainable-finance standards advisor; works with treasurers on
environment/climate risk. What follows is her guidance, distilled.

## What to measure against

- **ISO standards** — anchor measurement vocabulary to ISO environmental
  series (ISO 14008 = monetary valuation of environmental impacts;
  14064 = GHG quantification; 14090s = adaptation). Naming the standard
  is what makes a treasury reviewer trust the frame.
- **Transition pathways / scenario analysis** — frame project value
  against the objectives of the people supporting (or who might support)
  it: what does the world look like if this succeeds vs. stalls.
- **Capitals Coalition** (formerly Natural Capital Coalition) —
  https://capitalscoalition.org/ — the Natural / Social Capital Protocol
  lineage; **Value Accounting Network** —
  https://capitalscoalition.org/project/value-accounting-network/ —
  how a project contributes to society and environment *monetized* as
  project value creation.
- **rebalance.earth** — https://rebalance.earth/ — catastrophe/impact
  framing: potential damages, cost avoidance, benefits; reduce damages
  or enhance yield. Map to our `riskAvoided` (losses avoided) and
  leverage/riskPerUnit ratios.

## What verification requires

- Show the **assumptions and implications of the thought process**, not
  just the output — a verifier must be able to re-walk the steps.
- **Success rate** — evidence that actions actually took place; the
  trail must let a verifier check each step (our audit ledger +
  attestation path is the mechanism — cite it).
- **Scientific citations** — every benchmark/rate needs a published
  source (already the rule: declared / ledger / cited-estimate tiers).

## Product guidance

- **Reviews from people using the platform** — post-completion
  appreciation is that; surface it visibly (it already feeds trust, but
  make it legible as evidence).
- **When projects are abstract, add geographic information** — a map
  view of possibilities; get personal ("the stream may flood" — a
  reviewer should *see* the place).
- Highlight **why** + the proposed pledge, how it benefits, motivate the
  community toward the pledge.

## Action items

- [x] This file — call captured.
- [x] VALUATION.md — framework-alignment section (ISO, Capitals
      Coalition, damage-avoidance framing, verifier-replay rule).
- [x] Geo: `place` is already on every card — shipped as a
      server-rendered SVG world map (`/map`, `packages/portal/src/map.ts`)
      with h3-anchored markers; zero JS/tile dependency so it runs
      entirely on the Worker. (OSM+Leaflet considered; server-SVG won on
      the no-CDN constraint.)
- [x] Reviews: appreciation notes render as quotable "what participants
      said" blocks on cards, actor profiles, the report page, and
      `/community#voices` — real notes only, never fabricated.
- [x] Verification surfaces (shipped): per-card audit trail in the card
      overlay — every ledger event that names the card, chronological,
      linked to `/ledger`; every value figure expands into a
      verifier-replay `<details>` (inputs, formula, source, tier).
      `methodologyRef` citations render in the `/impact#evidence` table
      and on report pages.
- [x] Pathways: "Two pathways" block on every card — expires (damages
      stand, costs unmet) vs activates (value mobilized, risk mitigated) —
      the Rebalance Earth degraded→restored frame, with the
      environmental/operational/financial risk lanes footnoted.
- [x] Council + forum: `CouncilSeat` auto-seated at quorum (declarer +
      participants; verifiers self-seat; sponsors seat on bound pledge);
      `ForumPost` opens at quorum, council-gated writes, ledger-attributed.
- [x] Capitals grouping: valuation components tagged financial / human /
      social / natural-capital-risk in `valueCoordinated`; rendered as
      "Impacts vs Dependencies" per the Value Accounting Network frame.
- [ ] Follow-up: ask whether she'll review VALUATION.md after the
      hackathon and intro a treasurer/assurance contact.
