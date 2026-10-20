import { ExternalPlan, PlanNode, canonicalize } from '@springforth/coordination';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Silvi (silvi.earth) — community reforestation MRV protocol, Celo-based.
// Public MIT-licensed backend + contracts (SilviProtocol/silvi).
// Two data surfaces:
//   Silvi App API — projects/zones/trees/STAC assets; query-param api_key
//     auth (public reference impl: rifaisiciliadao/silvi-bridge). The base
//     URL is env-configured (SILVI_API_URL) — their staging host differs
//     from production and may change; nothing here hard-codes it.
//   Treekipedia LEAF — "Location-based Ecological Aptness Forecast":
//     what trees to plant where (96.5M GBIF occurrences + WCVP native
//     status + 847 WWF ecoregions). Documented keyless; currently
//     auth-gated upstream — every call here degrades to null, never 500.
// A verified tree count is honoured verbatim, like Treegens: statuses
// Silvi hasn't verified are never promoted — they stay evidence of
// intent, not verification.

export const SILVI_APP_URL = 'https://app.silvi.earth';
export const TREEKIPEDIA_API = 'https://treekipedia-api.silvi.earth';
const H3_RES = 6;

const GeoPoint = z.object({
  lat: z.number().optional(), lng: z.number().optional(),
  latitude: z.number().optional(), longitude: z.number().optional(),
  centroid: z.object({ lat: z.number(), lng: z.number() }).optional(),
}).passthrough();

const SilviTree = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  lat: z.number().optional(), lng: z.number().optional(),
  latitude: z.number().optional(), longitude: z.number().optional(),
  species: z.string().optional(),
  status: z.string().optional(),            // planted | verified | monitoring
  planted_at: z.string().optional(),
  verified_at: z.string().optional(),
  steward: z.string().optional(),
}).passthrough();
export type SilviTree = z.infer<typeof SilviTree>;

const SilviZone = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  trees_target: z.number().optional(),
  trees_planted: z.number().optional(),
  species: z.array(z.string()).optional(),
}).passthrough().merge(GeoPoint.partial());

const SilviProject = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  campaign: z.string().optional(),
  steward: z.string().optional(),
  trees_target: z.number().optional(),
  trees_planted: z.number().optional(),
  trees_verified: z.number().optional(),
  species: z.array(z.string()).optional(),
  zones: z.array(SilviZone).default([]),
  trees: z.array(SilviTree).default([]),
  stac_url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough().merge(GeoPoint.partial());
export type SilviProject = z.infer<typeof SilviProject>;

const SilviProjectsFeed = z.union([
  z.array(SilviProject),
  z.object({ projects: z.array(SilviProject).default([]),
             data: z.array(SilviProject).optional() }).passthrough(),
]);

const coords = (o: { lat?: number; lng?: number; latitude?: number;
  longitude?: number; centroid?: { lat: number; lng: number } }) => {
  const lat = o.lat ?? o.latitude ?? o.centroid?.lat;
  const lng = o.lng ?? o.longitude ?? o.centroid?.lng;
  return lat != null && lng != null ? { lat, lng } : undefined;
};
const cell = (c?: { lat: number; lng: number }) =>
  c ? latLngToCell(c.lat, c.lng, H3_RES) : undefined;
const trees = (n?: number) => (n ?? 0).toLocaleString('en-US');

// Projects → ExternalPlan. Each project yields an action node (h3'd
// where coordinates exist); zones with targets yield need nodes —
// Silvi's own targets are what a matching round would fund.
export function fromSilviProjects(feedJson: unknown, source = 'silvi:app'): ExternalPlan {
  const raw = SilviProjectsFeed.parse(feedJson);
  const projects = Array.isArray(raw) ? raw : (raw.projects.length ? raw.projects : raw.data ?? []);
  const nodes: PlanNode[] = [];
  for (const p of projects) {
    const pid = `silvi-${p.id}`;
    const c = coords(p);
    const place = p.location ?? p.country;
    const planted = p.trees_planted ?? p.trees.filter((t) => t.status !== 'planned').length;
    const verified = p.trees_verified
      ?? p.trees.filter((t) => t.status === 'verified').length;
    nodes.push({
      id: `${pid}-project`, kind: 'action',
      label: `${trees(planted)} trees planted${verified ? ` (${trees(verified)} Silvi-verified)` : ''} — ${p.name}`,
      canonical: canonicalize(`${p.name} trees planted reforestation`),
      source, placeId: place ? canonicalize(place) : undefined,
      h3: cell(c), orgIds: ['silvi'],
      tags: ['silvi', p.status ?? 'active', ...(p.species ?? [])],
      timeframe: { from: p.created_at, to: p.updated_at },
      description: [
        `Silvi project — ${p.status ?? 'active'}`,
        p.campaign ? `campaign: ${p.campaign}` : null,
        p.steward ? `steward: ${p.steward}` : null,
        verified ? `${trees(verified)} verified via Silvi MRV` : null,
        p.stac_url ? `STAC: ${p.stac_url}` : null,
      ].filter(Boolean).join('; '),
    });
    for (const zn of p.zones) {
      if (!zn.trees_target || (zn.trees_planted ?? 0) >= zn.trees_target) continue;
      const label = `${trees(zn.trees_target - (zn.trees_planted ?? 0))} trees to complete zone ${zn.name ?? zn.id ?? ''} — ${p.name}`;
      nodes.push({
        id: `${pid}-zone-${zn.id ?? nodes.length}-need`, kind: 'need',
        label, canonical: canonicalize(`trees seedlings reforestation ${p.name}`),
        source, placeId: place ? canonicalize(place) : undefined,
        h3: cell(coords(zn)) ?? cell(c), orgIds: ['silvi'],
        capital: 'living', tags: ['silvi', 'zone-target'],
        timeframe: {}, budget: undefined,
        description: `Silvi zone target ${trees(zn.trees_planted)}/${trees(zn.trees_target)} — ${zn.species?.join(', ') ?? 'native species'}`,
      });
    }
    const label = `Restored forest — ${p.name}`;
    nodes.push({
      id: `${pid}-outcome`, kind: 'outcome', label,
      canonical: canonicalize(label), source,
      placeId: place ? canonicalize(place) : undefined, h3: cell(c),
      orgIds: ['silvi'], tags: ['silvi', 'derived-outcome'],
      timeframe: {}, description: `Silvi project outcome aggregate — see ${pid}-project`,
    });
  }
  return {
    id: 'plan-silvi-app', source, title: 'Silvi reforestation projects',
    owner: 'silvi', importedAt: new Date().toISOString(), nodes,
  };
}

// Live client — query-param auth per the public silvi-bridge reference.
// Returns null on any failure: the adapter never throws into the worker.
export async function fetchSilviProjects(
  baseUrl = SILVI_APP_URL, apiKey?: string, f: typeof fetch = fetch,
): Promise<SilviProject[] | null> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl.replace(/\/$/, '')}/api/projects${apiKey ? `${sep}api_key=${encodeURIComponent(apiKey)}` : ''}`;
  const res = await f(url).catch(() => null);
  if (!res || !res.ok) return null;
  const body = await res.json().catch(() => null);
  if (body == null) return null;
  const parsed = SilviProjectsFeed.parse(body);
  return Array.isArray(parsed) ? parsed
    : (parsed.projects.length ? parsed.projects : parsed.data ?? []);
}

// Per-project fetch — Silvi API keys are issued per project (per the
// founder), so the authenticated lane is /api/projects/:id?api_key=.
export async function fetchSilviProject(
  projectId: string | number, baseUrl = SILVI_APP_URL,
  apiKey?: string, f: typeof fetch = fetch,
): Promise<SilviProject | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}${apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''}`;
  const res = await f(url).catch(() => null);
  if (!res || !res.ok) return null;
  const body = await res.json().catch(() => null);
  if (body == null) return null;
  // Accept the bare project, {project: {...}}, or {data: {...}} envelopes.
  const inner = (body as { project?: unknown; data?: unknown });
  const cand = inner.project ?? (Array.isArray(inner.data) ? inner.data[0] : inner.data) ?? body;
  const parsed = SilviProject.safeParse(cand);
  return parsed.success ? parsed.data : null;
}

// Individual tree records for the oracle's verified-count reading.
export async function fetchSilviTrees(
  baseUrl = SILVI_APP_URL, apiKey?: string, f: typeof fetch = fetch,
): Promise<(SilviTree & { projectName?: string })[] | null> {
  const projects = await fetchSilviProjects(baseUrl, apiKey, f);
  if (!projects) return null;
  return projects.flatMap((p) =>
    p.trees.map((t) => ({ ...t, projectName: p.name })));
}

// ── Treekipedia LEAF — species aptness ────────────────────────────────
export interface LeafResult {
  topScore: number;             // 0-100 aptness of the best species here
  speciesCount: number;         // species returned
  topSpecies: string[];
}

// LEAF is documented keyless but currently returns a login redirect
// upstream; any non-JSON or non-OK response degrades to null.
export async function fetchLeafScore(
  loc: { lat: number; lon: number }, f: typeof fetch = fetch,
  apiBase = TREEKIPEDIA_API,
): Promise<LeafResult | null> {
  const res = await f(
    `${apiBase}/api/geospatial/leaf/score?lat=${loc.lat}&lng=${loc.lon}&limit=25&min_score=50`)
    .catch(() => null);
  if (!res || !res.ok) return null;
  const body = await res.json().catch(() => null);
  const species = (body as { species?: { score?: number; scientific_name?: string; common_name?: string }[] })
    ?.species;
  if (!Array.isArray(species) || !species.length) return null;
  return {
    topScore: Math.max(...species.map((s) => s.score ?? 0)),
    speciesCount: species.length,
    topSpecies: species.slice(0, 3)
      .map((s) => s.scientific_name ?? s.common_name ?? 'unknown'),
  };
}

// Species research enrichment — AI+human ecological dossier per taxon.
export async function fetchSpeciesResearch(
  taxonId: string, f: typeof fetch = fetch, apiBase = TREEKIPEDIA_API,
): Promise<Record<string, unknown> | null> {
  const res = await f(`${apiBase}/research/research/${encodeURIComponent(taxonId)}`)
    .catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}
