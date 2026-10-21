# Endorsed data sources — integration matrix

Source selection follows the hackathon's own ranking
(`vendor/dataset-ranking.xlsx`, Co-Pilot-scored /25). Two integration
lanes: **oracle readers** (hourly `SourceReading` → `OracleCheck` against
baselines, can corroborate field reports) and **context connectors**
(point-in-time enrichment attached to possibility cards as "Verified
context" — never affects quorum).

## Live oracle readers (keyless)

| Source | Rank | Endpoint | License | Reading |
|---|---|---|---|---|
| EA Flood Monitoring | 1 (25) | `environment.data.gov.uk/flood-monitoring/id/floods` | OGL | Severity-weighted active warnings ≤40km |
| Open-Meteo | 7 (23) | `api.open-meteo.com/v1/forecast` | CC-BY-4.0 | 7-day precipitation sum |
| EA Water Quality | 7 (23) | `environment.data.gov.uk/water-quality/sampling-point` (`Accept: ld+json`) | OGL | Regulated sampling-point density |
| FSA Food Hygiene | 3 (24) | `api.ratings.food.gov.uk/establishments` (`x-api-version: 2`) | OGL | Mean venue rating ≤2km |
| iNaturalist | 16 (22) | `api.inaturalist.org/v1/observations` | CC0/CC-BY | Verifiable observations ≤10km |

## Live context connectors (keyless)

| Source | Rank | Endpoint | Card context produced |
|---|---|---|---|
| postcodes.io | (enabler) | `api.postcodes.io/postcodes?lon&lat` | Local authority, LSOA, constituency |
| English IMD 2025 | 1 (25) | Vendored File 7 CSV → `data/imd2025-lsoa.json` (live SPARQL cert expired upstream) | IMD decile/score/rank for the LSOA |
| HM Land Registry | 7 (23) | `landregistry.data.gov.uk/landregistry/query` SPARQL | Price-paid transaction count @ postcode |
| data.gov.uk CKAN | 7 (23) | `data.gov.uk/api/action/package_search` | Dataset count mentioning the place |
| ONS Beta | 7 (23) | `api.beta.ons.gov.uk/v1/datasets` | Published-dataset surface count |
| geoBoundaries | 7 (23) | `geoboundaries.org/api/current/gbOpen` | Admin-boundary reference |
| Climate TRACE | 3 (24) | `api.climatetrace.org/v6/country/emissions` | National CO₂ context |
| GLEIF | 7 (23) | `api.gleif.org/api/v1/lei-records` | LEI matches for a named entity |

## Registered, key-gated (activate when secrets land)

| Source | Rank | Env var | Provider |
|---|---|---|---|
| Companies House | 7 (23) | `COMPANIES_HOUSE_KEY` | `api.company-information.service.gov.uk` |
| OS Data Hub | 7 (23) | `OS_DATAHUB_KEY` | `api.os.uk` places/geocode |
| EO Data Hub (SatCat) | mentor | `EODATAHUB_KEY` | `api.eodatahub.org.uk` STAC — Sentinel-2, EOCIS LST |
| Alpha-Klima | mentor | `ALPHAKLIMA_KEY` | `platform.alpha-klima.com/prapi` — physrisk hazards to 2085 |
| Natural England | 16 (22) | `DEFRA_KEY` | NE Open Data Geoportal — designated sites |
| OnePlanet | mentor | `ONEPLANET_API_KEY` | `mcp.oneplanet.com/mcp` — client verified against `vendor/oneplanet-mcp-guide.pdf` |

## Valuation benchmarks (cited, on-card)

Published figures attached to GB cards as verified context + used by the
coordinated-value block — see `VALUATION.md` for methodology.

| Figure | Value | Source |
|---|---|---|
| Volunteer time rate | £14.43/h | ONS Household Satellite Accounts (2017) — cited by NCVO; DCMS replacement-cost method |
| Avg flood damage per home | £30,000 | Environment Agency; corroborated by ABI 2025 claims data |
| Avg flood damage per business | £82,000 | Environment Agency |
| Properties at flood risk in England | 5.2M | Environment Agency |

## Already live (pre-existing registry)

OpenAQ, Sensor.Community, NASA POWER, Sentinel-2 (earth-search STAC),
World Bank, GBIF, envhealth-atlas, Treegens, Silvi + LEAF — see
`packages/oracle/src/sources.ts`.

## Notes

- EA Flood Monitoring has **no safety-critical SLA** (per the catalogue);
  readings corroborate — never gate — coordination.
- Every reader is fail-soft: a dead API returns `null`, never an error
  that breaks the loop.
- `POST /possibilities/:id/context/refresh` re-pulls context for any card
  with an h3-located need (or explicit `lat/lon`).
