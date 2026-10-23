import { describe, expect, it } from 'vitest';
import {
  fetchBloomLocations, fromBloomLocations, bloomLastError,
} from '../src/index.ts';

// Real-shaped row from the public `locations` table (condensed).
const NE = {
  systemname: 'northeast', brandname: 'Northeast Woodlands Bioregioning Collective',
  placename: 'Northeast US', slug: 'northeast-woodlands-bioregioning-collective',
  description: 'Bioregional regeneration of the Northeastern US.',
  website_url: 'https://www.wellspringcommons.org/bioregioningcollective',
  stage: 'Garden', entity_type: 'Coalition', capital_type: 'Philanthropy',
  continent: 'North America', latitude: 42.990924, longitude: -71.463086,
  wallet: '0x5b6659DECE9153e73C1C3AECd0e3e8B3534495F8',
  published: true, created_at: '2024-12-20T21:12:17Z',
  needs: [
    { category: 'participation', description: 'Sponsors and conveners for the bioregion' },
    { category: 'material', description: 'Event space in New Haven' },
  ],
  offers: [
    { category: 'financial', description: 'Bioregional Financing Facility' },
    { category: 'Social Capital', description: 'Network weaving' },
  ],
  projects: [
    { id: '8274f1e8-a1cf-43ce-8f6c-464de5c0ffaf', name: 'Mycelial Law',
      descrip: 'Rights of Nature law.', funding_url: 'https://myceliallaw.com/' },
    { id: null, name: '', descrip: 'skip me', funding_url: null },
  ],
};

const LOC_NO_GEO = {
  systemname: 'global-web', brandname: 'Global Bloom Web',
  placename: null, stage: 'Seed', published: true,
  needs: [], offers: [{ category: '', description: 'Mutual aid threads' }],
  projects: [],
};

const stub = (body: unknown, status = 200) =>
  async () => new Response(JSON.stringify(body), { status });

describe('fetchBloomLocations', () => {
  it('parses a published locations page', async () => {
    const r = await fetchBloomLocations('k', stub([NE]));
    expect(r).toHaveLength(1);
    expect(r![0]!.brandname).toContain('Bioregioning');
  });
  it('returns null on http error', async () => {
    expect(await fetchBloomLocations('k', stub({ message: 'nope' }, 404))).toBeNull();
    expect(bloomLastError()).toContain('404');
  });
  it('returns null on schema mismatch', async () => {
    expect(await fetchBloomLocations('k', stub('[]bad'))).toBeNull();
  });
  it('returns null with no key', async () => {
    expect(await fetchBloomLocations('', stub([NE]))).toBeNull();
  });
});

describe('fromBloomLocations', () => {
  const plan = fromBloomLocations([NE, LOC_NO_GEO]);

  it('maps a location to a geo-tagged action node', () => {
    const ch = plan.nodes.find((n) => n.id === 'blm-northeast-bloom');
    expect(ch?.kind).toBe('action');
    expect(ch?.h3).toBeTruthy();
    expect(ch?.placeId).toBe('bloom:Northeast US');
    expect(ch?.tags).toContain('bloom-stage:Garden');
    expect(ch?.description).toContain('0x5b6659');   // wallet kept verbatim, as source reference
  });
  it('maps needs verbatim with bloom-need category tags', () => {
    const need = plan.nodes.find((n) => n.id === 'blm-northeast-need-0');
    expect(need?.kind).toBe('need');
    expect(need?.tags).toContain('bloom-need:participation');
  });
  it('maps offers to capital when the vocabulary matches', () => {
    const fin = plan.nodes.find((n) => n.id === 'blm-northeast-offer-0');
    expect(fin?.kind).toBe('offer');
    expect(fin?.capital).toBe('financial');
    const soc = plan.nodes.find((n) => n.id === 'blm-northeast-offer-1');
    expect(soc?.capital).toBe('social');   // "Social Capital" normalized
  });
  it('maps embedded projects, skipping nameless rows', () => {
    const proj = plan.nodes.find((n) => n.id === 'blm-northeast-proj-c0ffaf');
    expect(proj?.kind).toBe('action');
    expect(proj?.terms).toBe('https://myceliallaw.com/');
    expect(plan.nodes.filter((n) => n.id.includes('-proj-'))).toHaveLength(1);
  });
  it('keeps an empty-category offer as a tagged offer with no capital', () => {
    const o = plan.nodes.find((n) => n.id === 'blm-global-web-offer-0');
    expect(o?.kind).toBe('offer');
    expect(o?.capital).toBeUndefined();
    expect(o?.h3).toBeUndefined();
  });
});
