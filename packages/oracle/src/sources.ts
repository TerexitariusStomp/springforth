import { OracleCheck } from '@springforth/core';

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
    license: 'per-location CC0/CC-BY/gov', needs: 'OPENAQ_API_KEY' },
  { key: 'sensorcommunity', source: 'iot' as const, name: 'Sensor.Community — crowd AQ sensors',
    license: 'ODbL (attribution + share-alike)', needs: null },
  { key: 'nasa-power', source: 'remote-sensing' as const, name: 'NASA POWER — meteorology reanalysis',
    license: 'open, any use', needs: null },
  { key: 'sentinel2', source: 'remote-sensing' as const, name: 'earth-search STAC — Sentinel-2 scenes',
    license: 'Copernicus open', needs: null },
  { key: 'worldbank', source: 'connector' as const, name: 'World Bank — socioeconomic indicators',
    license: 'CC-BY-4.0', needs: null },
  { key: 'gbif', source: 'bioacoustic' as const, name: 'GBIF — biodiversity occurrences (CC0/CC-BY only)',
    license: 'CC0/CC-BY filtered', needs: null },
  { key: 'atlas', source: 'atlas' as const, name: 'envhealth-atlas — hazard model',
    license: 'project data', needs: null },
  { key: 'treegens', source: 'field-evidence' as const, name: 'Treegens — filmed, AI-counted planting records',
    license: 'site-published evidence', needs: null },
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

export const EXPECTED_DIRECTION: Record<string, 'decrease' | 'increase' | 'flat'> = {
  openaq: 'decrease', sensorcommunity: 'decrease', 'nasa-power': 'decrease',
  sentinel2: 'flat', worldbank: 'flat', gbif: 'increase',
  treegens: 'increase', atlas: 'decrease',
  'silvi-leaf': 'increase', silvi: 'increase',
};
