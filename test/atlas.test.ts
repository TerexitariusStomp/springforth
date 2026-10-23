import { describe, expect, it } from 'vitest';
import { liveAtlas, h3Parent } from '../src/adapters/atlas-live.ts';

const fakeFetch = (map: Record<string, unknown>) =>
  (async (url: string) => {
    const k = Object.keys(map).find((p) => url.endsWith(p));
    return { ok: !!k, status: k ? 200 : 404, json: async () => (k ? map[k] : null) };
  });

describe('atlas live client', () => {
  const atlas = liveAtlas('https://x.test', fakeFetch({
    'data/tiles/manifest.json': { animated: { 'hazard__score': { dates: ['2026-10-05', '2026-10-06'] } } },
    'data/values/hazard_2026-10-06.json': { '8397b1fffffffff': [3.1, 2.4, 12, 1, 220.5] },
    'data/api/org/priorities.json': { rows: [
      { intervention_id: 'early_warning_heat', name: 'Heat EWS', country: 'IN', h3: '8697b1b6fffffff', pop: 9500, benefit_per_1000usd: 0.21, benefit_rate: 0.2, evidence_grade: 'B', mission_kind: 'ews_setup' },
      { intervention_id: 'urban_cooling', name: 'Cool roofs', country: 'PK', h3: '87fffffffffffff', pop: 1200, benefit_per_1000usd: 0.1, benefit_rate: 0.1, evidence_grade: 'A', mission_kind: 'cooling_audit' },
    ] },
  }));

  it('snaps any-res h3 to res-3 parent', () => {
    expect(h3Parent('861f1d4d7ffffff', 3)).toBe('831f1dfffffffff');
    expect(h3Parent('8397b1fffffffff', 3)).toBe('8397b1fffffffff');
  });

  it('returns hazard row for the res-3 parent of a finer cell', async () => {
    const h = await atlas.hazard('8697b1b6fffffff');
    expect(h?.score).toBe(3.1);
    expect(h?.heatStreak).toBe(12);
  });

  it('filters priorities by country and res-3 cell', async () => {
    expect((await atlas.priorities({ country: 'IN' })).map((r) => r.intervention_id)).toEqual(['early_warning_heat']);
    expect(await atlas.priorities({ h3: '8697b1b6fffffff' })).toHaveLength(1);
  });
});
