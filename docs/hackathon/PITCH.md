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

## How we score against the published criteria

| Criterion | Where it shows |
|---|---|
| Business idea | `BMC.md` — settlement fee, data-revenue lane, hosted deployments; `/datasets` live |
| Technical implementation | `/docs` OpenAPI + typed client, 165 tests, hash-chained ledger anchored to Bitcoin, 1.8% custom code |
| Use of data sets | `/sources` — endorsed list wired: EA Flood, Open-Meteo, EA Water Quality, FHRS, iNaturalist live; Companies House / OS / EO Data Hub / Alpha-Klima key-gated; OnePlanet MCP client verified against the official guide |
| Presentation | `/tour` self-serve path, pairwise side-by-side allocation, live quorum flip |
| Feasibility | deployed, seeded, ledger-verified — running now |
| Scalability | edge-native worker, adapter lanes, trust graph compounds |
| Impact potential | coordinations/week north star at `/metrics` |

Deliverables: **BMC** (`BMC.md`) · **clickable demo** (live + `/tour`) ·
**logical architecture** (`ARCHITECTURE.md`).

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
