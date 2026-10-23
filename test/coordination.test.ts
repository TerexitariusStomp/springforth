import { describe, expect, it } from 'vitest';
import {
  detectOverlaps, detectComplements, isNeed, mergeProposal, validateOverlap,
  canonicalize, placeScore, PlanNode, ExternalPlan,
} from '../src/coordination.ts';

const node = (over: Partial<PlanNode>): PlanNode => PlanNode.parse({
  id: 'n1', kind: 'action', label: 'Wetland restoration',
  canonical: canonicalize('Wetland restoration'), source: 'oneplanet:p1', ...over,
});

const THORNTREE = [
  node({ id: 'a1', label: 'Thorntree wetland restoration Q3', placeId: 'thorntree',
    timeframe: { from: '2027-01-01' }, budget: 40000, source: 'oneplanet:plan-cvl',
    description: 'Restore the wetland and reed beds around Thorntree beck' }),
  node({ id: 'a2', label: 'Marsh regeneration project', placeId: 'thorntree',
    timeframe: { from: '2027-02-01' }, budget: 55000, source: 'csv:council-plan',
    description: 'Restore the wetland marsh behind Thorntree park' }),
  node({ id: 'a3', label: 'Youth employment hub', placeId: 'thorntree',
    timeframe: { from: '2027-01-15' }, source: 'oneplanet:plan-cvl' }),
  node({ id: 'a4', label: 'Youth skills and jobs centre', placeId: 'thorntree',
    timeframe: { from: '2027-03-01' }, source: 'csv:council-plan' }),
  node({ id: 'a5', label: 'Solar farm feasibility', placeId: 'middlesbrough-east',
    timeframe: { from: '2027-06-01' }, source: 'csv:council-plan' }),
];

describe('resolver', () => {
  it('flags the planted wetland/marsh overlap with explainable evidence', () => {
    const recs = detectOverlaps(THORNTREE, { now: '2026-10-18T00:00:00Z' });
    const wet = recs.find((r) => r.nodeIds.includes('a1') && r.nodeIds.includes('a2'));
    expect(wet).toBeDefined();
    expect(wet!.confidence).toBeGreaterThanOrEqual(0.3);
    expect(wet!.evidence.map((e) => e.field)).toContain('place');
    expect(wet!.reasoning.length).toBeGreaterThan(10);
  });
  it('flags youth hub/skills centre and ignores unrelated pairs', () => {
    const recs = detectOverlaps(THORNTREE);
    expect(recs.some((r) => r.nodeIds.includes('a3') && r.nodeIds.includes('a4'))).toBe(true);
    expect(recs.some((r) => r.nodeIds.includes('a5'))).toBe(false);
  });
  it('does not compare nodes from the same source plan', () => {
    const recs = detectOverlaps(THORNTREE);
    for (const r of recs) {
      const [a, b] = r.nodeIds.map((id) => THORNTREE.find((n) => n.id === id)!);
      expect(a.source).not.toBe(b.source);
    }
  });
  it('injected scorer contributes embedding evidence', () => {
    const recs = detectOverlaps(THORNTREE, { scorer: () => 0.9 });
    expect(recs.every((r) => r.evidence.some((e) => e.field === 'embedding'))).toBe(true);
  });
  it('h3 prefix proximity scores below exact place match', () => {
    const a = node({ id: 'x', h3: '861f1d4d7ffffff' });
    const same = node({ id: 'y', h3: '861f1d4d7ffffff' });
    const near = node({ id: 'z', h3: '861f1d4e7ffffff' });
    expect(placeScore(a, same)).toBe(1);
    expect(placeScore(a, near)).toBeGreaterThan(0);
    expect(placeScore(a, near)).toBeLessThan(1);
  });
});

describe('validation + proposal', () => {
  it('confirm → confirmed; reject → rejected; audit trail kept', () => {
    const rec = detectOverlaps(THORNTREE)[0]!;
    const confirmed = validateOverlap(rec, 'lunkhopao', 'confirm', 'same site, confirmed with CVL');
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.validations[0]!.actor).toBe('lunkhopao');
    const rejected = validateOverlap(rec, 'vicente', 'reject', 'different catchments');
    expect(rejected.status).toBe('rejected');
  });
  it('mergeProposal drafts joint action text citing both sources', () => {
    const rec = detectOverlaps(THORNTREE)
      .find((r) => r.nodeIds.includes('a1') && r.nodeIds.includes('a2'))!;
    const prop = mergeProposal(rec, THORNTREE);
    expect(prop.sources).toHaveLength(2);
    expect(prop.combinedBudget).toBeGreaterThan(0);
    expect(prop.rationale).toContain('confidence');
  });
});

describe('complements — CLC need × offer', () => {
  const offer = node({ id: 'o1', kind: 'offer', label: 'Thorntree Tool Library',
    placeId: 'thorntree', source: 'clc:sarafu',
    description: 'Tool hire and repair café supplies offered to local projects',
    terms: 'TTOOL · GBP · GIFTABLE' });
  const declaredNeed = node({ id: 'n1', kind: 'need',
    label: 'We need tools for the repair café', placeId: 'thorntree',
    source: 'csv:community-needs',
    description: 'Seeking tool hire and supplies' });
  const implicitNeed = node({ id: 'n2', kind: 'action',
    label: 'We need tree seedlings for reforestation', placeId: 'kwale',
    source: 'csv:needs-2' });
  const plainAction = node({ id: 'n3', kind: 'action',
    label: 'Plant the community orchard', placeId: 'thorntree',
    source: 'csv:needs-2' });
  const otherOffer = node({ id: 'o2', kind: 'offer', label: 'Mango seller',
    placeId: 'mnarani', source: 'clc:sarafu' });
  const sameSourceNeed = node({ id: 'n4', kind: 'need', label: 'Need tools',
    placeId: 'thorntree', source: 'clc:sarafu' });
  const graph = [offer, declaredNeed, implicitNeed, plainAction, otherOffer, sameSourceNeed];

  it('promotes actions with need-verbs but not plain actions', () => {
    expect(isNeed(declaredNeed)).toBe(true);
    expect(isNeed(implicitNeed)).toBe(true);   // "we need" on an action
    expect(isNeed(plainAction)).toBe(false);
    expect(isNeed(offer)).toBe(false);
  });
  it('flags need×offer directionally — [need, offer]', () => {
    const recs = detectComplements(graph, { now: '2026-10-19T00:00:00Z' });
    const hit = recs.find((r) => r.nodeIds.includes('n1') && r.nodeIds.includes('o1'));
    expect(hit).toBeDefined();
    expect(hit!.kind).toBe('complement');
    expect(hit!.nodeIds[0]).toBe('n1');        // need first
    expect(hit!.nodeIds[1]).toBe('o1');        // offer second
    expect(hit!.evidence.map((e) => e.field)).toContain('place');
  });
  it('never flags offer×offer, need×need, or same-source pairs', () => {
    const recs = detectComplements(graph);
    expect(recs.some((r) => r.nodeIds.includes('o1') && r.nodeIds.includes('o2'))).toBe(false);
    expect(recs.some((r) => r.nodeIds.includes('n1') && r.nodeIds.includes('n2'))).toBe(false);
    expect(recs.some((r) => r.nodeIds.includes('n4') && r.nodeIds.includes('o1'))).toBe(false);
  });
  it('respects the top-N record cap', () => {
    const offers = Array.from({ length: 20 }, (_, i) => node({
      id: `ox${i}`, kind: 'offer', label: 'tool hire repair supplies',
      placeId: 'thorntree', source: `clc:s${i}`,
    }));
    const recs = detectComplements([declaredNeed, ...offers], { maxRecords: 5 });
    expect(recs.length).toBeLessThanOrEqual(5);
  });
  it('does not feed offers/needs into the dedup pass', () => {
    const recs = detectOverlaps(graph);
    for (const r of recs)
      for (const id of r.nodeIds)
        expect(['offer', 'need']).not.toContain(graph.find((n) => n.id === id)!.kind);
  });
});

it('ExternalPlan validates adapter output shape', () => {
  const plan = ExternalPlan.parse({
    id: 'p1', source: 'oneplanet:p1', title: 'CVL Community Plan',
    importedAt: '2026-10-18T00:00:00Z', nodes: THORNTREE.slice(0, 2),
  });
  expect(plan.nodes).toHaveLength(2);
});

describe('counter-signals', () => {
  it('records fields that argue against the match when both sides state them', () => {
    const nodes = [
      node({ id: 'c1', label: 'Community orchard planting day',
        placeId: 'thorntree', timeframe: { from: '2027-03-01' },
        source: 'csv:a' }),
      node({ id: 'c2', label: 'Community orchard planting day',
        placeId: 'berwick-hills', timeframe: { from: '2029-11-01' },
        source: 'csv:b' }),
    ];
    const rec = detectOverlaps(nodes).find((r) => r.nodeIds.includes('c1'))!;
    expect(rec).toBeDefined();
    const fields = (rec.counterEvidence ?? []).map((e) => e.field);
    expect(fields).toContain('place');
    expect(fields).toContain('timeframe');
    // counter rows carry both observed values and a zero score
    const place = rec.counterEvidence!.find((e) => e.field === 'place')!;
    expect(place.a).toBe('thorntree');
    expect(place.b).toBe('berwick-hills');
    expect(place.score).toBe(0);
  });
  it('missing data on one side is not a counter-signal', () => {
    const nodes = [
      node({ id: 'd1', label: 'Shared seed library launch', placeId: 'thorntree',
        source: 'csv:a' }),
      node({ id: 'd2', label: 'Shared seed library launch', source: 'csv:b' }),
    ];
    const rec = detectOverlaps(nodes).find((r) => r.nodeIds.includes('d1'))!;
    expect(rec).toBeDefined();
    expect((rec.counterEvidence ?? []).map((e) => e.field)).not.toContain('place');
  });
  it('complements record mismatched place as counter-signal', () => {
    const need = node({ id: 'cn', kind: 'need',
      label: 'We need tools for the repair café', placeId: 'thorntree',
      source: 'csv:community-needs', description: 'Seeking tool hire and supplies' });
    const offer = node({ id: 'co', kind: 'offer', label: 'Thorntree Tool Library',
      placeId: 'redcar', source: 'clc:sarafu',
      description: 'Tool hire and repair café supplies offered to local projects',
      terms: 'TTOOL · GBP · GIFTABLE' });
    const rec = detectComplements([need, offer], { scorer: () => 1 })
      .find((r) => r.nodeIds.includes('cn'))!;
    expect(rec).toBeDefined();
    expect((rec.counterEvidence ?? []).map((e) => e.field)).toContain('place');
  });
});

describe('tri-indicator scoring', () => {
  it('separates strength, materiality and readiness', async () => {
    const { triScore } = await import('../src/coordination.ts');
    const recs = detectOverlaps(THORNTREE, { now: '2026-10-18T00:00:00Z' });
    const wet = recs.find((r) => r.nodeIds.includes('a1') && r.nodeIds.includes('a2'))!;
    const byId = new Map(THORNTREE.map((n) => [n.id, n]));
    const tri = triScore(wet, byId, 55000);
    expect(tri.strength).toBe(wet.confidence);
    expect(tri.materiality).toBeGreaterThan(0);
    expect(tri.materiality).toBeLessThanOrEqual(1);
    expect(tri.readiness).toBeGreaterThan(0);
    expect(tri.readiness).toBeLessThanOrEqual(1);
  });
  it('reports no materiality instead of inventing a budget', async () => {
    const { triScore } = await import('../src/coordination.ts');
    const nodes = [
      node({ id: 't1', label: 'Shared meal kitchen', source: 'csv:a' }),
      node({ id: 't2', label: 'Shared meal kitchen', source: 'csv:b' }),
    ];
    const rec = detectOverlaps(nodes).find((r) => r.nodeIds.includes('t1'))!;
    const tri = triScore(rec, new Map(nodes.map((n) => [n.id, n])));
    expect(tri.materiality).toBeUndefined();
    expect(tri.materialityNote).toBe('no budget data');
  });
  it('rejected records read as not-ready regardless of evidence', async () => {
    const { triScore } = await import('../src/coordination.ts');
    const rec = validateOverlap(
      detectOverlaps(THORNTREE)[0]!, 'vic', 'reject', 'not the same site');
    const tri = triScore(rec, new Map(THORNTREE.map((n) => [n.id, n])));
    expect(tri.readiness).toBe(0);
  });
});

describe('eight forms of capital', () => {
  it('explicit capital wins; otherwise inferred from terms', async () => {
    const { inferCapital, PlanNode } = await import('../src/coordination.ts');
    const mk = (o: object) => PlanNode.parse({
      id: 'x', kind: 'offer', label: 'x', canonical: 'x', source: 's', ...o });
    expect(inferCapital(mk({ capital: 'spiritual', terms: 'KES voucher' }))).toBe('spiritual');
    expect(inferCapital(mk({ terms: 'KES · GIFTABLE' }))).toBe('financial');
    expect(inferCapital(mk({ label: 'Tree seedlings for the nursery' }))).toBe('living');
    expect(inferCapital(mk({ label: 'Mentoring sessions', terms: '2 hours weekly' }))).toBe('experiential');
    expect(inferCapital(mk({ label: 'zzq unrelated' }))).toBeUndefined();
  });
});
