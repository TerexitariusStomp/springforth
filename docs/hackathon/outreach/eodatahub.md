# Draft — EO Data Hub access (Satellite Applications Catapult)

**To:** hackathon mentor lane (Liz Scott / Isabelle CrozierMorris /
Luisa Doughty / Anuradha DamaleDay @ sa.catapult.org.uk)

**Subject:** SF.Live PS1 — EO Data Hub API access for a live evidence lane

Hello,

We're a PS1 team at the Sustainable Finance Live hackathon. Our platform
coordinates community action and verifies outcomes against public
evidence. We're already reading Sentinel-2 via the public earth-search
STAC; we'd like to add the EO Data Hub as a second endorsed lane —
Sentinel-2 scenes plus EOCIS Land Surface Temperature / land cover for a
UK flood-response demo card (Shrewsbury, River Severn).

Our STAC client pattern is already running — `POST /stac/search` with an
intersects point + sortby datetime — so we mostly need:

1. An **API key / account** for `api.eodatahub.org.uk` (or the correct
   endpoint shape if it differs).
2. Pointer to the **EOCIS collections** most relevant to flood/heat
   evidence.

We'll wire it as `EODATAHUB_KEY` on our edge worker; the source is
registered and fail-softs until the key lands.

Live demo: https://springforth.widespread.workers.dev · repo:
github.com/TerexitariusStomp/springforth (oracle lane: `src/oracle.ts`).

Thanks!
— Team Two
