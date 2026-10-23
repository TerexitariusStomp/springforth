import { describe, expect, it } from 'vitest';
import {
  regenJurisdictionH3, fromRegen, fetchRegenProjects, regenLastError,
  type RegenProject, type RegenClass, type RegenBatch,
} from '../src/index.ts';

const cls: RegenClass = { id: 'C01', credit_type_abbrev: 'C', admin: 'regen1x' };
const project: RegenProject = {
  id: 'BT01-001', class_id: 'BT01', jurisdiction: 'CO-ANT',
  admin: 'regen1abc', metadata: 'regen:13to.rdf', reference_id: '',
};
const batch: RegenBatch = {
  denom: 'BT01-001-20200101-20201231-001', project_id: 'BT01-001',
  issuer: 'regen1xyz', start_date: '2020-01-01T00:00:00Z',
  end_date: '2020-12-31T00:00:00Z', issuance_date: '2022-05-06T00:00:00Z',
  open: false, metadata: null,
};

const fetchJson = (body: unknown, ok = true) =>
  (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;

describe('regenJurisdictionH3', () => {
  it('maps ISO subdivision → country centroid h3 (coarse)', () => {
    expect(regenJurisdictionH3('CO-ANT')).toMatch(/^[0-9a-f]{15}$/);
    expect(regenJurisdictionH3('AU-QLD')).toMatch(/^[0-9a-f]{15}$/);
  });
  it('unknown jurisdiction → undefined', () => {
    expect(regenJurisdictionH3('XX-99')).toBeUndefined();
    expect(regenJurisdictionH3(null)).toBeUndefined();
  });
});

describe('fromRegen', () => {
  it('project → action node (jurisdiction placeId, geo:centroid); batch → outcome', () => {
    const plan = fromRegen([project], [cls], [batch]);
    const action = plan.nodes.find((n) => n.id === 'regen-BT01-001-project')!;
    expect(action.h3).toMatch(/^[0-9a-f]{15}$/);
    expect(action.tags).toContain('jurisdiction:CO-ANT');
    expect(action.tags).toContain('geo:centroid');
    const out = plan.nodes.find((n) => n.kind === 'outcome')!;
    expect(out.label).toContain('BT01-001-20200101');
    expect(out.parentOutcomeId).toBe('regen-BT01-001-project');
  });
});

describe('fetchRegenProjects', () => {
  it('pages via pagination.next_key until empty', async () => {
    let calls = 0;
    const f = ((url: string) => {
      calls++;
      const hasKey = url.includes('pagination.key=');
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        projects: [project],
        pagination: hasKey ? { next_key: null } : { next_key: 'abc' },
      }) });
    }) as unknown as typeof fetch;
    const all = await fetchRegenProjects(f);
    expect(all).toHaveLength(2);
    expect(calls).toBe(2);
  });
  it('http failure → null + lastError', async () => {
    expect(await fetchRegenProjects(fetchJson({}, false))).toBeNull();
    expect(regenLastError()).toContain('http');
  });
});
