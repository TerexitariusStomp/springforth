import { describe, expect, it } from 'vitest';
import {
  fromSilviProjects, fetchSilviProjects, fetchSilviProject, fetchLeafScore,
  fetchSilviTrees, fetchSilviCampaign, fetchSilviClaims,
  clusterSilviClaims, fromSilviCampaign,
  type SilviProject, type SilviClaim, type SilviCampaign,
} from '../src/adapters/silvi.ts';

const kakamega: SilviProject = {
  id: 29,
  name: 'Kakamega Forest Agroforestry',
  description: 'Farmer-led indigenous reforestation',
  status: 'active', location: 'Kakamega, Kenya', country: 'Kenya',
  campaign: 'Kenya Bioregional', steward: 'Kakamega stewards',
  trees_target: 50000, trees_planted: 12000, trees_verified: 9400,
  species: ['Croton megalocarpus', 'Prunus africana'],
  lat: 0.283, lng: 34.752,
  zones: [
    { id: 'z1', name: 'North block', trees_target: 5000, trees_planted: 5000, lat: 0.29, lng: 34.76 },
    { id: 'z2', name: 'South block', trees_target: 8000, trees_planted: 2100, lat: 0.27, lng: 34.74 },
  ],
  trees: [
    { id: 't1', lat: 0.283, lng: 34.752, species: 'Prunus africana', status: 'verified' },
    { id: 't2', lat: 0.284, lng: 34.751, species: 'Croton megalocarpus', status: 'planted' },
  ],
  stac_url: 'https://stac.silvi.earth/collections/kakamega',
};

const fetchJson = (body: unknown, ok = true) =>
  (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;

describe('fromSilviProjects', () => {
  it('maps projects to h3-bearing action + outcome + zone-need nodes', () => {
    const plan = fromSilviProjects({ projects: [kakamega] });
    const action = plan.nodes.find((n) => n.id === 'silvi-29-project')!;
    expect(action.kind).toBe('action');
    expect(action.h3).toMatch(/^[0-9a-f]{15}$/);
    expect(action.orgIds).toContain('silvi');
    // full zone produces no need; incomplete zone produces one
    const needs = plan.nodes.filter((n) => n.kind === 'need');
    expect(needs).toHaveLength(1);
    expect(needs[0]!.label).toContain('5,900');
    expect(needs[0]!.capital).toBe('living');
    expect(plan.nodes.some((n) => n.kind === 'outcome')).toBe(true);
  });
  it('honours verified counts verbatim — never promotes planted to verified', () => {
    const plan = fromSilviProjects([kakamega]);
    const action = plan.nodes.find((n) => n.id === 'silvi-29-project')!;
    expect(action.label).toContain('9,400 Silvi-verified');
    expect(action.description).toContain('STAC');
  });
});

describe('fetchSilviProjects / fetchSilviTrees', () => {
  it('returns projects on a 200 JSON response', async () => {
    const r = await fetchSilviProjects('https://api.test', 'KEY', fetchJson([kakamega]));
    expect(r).toHaveLength(1);
    const trees = await fetchSilviTrees('https://api.test', 'KEY', fetchJson([kakamega]));
    expect(trees).toHaveLength(2);
    expect(trees![0]!.projectName).toContain('Kakamega');
  });
  it('returns null on HTTP error or non-JSON (auth redirect)', async () => {
    expect(await fetchSilviProjects('https://x', 'k', fetchJson({}, false))).toBeNull();
    expect(await fetchSilviProjects('https://x', 'k',
      (() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('html')) })) as unknown as typeof fetch))
      .toBeNull();
    expect(await fetchSilviProjects('https://x', 'k',
      (() => Promise.reject(new Error('dns'))) as unknown as typeof fetch)).toBeNull();
  });
  it('fetchSilviProject hits /projects/:id?key= and unwraps envelopes', async () => {
    let url = '';
    const spy = ((u: string) => { url = u; return Promise.resolve({ ok: true, json: () => Promise.resolve({ project: kakamega }) }); }) as unknown as typeof fetch;
    const p = await fetchSilviProject(29, 'https://api.test', 'KEY', spy);
    expect(url).toBe('https://api.test/projects/29/?key=KEY');
    expect(p?.name).toBe('Kakamega Forest Agroforestry');
    expect(await fetchSilviProject(29, 'https://x', 'k', fetchJson({}, false))).toBeNull();
    expect(await fetchSilviProject(29, 'https://x', 'k', fetchJson({ unrelated: 1 }))).toBeNull();
  });
});

// Campaign-scoped key surface — verified against the live API
// (admin.silvi.earth/public-api): ?key= auth, /campaigns/:id/ detail,
// /campaigns/:id/claims/ cursor-paginated verified planting claims.
const kenyaUganda: SilviCampaign = {
  id: 5,
  title: 'Kenya/Uganda',
  description: 'Highland reforestation',
  counts: { approved_claims: 12485, pending_claims: 2161, claims_with_a_payment: 12024 },
};

const claim = (id: number, over: Partial<SilviClaim> = {}): SilviClaim => ({
  id,
  review_status: 'approved',
  timestamp: '2024-03-03T10:13:24.966907Z',
  species: 'Croton',
  scientific_name: 'Croton arnhemicus',
  point: { lat: 0.2367, lng: 34.8171 },
  photos: [{ image_url: 'https://ipfs.example/photo' }],
  payment_status: 'paid',
  payments: [
    { role: 'steward', amount: '1.02', token: 'USDC', chain: 'celo',
      tx_hash: '0xabc', explorer_url: 'https://celoscan.io/tx/0xabc' },
    { role: 'evaluator', amount: '0.18', token: 'USDC', chain: 'celo',
      tx_hash: '0xabc', explorer_url: 'https://celoscan.io/tx/0xabc' },
  ],
  ...over,
});

describe('campaign scope — fetch + map', () => {
  it('fetchSilviCampaign hits /campaigns/:id/?key=', async () => {
    let url = '';
    const spy = ((u: string) => { url = u; return Promise.resolve({ ok: true, json: () => Promise.resolve(kenyaUganda) }); }) as unknown as typeof fetch;
    const c = await fetchSilviCampaign(5, 'https://api.test', 'KEY', spy);
    expect(url).toBe('https://api.test/campaigns/5/?key=KEY');
    expect(c?.title).toBe('Kenya/Uganda');
    expect(await fetchSilviCampaign(5, 'https://x', 'k', fetchJson({}, false))).toBeNull();
  });
  it('fetchSilviClaims pages with after/limit/review_status', async () => {
    let url = '';
    const page = { limit: 500, next_after: 6857, claims: [claim(844)] };
    const spy = ((u: string) => { url = u; return Promise.resolve({ ok: true, json: () => Promise.resolve(page) }); }) as unknown as typeof fetch;
    const r = await fetchSilviClaims(5, { after: 100, reviewStatus: 'approved' }, 'https://api.test', 'KEY', spy);
    expect(url).toContain('campaigns/5/claims/');
    expect(url).toContain('key=KEY');
    expect(url).toContain('after=100');
    expect(url).toContain('review_status=approved');
    expect(r!.claims).toHaveLength(1);
    expect(r!.nextAfter).toBe(6857);
    const lastPage = { limit: 500, next_after: null, claims: [claim(1)] };
    const r2 = await fetchSilviClaims(5, {}, 'https://x', 'k', fetchJson(lastPage));
    expect(r2!.nextAfter).toBeNull();
    expect(await fetchSilviClaims(5, {}, 'https://x', 'k', fetchJson({}, false))).toBeNull();
    expect(await fetchSilviClaims(5, {}, 'https://x', 'k', fetchJson({ unrelated: 1 }))).toBeNull();
  });
  it('clusterSilviClaims buckets by degree-grid and keeps verified honest', () => {
    const claims = [
      claim(1), claim(2), claim(3),
      claim(4, { point: { lat: 5.5, lng: 40.1 } }),
      claim(5, { review_status: 'pending' }),
    ];
    const clusters = clusterSilviClaims(claims);
    expect(clusters).toHaveLength(2);
    const main = clusters.find((c) => c.verified > 1)!;
    expect(main.verified).toBe(3);
    expect(main.pending).toBe(1);          // pending counted, never promoted
    expect(main.species).toContain('Croton arnhemicus');
    expect(main.paidUsdc).toBeCloseTo(4.8, 5); // 4 × (1.02 + 0.18)
    expect(main.txSample).toBe('https://celoscan.io/tx/0xabc');
    expect(main.photoCount).toBe(4);
  });
  it('fromSilviCampaign emits cluster actions + campaign outcome', () => {
    const plan = fromSilviCampaign(kenyaUganda, [claim(1), claim(2), claim(3)]);
    const action = plan.nodes.find((n) => n.kind === 'action')!;
    expect(action.id).toMatch(/^silvi-c5-/);
    expect(action.h3).toMatch(/^[0-9a-f]{15}$/);
    expect(action.label).toContain('3 Silvi-verified');
    expect(action.description).toContain('USDC');
    expect(action.tags).toContain('verified');
    const outcome = plan.nodes.find((n) => n.kind === 'outcome')!;
    expect(outcome.label).toContain('Kenya/Uganda');
    expect(outcome.description).toContain('12,485');
  });
  it('claims without coordinates cluster nowhere but stay in totals', () => {
    const clusters = clusterSilviClaims([claim(9, { point: undefined })]);
    expect(clusters).toHaveLength(0);
  });
});

describe('fetchLeafScore', () => {
  const leaf = {
    species: [
      { scientific_name: 'Prunus africana', score: 94 },
      { scientific_name: 'Croton megalocarpus', score: 88 },
      { scientific_name: 'Juniperus procera', score: 81 },
    ],
  };
  it('summarises aptness when the endpoint serves JSON', async () => {
    const r = await fetchLeafScore({ lat: 0.28, lon: 34.75 }, fetchJson(leaf));
    expect(r!.topScore).toBe(94);
    expect(r!.speciesCount).toBe(3);
    expect(r!.topSpecies[0]).toBe('Prunus africana');
  });
  it('returns null while the endpoint is auth-gated (non-JSON redirect)', async () => {
    const r = await fetchLeafScore({ lat: 0, lon: 0 },
      (() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('html')) })) as unknown as typeof fetch);
    expect(r).toBeNull();
    expect(await fetchLeafScore({ lat: 0, lon: 0 }, fetchJson(leaf, false))).toBeNull();
  });
});
