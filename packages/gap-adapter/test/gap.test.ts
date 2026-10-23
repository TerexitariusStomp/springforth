import { describe, expect, it } from 'vitest';
import {
  fetchGapProjectsPage, fetchGapProjects, fromGapProjects,
  toGapChecks, toGapEndorsements, gapLastError, type GapProject,
} from '../src/index.ts';

const lantern: GapProject = {
  uid: '0x26c2dc782f7e98a4df46d88af8b4a9342bd277ccd7c69a4fed21e87631422f42',
  txid: '0x84c4', chainID: 8453,
  createdAt: '2026-10-22T18:17:26Z', updatedAt: '2026-10-22T18:17:26Z',
  attester: '0x7b05', revoked: false,
  type: 'Project',
  details: { data: {
    title: 'Lantern — Filecoin light node', slug: 'lantern',
    description: 'pure-Go PDP light node', missionSummary: 'Verify chain state',
    locationOfImpact: 'Kilifi, Kenya',
    tags: [{ name: 'infrastructure' }],
  } },
  grants: [{
    uid: '0xc20a', txid: '0xg1', chainID: 8453,
    createdAt: '2026-09-01T00:00:00Z',
    data: { title: 'ProPGF Batch 3' },
    details: { data: { title: 'Filecoin ProPGF Batch 3', amount: '50000' } },
    categories: ['infrastructure'],
    milestones: [
      { uid: 'm1', data: { title: 'M1' }, completed: true, approved: true },
      { uid: 'm2', data: { title: 'M2' }, completed: false, approved: false, verified: true },
      { uid: 'm3', data: { title: 'M3' }, completed: false },
    ],
    community: { uid: 'cu', details: { data: { name: 'Filecoin' } } },
  }],
  members: [], impacts: [],
  endorsements: [{ uid: 'e1', attester: '0xdead', chainID: 10, createdAt: '2026-01-01T00:00:00Z' }],
};

const fetchJson = (body: unknown, ok = true) =>
  (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;

describe('fromGapProjects', () => {
  it('project → action node w/ attestation refs; grant → need node', () => {
    const plan = fromGapProjects([lantern]);
    const action = plan.nodes.find((n) => n.kind === 'action')!;
    expect(action.label).toBe('Lantern — Filecoin light node');
    expect(action.description).toContain('EAS attestation 0x26c2');
    expect(action.h3).toMatch(/^[0-9a-f]{15}$/);          // kilifi gazetteer
    const need = plan.nodes.find((n) => n.kind === 'need')!;
    expect(need.label).toContain('Filecoin ProPGF Batch 3');
    expect(need.budget).toBe(50000);
    expect(need.tags).toContain('community:Filecoin');
  });
});

describe('toGapChecks', () => {
  it('milestones → connector oracle-check with verbatim counts', () => {
    const c = toGapChecks([lantern])[0]!;
    expect(c.source).toBe('connector');
    // m1 completed+approved, m2 verified → 2/3 counted done
    expect(c.score).toBeCloseTo(2 / 3);
    expect(c.detail).toContain('1 GAP-verified');
    expect(c.nodeId).toContain('gap-');
    expect(c.result).toBe('match');
  });
  it('no milestones → no check', () => {
    expect(toGapChecks([{ ...lantern, grants: [] }])).toHaveLength(0);
  });
});

describe('toGapEndorsements', () => {
  it('endorsements stay raw records — no trust edges', () => {
    const e = toGapEndorsements([lantern]);
    expect(e).toHaveLength(1);
    expect(e[0]!.attester).toBe('0xdead');
    expect(e[0]!.projectNodeId).toBe('gap-lantern-project');
  });
});

describe('fetchers', () => {
  it('page parses', async () => {
    const f = fetchJson([lantern]);
    expect((await fetchGapProjectsPage(1, f))?.[0]?.uid).toBe(lantern.uid);
  });
  it('http error → null + lastError', async () => {
    expect(await fetchGapProjectsPage(1, fetchJson({}, false))).toBeNull();
    expect(gapLastError()).toContain('http');
  });
  it('fetchGapProjects pages until dup ids', async () => {
    let calls = 0;
    const f = (() => {
      calls++;
      return Promise.resolve({ ok: true, json: () =>
        Promise.resolve(calls === 1 ? [lantern] : calls === 2 ? [{ ...lantern }] : []) });
    }) as unknown as typeof fetch;
    const all = await fetchGapProjects({}, f);
    expect(all).toHaveLength(1);
    expect(calls).toBe(2);
  });
});
