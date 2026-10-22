# Reviewer's guide — Springforth

Live: https://springforth.widespread.workers.dev — everything below is live,
no login required. Two paths: 3 minutes or 8 minutes.

## 3-minute path

1. **`/`** — "coordinate first" + *what needs attention*: open cards,
   overlaps awaiting human review, unmet needs. (UX)
2. **`/collaborate#overlaps`** — the core answer: machine-flagged overlaps
   between plans in different systems, with confidence, evidence,
   counter-evidence, and human validation. (Use of datasets)
3. **`/rounds/round-pairwise-demo`** — the moat: three donors who
   appreciated each other get *less* matching than diverse donors — the
   trust graph discounts coordination. Compare with
   `/rounds/round-mida-creek` (standard QF on the same needs). (Business
   idea + technical)
4. **`/ledger/verify`** — hash-chained audit, Bitcoin-anchored. (Feasibility)

## 8-minute path (adds)

5. **`/possibilities`** — the deck: quorum mechanics live; feed learns
   yes/no (pass/interest POSTs), reason lines, since-engagement badges.
   `poss-you-in-this-room-…` sits at 2/3 — join and watch it flip.
6. **`/collaborate#outcomes`** — who else is pursuing the same outcome,
   across OnePlanet, Treegens, Silvi, community cards.
7. **`/impact#evidence`** — open-evidence readings per node: Sentinel-2,
   GBIF, NASA POWER, field reports. Evidence for review; humans stay
   authoritative.
8. **`/community#decisions`** — trust-gated parameter ballots; one
   proposal already passed and rewrote a matching parameter.
9. **`/impact#claims` → claim → attestations** — impact claim
   (hypercert-shaped) with EAS attestation payloads.
10. **`/impact#data`** — signed releases (sha256 manifests, OTS-anchored) +
    access grants — the data-revenue lane.
11. **`/docs`** — every route, grouped; OpenAPI 3.1 at `/docs.json`;
    typed client `@springforth/client`.
12. **`/collaborate#ask`** (POST `/agent` `{"q":"who else is pursuing
    mangrove planting"}`) — cited answers over the live graph — the
    idea-starter's agentic lane.
13. **`/map`** — h3-pinned cards across Kenya + UK; per-card minimaps in
    overlays.
14. **Quorum card overlay** — auto-seated council, council-gated forum,
    participant reviews, verifier-replay disclosures on every £ figure.

## Criteria map

| Criterion (verbatim, slide 38) | Where it shows |
|---|---|
| Demo | live site throughout; `DEMO-SCRIPT.md` legs; `/tour` self-serve path |
| Business Idea | `BMC.md` (canvas + Benefits Dependency Network + GTM work-back), `/impact#data` data-revenue lane, round settlement lane |
| Technical Implementation | `/docs`, test suite, ledger+OTS anchor, ~2% custom code, non-custodial tx builders |
| Use of Datasets | `/impact#data` endorsed-sources block, `/impact#evidence` readings w/ methodology refs, OnePlanet MCP + Sarafu/Treegens/Silvi imports, key-gated lanes honestly marked (`DATA-SOURCES.md`) |
| Presentation | `PITCH-LIVE.md` 8-min script, pairwise side-by-side, live quorum flip |
| Feasibility | deployed + seeded + ledger-verified now; `?actor=` feed live |
| Scalability | edge-native worker, adapter lanes, trust graph compounds |
| Impact potential | coordinations/week north star + per-currency, per-capital coordinated value at `/impact#results`; avoided-loss lane (`VALUATION.md`) |

Deliverables: **BMC** (`BMC.md`) · **logical architecture**
(`ARCHITECTURE.md` + `demo-assets/architecture.svg`) · clickable demo (live
+ `/tour`). Mentor map: `MENTORS.md`.

Repo: github.com/TerexitariusStomp/springforth (MIT-clean provenance,
`docs/PROVENANCE.md`).
