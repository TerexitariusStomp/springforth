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

## The demo journey — Mida Creek

- A community conservation group declares *"Plant 1,200 mangrove propagules
  along the Mida Creek shoreline"* — needs: 400 more propagules, boat
  transport, lunch for 15.
- The overlap layer answers *"who else is pursuing this outcome?"* with real
  evidence: Kilifi County's own plan, plus **Treegens' filmed planting
  records at Kisiwani and Dabaso — the same creek.**
- The hourly oracle reads Sentinel-2 NDVI + GBIF + Treegens feeds against the
  delivery action's h3 cell.
- Trust: mutual recognition (min of reciprocal appreciation) shapes what
  surfaces to whom next.

## Why it wins PS1

- Coordination first, money second — eight capital forms, resources rallied
  internally counted as the mobilisation signal.
- Every overlap shows evidence **and** counter-evidence; humans validate;
  nothing merges automatically.
- Read-only agent answers "what should we do next?" with citations, not vibes.
- 7 live adapters (OnePlanet incl. MCP, Sarafu/CLC, Holons, Artizen,
  Open Collective, ValueFlows, Treegens) — same graph, their vocabularies.
- Real public evidence: Treegens' filmed records, not mock data.

## Numbers

14 packages · ~110 tests · AGPL-3.0 · no wallet, no custody, no payment rails.
