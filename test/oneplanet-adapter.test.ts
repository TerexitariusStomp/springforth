import { describe, expect, it } from 'vitest';
import { fromCsv, fromMarkdown, normalizePlan } from '../src/adapters/oneplanet/index.ts';

const OP_PLAN = {
  id: 'plan-cvl', title: 'Thorntree Community Plan',
  outcomes: [{ id: 'o1', title: 'A greener neighbourhood' }],
  actions: [{
    id: 'a1', title: 'Thorntree wetland restoration Q3', outcomeId: 'o1',
    placeId: 'p1', organisationIds: ['org1'], startDate: '2027-01-01', budget: 40000,
  }],
  organisations: [{ id: 'org1', name: 'Community Ventures Ltd' }],
  places: [{ id: 'p1', name: 'Thorntree' }],
};

describe('oneplanet-adapter', () => {
  it('normalises an API-shaped plan into graph nodes with edges intact', () => {
    const plan = normalizePlan(OP_PLAN);
    expect(plan.nodes.length).toBe(4);
    const action = plan.nodes.find((n) => n.kind === 'action')!;
    expect(action.parentOutcomeId).toBe('oneplanet:plan-cvl-outcome-o1');
    expect(action.placeId).toBe('thorntree');
    expect(action.orgIds).toEqual(['oneplanet:plan-cvl-organisation-org1']);
    expect(action.budget).toBe(40000);
    expect(action.timeframe.from).toBe('2027-01-01');
  });
  it('CSV lane produces the same node shape', () => {
    const plan = fromCsv(
      'kind,label,place,outcome,org,start,budget\naction,Marsh regeneration,thorntree,,council,2027-02-01,55000\noutcome,Greener Thorntree,thorntree,,,,\n',
    );
    const action = plan.nodes.find((n) => n.kind === 'action')!;
    expect(action.label).toBe('Marsh regeneration');
    expect(action.placeId).toBe('thorntree');
    expect(action.budget).toBe(55000);
  });
  it('Markdown lane: headings become outcomes, bullets become actions', () => {
    const plan = fromMarkdown('# Greener Thorntree\n- Restore the wetland\n- Plant 500 trees\n');
    expect(plan.nodes.filter((n) => n.kind === 'outcome')).toHaveLength(1);
    const actions = plan.nodes.filter((n) => n.kind === 'action');
    expect(actions).toHaveLength(2);
    expect(actions[0]!.parentOutcomeId).toBe(plan.nodes[0]!.id);
  });
});
