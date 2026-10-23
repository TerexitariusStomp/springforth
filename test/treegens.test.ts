import { describe, expect, it } from 'vitest';
import { detectOverlaps, PlanNode } from '../src/coordination';
import { fromTreegensArchive, fromTreegensFeed } from '../src/adapters/treegens';

const liveFeed = {
  totalTrees: 500, verifiedTrees: 300,
  plantings: [
    { id: 'aaa1', lat: -3.35264, lng: 39.99246, trees: 344, species: 'mangrove',
      location: 'Kisiwani, Mida Creek, Kilifi County, Kenya', status: 'verified',
      before: '/clips/b1.mp4', after: '/clips/a1.mp4', aiTreeCount: 344,
      filmedBy: 'Jimi', filmedAt: '2026-10-10T13:16:46Z', verifiedAt: '2026-10-12T09:00:00Z' },
    { id: 'bbb2', lat: -3.01911, lng: 40.15789, trees: 156, species: 'mangrove',
      location: 'Gongoni, Magarini, Kilifi County, Kenya', status: 'pending',
      before: '/clips/b2.mp4', after: '/clips/a2.mp4', aiTreeCount: 156,
      filmedBy: 'Amina', filmedAt: '2026-10-11T08:00:00Z', verifiedAt: null },
    { id: 'ccc3', trees: 50, status: 'pending' }, // no coords, no location
  ],
};

const archive = {
  sites: [
    { id: 'pre-kisiwani', name: 'Kisiwani, Mida Creek', country: 'Kenya',
      lat: -3.35264, lng: 39.99246, trees: 48099, species: 'Mangroves',
      planters: 'Treegens field team - Kilifi County', plantedSince: 'Mar 2024' },
    { id: 'pre-mida', name: 'Mida, Dabaso', country: 'Kenya',
      lat: -3.3304, lng: 39.9755, trees: 16600, species: 'Mangroves' },
  ],
};

// Our seeded hero outcome — the shape a community plan contributes.
const midaOutcome: PlanNode = {
  id: 'mo1', kind: 'outcome',
  label: 'Restored mangrove cover and fish-nursery habitat at Mida Creek',
  canonical: 'restored mangrove cover fish nursery habitat mida creek',
  source: 'oneplanet:plan-mida-creek', placeId: 'mida creek',
  orgIds: ['mida-creek-conservation'], tags: [], timeframe: {}, description: '',
};

describe('fromTreegensFeed', () => {
  const plan = fromTreegensFeed(liveFeed);

  it('maps each planting to an action node with provenance', () => {
    const acts = plan.nodes.filter((n) => n.kind === 'action');
    expect(acts).toHaveLength(2); // unmapped+uncoordinated record skipped
    const a = acts.find((n) => n.id === 'treegens-aaa1')!;
    expect(a.h3).toBeTruthy();
    expect(a.placeId).toBe('kisiwani mida creek kilifi county kenya');
    expect(a.timeframe.from).toBe('2026-10-10T13:16:46Z');
    expect(a.description).toContain('AI count 344');
    expect(a.description).toContain('world.treegens.app/clips/b1.mp4');
  });

  it('preserves evidence states — pending is never promoted', () => {
    const a = plan.nodes.find((n) => n.id === 'treegens-aaa1')!;
    const b = plan.nodes.find((n) => n.id === 'treegens-bbb2')!;
    expect(a.tags).toContain('verified');
    expect(b.tags).toContain('pending');
    expect(b.tags).not.toContain('verified');
  });

  it('skips evidence-empty records (no site, no coords)', () => {
    expect(plan.nodes.find((n) => n.id === 'treegens-ccc3')).toBeUndefined();
  });

  it('emits one outcome node per unique site', () => {
    const outs = plan.nodes.filter((n) => n.kind === 'outcome');
    expect(outs).toHaveLength(2);
    expect(outs.map((o) => o.id)).toContain('treegens-out-kisiwani-mida-creek-kilifi-county-kenya');
  });

  it('deterministic ids — re-import is idempotent', () => {
    const again = fromTreegensFeed(liveFeed);
    expect(again.nodes.map((n) => n.id)).toEqual(plan.nodes.map((n) => n.id));
  });

  it('rejects malformed feed', () => {
    expect(() => fromTreegensFeed({ plantings: 'nope' })).toThrow();
  });
});

describe('fromTreegensArchive', () => {
  const plan = fromTreegensArchive(archive);

  it('maps field-team sites as evidence-only actions plus outcomes', () => {
    const a = plan.nodes.find((n) => n.id === 'treegens-pre-kisiwani')!;
    expect(a.kind).toBe('action');
    expect(a.tags).toEqual(expect.arrayContaining(['treegens', 'field-team', 'evidence-only']));
    expect(a.placeId).toBe('kisiwani mida creek');
    expect(plan.nodes.filter((n) => n.kind === 'outcome')).toHaveLength(2);
  });
});

describe('overlap with a community plan', () => {
  it('flags the Mida Creek outcome pair at human-review confidence', () => {
    const nodes = [
      ...fromTreegensArchive(archive).nodes,
      ...fromTreegensFeed(liveFeed).nodes,
      midaOutcome,
    ];
    const flagged = detectOverlaps(nodes);
    const pair = flagged.find((r) =>
      r.nodeIds.includes('treegens-out-kisiwani-mida-creek') && r.nodeIds.includes('mo1'));
    expect(pair).toBeTruthy();
    expect(pair!.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('does not flag far-away sites against Mida Creek', () => {
    const nodes = [...fromTreegensFeed(liveFeed).nodes, midaOutcome];
    const flagged = detectOverlaps(nodes);
    expect(flagged.some((r) =>
      r.nodeIds.some((id) => id === 'treegens-out-gongoni-magarini-kilifi-county-kenya')
      && r.nodeIds.includes('mo1'))).toBe(false);
  });
});
