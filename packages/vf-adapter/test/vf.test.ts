import { describe, expect, it } from 'vitest';
import { fromJson, normalizeFlow } from '../src/index.js';

// Shapes follow the VF JSON schema (Holo-REA export style) — the same
// model playnet serializes as (@vf Intent …) s-expressions internally.
const export_ = {
  agents: [
    { id: 'ag-kalimbo', name: 'Kalimbo Nursery', note: 'community nursery' },
    { id: 'ag-council', name: 'Calderdale Council Liaison' },
  ],
  resourceSpecifications: [
    { id: 'spec-sandbag', name: 'Sandbag', note: 'filled flood sandbag' },
    { id: 'spec-pump', name: 'Submersible pump' },
  ],
  proposals: [
    { id: 'prop-1', name: 'Flood prep exchange', note: 'upper Calder response' },
  ],
  intents: [
    { id: 'i-1', action: 'use', receiver: 'ag-kalimbo',
      resourceConformsTo: 'spec-sandbag',
      resourceQuantity: { hasNumericalValue: 400, hasUnit: 'one' },
      note: 'need filled sandbags at the hall', atLocation: 'Hebden Bridge',
      inScopeOf: ['ag-kalimbo'], due: '2027-01-17T00:00:00Z' },
    { id: 'i-2', action: 'work', provider: 'ag-council',
      resourceConformsTo: 'spec-pump',
      effortQuantity: { hasNumericalValue: 3, hasUnit: 'hour' },
      note: 'pump testing crew', atLocation: { name: 'Hebden Bridge' },
      satisfiedBy: ['c-1'] },
  ],
  commitments: [
    { id: 'c-1', action: 'work', provider: 'ag-council', receiver: 'ag-kalimbo',
      resourceConformsTo: 'spec-pump',
      effortQuantity: { hasNumericalValue: 3, hasUnit: 'hour' },
      satisfies: 'i-2' },
  ],
  processes: [
    { id: 'pr-1', name: 'Sandbag filling at the hall',
      hasBeginning: '2027-01-24T10:00:00Z', hasEnd: '2027-01-24T16:00:00Z',
      inScopeOf: ['ag-kalimbo'] },
  ],
  economicEvents: [
    { id: 'e-1', action: 'produce', provider: 'ag-kalimbo', receiver: 'ag-kalimbo',
      resourceConformsTo: 'spec-sandbag',
      resourceQuantity: { hasNumericalValue: 380, hasUnit: 'one' },
      fulfills: 'c-1', hasPointInTime: '2027-01-24T15:00:00Z' },
  ],
};

describe('vf adapter', () => {
  it('maps the temporal layers to the plan graph', () => {
    const plan = fromJson(export_, 'vf:playnet');
    const byId = new Map(plan.nodes.map((n) => [n.id, n]));
    expect(plan.nodes.length).toBe(10);
    // intents: receiver-only → need; provider → offer (satisfied → tagged)
    expect(byId.get('vf:playnet-intent-i-1')?.kind).toBe('need');
    expect(byId.get('vf:playnet-intent-i-2')?.kind).toBe('offer');
    expect(byId.get('vf:playnet-intent-i-2')?.tags).toContain('satisfied');
    // commitment → offer tagged committed
    expect(byId.get('vf:playnet-commitment-c-1')?.kind).toBe('offer');
    expect(byId.get('vf:playnet-commitment-c-1')?.tags).toContain('committed');
    // event → action; process → action; spec/proposal → framework; agent → org
    expect(byId.get('vf:playnet-event-e-1')?.kind).toBe('action');
    expect(byId.get('vf:playnet-process-pr-1')?.kind).toBe('action');
    expect(byId.get('vf:playnet-spec-spec-sandbag')?.kind).toBe('framework');
    expect(byId.get('vf:playnet-proposal-prop-1')?.kind).toBe('framework');
    expect(byId.get('vf:playnet-agent-ag-kalimbo')?.kind).toBe('organisation');
    // place + terms flow through
    expect(byId.get('vf:playnet-intent-i-1')?.placeId).toBe('hebden bridge');
    expect(byId.get('vf:playnet-intent-i-1')?.terms).toBe('qty 400 one');
  });

  it('accepts a JSON-LD @graph', () => {
    const plan = fromJson({
      '@graph': [
        { '@type': 'Intent', id: 'i-9', action: 'transfer', receiver: 'ag-x', name: 'spare tarpaulins' },
        { '@type': 'Agent', id: 'ag-x', name: 'Mutual Aid North' },
      ],
    }, 'vf:ld');
    const kinds = plan.nodes.map((n) => n.kind).sort();
    expect(kinds).toEqual(['need', 'organisation']);
  });

  it('a need from a VF intent can match an existing offer', () => {
    const n = normalizeFlow({ action: 'use', receiver: 'x', name: 'Two submersible pumps' }, 'intent', 'vf:t');
    expect(n.kind).toBe('need');
    expect(n.canonical).toContain('submersible pumps');
  });
});
