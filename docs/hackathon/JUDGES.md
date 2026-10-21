# Judge's guide — Springforth (PS1 · Team Two)

Live: https://springforth.widespread.workers.dev — everything below is live,
no login required. Two paths: 3 minutes or 8 minutes.

## 3-minute path

1. **`/`** — "coordinate first" + *what needs attention*: open cards,
   overlaps awaiting human review, unmet needs. (UX)
2. **`/coordination`** — the PS1 answer: machine-flagged overlaps between
   plans in different systems, with confidence, evidence, counter-evidence,
   and human validation. (Use of datasets)
3. **`/rounds/round-pairwise-demo`** — the moat: three donors who
   appreciated each other get *less* matching than diverse donors — the
   trust graph discounts coordination. Compare with
   `/rounds/round-mida-creek` (standard QF on the same needs). (Business
   idea + technical)
4. **`/ledger/verify`** — hash-chained audit, Bitcoin-anchored. (Feasibility)

## 8-minute path (adds)

5. **`/possibilities`** — the deck: quorum mechanics live.
   `poss-you-in-this-room-…` sits at 2/3 — join and watch it flip.
6. **`/outcomes`** — who else is pursuing the same outcome, across
   OnePlanet, Treegens, Silvi, community cards.
7. **`/verify`** — open-evidence readings per node: Sentinel-2, GBIF,
   NASA POWER, field reports. Evidence for review; humans stay authoritative.
8. **`/governance`** — EigenTrust-gated parameter ballots; one proposal
   already passed and rewrote a matching parameter.
9. **`/claims` → claim → attestations** — impact claim (hypercert-shaped)
   with EAS attestation payloads.
10. **`/datasets`** — signed releases (sha256 manifests, OTS-anchored) +
    access grants — the data-revenue lane.
11. **`/docs`** — every route, grouped; OpenAPI 3.1 at `/docs.json`;
    typed client `@springforth/client`.
12. **`/agent`** (POST `{"q":"who else is pursuing mangrove planting"}`) —
    cited answers over the live graph — the idea-starter's agentic lane.

## Criteria map

| Criterion | Where it shows |
|---|---|
| Deliverables | `BMC.md`, live demo, `ARCHITECTURE.md` + `demo-assets/architecture.svg` |
| Business idea | `BMC.md`, `/datasets` (data revenue), round settlement lane |
| Technical implementation | `/docs`, 175 tests, ledger+OTS, 1.72% custom code |
| UX / first-time user | `/` triage, `/tour`, mobile-ready pages |
| Use of datasets | `/sources` (endorsed matrix: `DATA-SOURCES.md`), card verified-context, `/verify` oracle lane, OnePlanet/Treegens/Silvi plans → `/coordination` |
| Presentation | the pairwise side-by-side + live quorum flip |
| Feasibility | deployed + seeded + ledger-verified now |
| Scalability | edge-native, adapter lanes, trust graph compounds |
| Impact potential | coordinations/week north star at `/metrics` |

Repo: github.com/TerexitariusStomp/springforth (MIT-clean provenance,
`docs/PROVENANCE.md`).
