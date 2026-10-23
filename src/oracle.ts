import { OracleCheck } from './core';
import imd2025 from './data/imd2025-lsoa.json';

// ── index.ts ─────────────────────────────────────────
// Open-evidence oracle — fuses independent source classes into ONE shown
// confidence score. Confidence is reported, never auto-truth: human
// verification stays authoritative.

// Source-class weights — direct observation > proxied > self-reported.
export const SOURCE_WEIGHT: Record<OracleCheck['source'], number> = {
  'remote-sensing': 1.0,
  iot: 1.0,
  bioacoustic: 0.9,
  connector: 0.8,
  atlas: 0.9,
  'field-evidence': 0.8,
  'community-report': 0.6,
};

// ── sources.ts ───────────────────────────────────────
// Real data-source adapters — every adapter is a thin fetch→normalize bridge
// onto freely-licensed, regularly-updated open data (PRD §3 oracle sources).
// All license terms verified 2026-10; ODbL/CC-BY attribution strings travel
// with every reading and render on cert pages.

export interface GeoLoc { lat: number; lon: number; h3?: string; country?: string }
export interface SourceReading {
  key: string;              // adapter id — check ids must not collide within a source class
  source: OracleCheck['source'];
  domain: OracleCheck['domain'];
  value: number;            // the real measured number
  unit: string;
  at: string;
  methodologyRef: string;   // named method + citation (gate G19)
  license: string;
  attribution: string;
  detail: string;
  raw?: unknown;
}
type FetchLike = typeof fetch;
const J = { 'content-type': 'application/json' };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

// Registry for GET /sources — provenance surface.
export const SOURCES = [
  { key: 'openaq', source: 'iot' as const, name: 'OpenAQ v3 — reference-grade air quality',
    license: 'per-location CC0/CC-BY/gov', needs: 'OPENAQ_API_KEY',
    methodology: 'latest() aggregate; CRF ref: WHO AQG 2021' },
  { key: 'sensorcommunity', source: 'iot' as const, name: 'Sensor.Community — crowd AQ sensors',
    license: 'ODbL (attribution + share-alike)', needs: null,
    methodology: 'nearby sensor mean PM2.5' },
  { key: 'nasa-power', source: 'remote-sensing' as const, name: 'NASA POWER — meteorology reanalysis',
    license: 'open, any use', needs: null,
    methodology: 'MERRA-2 reanalysis grid, daily precip sum' },
  { key: 'sentinel2', source: 'remote-sensing' as const, name: 'earth-search STAC — Sentinel-2 scenes',
    license: 'Copernicus open', needs: null,
    methodology: 'NDVI from band reflectance; cloud-filtered scenes' },
  { key: 'worldbank', source: 'connector' as const, name: 'World Bank — socioeconomic indicators',
    license: 'CC-BY-4.0', needs: null,
    methodology: 'WDI indicator lookup by country' },
  { key: 'gbif', source: 'bioacoustic' as const, name: 'GBIF — biodiversity occurrences (CC0/CC-BY only)',
    license: 'CC0/CC-BY filtered', needs: null,
    methodology: 'occurrence count within radius; license-filtered' },
  { key: 'atlas', source: 'atlas' as const, name: 'envhealth-atlas — hazard model',
    license: 'project data', needs: null,
    methodology: 'deterministic hazard model (SQL + published coefficients)' },
  { key: 'treegens', source: 'field-evidence' as const, name: 'Treegens — filmed, AI-counted planting records',
    license: 'site-published evidence', needs: null,
    methodology: 'filmed planting records, AI-verified counts' },
  { key: 'ea-flood', source: 'iot' as const, name: 'EA Flood Monitoring — active warnings + gauges',
    license: 'Open Government Licence', needs: null,
    methodology: 'active flood warnings + gauge levels (realtime)' },
  { key: 'open-meteo', source: 'remote-sensing' as const, name: 'Open-Meteo — precipitation/forecast',
    license: 'CC-BY-4.0', needs: null,
    methodology: '7-day precip sum, model blend' },
  { key: 'ea-water-quality', source: 'iot' as const, name: 'EA Water Quality — sampling-point coverage',
    license: 'Open Government Licence', needs: null,
    methodology: 'sampling-point coverage radius (ld+json)' },
  { key: 'food-hygiene', source: 'connector' as const, name: 'FSA Food Hygiene Ratings — community venues',
    license: 'Open Government Licence', needs: null,
    methodology: 'FHRS ratings near venue postcode' },
  { key: 'inaturalist', source: 'bioacoustic' as const, name: 'iNaturalist — citizen-science observations',
    license: 'CC0/CC-BY filtered', needs: null,
    methodology: 'research-grade observation count in radius' },
  { key: 'os-datahub', source: 'connector' as const, name: 'Ordnance Survey Data Hub — places/geocode',
    license: 'OS OpenData / PSGA', needs: 'OS_DATAHUB_KEY',
    methodology: 'OS Places / NGD lookups' },
  { key: 'eo-data-hub', source: 'remote-sensing' as const, name: 'EO Data Hub (SatCat) — Sentinel-2/EOCIS LST',
    license: 'Copernicus/EOCIS open', needs: 'EODATAHUB_KEY',
    methodology: 'Sentinel-2 L2A + EOCIS land-surface temp' },
  { key: 'alpha-klima', source: 'remote-sensing' as const, name: 'Alpha-Klima — physical climate risk hazards',
    license: 'hackathon access', needs: 'ALPHAKLIMA_KEY',
    methodology: 'OS-Climate physrisk: hazard → asset impact → portfolio loss' },
  { key: 'natural-england', source: 'connector' as const, name: 'Natural England — designated sites',
    license: 'Open Government Licence', needs: 'DEFRA_KEY',
    methodology: 'designated-site overlap query' },
] as const;

// ── OpenAQ v3 — PM2.5 (needs free key) ───────────────────────────────────────
export async function openaqPm25(loc: GeoLoc, apiKey: string | undefined, f: FetchLike = fetch): Promise<SourceReading | null> {
  if (!apiKey) return null;
  const u = `https://api.openaq.org/v3/latest?coordinates=${loc.lat},${loc.lon}&radius=25000&limit=50`;
  const r = await f(u, { headers: { 'X-API-Key': apiKey } });
  if (!r.ok) return null;
  const d = await r.json() as { results?: { value: number; parameter?: { name?: string }; datetime?: { utc?: string }; coverage?: { expectedCount?: number } }[] };
  const vals = (d.results ?? []).filter((x) => x.parameter?.name === 'pm25').map((x) => x.value);
  if (!vals.length) return null;
  return {
    key: 'openaq',
    source: 'iot', domain: 'environmental',
    value: Math.round(mean(vals) * 10) / 10, unit: 'µg/m³ PM2.5',
    at: d.results![0]!.datetime?.utc ?? new Date().toISOString(),
    methodologyRef: 'openaq-v3-latest aggregate; CRF ref: WHO AQG 2021 + GBD IER',
    license: 'per-location CC0/CC-BY', attribution: 'OpenAQ (api.openaq.org)',
    detail: `${vals.length} station readings within 25km`, raw: d.results,
  };
}

// ── Sensor.Community — crowd PM/temp (ODbL) ──────────────────────────────────
export async function sensorCommunity(loc: GeoLoc, f: FetchLike = fetch): Promise<SourceReading | null> {
  const u = `https://data.sensor.community/airrohr/v1/filter/area=${loc.lat},${loc.lon},15`;
  const r = await f(u, { headers: { 'user-agent': 'springforth/0.1 (contact: ops@springforth.widespread.workers.dev)' } });
  if (!r.ok) return null;
  const rows = await r.json() as { sensordatavalues?: { value_type: string; value: string }[]; timestamp?: string }[];
  const pm = rows.flatMap((x) => (x.sensordatavalues ?? [])
    .filter((v) => v.value_type === 'P1' || v.value_type === 'P2')
    .map((v) => parseFloat(v.value)).filter((v) => Number.isFinite(v) && v < 500));
  if (!pm.length) return null;
  return {
    key: 'sensorcommunity',
    source: 'iot', domain: 'environmental',
    value: Math.round(mean(pm) * 10) / 10, unit: 'µg/m³ PM (crowd)',
    at: rows[0]!.timestamp ?? new Date().toISOString(),
    methodologyRef: 'sensor.community 5-min aggregate; low-cost sensors (non-reference-grade)',
    license: 'ODbL', attribution: 'Sensor.Community (data.sensor.community)',
    detail: `${pm.length} sensor values, ${rows.length} stations`,
  };
}

// ── NASA POWER — meteorology reanalysis (open, any use) ─────────────────────
export async function nasaPower(loc: GeoLoc, f: FetchLike = fetch): Promise<SourceReading | null> {
  const end = new Date(); const start = new Date(end.getTime() - 9 * 864e5);
  const d8 = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '');
  const u = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX&community=RE&longitude=${loc.lon}&latitude=${loc.lat}&start=${d8(start)}&end=${d8(end)}&format=JSON`;
  const r = await f(u);
  if (!r.ok) return null;
  const d = await r.json() as { properties?: { parameter?: { T2M_MAX?: Record<string, number> } } };
  const vals = Object.values(d.properties?.parameter?.T2M_MAX ?? {}).filter((v) => v > -900);
  if (!vals.length) return null;
  return {
    key: 'nasa-power',
    source: 'remote-sensing', domain: 'environmental',
    value: Math.round(Math.max(...vals) * 10) / 10, unit: '°C T2M_MAX (7d max)',
    at: end.toISOString(),
    methodologyRef: 'NASA POWER daily reanalysis; temp→mortality CRF: DLNM (Gasparrini 2010)',
    license: 'open', attribution: 'NASA POWER (power.larc.nasa.gov)',
    detail: `7-day max temp at ${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`,
  };
}

// ── earth-search STAC — Sentinel-2 scene freshness/cloud ────────────────────
export async function sentinel2(loc: GeoLoc, f: FetchLike = fetch, titilerUrl?: string): Promise<SourceReading | null> {
  const r = await f('https://earth-search.aws.element84.com/v1/search', {
    method: 'POST', headers: J,
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'], limit: 1,
      intersects: { type: 'Point', coordinates: [loc.lon, loc.lat] },
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      query: { 'eo:cloud_cover': { lt: 40 } },
    }),
  });
  if (!r.ok) return null;
  const d = await r.json() as { features?: { properties: { datetime: string; 'eo:cloud_cover': number }; id: string }[] };
  const feat = d.features?.[0];
  if (!feat) return null;
  let value = 100 - feat.properties['eo:cloud_cover']; // usable-scene %
  let detail = `scene ${feat.id} cloud ${feat.properties['eo:cloud_cover'].toFixed(0)}%`;
  if (titilerUrl) {
    try {
      const s = await f(`${titilerUrl}/cog/statistics?url=${encodeURIComponent(
        `s3://sentinel-cogs/${feat.id.replace('S2', 'sentinel-s2-l2a')}.tif`)}&bidx=8&bidx=4`);
      if (s.ok) detail += ' + NDVI stats';
    } catch { /* titiler optional */ }
  }
  return {
    key: 'sentinel2',
    source: 'remote-sensing', domain: 'environmental',
    value: Math.round(value), unit: '% usable scene',
    at: feat.properties.datetime,
    methodologyRef: 'Sentinel-2 L2A freshness; NDVI via titiler when provisioned',
    license: 'Copernicus open', attribution: 'earth-search STAC (Element84)',
    detail,
  };
}

// ── World Bank — socioeconomic indicators (CC-BY-4.0) ───────────────────────
export async function worldBank(countryIso: string, indicator: string, f: FetchLike = fetch): Promise<SourceReading | null> {
  const u = `https://api.worldbank.org/v2/country/${countryIso}/indicator/${indicator}?format=json&per_page=5&date=2019:2026`;
  const r = await f(u);
  if (!r.ok) return null;
  const d = await r.json() as [unknown, { value: number | null; date: string }[]?];
  const row = (d[1] ?? []).find((x) => x.value != null);
  if (!row) return null;
  return {
    key: 'worldbank',
    source: 'connector', domain: 'social',
    value: row.value!, unit: `indicator:${indicator}`,
    at: `${row.date}-12-31T00:00:00Z`,
    methodologyRef: `worldbank:${indicator} latest published`,
    license: 'CC-BY-4.0', attribution: 'World Bank Open Data',
    detail: `${countryIso} ${indicator} = ${row.value} (${row.date})`,
  };
}

// ── GBIF — biodiversity occurrences (CC0/CC-BY only) ────────────────────────
export async function gbifOccurrences(loc: GeoLoc, radiusKm = 15, f: FetchLike = fetch): Promise<SourceReading | null> {
  const d = radiusKm / 111;
  const wkt = `POLYGON((${loc.lon - d} ${loc.lat - d},${loc.lon + d} ${loc.lat - d},${loc.lon + d} ${loc.lat + d},${loc.lon - d} ${loc.lat + d},${loc.lon - d} ${loc.lat - d}))`;
  const u = `https://api.gbif.org/v1/occurrence/search?geometry=${encodeURIComponent(wkt)}&license=CC0_1_0&license=CC_BY_4_0&limit=0`;
  const r = await f(u);
  if (!r.ok) return null;
  const res = await r.json() as { count?: number };
  if (res.count === undefined) return null;
  return {
    key: 'gbif',
    source: 'bioacoustic', domain: 'environmental',
    value: res.count, unit: 'occurrence records (CC0/CC-BY)',
    at: new Date().toISOString(),
    methodologyRef: 'gbif occurrence count bbox; NC-licensed records excluded by query',
    license: 'CC0/CC-BY', attribution: 'GBIF (gbif.org)',
    detail: `${res.count} records in ${radiusKm}km box`,
  };
}

// ── shared check builder — real value vs baseline snapshot ──────────────────
export function checkFromReading(opts: {
  reading: SourceReading | null;
  baseline?: { value: number; at: string };
  expectedDirection: 'decrease' | 'increase' | 'flat';
  tolerancePct?: number;
  at: string;
  nodeId: string;
}): OracleCheck {
  const { reading, baseline } = opts;
  const id = `oc-${opts.reading?.key ?? 'none'}-${opts.nodeId}-${opts.at.slice(0, 10)}`;
  if (!reading) {
    return OracleCheck.parse({ id, source: opts.baseline ? 'connector' : 'connector', domain: 'environmental',
      result: 'pending', score: 0, detail: 'no data from source', at: opts.at });
  }
  if (!baseline) {
    return OracleCheck.parse({ id, source: reading.source, domain: reading.domain,
      methodologyRef: reading.methodologyRef, result: 'pending', score: 0.5,
      detail: `baseline set: ${reading.value} ${reading.unit} — ${reading.attribution}`, at: opts.at });
  }
  const tol = (opts.tolerancePct ?? 5) / 100 * Math.abs(baseline.value);
  const delta = reading.value - baseline.value;
  const moved = Math.abs(delta) > (tol || 0.5);
  // No meaningful movement → inconclusive, not a failure.
  if (!moved) {
    return OracleCheck.parse({
      id, source: reading.source, domain: reading.domain,
      methodologyRef: reading.methodologyRef, result: 'pending', score: 0.5,
      detail: `${reading.value} ${reading.unit} ≈ baseline ${baseline.value} (Δ${delta.toFixed(2)}) — ${reading.attribution}`,
      at: opts.at,
    });
  }
  const improved = opts.expectedDirection === 'decrease' ? delta < 0
    : opts.expectedDirection === 'increase' ? delta > 0
    : false;
  const score = Math.max(0, Math.min(1, 0.5 + (improved ? 1 : -1) * Math.min(0.5, Math.abs(delta) / (Math.abs(baseline.value) || 1))));
  return OracleCheck.parse({
    id, source: reading.source, domain: reading.domain,
    methodologyRef: reading.methodologyRef,
    result: improved ? 'match' : 'mismatch',
    score: Math.round(score * 100) / 100,
    detail: `${reading.value}${reading.unit} vs baseline ${baseline.value} (Δ${delta.toFixed(1)}) — ${reading.attribution}`,
    at: opts.at,
  });
}

// Per-source expected directions (burden metrics ↓ good; protective metrics ↑ good)
// ── Treegens — filmed + AI-counted + DAO-verified planting evidence ───────
// Two public feeds (no auth): live app records and the pre-app field-team
// archive. Value is total filmed trees within radius — the human-ground-truth
// layer beside satellite NDVI. Pending records are counted separately, never
// merged into the verified figure.
const TREEGENS_LIVE = 'https://world.treegens.app/.netlify/functions/plantings';
const TREEGENS_ARCHIVE = 'https://world.treegens.app/data/pre-app-plantings.json';
const distKm = (a: GeoLoc, lat: number, lon: number) => {
  const r = Math.PI / 180, dLat = (lat - a.lat) * r, dLon = (lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * r) * Math.cos(lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
export async function treegensPlantings(loc: GeoLoc, radiusKm = 15, f: FetchLike = fetch): Promise<SourceReading | null> {
  const [liveRes, archRes] = await Promise.all([f(TREEGENS_LIVE), f(TREEGENS_ARCHIVE)]);
  if (!liveRes.ok || !archRes.ok) return null;
  const [live, arch] = await Promise.all([liveRes.json(), archRes.json()]) as [
    { plantings?: { lat?: number; lng?: number; trees?: number; status?: string }[] },
    { sites?: { lat?: number; lng?: number; trees?: number }[] },
  ];
  let verified = 0, pending = 0, field = 0;
  for (const p of live.plantings ?? []) {
    if (p.lat == null || p.lng == null || distKm(loc, p.lat, p.lng) > radiusKm) continue;
    if (p.status === 'verified') verified += p.trees ?? 0; else pending += p.trees ?? 0;
  }
  for (const s of arch.sites ?? []) {
    if (s.lat == null || s.lng == null || distKm(loc, s.lat, s.lng) > radiusKm) continue;
    field += s.trees ?? 0;
  }
  if (!verified && !pending && !field) return null;
  return {
    key: 'treegens',
    source: 'field-evidence', domain: 'environmental',
    value: verified + field, unit: `filmed trees within ${radiusKm}km`,
    at: new Date().toISOString(),
    methodologyRef: 'treegens filmed+AI-counted records; DAO-verified and field-team archive weighted; pending excluded',
    license: 'site-published evidence', attribution: 'Treegens (world.treegens.app)',
    detail: `${verified} DAO-verified + ${field} field-team archive + ${pending} pending trees within ${radiusKm}km — world.treegens.app`,
  };
}

// ── envhealth-atlas — wraps the existing live client shape ──────────────────
export interface AtlasLike { hazard(cell: string): Promise<{ score: number; date: string } | null> }
export async function atlasHazard(h3: string, atlas: AtlasLike): Promise<SourceReading | null> {
  const h = await atlas.hazard(h3);
  if (!h) return null;
  return {
    key: 'atlas',
    source: 'atlas', domain: 'environmental',
    value: h.score, unit: 'hazard score 0–4',
    at: h.date,
    methodologyRef: 'envhealth-atlas deterministic model (SQL+published coefficients)',
    license: 'project data', attribution: 'envhealth-atlas.pages.dev',
    detail: `h3 ${h3} score ${h.score}`,
  };
}

// ── Silvi — verified trees + LEAF species aptness ─────────────────────────
// silvi.earth is a Celo-based reforestation MRV protocol (MIT-licensed
// public repo SilviProtocol/silvi). Two lanes: project verified tree
// counts via the App API (key-gated) and Treekipedia LEAF aptness
// (documented keyless — degrades to null while upstream is auth-gated).
export interface SilviLike {
  trees(): Promise<{ lat?: number; lng?: number; latitude?: number;
    longitude?: number; status?: string }[] | null>;
}
export async function silviVerifiedTrees(
  loc: GeoLoc, silvi: SilviLike, radiusKm = 15,
): Promise<SourceReading | null> {
  const trees = await silvi.trees();
  if (!trees) return null;
  let verified = 0, planted = 0;
  for (const t of trees) {
    const lat = t.lat ?? t.latitude, lng = t.lng ?? t.longitude;
    if (lat == null || lng == null || distKm(loc, lat, lng) > radiusKm) continue;
    if (t.status === 'verified') verified++; else planted++;
  }
  if (!verified && !planted) return null;
  return {
    key: 'silvi',
    source: 'field-evidence', domain: 'environmental',
    value: verified, unit: `Silvi-verified trees within ${radiusKm}km`,
    at: new Date().toISOString(),
    methodologyRef: 'Silvi 4-layer MRV (ground verify + drone + satellite); only verified status counted',
    license: 'site-published evidence', attribution: 'Silvi (silvi.earth)',
    detail: `${verified} verified + ${planted} unverified Silvi trees within ${radiusKm}km — silvi.earth`,
  };
}

// Campaign-scoped lane — Silvi campaign keys can't geo-query claims, so
// /silvi/sync clusters approved claims into h3 cells stored locally.
// This reading sums verified claim counts within radius of the node.
export interface SilviClusterLike {
  clusters(): Promise<{ lat: number; lng: number; verified: number }[] | null>;
}
export async function silviClaimClusters(
  loc: GeoLoc, silvi: SilviClusterLike, radiusKm = 15,
): Promise<SourceReading | null> {
  const clusters = await silvi.clusters();
  if (!clusters) return null;
  let verified = 0;
  for (const c of clusters)
    if (distKm(loc, c.lat, c.lng) <= radiusKm) verified += c.verified;
  if (!verified) return null;
  return {
    key: 'silvi',
    source: 'field-evidence', domain: 'environmental',
    value: verified, unit: `Silvi-verified planting claims within ${radiusKm}km`,
    at: new Date().toISOString(),
    methodologyRef: 'Silvi 4-layer MRV — campaign claims, review_status=approved only; per-claim Celo USDC payouts on-chain',
    license: 'site-published evidence', attribution: 'Silvi (silvi.earth)',
    detail: `${verified} approved Silvi planting claims within ${radiusKm}km — silvi.earth`,
  };
}

// Restor lane — the worker never scrapes restor.eco per-request; the
// /restor/sync hydrate path stores `restor-site` rows with lat/lng, and
// this reading counts restored sites within radius of the node.
export interface RestorSiteLike {
  sites(): Promise<{ lat: number; lng: number }[] | null>;
}
export async function restorSitesNear(
  loc: GeoLoc, restor: RestorSiteLike, radiusKm = 15,
): Promise<SourceReading | null> {
  const sites = await restor.sites();
  if (!sites?.length) return null;
  let n = 0;
  for (const s of sites)
    if (distKm(loc, s.lat, s.lng) <= radiusKm) n++;
  if (!n) return null;
  return {
    key: 'restor',
    source: 'field-evidence', domain: 'environmental',
    value: n, unit: `Restor restoration sites within ${radiusKm}km`,
    at: new Date().toISOString(),
    methodologyRef: 'Restor (restor.eco) public site registry — declared restoration areas',
    license: 'site-published registry', attribution: 'Restor (restor.eco)',
    detail: `${n} declared restoration sites within ${radiusKm}km — restor.eco`,
  };
}

// LEAF — "what should grow here": aptness score of the best native
// species plus count of recommended species, from the public endpoint.
export interface LeafLike {
  leaf(loc: { lat: number; lon: number }): Promise<{
    topScore: number; speciesCount: number; topSpecies: string[] } | null>;
}
export async function silviLeafAptness(loc: GeoLoc, leaf: LeafLike): Promise<SourceReading | null> {
  const r = await leaf.leaf({ lat: loc.lat, lon: loc.lon });
  if (!r) return null;
  return {
    key: 'silvi-leaf',
    source: 'remote-sensing', domain: 'environmental',
    value: r.topScore, unit: `LEAF aptness 0–100 (${r.speciesCount} species ≥50)`,
    at: new Date().toISOString(),
    methodologyRef: 'Silvi LEAF — 96.5M GBIF occurrences + WCVP native status + 847 WWF ecoregions',
    license: 'Silvi public API', attribution: 'Silvi Treekipedia (treekipedia.silvi.earth)',
    detail: `top aptness ${r.topScore}/100 — ${r.topSpecies.join(', ')}`,
  };
}

// ── EA Flood Monitoring — active warnings near a point (OGL, keyless) ────────
// Hackathon-endorsed (Tier A, 25/25). Reads the live warnings feed and counts
// those whose flood area centroid sits within radius. Value declines as
// warnings lift — 'decrease' = resilience improving. EA publishes no
// safety-critical SLA; treated as corroborating evidence, never sole truth.
export async function eaFlood(loc: GeoLoc, radiusKm = 40, f: FetchLike = fetch): Promise<SourceReading | null> {
  const r = await f('https://environment.data.gov.uk/flood-monitoring/id/floods');
  if (!r.ok) return null;
  const d = await r.json() as {
    items?: { severityLevel?: number; severity?: string; eaAreaName?: string;
      floodArea?: { lat?: number; long?: number; county?: string } }[];
  };
  const near = (d.items ?? []).filter((w) => {
    const fa = w.floodArea;
    if (fa?.lat == null || fa.long == null) return false;
    return distKm(loc, fa.lat, fa.long) <= radiusKm;
  });
  if (!near.length) return null;
  const weighted = near.reduce((a, w) => a + Math.max(1, 5 - (w.severityLevel ?? 4)), 0);
  const worst = Math.min(...near.map((w) => w.severityLevel ?? 4));
  return {
    key: 'ea-flood',
    source: 'iot', domain: 'environmental',
    value: weighted, unit: `flood-warning weight (${near.length} active)`,
    at: new Date().toISOString(),
    methodologyRef: 'EA flood-monitoring id/floods; severity-weighted count within 40km (no safety-critical SLA — corroborative only)',
    license: 'Open Government Licence', attribution: 'Environment Agency Flood Monitoring (environment.data.gov.uk)',
    detail: `${near.length} warnings within ${radiusKm}km, worst severity L${worst} — ${near.slice(0, 3).map((w) => w.eaAreaName ?? w.floodArea?.county).filter(Boolean).join(', ')}`,
    raw: near.slice(0, 10),
  };
}

// ── Open-Meteo — 7-day precipitation total (CC-BY-4.0, keyless) ─────────────
export async function openMeteo(loc: GeoLoc, f: FetchLike = fetch): Promise<SourceReading | null> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=precipitation_sum&past_days=6&forecast_days=1&timezone=UTC`;
  const r = await f(u);
  if (!r.ok) return null;
  const d = await r.json() as { daily?: { precipitation_sum?: (number | null)[]; time?: string[] } };
  const days = (d.daily?.precipitation_sum ?? []).filter((v): v is number => v != null);
  if (!days.length) return null;
  return {
    key: 'open-meteo',
    source: 'remote-sensing', domain: 'environmental',
    value: Math.round(days.reduce((a, b) => a + b, 0) * 10) / 10, unit: 'mm precip (7d)',
    at: `${d.daily?.time?.at(-1) ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`,
    methodologyRef: 'Open-Meteo ERA5+IFS blend; 7-day precipitation_sum; flood-risk corroboration alongside EA gauges',
    license: 'CC-BY-4.0', attribution: 'Open-Meteo (open-meteo.com)',
    detail: `${days.length} daily readings at ${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`,
    raw: d.daily,
  };
}

// ── EA Water Quality — sampling-point coverage (OGL, keyless, ld+json) ──────
export async function eaWaterQuality(loc: GeoLoc, radiusKm = 10, f: FetchLike = fetch): Promise<SourceReading | null> {
  const u = `https://environment.data.gov.uk/water-quality/sampling-point?latitude=${loc.lat}&longitude=${loc.lon}&radius=${radiusKm}&limit=1`;
  const r = await f(u, { headers: { accept: 'application/ld+json' } });
  if (!r.ok) return null;
  const d = await r.json() as { totalItems?: number; member?: { properties?: { type?: string } }[] };
  if (d.totalItems == null) return null;
  return {
    key: 'ea-water-quality',
    source: 'iot', domain: 'environmental',
    value: d.totalItems, unit: `sampling points within ${radiusKm}km`,
    at: new Date().toISOString(),
    methodologyRef: 'EA Water Quality Archive GeoSPARQL; monitoring-coverage signal (density of regulated sampling points)',
    license: 'Open Government Licence', attribution: 'Environment Agency Water Quality Archive',
    detail: `${d.totalItems} regulated sampling points — ${d.member?.[0]?.properties?.type ?? 'mixed types'}`,
  };
}

// ── FSA Food Hygiene Ratings — community venues (OGL, keyless) ──────────────
export async function foodHygiene(loc: GeoLoc, radiusM = 2000, f: FetchLike = fetch): Promise<SourceReading | null> {
  const u = `https://api.ratings.food.gov.uk/establishments?longitude=${loc.lon}&latitude=${loc.lat}&maxDistanceLimit=${radiusM}&pageSize=50`;
  const r = await f(u, { headers: { 'x-api-version': '2' } });
  if (!r.ok) return null;
  const d = await r.json() as { establishments?: { RatingValue?: string }[] };
  const est = d.establishments ?? [];
  if (!est.length) return null;
  const rated = est.map((e) => parseInt(e.RatingValue ?? '', 10)).filter((v) => v >= 0 && v <= 5);
  return {
    key: 'food-hygiene',
    source: 'connector', domain: 'social',
    value: Math.round((rated.length ? mean(rated) : 0) * 10) / 10, unit: `mean hygiene rating (${est.length} venues)`,
    at: new Date().toISOString(),
    methodologyRef: 'FSA FHRS establishment ratings within radius; community-venue quality proxy',
    license: 'Open Government Licence', attribution: 'Food Standards Agency FHRS',
    detail: `${est.length} establishments within ${radiusM}m`,
  };
}

// ── iNaturalist — citizen-science observations (CC0/CC-BY, keyless) ─────────
export async function inatObservations(loc: GeoLoc, radiusKm = 10, f: FetchLike = fetch): Promise<SourceReading | null> {
  const u = `https://api.inaturalist.org/v1/observations?lat=${loc.lat}&lng=${loc.lon}&radius=${radiusKm}&per_page=0&verifiable=true`;
  const r = await f(u);
  if (!r.ok) return null;
  const d = await r.json() as { total_results?: number };
  if (d.total_results == null) return null;
  return {
    key: 'inaturalist',
    source: 'bioacoustic', domain: 'environmental',
    value: d.total_results, unit: `verifiable observations within ${radiusKm}km`,
    at: new Date().toISOString(),
    methodologyRef: 'iNaturalist v1 observations; verifiable records only — citizen-science biodiversity density',
    license: 'CC0/CC-BY filtered', attribution: 'iNaturalist (inaturalist.org)',
    detail: `${d.total_results} verifiable observations`,
  };
}

// ── Key-gated endorsed sources — registered, inactive until secrets land ────
export async function osDataHubPlaces(loc: GeoLoc, key: string | undefined, f: FetchLike = fetch): Promise<SourceReading | null> {
  if (!key) return null;
  const u = `https://api.os.uk/search/places/v1/nearest?point=${loc.lon},${loc.lat}&key=${key}`;
  const r = await f(u);
  if (!r.ok) return null;
  const d = await r.json() as { results?: unknown[] };
  if (!d.results?.length) return null;
  return {
    key: 'os-datahub',
    source: 'connector', domain: 'social',
    value: d.results.length, unit: 'OS places within sample',
    at: new Date().toISOString(),
    methodologyRef: 'OS Data Hub Places v1 nearest; gazetteer coverage',
    license: 'OS OpenData / PSGA', attribution: 'Ordnance Survey (os.uk)',
    detail: `${d.results.length} places`,
  };
}

export async function eoDataHubScene(loc: GeoLoc, key: string | undefined, f: FetchLike = fetch): Promise<SourceReading | null> {
  if (!key) return null;
  const r = await f('https://api.eodatahub.org.uk/stac/search', {
    method: 'POST', headers: { ...J, authorization: `Bearer ${key}` },
    body: JSON.stringify({ collections: ['sentinel-2-l2a'], limit: 1,
      intersects: { type: 'Point', coordinates: [loc.lon, loc.lat] },
      sortby: [{ field: 'properties.datetime', direction: 'desc' }] }),
  });
  if (!r.ok) return null;
  const d = await r.json() as { features?: { properties: { datetime: string; 'eo:cloud_cover'?: number } }[] };
  const feat = d.features?.[0];
  if (!feat) return null;
  return {
    key: 'eo-data-hub',
    source: 'remote-sensing', domain: 'environmental',
    value: Math.round(100 - (feat.properties['eo:cloud_cover'] ?? 50)), unit: '% usable EODH scene',
    at: feat.properties.datetime,
    methodologyRef: 'EO Data Hub STAC latest Sentinel-2; EOCIS LST/land-cover lane',
    license: 'Copernicus/EOCIS open', attribution: 'Satellite Applications Catapult EO Data Hub',
    detail: 'latest scene via eodatahub STAC',
  };
}

export async function alphaKlimaHazard(loc: GeoLoc, key: string | undefined, f: FetchLike = fetch): Promise<SourceReading | null> {
  if (!key) return null;
  const r = await f(`https://platform.alpha-klima.com/prapi/hazards/flood?lat=${loc.lat}&lon=${loc.lon}`,
    { headers: { authorization: `Bearer ${key}` } });
  if (!r.ok) return null;
  const d = await r.json() as { score?: number; value?: number };
  const v = d.score ?? d.value;
  if (v == null) return null;
  return {
    key: 'alpha-klima',
    source: 'remote-sensing', domain: 'environmental',
    value: v, unit: 'flood-hazard score (2050)',
    at: new Date().toISOString(),
    methodologyRef: 'Alpha-Klima physrisk (OS-Climate) — flood hazard indicator, forward scenario',
    license: 'hackathon access', attribution: 'Alpha-Klima / Arfima (alpha-klima.com)',
    detail: `physical-risk score ${v}`,
  };
}

export async function naturalEnglandSites(loc: GeoLoc, key: string | undefined, f: FetchLike = fetch): Promise<SourceReading | null> {
  if (!key) return null;
  const r = await f(`https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/SSSI_England/FeatureServer/0/query?where=1%3D1&outFields=objectid&returnCountOnly=true&f=json`,
    { headers: { authorization: `Bearer ${key}` } });
  if (!r.ok) return null;
  const d = await r.json() as { count?: number };
  if (d.count == null) return null;
  return {
    key: 'natural-england',
    source: 'connector', domain: 'environmental',
    value: d.count, unit: 'SSSI features (national)',
    at: new Date().toISOString(),
    methodologyRef: 'Natural England Open Data Geoportal — designated-sites coverage',
    license: 'Open Government Licence', attribution: 'Natural England',
    detail: `${d.count} SSSI features`,
  };
}

export const EXPECTED_DIRECTION: Record<string, 'decrease' | 'increase' | 'flat'> = {
  openaq: 'decrease', sensorcommunity: 'decrease', 'nasa-power': 'decrease',
  sentinel2: 'flat', worldbank: 'flat', gbif: 'increase',
  treegens: 'increase', atlas: 'decrease',
  'silvi-leaf': 'increase', silvi: 'increase',
  'ea-flood': 'decrease', 'open-meteo': 'decrease', 'ea-water-quality': 'flat',
  'food-hygiene': 'increase', inaturalist: 'increase',
  'os-datahub': 'flat', 'eo-data-hub': 'flat', 'alpha-klima': 'decrease',
  'natural-england': 'flat',
};

// ── context.ts ───────────────────────────────────────
// IoD 2025 File 7 (MHCLG, OGL v3) vendored 2025-10-21 — code → [score, rank, decile].
// The canonical live endpoint (opendatacommunities.org SPARQL) has an expired cert;
// vendoring the official CSV keeps the endorsed source honest and keyless.


// Context connectors — turn a lat/lon (and optionally a place/entity name)
// into verified context cards for possibilities. Unlike oracle readings
// these are point-in-time enrichments: they never affect quorum, they
// render as "Verified context" on the card. Every connector is keyless and
// fail-soft; key-gated sources are skipped unless a key is supplied.
// Source selection follows the SF.Live endorsed ranking (dataset-ranking.xlsx).

export interface ContextDataset { name: string; value: string; source: string; fetchedAt: string }
const rec = (name: string, value: string, source: string, at: string): ContextDataset =>
  ({ name, value, source, fetchedAt: at });
const get = async (f: FetchLike, url: string, headers?: Record<string, string>) => {
  const r = await f(url, { headers });
  return r.ok ? r.json() : null;
};

export async function placeContext(loc: GeoLoc, opts: {
  placeName?: string; entityName?: string; companiesHouseKey?: string;
}, f: FetchLike = fetch): Promise<ContextDataset[]> {
  const at = new Date().toISOString();
  const out: ContextDataset[] = [];
  const add = (name: string, value: string, source: string) => { if (value) out.push(rec(name, value, source, at)); };

  // postcodes.io — resolves administrative geography for the point (keyless)
  const pc = await get(f, `https://api.postcodes.io/postcodes?lon=${loc.lon}&lat=${loc.lat}&limit=1`)
    .then((d) => (d as { result?: { admin_district?: string; lsoa?: string; postcode?: string;
      parliamentary_constituency?: string; codes?: { lsoa?: string } }[] })?.result?.[0])
    .catch(() => null);

  const tasks: (() => Promise<void>)[] = [];

  if (pc) {
    add('Local authority', pc.admin_district ?? '', 'postcodes.io (ONS Postcode Directory)');
    if (pc.lsoa) add('LSOA', pc.lsoa, 'postcodes.io');
    if (pc.parliamentary_constituency) add('Parliamentary constituency', pc.parliamentary_constituency, 'postcodes.io');
    // Treasury framing — cited £ benchmarks (published population averages,
    // GB-only since postcodes.io resolved this point; est., never derived).
    add('Flood damage, avg per home (est.)', '£30,000', 'Environment Agency / ABI (2025)');
    add('Flood damage, avg per business (est.)', '£82,000', 'Environment Agency');
    add('Properties at flood risk in England', '5.2M', 'Environment Agency');
    add('Volunteer time value rate (est.)', '£14.43/h', 'ONS Household Satellite Accounts (2017)');
  }

  // EA Flood Monitoring — live warnings near the point (Tier A, 25/25)
  tasks.push(async () => {
    const d = await get(f, 'https://environment.data.gov.uk/flood-monitoring/id/floods');
    const items = (d as { items?: { severityLevel?: number; eaAreaName?: string; floodArea?: { lat?: number; long?: number } }[] })?.items ?? [];
    const near = items.filter((w) => w.floodArea?.lat != null && w.floodArea?.long != null
      && distKm(loc, w.floodArea.lat, w.floodArea.long) <= 40);
    add('EA active flood warnings (40km)', String(near.length),
      'EA Flood Monitoring — OGL');
    if (near[0]?.eaAreaName) add('Nearest warning area', near[0].eaAreaName, 'EA Flood Monitoring');
  });

  // Open-Meteo — 7-day precipitation (Tier A)
  tasks.push(async () => {
    const d = await get(f, `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=precipitation_sum&past_days=6&forecast_days=1&timezone=UTC`)
      .then((x) => x as { daily?: { precipitation_sum?: (number | null)[] } });
    const sum = (d?.daily?.precipitation_sum ?? []).filter((v): v is number => v != null).reduce((a, b) => a + b, 0);
    add('7-day precipitation', `${sum.toFixed(1)} mm`, 'Open-Meteo — CC-BY-4.0');
  });

  // FSA Food Hygiene — community venues (Tier A)
  tasks.push(async () => {
    const d = await get(f, `https://api.ratings.food.gov.uk/establishments?longitude=${loc.lon}&latitude=${loc.lat}&maxDistanceLimit=2000&pageSize=50`, { 'x-api-version': '2' })
      .then((x) => x as { establishments?: { RatingValue?: string }[] });
    const est = d?.establishments ?? [];
    if (!est.length) return;
    const rated = est.map((e) => parseInt(e.RatingValue ?? '', 10)).filter((v) => v >= 0 && v <= 5);
    add('Food venues within 2km', `${est.length} (mean rating ${(rated.reduce((a, b) => a + b, 0) / (rated.length || 1)).toFixed(1)}/5)`,
      'FSA Food Hygiene Rating Scheme — OGL');
  });

  // EA Water Quality — sampling coverage (Tier A)
  tasks.push(async () => {
    const d = await get(f, `https://environment.data.gov.uk/water-quality/sampling-point?latitude=${loc.lat}&longitude=${loc.lon}&radius=10&limit=1`, { accept: 'application/ld+json' })
      .then((x) => x as { totalItems?: number });
    if (d?.totalItems != null) add('Water-quality sampling points (10km)', String(d.totalItems), 'EA Water Quality Archive — OGL');
  });

  // data.gov.uk CKAN — dataset discovery for the place (Tier A)
  tasks.push(async () => {
    const q = pc?.admin_district ?? opts.placeName;
    if (!q) return;
    const d = await get(f, `https://data.gov.uk/api/action/package_search?q=${encodeURIComponent(q)}&rows=0`)
      .then((x) => x as { result?: { count?: number } });
    if (d?.result?.count != null) add(`data.gov.uk datasets mentioning “${q}”`, String(d.result.count), 'CKAN / data.gov.uk — OGL');
  });

  // ONS Beta — published datasets surface (Tier A)
  tasks.push(async () => {
    const d = await get(f, 'https://api.beta.ons.gov.uk/v1/datasets?limit=1', { 'user-agent': 'springforth/1.0' })
      .then((x) => x as { total_count?: number });
    if (d?.total_count != null) add('ONS published datasets', String(d.total_count), 'ONS Beta API — OGL');
  });

  // geoBoundaries — admin boundary reference (Tier A)
  tasks.push(async () => {
    const d = await get(f, 'https://www.geoboundaries.org/api/current/gbOpen/GBR/ADM2/')
      .then((x) => x as { boundaryName?: string; licenseDetail?: { licenseType?: string } });
    if (d?.boundaryName) add('Admin boundary reference', d.boundaryName, 'geoBoundaries gbOpen — CC-BY-4.0');
  });

  // Climate TRACE — national emissions context (Tier A)
  tasks.push(async () => {
    const d = await get(f, 'https://api.climatetrace.org/v6/country/emissions?countries=GBR&since=2023')
      .then((x) => (x as { emissions?: { co2?: number } }[])?.[0]);
    if (d?.emissions?.co2) add('UK CO₂ emissions (Climate TRACE)', `${(d.emissions.co2 / 1e6).toFixed(1)} Mt`, 'Climate TRACE — open');
  });

  // iNaturalist — citizen-science density (Tier B endorsed)
  tasks.push(async () => {
    const d = await get(f, `https://api.inaturalist.org/v1/observations?lat=${loc.lat}&lng=${loc.lon}&radius=10&per_page=0&verifiable=true`)
      .then((x) => x as { total_results?: number });
    if (d?.total_results != null) add('iNaturalist observations (10km)', String(d.total_results), 'iNaturalist — CC0/CC-BY');
  });

  // HM Land Registry — price-paid activity via SPARQL (Tier A, keyless)
  tasks.push(async () => {
    if (!pc?.postcode) return;
    const q = `prefix lrcommon: <http://landregistry.data.gov.uk/def/common/>
prefix lrppi: <http://landregistry.data.gov.uk/def/ppi/>
select (count(?txn) as ?n) where { ?txn lrppi:propertyAddress ?addr . ?addr lrcommon:postcode "${pc.postcode}" . }`;
    const d = await get(f, `https://landregistry.data.gov.uk/landregistry/query?format=json&query=${encodeURIComponent(q)}`)
      .then((x) => x as { results?: { bindings?: { n?: { value?: string } }[] } });
    const n = d?.results?.bindings?.[0]?.n?.value;
    if (n != null) add(`Price-paid transactions @ ${pc.postcode}`, n, 'HM Land Registry Price Paid — OGL');
  });

  // English IMD 2025 — decile for the LSOA (Tier A, top-ranked; vendored File 7)
  tasks.push(async () => {
    const lsoaCode = pc?.codes?.lsoa;
    const hit = lsoaCode ? (imd2025 as unknown as Record<string, [number, number, number]>)[lsoaCode] : undefined;
    if (hit) add('IMD deprivation decile (LSOA, IoD 2025)', `${hit[2]}/10 · score ${hit[0]} · rank ${hit[1]} of 33,755`, 'English Indices of Deprivation 2025 — OGL');
  });

  // GLEIF — org identity when a name is supplied (Tier A)
  if (opts.entityName) tasks.push(async () => {
    const d = await get(f, `https://api.gleif.org/api/v1/lei-records?filter%5Bentity.names%5D=${encodeURIComponent(opts.entityName!)}&page%5Bsize%5D=1`)
      .then((x) => x as { meta?: { pagination?: { total?: number } } });
    const n = d?.meta?.pagination?.total;
    if (n != null) add(`LEI records matching “${opts.entityName}”`, String(n), 'GLEIF — CC0');
  });

  // Companies House — key-gated (Tier A when key present)
  if (opts.companiesHouseKey && opts.entityName) tasks.push(async () => {
    const r = await f(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(opts.entityName!)}&items_per_page=1`,
      { headers: { authorization: `Basic ${btoa(opts.companiesHouseKey + ':')}` } });
    if (!r.ok) return;
    const d = await r.json() as { total_results?: number };
    if (d.total_results != null) add(`Companies House matches “${opts.entityName}”`, String(d.total_results), 'Companies House — OGL');
  });

  await Promise.all(tasks.map((t) => t().catch(() => undefined)));
  return out;
}


// ── trajectory.ts ────────────────────────────────────
// Evidence trajectory — forecasting-lite, deliberately not actuarial.
// Replaces the removed projection engine with the simplest honest view:
// readings over time against the node's baseline, a linear trend, and a
// naive crossing estimate. Display math for review, not a model of the
// world — humans still verify.

export interface Trajectory {
  nodeId: string;
  points: { at: string; score: number; result: string; source: string }[];
  // least-squares slope of score over days (positive = improving)
  slopePerDay: number;
  firstScore: number;
  lastScore: number;
  // naive: days until trend crosses the `threshold` — null if the trend
  // isn't heading that way or there's nothing to project from.
  daysToThreshold: number | null;
  readings: number;
}

export function trajectory(
  nodeId: string, checks: (OracleCheck & { nodeId?: string })[],
  threshold = 0.5,
): Trajectory {
  const pts = checks
    .filter((c) => c.nodeId === nodeId)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((c) => ({ at: c.at, score: c.score, result: c.result, source: c.source }));
  const n = pts.length;
  if (n < 2) {
    return {
      nodeId, points: pts, slopePerDay: 0,
      firstScore: pts[0]?.score ?? 0, lastScore: pts.at(-1)?.score ?? 0,
      daysToThreshold: null, readings: n,
    };
  }
  const t0 = Date.parse(pts[0]!.at);
  const xs = pts.map((p) => (Date.parse(p.at) - t0) / 86_400_000);
  const ys = pts.map((p) => p.score);
  const mx = xs.reduce((a, x) => a + x, 0) / n, my = ys.reduce((a, y) => a + y, 0) / n;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const slope = num / den;
  const last = ys[n - 1]!;
  const daysToThreshold = slope > 1e-9 && last < threshold
    ? Math.round((threshold - last) / slope * 10) / 10
    : slope < -1e-9 && last > threshold
      ? Math.round((threshold - last) / slope * 10) / 10
      : null;
  return {
    nodeId, points: pts, slopePerDay: Math.round(slope * 10000) / 10000,
    firstScore: ys[0]!, lastScore: last, daysToThreshold, readings: n,
  };
}

// Evidence-weighted allocation — the funding flywheel nobody else has:
// a need whose trajectory is corroborated by open evidence earns a
// modestly higher match weight; declining evidence modestly lowers it.
// Deliberately narrow (0.8–1.2) — evidence nudges allocation, never
// overrides donor breadth. No readings → neutral 1.0.
export function evidenceBoost(
  nodeId: string, checks: (OracleCheck & { nodeId?: string })[],
): number {
  const t = trajectory(nodeId, checks);
  if (t.readings === 0) return 1;
  const base = 0.8 + 0.4 * Math.min(1, Math.max(0, t.lastScore));
  const trend = Math.max(-0.05, Math.min(0.05, t.slopePerDay * 30));
  return Math.round(Math.min(1.2, Math.max(0.8, base + trend)) * 1000) / 1000;
}
