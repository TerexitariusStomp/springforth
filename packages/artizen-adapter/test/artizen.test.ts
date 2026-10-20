import { describe, expect, it } from 'vitest';
import { fromJson } from '../src/index.ts';
import { detectComplements } from '@springforth/coordination';

const EXPORT = {
  seasons: [
    { id: 's6', name: 'Season 6 — Solidarity', curators: ['ana', 'maya'],
      startDate: '2026-06-01', endDate: '2026-08-31' },
  ],
  projects: [
    {
      id: 'p1', title: 'Kilifi Mangrove Nursery', owner: 'coast-collective',
      description: 'Community mangrove restoration on the Kenyan coast',
      seasonId: 's6', fundIds: ['s6'], place: 'Kilifi',
      needs: [
        { title: 'Tree seedlings and nursery tools', amount: 800,
          deadline: '2026-11-15',
          description: 'We need seedlings, pots and hand tools' },
      ],
      owed: 1240,          // unpaid artifact proceeds — internal flag only
    },
  ],
  artifacts: [
    {
      projectId: 'p1', title: 'Mangrove Artifact (open edition)',
      tokenPrice: '0.01 ETH', supply: 1000, artistFeePercentage: 10,
      treasurySplitPercentage: 5, contract: '0xART', tokenId: 7,
    },
  ],
};

describe('artizen-adapter', () => {
  const plan = fromJson(EXPORT, 'artizen:test');

  it('season → framework node with curators as stewards', () => {
    const f = plan.nodes.find((n) => n.kind === 'framework')!;
    expect(f.orgIds).toEqual(['ana', 'maya']);
    expect(f.terms).toContain('curators');
  });

  it('project → action node tagged with fund provenance; owed stays internal', () => {
    const p = plan.nodes.find((n) => n.id === 'artizen-proj-p1')!;
    expect(p.kind).toBe('action');
    expect(p.tags).toContain('fund:s6');
    expect(p.tags).toContain('owed-outstanding');
    expect(p.placeId).toBe('kilifi');
  });

  it('project need → need node with deadline, owner and amount', () => {
    const n = plan.nodes.find((x) => x.kind === 'need')!;
    expect(n.timeframe.to).toBe('2026-11-15');
    expect(n.budget).toBe(800);
    expect(n.parentOutcomeId).toBe('artizen-proj-p1');
  });

  it('artifact → offer node carrying edition terms', () => {
    const a = plan.nodes.find((x) => x.kind === 'offer')!;
    expect(a.terms).toContain('0.01 ETH');
    expect(a.terms).toContain('supply 1000');
    expect(a.terms).toContain('creator royalty 10%');
    expect(a.tags).toContain('artifact');
  });

  it('artizen needs match CLC/holons offers via detectComplements', () => {
    const offer = {
      id: 'sarafu-offer-kali', kind: 'offer' as const, label: 'Kalimbo',
      canonical: 'kalimbo tree nursery sell trees seedlings tools',
      source: 'sarafu', orgIds: [], tags: [], timeframe: {},
      description: 'I have a tree nursery that sells seedlings and pots',
      placeId: 'kilifi',
    };
    const recs = detectComplements([...plan.nodes, offer]);
    expect(recs.some((r) => r.nodeIds[0] === 'artizen-need-p1-0'
      && r.nodeIds[1] === 'sarafu-offer-kali')).toBe(true);
  });
});
