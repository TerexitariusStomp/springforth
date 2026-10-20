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
| EA Flood Monitoring | Open Government Licence | flood-risk context |
| postcodes.io / ONS | OGL | geography + deprivation context |
| OpenTimestamps calendars | public | Bitcoin ledger anchoring |

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
