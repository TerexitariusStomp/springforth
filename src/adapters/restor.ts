import { ExternalPlan, PlanNode, canonicalize } from '../coordination';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Restor (restor.eco) — ETH Crowther Lab's restoration platform: ~200k
// declared restoration sites, each a public page carrying the site's
// full record (GeoJSON polygon, country, intervention, stage, goals,
// support sought, carbon estimates) embedded in the Next.js RSC stream.
// The documented API (api.restor.eco) is api-key gated, so the keyless
// lane here reads the public web contract:
//   1. /sitemaps/sites/{i}/sitemap.xml — 500 site URLs + lastmod each,
//      indices 0..~499 (enumeration, cheap)
//   2. /sites/{id}/ — dehydrated react-query state embeds the site JSON
//      (hydration — one page fetch per site)
// robots.txt disallows only named SEO scrapers; sitemaps exist to be
// crawled. Hydration stays polite (serial, retried, identifiable UA) —
// bulk backfill runs via scripts/restor-import.mjs, not in the worker.
// Site `stage`/`goals`/`supportSought` stay verbatim — Restor's
// vocabulary, not ours. `supportSought:FUNDING`/VOLUNTEERS are Restor's
// own declared asks → they map to need nodes.

export const RESTOR_URL = 'https://restor.eco';
const H3_RES = 5;

export const RestorSite = z.object({
  id: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  polygon: z.object({
    type: z.string(), coordinates: z.array(z.unknown()),
  }).passthrough().nullish(),
  boundingBox: z.object({
    top: z.number(), right: z.number(),
    bottom: z.number(), left: z.number(),
  }).passthrough().nullish(),
  siteType: z.string().nullish(),
  siteVisibility: z.string().nullish(),
  surfaceAreaKm2: z.number().nullish(),
  countryCode: z.string().nullish(),
  interventionStartYear: z.number().nullish(),
  stage: z.string().nullish(),
  preInterventionLandUse: z.string().nullish(),
  interventionType: z.string().nullish(),
  postInterventionLandCover: z.string().nullish(),
  siteManagement: z.string().nullish(),
  siteOwnership: z.string().nullish(),
  goals: z.array(z.string()).default([]),
  supportSought: z.array(z.string()).default([]),
  website: z.string().nullish(),
  certificates: z.array(z.unknown()).default([]),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
}).passthrough();
export type RestorSite = z.infer<typeof RestorSite>;

// Carbon + trees data rides alongside the site object in the same
// dehydrated state ({carbon:{current:{data:{value,unitOfMeasure}}}}).
export const RestorCarbon = z.object({
  current: z.object({ data: z.object({
    value: z.number().nullish(), unitOfMeasure: z.string().nullish(),
  }).passthrough().nullish() }).passthrough().nullish(),
  potential: z.object({ data: z.object({
    value: z.number().nullish(), unitOfMeasure: z.string().nullish(),
  }).passthrough().nullish() }).passthrough().nullish(),
}).passthrough();
export type RestorCarbon = z.infer<typeof RestorCarbon>;

// ── Sitemap parsing ───────────────────────────────────────────────────
export interface RestorSitemapEntry { id: string; lastmod?: string }

export function parseRestorSitemap(xml: string): RestorSitemapEntry[] {
  const out: RestorSitemapEntry[] = [];
  const re = /<url>\s*<loc>https:\/\/restor\.eco\/sites\/([0-9a-f-]{36})\/?<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push({ id: m[1]!, lastmod: m[2] });
  return out;
}

// ── RSC payload extraction ────────────────────────────────────────────
// The site object lives inside self.__next_f.push strings as escaped
// JSON inside the dehydrated react-query state:
//   {"state":{"data":{...site...}},"queryKey":["site","<id>"]}
// We locate the site object's opening brace by the key preceding
// `queryKey` containing our id, then brace-walk to its close.
export function extractRestorSite(html: string, siteId: string): RestorSite | null {
  const key = `\\"queryKey\\":[\\"site\\",\\"${siteId}\\"`;
  const ki = html.indexOf(key);
  if (ki === -1) return null;
  // Walk back to the `"data":{` that opens the site object.
  const dataMark = html.lastIndexOf('\\"data\\":{', ki);
  if (dataMark === -1) return null;
  const start = dataMark + '\\"data\\":'.length;   // index of '{'
  // Brace-walk the escaped JSON: inside the push-string, quotes appear
  // as \" so raw braces never sit inside string literals.
  let depth = 0, end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
    if (i - start > 64 * 1024) break;              // sanity bound
  }
  if (end === -1) return null;
  const unescaped = html.slice(start, end).replace(/\\"/g, '"');
  let obj: unknown;
  try { obj = JSON.parse(unescaped); } catch { return null; }
  const parsed = RestorSite.safeParse(obj);
  return parsed.success ? parsed.data : null;
}

// Carbon estimate rides in a sibling dehydrated query — separate parse.
export function extractRestorCarbon(html: string): RestorCarbon | null {
  const i = html.indexOf('\\"carbon\\":{\\"current\\"');
  if (i === -1) return null;
  const start = i + '\\"carbon\\":'.length;
  let depth = 0, end = -1;
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = j + 1; break; }
    }
    if (j - start > 16 * 1024) break;
  }
  if (end === -1) return null;
  let obj: unknown;
  try { obj = JSON.parse(html.slice(start, end).replace(/\\"/g, '"')); }
  catch { return null; }
  const parsed = RestorCarbon.safeParse(obj);
  return parsed.success ? parsed.data : null;
}

// Centroid: use the provided bounding box when present (cheap + exact
// for small sites), else average the first polygon ring's vertices.
export function restorCentroid(site: RestorSite): { lat: number; lng: number } | null {
  if (site.boundingBox) {
    return {
      lat: (site.boundingBox.top + site.boundingBox.bottom) / 2,
      lng: (site.boundingBox.left + site.boundingBox.right) / 2,
    };
  }
  const ring = (site.polygon?.coordinates?.[0] as number[][][] | undefined)?.[0];
  if (!Array.isArray(ring) || !ring.length) return null;
  const n = ring.length;
  const [lat, lng] = ring.reduce(
    ([a, b], pt) => [a + (pt[1] ?? 0), b + (pt[0] ?? 0)] as const, [0, 0] as const);
  return { lat: lat / n, lng: lng / n };
}

const money = (n: number) => n.toLocaleString('en-US');

// Sites → ExternalPlan. Each site yields one action node (the declared
// intervention, verbatim stage), plus need nodes for declared support
// asks (FUNDING→financial, MONITORING/PARTNERSHIPS→social, etc.).
export function fromRestorSites(
  sites: RestorSite[], source = 'restor:web',
): ExternalPlan {
  const nodes: PlanNode[] = [];
  const SUPPORT_CAPITAL: Record<string, PlanNode['capital']> = {
    FUNDING: 'financial', VOLUNTEERS: 'experiential',
    PARTNERSHIPS: 'social', MONITORING: 'intellectual',
    KNOWLEDGE: 'intellectual', EQUIPMENT: 'material',
  };
  for (const s of sites) {
    const sid = `restor-${s.id}`;
    const c = restorCentroid(s);
    const url = `${RESTOR_URL}/sites/${s.id}/`;
    const area = s.surfaceAreaKm2 != null
      ? `${money(+s.surfaceAreaKm2.toFixed(2))} km²` : null;
    const label = `${s.name ?? 'Restoration site'}` +
      (s.countryCode ? ` — ${s.countryCode}` : '');
    nodes.push({
      id: `${sid}-site`, kind: 'action', label,
      canonical: canonicalize(
        `${s.name ?? 'restoration site'} ${s.siteType ?? ''} ${s.interventionType ?? ''}`),
      source,
      placeId: s.countryCode ? `country:${s.countryCode}` : undefined,
      h3: c ? latLngToCell(c.lat, c.lng, H3_RES) : undefined,
      orgIds: ['restor'],
      tags: ['restor',
        ...(s.siteType ? [`type:${s.siteType}`] : []),
        ...(s.stage ? [`stage:${s.stage}`] : []),
        ...(s.countryCode ? [`country:${s.countryCode}`] : []),
        ...s.goals.map((g) => `goal:${g}`)],
      timeframe: {
        from: s.interventionStartYear ? `${s.interventionStartYear}` : undefined,
        to: s.updatedAt ?? undefined,
      },
      description: [
        (s.description ?? '').slice(0, 300) || null,
        [
          s.siteType ?? null, s.stage ?? null,
          s.interventionStartYear ? `since ${s.interventionStartYear}` : null,
          area,
        ].filter(Boolean).join(' · ') || null,
        url,
      ].filter(Boolean).join(' — '),
    });
    for (const sup of s.supportSought) {
      nodes.push({
        id: `${sid}-need-${sup.toLowerCase()}`, kind: 'need',
        label: `${sup.toLowerCase().replace(/_/g, ' ')} sought — ${label}`,
        canonical: canonicalize(
          `${sup} support sought restoration ${s.siteType ?? ''}`),
        source,
        placeId: s.countryCode ? `country:${s.countryCode}` : undefined,
        h3: c ? latLngToCell(c.lat, c.lng, H3_RES) : undefined,
        orgIds: ['restor'], capital: SUPPORT_CAPITAL[sup] ?? 'social',
        tags: ['restor', 'support-sought', `support:${sup}`],
        timeframe: {},
        description: `Restor site declares ${sup} support — ${url}`,
      });
    }
  }
  return {
    id: 'plan-restor', source,
    title: 'Restor — restoration sites',
    owner: 'restor', importedAt: new Date().toISOString(), nodes,
  };
}

// ── Live fetchers ─────────────────────────────────────────────────────
let lastError = '';
export const restorLastError = () => lastError;

export async function fetchRestorSitemap(
  index: number, f: typeof fetch = fetch, baseUrl = RESTOR_URL,
): Promise<RestorSitemapEntry[] | null> {
  const res = await f(`${baseUrl}/sitemaps/sites/${index}/sitemap.xml`, {
    headers: { 'user-agent': 'springforth-adapter/1.0 (+https://springforth.earth)' },
  }).catch((e) => { lastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (res.status === 404) { lastError = ''; return []; }   // end of index
  if (!res.ok) { lastError = `http ${res.status}`; return null; }
  const xml = await res.text().catch(() => null);
  if (xml == null) return null;
  lastError = '';
  return parseRestorSitemap(xml);
}

export async function fetchRestorSite(
  id: string, f: typeof fetch = fetch, baseUrl = RESTOR_URL,
): Promise<{ site: RestorSite; carbon: RestorCarbon | null } | null> {
  const res = await f(`${baseUrl}/sites/${id}/`, {
    headers: { 'user-agent': 'springforth-adapter/1.0 (+https://springforth.earth)' },
  }).catch((e) => { lastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (!res.ok) { lastError = `http ${res.status}`; return null; }
  const html = await res.text().catch(() => null);
  if (html == null) return null;
  const site = extractRestorSite(html, id);
  if (!site) { lastError = 'site parse failed'; return null; }
  lastError = '';
  return { site, carbon: extractRestorCarbon(html) };
}
