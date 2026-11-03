# OSS Stack

Springforth is a thin orchestration layer over open infrastructure and
open data. This file inventories what we build on, under which license,
and where the seams are.

## Runtime

| Component | License | Used for |
|---|---|---|
| Cloudflare Workers + D1 | proprietary platform (Apache-2.0 workerd runtime) | edge API + persistence |
| TypeScript | Apache-2.0 | language |
| pnpm | MIT | workspaces |
| zod | MIT | entity + adapter validation |
| h3-js | Apache-2.0 | geospatial cells for oracle targeting |
| vitest | MIT | tests |
| wrangler | Apache-2.0-ish (Cloudflare) | deploy + D1 |

## Data sources (read-only, public)

| Source | License/terms | Used for |
|---|---|---|
| Sentinel-2 via titiler | ESA open data | vegetation (NDVI) readings |
| OpenAQ | CC-BY | air-quality sensors |
| Sensor.Community | open data | community air-quality sensors |
| NASA POWER | NASA open | solar/weather |
| GBIF | CC0/CC-BY | biodiversity occurrences |
| World Bank indicators | CC-BY-4.0 | country baselines |
| Treegens feeds | public | filmed + AI-counted planting records |
| Silvi App API | public API (per-project key) | projects/zones/trees/STAC — verified tree counts |
| Silvi Treekipedia LEAF | public API | species aptness — GBIF+WCVP+WWF ecoregions |
| SilviProtocol/silvi | MIT | treekipedia backend + contracts (sponsor/NFT/EAS) |
| EA Flood Monitoring | Open Government Licence | flood-risk context |
| postcodes.io / ONS | OGL | geography + deprivation context |
| OpenTimestamps calendars | public | Bitcoin ledger anchoring |

## Funding-layer protocols (public prior art — see `docs/PROVENANCE.md`)

| Component | License | Used for |
|---|---|---|
| allo-v2 contracts (Gitcoin) | AGPL-3.0 | on-chain quadratic rounds on Celo — custody + merkle distribution live in the deployed strategy |
| @ethereum-attestation-service/eas-sdk + EAS contracts (Celo) | MIT | outcome/evaluation attestations |
| @hypercerts-org/lexicon + sdk-core | MIT | impact claim records (ATProto) |
| viem | MIT | chain client + calldata building |
| gitcoinco/quadratic-funding | MIT | QF reference implementation / test vectors |
| gitcoinco/easy-retro-pgf (+ allo2 strategy) | MIT | retro-round ballot model reference |
| 360Giving / IATI | open standards | grant + activity exports |
| cUSD / Celo | — | donation + matching currency |

## Custom-code accounting (`node scripts/oss-audit.mjs`)

| Custom src | Custom tests | Vendored npm | Cited contract repos | Custom share |
|---|---|---|---|---|
| 29,931 | 4,063 | 228,045 | 125,000 | **8.26%** |

Custom code is the coordination semantics, funding-mechanism glue, edge
routes and renderers — every mechanism itself is cited public prior art.
The crowd-surfing layer (questions, council decisions, referrals,
interest intensity, compost, constellation, facilitation picks) added
~1.5k custom LOC and **zero new npm dependencies** — it composes the
existing store/ledger/graph modules plus published mechanisms (Sociocracy
3.0 consent, the advice process, duocracy, liberating-structures names).
The brief/test-card/ecocycle pass added ~0.9k more, again with **zero new
dependencies** — `TestCard`/`Possibility.brief` are zod schemas, and the
ecocycle is a ~120-line shared SVG builder consumed by both the portal
and React.

### Dependency evaluation — brief/test-card/ecocycle pass

Every commercially-usable candidate was evaluated and rejected:

| Candidate | License | Verdict |
|---|---|---|
| mermaid | MIT | can't express the canonical ∞ ecocycle layout; requires client JS — violates the no-JS portal rule |
| d3 | ISC | ~600KB of library to draw 4 nodes on a bezier path — net-negative |
| elkjs / viz.js | EPL/MIT (WASM) | layout/WASM overhead + client JS for a fixed 4-node diagram |
| rough.js | MIT | same overhead/fit rejection |
| lucide-static | ISC | **adopted** — the trap marker reuses its `triangle-alert` SVG path markup (already a web dep) |

The test-card and ecocycle *methods* are domain content, not code —
cited in `docs/PROVENANCE.md` (Strategyzer Test Card vocabulary
CC-BY-SA, LS Ecocycle Planning), never copied.

Honest note: the &lt;5% aspiration is not currently met — the custom
share is dominated by the server-rendered portal + edge route layer,
not by mechanism code. A real reduction means extracting the render
layer into a published package, not gaming the denominator.

## Interop formats

| System | License | Lane |
|---|---|---|
| OnePlanet | platform API / MCP | plan import + live pull |
| Sarafu / Community Ledger (Grassroots Economics) | open data | voucher → community offer nodes |
| Holons | open protocol | hub inventory + possibility composite |
| Artizen Fund | API export shape | fund seasons/projects/artifacts → plan nodes |
| Open Collective | API export shape | collectives + expenses → nodes |
| ValueFlows (playnet) | open vocabulary | agents/intents/commitments |
| Accord Project / Concerto (org.agreeable) | Apache-2.0 | agreement export namespace |
| EAS attestations | open schema | trust export (`?format=attestations`) |
| iCalendar (RFC 5545) | standard | possibility → calendar export |
| ActivityPub-shaped possibility cards | open | declaration portability |

## Conventions

- Every adapter preserves the source system's vocabulary in tags and
  provenance fields; nothing is silently re-labelled.
- Third-party records are never mutated — corrections happen on our copy
  and are diff-logged to the audit ledger.
- All adapter inputs are treated as untrusted data and validated with zod
  before entering the plan graph.
