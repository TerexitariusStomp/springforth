import type { GeoLoc } from './sources.ts';
// IoD 2025 File 7 (MHCLG, OGL v3) vendored 2025-10-21 — code → [score, rank, decile].
// The canonical live endpoint (opendatacommunities.org SPARQL) has an expired cert;
// vendoring the official CSV keeps the endorsed source honest and keyless.
import imd2025 from '../data/imd2025-lsoa.json';

// Context connectors — turn a lat/lon (and optionally a place/entity name)
// into verified context cards for possibilities. Unlike oracle readings
// these are point-in-time enrichments: they never affect quorum, they
// render as "Verified context" on the card. Every connector is keyless and
// fail-soft; key-gated sources are skipped unless a key is supplied.
// Source selection follows the SF.Live endorsed ranking (dataset-ranking.xlsx).

export interface ContextDataset { name: string; value: string; source: string; fetchedAt: string }
type FetchLike = typeof fetch;
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

function distKm(a: GeoLoc, lat: number, lon: number): number {
  const r = Math.PI / 180, dLat = (lat - a.lat) * r, dLon = (lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
