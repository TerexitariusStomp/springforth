import { describe, expect, it } from 'vitest';
import {
  fetchSoulutionsPage, fetchSoulutionsProjects, fromSoulutionsProjects,
  soulutionsLastError, type SoulutionsProject,
} from '../src/adapters/soulutions.ts';

const sika: SoulutionsProject = {
  id: 'b5d3a604-e1fa-46ea-8ebd-9293c34bf532',
  slug: 'sikafields-agroforestry-mosaic-project',
  name: 'SikaFields: Agroforestry Mosaic Project',
  headline: 'Regenerating rural landscapes',
  status: 1, type: 0,
  totalRaised: 9650, totalDonors: 1, totalGoal: 985000,
  totalGoalPercentage: 0.9797,
  files: [],
  organization: { id: 'o1', slug: 'sika-fields', name: 'Sika Fields ' },
  milestoneCurrent: {
    id: 'm1', name: ' Pilot & Expansion', goal: 265000, raised: 9650,
    percentageRaised: 3.64, files: [],
  },
  categories: ['animals-and-plants', 'sustainable-agriculture-and-nutrition'],
  impactLocations: ['sub-saharan-africa'],
};

const funded: SoulutionsProject = {
  ...sika, id: 'p2', slug: 'done', name: 'Fully funded',
  milestoneCurrent: { id: 'm2', name: 'done', goal: 100, raised: 100, files: [] },
};

const fetchJson = (body: unknown, ok = true) =>
  (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;

describe('fromSoulutionsProjects', () => {
  it('maps project → action + milestone-need + outcome nodes', () => {
    const plan = fromSoulutionsProjects([sika]);
    const action = plan.nodes.find((n) => n.id === `sol-${sika.id}-project`)!;
    expect(action.kind).toBe('action');
    expect(action.orgIds).toContain('soulutions-org-sika-fields');
    const need = plan.nodes.find((n) => n.kind === 'need')!;
    expect(need.budget).toBe(265000 - 9650);
    expect(need.capital).toBe('financial');
    expect(need.label).toContain('$255,350');
    expect(plan.nodes.some((n) => n.kind === 'outcome')).toBe(true);
  });
  it('fully-funded milestones produce no need node', () => {
    const plan = fromSoulutionsProjects([funded]);
    expect(plan.nodes.some((n) => n.kind === 'need')).toBe(false);
  });
  it('keeps status/type verbatim as tags, never promotes to verified', () => {
    const plan = fromSoulutionsProjects([sika]);
    const action = plan.nodes[0]!;
    expect(action.tags).toContain('status:1');
    expect(action.tags).not.toContain('verified');
    expect(action.h3).toBeUndefined();           // region slugs ≠ geometry
    expect(action.placeId).toBe('sub saharan africa');
  });
});

describe('fetchSoulutionsPage', () => {
  it('parses a listing page', async () => {
    const f = fetchJson({ success: true, take: 9, skip: 0, projects: [sika], communities: [] });
    const p = await fetchSoulutionsPage(1, f);
    expect(p?.projects).toHaveLength(1);
  });
  it('returns null on http error and records lastError', async () => {
    const p = await fetchSoulutionsPage(1, fetchJson({}, false));
    expect(p).toBeNull();
    expect(soulutionsLastError()).toContain('http');
  });
  it('returns null on schema mismatch', async () => {
    const p = await fetchSoulutionsPage(1, fetchJson({ projects: 'not-an-array' }));
    expect(p).toBeNull();
  });
});

describe('fetchSoulutionsProjects', () => {
  it('pages until empty and dedupes ids', async () => {
    let calls = 0;
    const f = (() => {
      calls++;
      const body = calls === 1
        ? { projects: [sika] }
        : calls === 2 ? { projects: [sika, funded] } : { projects: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }) as unknown as typeof fetch;
    const all = await fetchSoulutionsProjects({}, f);
    expect(all).toHaveLength(2);
    expect(calls).toBe(3);
  });
});
