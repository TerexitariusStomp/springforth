import { ExternalPlan, PlanNode, canonicalize } from '../coordination';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Treegens (treegens.app / world.treegens.app) — filmed, GPS-tagged,
// AI-counted, DAO-verified tree planting records settling on Base.
// Two public, unauthenticated evidence feeds:
//   live:    /.netlify/functions/plantings      — app submissions, pending→verified
//   archive: /data/pre-app-plantings.json       — pre-app field-team plots
// Treegens' own proof model is honoured verbatim: `status` maps to a tag and
// a pending or AI-counted record is never promoted to DAO-verified — those
// are evidence of intent/footage, not verification.

export const TREEGENS_LIVE_URL = 'https://world.treegens.app/.netlify/functions/plantings';
export const TREEGENS_ARCHIVE_URL = 'https://world.treegens.app/data/pre-app-plantings.json';
export const TREEGENS_SITE = 'https://world.treegens.app';
const H3_RES = 6;

const LivePlanting = z.object({
  id: z.string(),
  lat: z.number().optional(), lng: z.number().optional(),
  trees: z.number().optional(),
  species: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  before: z.string().optional(), after: z.string().optional(),
  aiTreeCount: z.number().nullable().optional(),
  aiVideo: z.string().nullable().optional(),
  filmedBy: z.string().nullable().optional(),
  filmedAt: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
}).passthrough();

const LiveFeed = z.object({
  totalTrees: z.number().optional(),
  verifiedTrees: z.number().optional(),
  plantings: z.array(LivePlanting).default([]),
}).passthrough();

const ArchiveSite = z.object({
  id: z.string(), name: z.string(),
  country: z.string().optional(),
  lat: z.number().optional(), lng: z.number().optional(),
  trees: z.number().optional(),
  species: z.string().optional(),
  planters: z.string().optional(),
  lastVerified: z.string().optional(),
  plantedSince: z.string().optional(),
}).passthrough();

const ArchiveFeed = z.object({
  sites: z.array(ArchiveSite).default([]),
}).passthrough();

const slug = (s: string) => canonicalize(s).replace(/\s+/g, '-');
const cell = (lat?: number, lng?: number) =>
  lat != null && lng != null ? latLngToCell(lat, lng, H3_RES) : undefined;
const trees = (n?: number) => (n ?? 0).toLocaleString('en-US');
const clip = (path?: string | null) => (path ? `${TREEGENS_SITE}${path}` : undefined);
// 'mangrove' → 'mangrove trees' — the tree synonym group is how the
// resolver recognises a planting record beside a community 'planting day'.
const speciesLabel = (s?: string) => {
  const sp = s?.toLowerCase().replace(/s$/, '');
  return sp && sp !== 'tree' ? `${sp} trees` : 'trees';
};

// One outcome node per unique planting site — the common-outcome layer's
// "who else is pursuing this" answer. 'Mangrove forest' is the standard
// ecological term and lands the node beside community outcomes that use it.
function outcomeNode(id: string, site: string, source: string, tags: string[]): PlanNode {
  const label = `Restored mangrove forest cover — ${site}`;
  return {
    id, kind: 'outcome', label, canonical: canonicalize(label), source,
    placeId: canonicalize(site), orgIds: ['treegens'],
    tags: ['treegens', 'derived-outcome', ...tags],
    timeframe: {}, description: `Treegens evidence aggregate for ${site} — see action records`,
  };
}

export function fromTreegensFeed(feedJson: unknown, source = 'treegens:live'): ExternalPlan {
  const feed = LiveFeed.parse(feedJson);
  const nodes: PlanNode[] = [];
  const sites = new Set<string>();
  for (const p of feed.plantings) {
    const status = p.status ?? 'pending';
    const site = p.location?.trim();
    // A record with neither a site name nor coordinates carries no
    // matchable evidence — skip it rather than emit a pure-noise node.
    if (!site && (p.lat == null || p.lng == null)) continue;
    const label = `${trees(p.trees)} ${speciesLabel(p.species)} planted — ${site || 'unmapped'}`;
    nodes.push({
      id: `treegens-${p.id}`, kind: 'action', label,
      canonical: canonicalize(label), source,
      placeId: site ? canonicalize(site) : undefined,
      h3: cell(p.lat, p.lng), orgIds: ['treegens'],
      tags: ['treegens', status, p.species ?? 'trees'],
      timeframe: { from: p.filmedAt ?? undefined, to: p.verifiedAt ?? undefined },
      description: [
        `${status} planting record on Treegens`,
        p.aiTreeCount != null ? `AI count ${p.aiTreeCount}` : null,
        p.filmedBy ? `filmed by ${p.filmedBy}` : null,
        clip(p.before) ? `before: ${clip(p.before)}` : null,
        clip(p.after) ? `after: ${clip(p.after)}` : null,
      ].filter(Boolean).join('; '),
    });
    if (site) sites.add(site);
  }
  for (const site of sites) nodes.push(outcomeNode(`treegens-out-${slug(site)}`, site, source, []));
  return {
    id: 'plan-treegens-live', source, title: 'Treegens app planting records',
    owner: 'treegens', importedAt: new Date().toISOString(), nodes,
  };
}

export function fromTreegensArchive(archiveJson: unknown, source = 'treegens:archive'): ExternalPlan {
  const feed = ArchiveFeed.parse(archiveJson);
  const nodes: PlanNode[] = [];
  for (const s of feed.sites) {
    const label = `${trees(s.trees)} ${speciesLabel(s.species)} — ${s.name}`;
    nodes.push({
      id: `treegens-${s.id}`, kind: 'action', label,
      canonical: canonicalize(label), source,
      placeId: canonicalize(s.name), h3: cell(s.lat, s.lng),
      orgIds: ['treegens'],
      tags: ['treegens', 'field-team', 'evidence-only'],
      timeframe: {},
      description: [
        `Pre-app field-team plot (${s.planters ?? 'Treegens field team'})`,
        s.plantedSince ? `planted since ${s.plantedSince}` : null,
        s.lastVerified ? `last verified ${s.lastVerified}` : null,
        'filmed plot evidence on world.treegens.app — not an app-verified record',
      ].filter(Boolean).join('; '),
    });
    nodes.push(outcomeNode(`treegens-out-${slug(s.name)}`, s.name, source, ['field-team']));
  }
  return {
    id: 'plan-treegens-archive', source, title: 'Treegens field-team archive plots',
    owner: 'treegens', importedAt: new Date().toISOString(), nodes,
  };
}

export async function fetchTreegens(
  liveUrl = TREEGENS_LIVE_URL, archiveUrl = TREEGENS_ARCHIVE_URL,
): Promise<{ live: ExternalPlan; archive: ExternalPlan }> {
  const [liveRes, archRes] = await Promise.all([fetch(liveUrl), fetch(archiveUrl)]);
  if (!liveRes.ok) throw new Error(`treegens live feed ${liveRes.status}`);
  if (!archRes.ok) throw new Error(`treegens archive feed ${archRes.status}`);
  const [live, archive] = await Promise.all([liveRes.json(), archRes.json()]);
  return { live: fromTreegensFeed(live), archive: fromTreegensArchive(archive) };
}
