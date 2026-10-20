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

Rules:

- A methodologyRef is a *claim about method*, not a verdict — readings
  are evidence for human review, never auto-truth.
- New sources register here with the public spec link before merging.
- `EXPECTED_DIRECTION` in `packages/oracle/src/sources.ts` must agree.
