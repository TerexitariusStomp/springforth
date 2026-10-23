import { ExternalPlan, PlanNode, canonicalize } from '../coordination';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Silvi (silvi.earth) — community reforestation MRV protocol, Celo-based.
// Public MIT-licensed backend + contracts (SilviProtocol/silvi).
// Two data surfaces:
//   Silvi public API — admin.silvi.earth/public-api; ?key= query auth
//     (public reference impl: rifaisiciliadao/silvi-bridge). Keys are
//     scope-issued: campaign keys read /campaigns/:id/ + /campaigns/:id/
//     claims/ (verified planting claims w/ Celo USDC payment proofs);
//     project keys read /projects/:id/. The base URL is env-configured
//     (SILVI_API_URL) — their staging host differs from production.
//   Treekipedia LEAF — "Location-based Ecological Aptness Forecast":
//     what trees to plant where (96.5M GBIF occurrences + WCVP native
//     status + 847 WWF ecoregions). Documented keyless; currently
//     auth-gated upstream — every call here degrades to null, never 500.
// A verified tree count is honoured verbatim, like Treegens: statuses
// Silvi hasn't verified (claims still pending review) are never promoted —
// they stay evidence of intent, not verification.

export const SILVI_APP_URL = 'https://admin.silvi.earth/public-api';
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

// Campaign-scoped key surface (verified live 2026-10): campaign keys get
// /campaigns/:id/ detail + /campaigns/:id/claims/ — each claim is one
// steward-submitted planting with species, GPS point, IPFS photos, and
// the Celo USDC payouts to steward + evaluator (tx hashes + explorer
// links). `review_status === 'approved'` is Silvi's verified signal.
const SilviClaim = z.object({
  id: z.union([z.string(), z.number()]),
  review_status: z.string().nullish(),
  timestamp: z.string().nullish(),
  species: z.string().nullish(),
  scientific_name: z.string().nullish(),
  point: z.object({ lat: z.number(), lng: z.number() }).partial().nullish(),
  photos: z.array(z.object({
    id: z.union([z.string(), z.number()]).nullish(),
    image_url: z.string().nullish(),
    timestamp: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
  }).passthrough()).default([]),
  payment_status: z.string().nullish(),
  payments: z.array(z.object({
    role: z.string().nullish(),
    amount: z.string().nullish(),
    token: z.string().nullish(),
    chain: z.string().nullish(),
    tx_hash: z.string().nullish(),
    explorer_url: z.string().nullish(),
  }).passthrough()).default([]),
}).passthrough();
export type SilviClaim = z.infer<typeof SilviClaim>;

const SilviCampaign = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  description: z.string().optional(),
  countries: z.string().optional(),
  bioregions: z.string().optional(),
  ecoregions: z.string().optional(),
  goal: z.object({
    name: z.string().optional(), active: z.boolean().optional(),
    start_date: z.string().optional(), end_date: z.string().optional(),
    target: z.number().optional(),
  }).passthrough().optional(),
  counts: z.object({
    approved_claims: z.number().optional(),
    pending_claims: z.number().optional(),
    claims_with_a_payment: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();
export type SilviCampaign = z.infer<typeof SilviCampaign>;

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

// Campaign + claims → ExternalPlan. Approved claims are Silvi's verified
// signal: each is a GPS'd planting with reviewer sign-off and Celo USDC
// payouts on-chain. Individual claims are too many for the plan graph
// (a campaign runs to five figures), so they cluster into one action
// node per ~22 km degree-grid bucket (coarsening when a campaign spans
// more than ~400 buckets). Bucketing is pure arithmetic — h3 conversion
// runs once per bucket centroid, never per claim: 12k claims → ~400
// Emscripten calls, which fits a Worker's CPU budget. Pending claims
// are counted but never promoted — intent, not verification.
export interface SilviClaimCluster {
  key: string;                 // degree-grid bucket key
  lat: number; lng: number;    // claim centroid
  verified: number; pending: number;
  species: string[];
  paidUsdc: number;
  photoCount: number;
  firstAt?: string; lastAt?: string;
  txSample?: string;           // one explorer link as an audit trail entry
}

export function clusterSilviClaims(
  claims: SilviClaim[], deg = 0.2,
): SilviClaimCluster[] {
  const m = new Map<string, SilviClaim[]>();
  for (const c of claims) {
    const p = c.point;
    if (p?.lat == null || p?.lng == null) continue;
    const k = `${Math.floor(p.lat / deg)}:${Math.floor(p.lng / deg)}`;
    const arr = m.get(k) ?? [];
    if (!arr.length) m.set(k, arr);
    arr.push(c);
  }
  if (m.size > 400 && deg < 0.4) return clusterSilviClaims(claims, deg * 2);
  return [...m.entries()].map(([key, group]) => {
    const approved = group.filter((c) => c.review_status === 'approved');
    const species = [...new Set(group.map((c) => c.scientific_name ?? c.species)
      .filter((s): s is string => !!s))];
    const dates = group.map((c) => c.timestamp).filter((d): d is string => !!d).sort();
    return {
      key,
      lat: group.reduce((s, c) => s + c.point!.lat!, 0) / group.length,
      lng: group.reduce((s, c) => s + c.point!.lng!, 0) / group.length,
      verified: approved.length, pending: group.length - approved.length,
      species,
      paidUsdc: group.reduce((s, c) => s + c.payments
        .filter((p) => p.token === 'USDC')
        .reduce((x, p) => x + parseFloat(p.amount ?? '0'), 0), 0),
      photoCount: group.filter((c) => c.photos.length).length,
      firstAt: dates[0], lastAt: dates[dates.length - 1],
      txSample: group.find((c) => c.payments[0]?.explorer_url)?.payments[0]?.explorer_url ?? undefined,
    };
  });
}

export function fromSilviClusters(
  campaign: SilviCampaign, clusters: SilviClaimCluster[],
  claimsSeen = 0, source = 'silvi:app',
): ExternalPlan {
  const cid = `silvi-c${campaign.id}`;
  const place = campaign.countries || campaign.title;
  const nodes: PlanNode[] = [];
  for (const cl of clusters) {
    if (!cl.verified) continue;
    nodes.push({
      id: `${cid}-${cl.key}`, kind: 'action',
      label: `${trees(cl.verified)} Silvi-verified plantings — ${cl.species.slice(0, 3).join(', ') || 'native species'}`,
      canonical: canonicalize('verified tree plantings reforestation mrv'),
      source, placeId: canonicalize(place),
      h3: latLngToCell(cl.lat, cl.lng, H3_RES), orgIds: ['silvi'],
      tags: ['silvi', 'claim-cluster', 'verified', ...cl.species.slice(0, 5)],
      timeframe: { from: cl.firstAt, to: cl.lastAt },
      description: [
        `${cl.verified} approved claims` + (cl.pending ? ` (+${cl.pending} pending)` : ''),
        `${cl.photoCount} with photo evidence`,
        cl.paidUsdc ? `${cl.paidUsdc.toFixed(2)} USDC paid to stewards+evaluators on Celo` : null,
        cl.txSample ? `e.g. ${cl.txSample}` : null,
      ].filter(Boolean).join('; '),
    });
  }
  const verifiedTotal = campaign.counts?.approved_claims
    ?? clusters.reduce((s, c) => s + c.verified, 0);
  const pendingTotal = campaign.counts?.pending_claims
    ?? Math.max(claimsSeen - verifiedTotal, clusters.reduce((s, c) => s + c.pending, 0));
  const paidTotal = clusters.reduce((s, c) => s + c.paidUsdc, 0);
  nodes.push({
    id: `${cid}-outcome`, kind: 'outcome',
    label: `Restored highland forest — ${campaign.title}`,
    canonical: canonicalize(`restored forest reforestation ${campaign.title}`),
    source, placeId: canonicalize(place),
    orgIds: ['silvi'], tags: ['silvi', 'derived-outcome'],
    timeframe: { from: campaign.goal?.start_date, to: campaign.goal?.end_date },
    description: [
      `${trees(verifiedTotal)} verified planting claims`,
      pendingTotal ? `${trees(pendingTotal)} pending review` : null,
      paidTotal ? `${paidTotal.toFixed(0)} USDC paid out on Celo` : null,
      campaign.goal?.target ? `campaign target ${trees(campaign.goal.target)}` : null,
    ].filter(Boolean).join('; '),
  });
  return {
    id: `plan-silvi-campaign-${campaign.id}`, source,
    title: `Silvi — ${campaign.title} campaign`, owner: 'silvi',
    importedAt: new Date().toISOString(), nodes,
  };
}

export function fromSilviCampaign(
  campaign: SilviCampaign, claims: SilviClaim[], source = 'silvi:app',
): ExternalPlan {
  return fromSilviClusters(campaign, clusterSilviClaims(claims), claims.length, source);
}

// Live client — ?key= query auth per the public silvi-bridge reference.
// Returns null on any failure: the adapter never throws into the worker.
// `silviLastError` keeps the last failure reason for sync-route errors —
// upstream auth blocks (403) look identical to missing data otherwise.
let lastError = '';
export const silviLastError = () => lastError;
const silviGet = async (
  baseUrl: string, path: string, apiKey: string | undefined,
  f: typeof fetch, params: Record<string, string | number | undefined> = {},
) => {
  const u = new URL(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`);
  for (const [k, v] of Object.entries(params))
    if (v != null) u.searchParams.set(k, String(v));
  if (apiKey) u.searchParams.set('key', apiKey);
  const res = await f(u.toString(), {
    // admin.silvi.earth sits behind Cloudflare with a rule that 520s the
    // bare Workers fetch signature — a plain UA header passes it.
    headers: { 'user-agent': 'silvi-bridge/1.0 (+https://silvi.earth)' },
  }).catch((e) => { lastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (!res.ok) { lastError = `http ${res.status}`; return null; }
  const body = await res.json().catch((e) => { lastError = `json: ${e}`; return null; });
  if (body == null) return null;
  lastError = '';
  return body;
};

export async function fetchSilviProjects(
  baseUrl = SILVI_APP_URL, apiKey?: string, f: typeof fetch = fetch,
): Promise<SilviProject[] | null> {
  const body = await silviGet(baseUrl, 'projects/', apiKey, f);
  if (body == null) return null;
  const parsed = SilviProjectsFeed.parse(body);
  return Array.isArray(parsed) ? parsed
    : (parsed.projects.length ? parsed.projects : parsed.data ?? []);
}

// Per-project fetch — project-scoped keys read /projects/:id/?key=.
export async function fetchSilviProject(
  projectId: string | number, baseUrl = SILVI_APP_URL,
  apiKey?: string, f: typeof fetch = fetch,
): Promise<SilviProject | null> {
  const body = await silviGet(baseUrl, `projects/${encodeURIComponent(projectId)}/`, apiKey, f);
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

// Campaign detail — GET /campaigns/:id/?key= (campaign-scoped keys also
// get the same payload embedded at the root under {campaign}).
export async function fetchSilviCampaign(
  campaignId: string | number, baseUrl = SILVI_APP_URL,
  apiKey?: string, f: typeof fetch = fetch,
): Promise<SilviCampaign | null> {
  const body = await silviGet(baseUrl, `campaigns/${encodeURIComponent(campaignId)}/`, apiKey, f);
  if (body == null) return null;
  const inner = (body as { campaign?: unknown; data?: unknown });
  const cand = inner.campaign ?? inner.data ?? body;
  const parsed = SilviCampaign.safeParse(cand);
  return parsed.success ? parsed.data : null;
}

// One page of campaign claims — cursor-paginated (`after`), ~500 max per
// page. Callers loop on `nextAfter` until null; the worker's sync route
// bounds pages per invocation and persists the cursor to resume.
export async function fetchSilviClaims(
  campaignId: string | number,
  opts: { after?: number; limit?: number; reviewStatus?: string } = {},
  baseUrl = SILVI_APP_URL, apiKey?: string, f: typeof fetch = fetch,
): Promise<{ claims: SilviClaim[]; nextAfter: number | null } | null> {
  const body = await silviGet(
    baseUrl, `campaigns/${encodeURIComponent(campaignId)}/claims/`, apiKey, f,
    { after: opts.after, limit: opts.limit, review_status: opts.reviewStatus });
  if (body == null) return null;
  const claims = z.array(SilviClaim).safeParse((body as { claims?: unknown }).claims);
  if (!claims.success) { lastError = 'claims schema mismatch'; return null; }
  const nextAfter = (body as { next_after?: unknown }).next_after;
  return { claims: claims.data,
    nextAfter: typeof nextAfter === 'number' ? nextAfter : null };
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
