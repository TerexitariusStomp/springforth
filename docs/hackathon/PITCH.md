# Springforth — pitch (Sustainable Finance Live 2026, PS1)

## The problem

Community action fails before funding ever matters: people who want to make
the same thing happen can't find each other, needs and offers live in
different systems, and duplication is invisible until it's too late.

## The system

A coordination layer, not a payments layer.

1. **Declare** — "I want to make X happen" with what you bring, what you
   need, a quorum and a deadline.
2. **Commit** — others opt in; the coordination layer matches each need to
   existing offers in the commons *before* anything external is asked.
3. **Activate** — quorum binds the commitment; deadlines expire what never
   reaches it.
4. **Verify** — open-evidence readings (Sentinel-2, air-quality sensors,
   GBIF, Treegens filmed plantings) score movement against baselines;
   post-event appreciation builds a pairwise trust graph.

Every decision lands on a hash-chained audit ledger, anchored to Bitcoin via
OpenTimestamps.

## Why it wins PS1

- Coordination first, money second — eight capital forms, resources rallied
  internally counted as the mobilisation signal.
- Every overlap shows evidence **and** counter-evidence; humans validate;
  nothing merges automatically.
- Read-only agent answers "what should we do next?" with citations, not vibes.
- 7 live adapters (OnePlanet incl. MCP, Sarafu/CLC, Holons, Artizen,
  Open Collective, ValueFlows, Treegens) — same graph, their vocabularies.
- Real public evidence: Treegens' filmed records, not mock data.
- Funding follows evidence — quadratic + pairwise rounds with a visible
  clique discount, dominant-assurance pledges, retro rounds, streams.
  Nothing custodies funds; wallets sign unsigned transactions we build.

## Value in money terms — the treasurer's three frames

Mentor feedback (treasury lane): *"turn environmental/climate units into
monetary value to capture the risk, cost or value creation."* All three
frames are live:

- **Risk** — the Shrewsbury card carries cited £ benchmarks beside live EA
  flood warnings: £30,000 average flood damage per home, £82,000 per
  business, 5.2M English properties at risk (EA/ABI). The value at stake
  is on the card, not in a slide.
- **Cost** — needs carry declared budgets (the cost of the ask); offers
  carry declared in-kind value (the cost already covered).
- **Value creation** — every card computes "Coordinated value (est.)":
  committed + matched on the ledger, plus declared hours × the cited ONS
  £14.43/h volunteer-time rate, plus in-kind budgets — per currency,
  never converted. `/metrics` aggregates it; methodology is public at
  `VALUATION.md`.

Everything is science-backed and labelled: ledger-derived, declared, or
cited estimate — nothing invented. Sarafu/CLC voucher flows extend the same
framing: community currency is already denominated in the local unit (KES).

## How we score against the published criteria

| Criterion | Where it shows |
|---|---|
| Business idea | `BMC.md` — settlement fee, data-revenue lane, hosted deployments; `/datasets` live |
| Technical implementation | `/docs` OpenAPI + typed client, 165 tests, hash-chained ledger anchored to Bitcoin, 1.8% custom code |
| Use of data sets | `/sources` — endorsed list wired: EA Flood, Open-Meteo, EA Water Quality, FHRS, iNaturalist live; Companies House / OS / EO Data Hub / Alpha-Klima key-gated; OnePlanet MCP client verified against the official guide |
| Presentation | `/tour` self-serve path, pairwise side-by-side allocation, live quorum flip |
| Feasibility | deployed, seeded, ledger-verified — running now |
| Scalability | edge-native worker, adapter lanes, trust graph compounds |
| Impact potential | coordinations/week north star + per-currency coordinated value at `/metrics`; VALUATION.md methodology |

Deliverables: **BMC** (`BMC.md`) · **clickable demo** (live + `/tour`) ·
**logical architecture** (`ARCHITECTURE.md`).

## Where this sits in the funding landscape — the flywheel question

The Gitcoin × Bread proposal (Oct 20) validates the spine: on-chain match
that *must exist before it's promised*, a permanent ERC-4626-style
endowment that spends only yield, governance-encoded round rules. It is
the Pastry crowdfunding layer with a treasury behind it.

Its open problem is the one we hit designing our Artizen-archive sibling
(**Commons Protocol**: 3,375 rescued projects, marketplace + Pot
endowment): **yield alone starves the flywheel** — ~$400k at 4–6% is
~$20k/yr of match. Commons' answer was an *activity* revenue stream —
0.5% on every artifact sale + escrowed unclaimed royalties compounding
the endowment — and loop closure: funded projects launch new collections
that drive new sales. Add demand-gating (pledge + reputation-backing
targets before match unlocks) and non-transferable seasonal points
steering allocation — and the funding engine is complete.

Springforth keeps that flywheel lineage (quadratic/pairwise matching,
retro rounds, dominant-assurance pledges, recurring streams) and adds
what neither Pastry nor Commons had: **activation quorum, an evidence
oracle, and treasurer-grade value accounting on every card** — the
layer that tells a funder not just "your $1 matched 3×" but "£135
coordinated £584.87 and est. £360k of damage risk."

## Community operating system, not a marketplace

Following the mentor guidance in the hackathon notebook (Richard Peers'
marketplace-design note): a marketplace needs both sides before it's
useful; **a tool is valuable with one user**. Day-one value here is
organising what already exists — an asset register of needs/offers, field
evidence, verifiable claims — and the marketplace emerges as trust
compounds. The single painful transaction is the quorum flip.

The "marketplace of marketplaces" note maps directly onto our adapter
layer: we federate existing systems' plans into one ontology (plan nodes)
rather than replacing them, and the agent lane answers across the whole
graph. Specialist agents (funding/nature/skills) = domain packages behind
one edge surface.

## The demo journey — Mida Creek + River Severn

- A community conservation group declares *"Plant 1,200 mangrove propagules
  along the Mida Creek shoreline"* — needs: 400 more propagules, boat
  transport, lunch for 15.
- **UK parallel**: *"Shrewsbury riverside flood response"* — the card carries
  live verified context (EA flood warnings, Open-Meteo precipitation,
  water-quality sampling, food-hygiene venues) pulled from endorsed public
  APIs; its h3'd action node joins the hourly oracle cycle; a UK matching
  round shows the pairwise clique discount locally.
- The overlap layer answers *"who else is pursuing this outcome?"* with real
  evidence: Kilifi County's own plan, plus **Treegens' filmed planting
  records at Kisiwani and Dabaso — the same creek.**
- The hourly oracle reads Sentinel-2 NDVI + GBIF + Treegens feeds against the
  delivery action's h3 cell.
- Trust: mutual recognition (min of reciprocal appreciation) shapes what
  surfaces to whom next.

## Numbers

22 packages · 165 tests · MIT-clean provenance · no wallet, no custody —
unsigned transactions only.
