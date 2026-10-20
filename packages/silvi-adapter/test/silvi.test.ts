import { describe, expect, it } from 'vitest';
import {
  fromSilviProjects, fetchSilviProjects, fetchSilviProject, fetchLeafScore,
  fetchSilviTrees, type SilviProject,
} from '../src/index.ts';

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
  it('fetchSilviProject hits /api/projects/:id and unwraps envelopes', async () => {
    let url = '';
    const spy = ((u: string) => { url = u; return Promise.resolve({ ok: true, json: () => Promise.resolve({ project: kakamega }) }); }) as unknown as typeof fetch;
    const p = await fetchSilviProject(29, 'https://api.test', 'KEY', spy);
    expect(url).toBe('https://api.test/api/projects/29?api_key=KEY');
    expect(p?.name).toBe('Kakamega Forest Agroforestry');
    expect(await fetchSilviProject(29, 'https://x', 'k', fetchJson({}, false))).toBeNull();
    expect(await fetchSilviProject(29, 'https://x', 'k', fetchJson({ unrelated: 1 }))).toBeNull();
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
