// Bloom Network adapter — bloomnetwork.earth is a SvelteKit app backed by
// a public Supabase project; the site's own anonymous read key (shipped in
// its client bundle, RLS-gated to published rows) reads the `locations`
// table: local Bloom chapters with lat/lng, a `stage` lifecycle
// (Seed→Sprout→Garden→Flower), `needs[]`/`offers[]` in the eight-forms-of-
// capital vocabulary, and embedded `projects[]` with funding links.
//
// Mapping:
//   location            → action node (the chapter/organization)
//   needs[]             → need nodes — Bloom categories kept verbatim as
//                         bloom-need:<cat> tags (participation, material,
//                         understanding, protection, creation, subsistence)
//   offers[]            → offer nodes — Bloom categories match Springforth's
//                         capital vocabulary; recognized values set `capital`,
//                         all values stay verbatim in tags either way
//   projects[]          → action nodes under the chapter org, funding_url
//                         preserved in terms (non-custodial reference)
//   wallet              → org surface tag only — never a settlement claim
//
// Nothing is promoted to verified: stages, wallets, and roles are
// self-published metadata and stay verbatim in tags/description.

import { z } from 'zod';
import { latLngToCell } from 'h3-js';
import {
  canonicalize,
  ExternalPlan,
  PlanNode,
  gazetteerLookup,
} from '@springforth/coordination';

const DEFAULT_BASE = 'https://hdkzuqwqcauhtqkrrzjx.supabase.co';

let lastError = '';
export const bloomLastError = () => lastError;

const BloomNeed = z.object({
  category: z.string().nullish(),
  description: z.string().nullish(),
}).passthrough();
const BloomProject = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  descrip: z.string().nullish(),
  description: z.string().nullish(),
  funding_url: z.string().nullish(),
  image_url: z.string().nullish(),
}).passthrough();
const BloomLocation = z.object({
  systemname: z.string().nullish(),
  placename: z.string().nullish(),
  brandname: z.string().nullish(),
  slug: z.string().nullish(),
  description: z.string().nullish(),
  website_url: z.string().nullish(),
  stage: z.string().nullish(),
  entity_type: z.string().nullish(),
  capital_type: z.string().nullish(),
  continent: z.string().nullish(),
  bioregion: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  wallet: z.string().nullish(),
  needs: z.array(BloomNeed).nullish(),
  offers: z.array(BloomNeed).nullish(),
  projects: z.array(BloomProject).nullish(),
  published: z.boolean().nullish(),
  created_at: z.string().nullish(),
}).passthrough();
export type BloomLocation = z.infer<typeof BloomLocation>;

const HEADERS = (key: string) => ({
  apikey: key, authorization: `Bearer ${key}`,
  accept: 'application/json',
  'user-agent': 'springforth-coordination (+https://springforth.widespread.workers.dev)',
});

// PostgREST pages via Range headers; published rows only.
export async function fetchBloomLocations(
  key: string,
  fetchFn: typeof fetch = fetch,
  baseUrl = DEFAULT_BASE,
  pageSize = 200,
): Promise<BloomLocation[] | null> {
  if (!key) { lastError = 'no anon key'; return null; }
  const out: BloomLocation[] = [];
  for (let from = 0; ; from += pageSize) {
    let res: Response;
    try {
      res = await fetchFn(
        `${baseUrl}/rest/v1/locations?published=eq.true&order=systemname.asc`,
        { headers: { ...HEADERS(key), range: `${from}-${from + pageSize - 1}` } });
    } catch (e) { lastError = String(e); return null; }
    if (!res.ok) { lastError = `http ${res.status}`; return null; }
    let rows: unknown;
    try { rows = await res.json(); }
    catch (e) { lastError = `bad json — ${e}`; return null; }
    const parsed = z.array(BloomLocation).safeParse(rows);
    if (!parsed.success) {
      lastError = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join('; ');
      return null;
    }
    out.push(...parsed.data);
    if (parsed.data.length < pageSize) return out;
  }
}

// Recognized Springforth capital values — offers whose category matches
// (case-insensitive, "… Capital" suffix dropped) set the typed field.
const CAPITALS = new Set([
  'living', 'material', 'experiential', 'intellectual',
  'social', 'cultural', 'spiritual', 'financial',
]);
const capitalOf = (cat: string | null | undefined) => {
  const c = (cat ?? '').trim().toLowerCase().replace(/ capital$/, '');
  return CAPITALS.has(c) ? c : undefined;
};

const slugOf = (l: BloomLocation) =>
  (l.systemname ?? l.slug ?? l.brandname ?? 'unnamed')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const placeOf = (l: BloomLocation) => {
  if (l.placename?.trim()) return `bloom:${l.placename.trim()}`;
  return undefined;
};

export function fromBloomLocations(
  locations: BloomLocation[], source = 'bloom:supabase',
): ExternalPlan {
  const nodes: PlanNode[] = [];
  for (const l of locations) {
    const sid = `blm-${slugOf(l)}`;
    const name = (l.brandname?.trim() || l.placename?.trim() || l.systemname
      || 'Unnamed Bloom');
    const url = `https://bloomnetwork.earth/${l.slug ?? l.systemname ?? ''}`;
    const geo = (l.latitude != null && l.longitude != null)
      ? { lat: l.latitude, lon: l.longitude }
      : (l.placename ? gazetteerLookup(l.placename) : null);
    const h3 = geo ? latLngToCell(geo.lat, geo.lon, 5) : undefined;
    const placeId = placeOf(l);
    const stage = l.stage?.trim() || undefined;
    const tags = [
      'bloom-network',
      stage ? `bloom-stage:${stage}` : null,
      l.entity_type ? `entity:${l.entity_type.trim()}` : null,
      l.capital_type ? `funding-preference:${l.capital_type.trim()}` : null,
      l.continent ? `continent:${l.continent.trim()}` : null,
      l.bioregion ? `bioregion:${l.bioregion.trim()}` : null,
    ].filter((x): x is string => !!x);

    nodes.push(PlanNode.parse({
      id: `${sid}-bloom`, kind: 'action',
      label: name,
      canonical: canonicalize(
        `${name} ${l.placename ?? ''} ${l.bioregion ?? ''} ${stage ?? ''}`),
      source, h3, placeId,
      orgIds: [sid], tags,
      description: [
        l.description?.trim() || null,
        l.wallet ? `payout wallet on file at source: ${l.wallet}` : null,
        url,
      ].filter(Boolean).join(' — '),
      terms: l.website_url ?? url,
      capital: l.capital_type?.trim().toLowerCase().includes('philanthrop')
        ? 'financial' : undefined,
    }));

    (l.needs ?? []).forEach((n, i) => {
      const desc = n.description?.trim();
      if (!n.category?.trim() && !desc) return;
      nodes.push(PlanNode.parse({
        id: `${sid}-need-${i}`, kind: 'need',
        label: desc?.slice(0, 90) || `${name} — ${n.category} need`,
        canonical: canonicalize(`${name} needs ${n.category ?? ''} ${desc ?? ''}`),
        source, h3, placeId, orgIds: [sid],
        tags: [...tags, 'bloom-need', `bloom-need:${(n.category ?? '').trim()}`]
          .filter((x) => !x.endsWith(':')),
        description: [desc, `${url} (Bloom ${stage ?? 'chapter'})`]
          .filter(Boolean).join(' — '),
        terms: url,
      }));
    });

    (l.offers ?? []).forEach((o, i) => {
      const desc = o.description?.trim();
      if (!o.category?.trim() && !desc) return;
      nodes.push(PlanNode.parse({
        id: `${sid}-offer-${i}`, kind: 'offer',
        label: desc?.slice(0, 90) || `${name} — ${o.category} offer`,
        canonical: canonicalize(`${name} offers ${o.category ?? ''} ${desc ?? ''}`),
        source, h3, placeId, orgIds: [sid],
        capital: capitalOf(o.category),
        tags: [...tags, 'bloom-offer', `bloom-offer:${(o.category ?? '').trim()}`]
          .filter((x) => !x.endsWith(':')),
        description: [desc, url].filter(Boolean).join(' — '),
        terms: url,
      }));
    });

    (l.projects ?? []).forEach((p, i) => {
      const pname = p.name?.trim();
      if (!pname) return;
      nodes.push(PlanNode.parse({
        id: `${sid}-proj-${p.id?.slice(-6) ?? i}`, kind: 'action',
        label: pname.slice(0, 90),
        canonical: canonicalize(`${pname} ${name} ${l.placename ?? ''}`),
        source, h3, placeId, orgIds: [sid],
        tags: [...tags, 'bloom-project'],
        description: [(p.descrip ?? p.description)?.slice(0, 300), url]
          .filter(Boolean).join(' — '),
        terms: p.funding_url ?? url,
      }));
    });
  }
  return ExternalPlan.parse({
    id: 'plan-bloom', source,
    title: 'Bloom Network — local Bloom chapters',
    owner: 'bloomnetwork.earth',
    importedAt: new Date().toISOString(), nodes,
  });
}
