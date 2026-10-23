import { describe, expect, it } from 'vitest';
import { answer, type AgentCtx } from '../src/agent.ts';
import { detectOverlaps, validateOverlap, PlanNode, canonicalize } from '../src/coordination';

const node = (over: Partial<PlanNode>): PlanNode => PlanNode.parse({
  id: 'n1', kind: 'action', label: 'x', canonical: canonicalize('x'), source: 's', ...over,
});

const NODES = [
  node({ id: 'a1', label: 'Wetland restoration', placeId: 'thorntree', source: 'p1' }),
  node({ id: 'a2', label: 'Marsh wetland project', placeId: 'thorntree', source: 'p2',
    timeframe: { from: '2027-01-01' } }),
  node({ id: 'a3', label: 'Solar farm', placeId: 'east', source: 'p2',
    timeframe: { from: '2027-01-01' } }),
];
const ctx = (): AgentCtx => ({ nodes: NODES, overlaps: detectOverlaps(NODES) });

describe('agent', () => {
  it('answers overlap queries with citations', () => {
    const r = answer('what overlaps in thorntree?', ctx());
    expect(r.intent).toBe('overlap');
    expect(r.citedOverlapIds.length).toBeGreaterThan(0);
    expect(r.citedNodeIds).toContain('a1');
  });
  it('explains a flagged pair with field scores', () => {
    const c = ctx();
    const r = answer(`why was ${c.overlaps[0]!.id} flagged?`, c);
    expect(r.intent).toBe('explain');
    expect(r.answer).toContain('confidence');
    expect(r.answer).toContain('place');
  });
  it('suggests validation as the next action when proposals are pending', () => {
    const r = answer('what should we do next?', ctx());
    expect(r.intent).toBe('next');
    expect(r.answer).toContain('validation');
  });
  it('drafts a merge proposal once an overlap is confirmed', () => {
    const c = ctx();
    c.overlaps = [validateOverlap(c.overlaps[0]!, 'lunkhopao', 'confirm')];
    const r = answer('draft the merge proposal', c);
    expect(r.intent).toBe('merge');
    expect(r.answer).toContain('Draft');
    expect(r.citedOverlapIds).toHaveLength(1);
  });
  it('handles empty graph and unknown intents gracefully', () => {
    expect(answer('anything?', { nodes: [], overlaps: [] }).intent).toBe('unknown');
  });
  it('answers standing queries ranked by earned recognition', () => {
    const c: AgentCtx = {
      ...ctx(),
      standing: [
        { id: 'kalimbo', earned: 3, trustScore: 0.82 },
        { id: 'marcus', earned: 1, trustScore: 0.41, assuranceCredits: 1 },
      ],
    };
    const r = answer('who is most trusted?', c);
    expect(r.intent).toBe('standing');
    expect(r.answer).toContain('kalimbo');
    expect(r.answer).toContain('assurance');
  });
  it('answers "what happened" from completed reports', () => {
    const c: AgentCtx = {
      ...ctx(),
      possibilities: [{
        id: 'p1', title: 'Mangrove planting', status: 'completed',
        report: { summary: '480 seedlings planted' },
      }],
    };
    const r = answer('what happened recently?', c);
    expect(r.intent).toBe('report');
    expect(r.answer).toContain('480 seedlings planted');
  });
});
