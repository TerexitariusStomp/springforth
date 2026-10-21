# Methodology registry

Every `OracleCheck.methodologyRef` and `SourceReading.methodologyRef`
names the public method behind the reading. This file is the registry
— Regen-style methodology transparency without credit issuance.

| methodologyRef | Source | Method | Direction |
|---|---|---|---|
| `openaq` | OpenAQ API | Ground-station air quality (PM2.5 µg/m³) | decrease |
| `sensor.community` | Sensor.Community | Crowdsourced PM sensor density | decrease |
| `NASA POWER` | NASA POWER API | Satellite solar/meteo reanalysis | contextual |
| `Sentinel-2 L2A` | Earth Search STAC | NDVI / vegetation index via titiler | increase |
| `gbif` | GBIF occurrence API | Species occurrence count within radius | increase |
| `worldbank` | World Bank indicators | Published development indicator | contextual |
| `treegens` | treegens.app feed | Filmed / AI-counted / DAO-verified plantings | increase |
| `envhealth-atlas` | envhealth-atlas | Composite environmental-hazard index | decrease |
| `silvi` | Silvi App API | Silvi-verified tree counts (per-project key) | increase |
| `silvi-leaf` | Treekipedia LEAF | Species aptness 0–100 (GBIF+WCVP+WWF) | increase |
| `aave-atoken` | Aave v3 on-chain | `balanceOf` delta = observed yield | increase |
| `superfluid-cfa` | Superfluid CFA | elapsed time × flowRate accrual | increase |
| `ea-flood` | EA Flood Monitoring | Severity-weighted active warnings within 40km (no safety-critical SLA — corroborative) | decrease |
| `open-meteo` | Open-Meteo | ERA5+IFS blend; 7-day precipitation sum | decrease |
| `ea-water-quality` | EA Water Quality Archive | Regulated sampling-point density (GeoSPARQL, ld+json) | flat |
| `food-hygiene` | FSA FHRS | Mean venue hygiene rating within radius | increase |
| `inaturalist` | iNaturalist v1 | Verifiable citizen-science observations within radius | increase |
| `os-datahub` | OS Data Hub Places | Gazetteer coverage (env-gated: `OS_DATAHUB_KEY`) | flat |
| `eo-data-hub` | EO Data Hub (SatCat) | Latest Sentinel-2 scene via STAC (env-gated: `EODATAHUB_KEY`) | flat |
| `alpha-klima` | Alpha-Klima physrisk | Flood-hazard score, forward scenario (env-gated: `ALPHAKLIMA_KEY`) | decrease |
| `natural-england` | NE Open Data Geoportal | Designated-sites coverage (env-gated: `DEFRA_KEY`) | flat |

Rules:

- A methodologyRef is a *claim about method*, not a verdict — readings
  are evidence for human review, never auto-truth.
- New sources register here with the public spec link before merging.
- `EXPECTED_DIRECTION` in `packages/oracle/src/sources.ts` must agree.
