import { describe, expect, it } from 'vitest';
import { to360Giving, donations360 } from '../src/index.ts';
import type { FundingRound, Donation } from '@springforth/core';

const round: FundingRound = {
  id: 'r1', title: 'Test round', description: '', sponsorIds: ['sponsor-a'],
  matchingFund: { amount: 500, currency: 'USD' },
  eligibleNeedIds: ['n1', 'n2'],
  opensAt: '2026-10-15T00:00:00Z', closesAt: '2026-11-15T00:00:00Z', state: 'allocated',
  matchingMode: 'lr', conviction: false, acceptedTokens: {},
};
const allocation = [
  { needNodeId: 'n1', donations: 100, donorCount: 9, weight: 900, match: 450, total: 550 },
  { needNodeId: 'n2', donations: 50, donorCount: 1, weight: 100, match: 50, total: 100 },
];

describe('360Giving export', () => {
  it('emits one grant per allocated need', () => {
    const out = to360Giving({
      round, allocation,
      needLabels: new Map([['n1', 'Boats'], ['n2', 'Lunch']]),
      needOwners: new Map([['n1', 'dabaso-fishers']]),
      publisher: { name: 'Springforth', orgId: 'springforth' },
    });
    expect(out.grants).toHaveLength(2);
    const g = out.grants[0]!;
    expect(g.amountAwarded).toBe(550);
    expect(g.recipientOrganization.id).toBe('dabaso-fishers');
    expect(g.fundingOrganization[0]!.id).toBe('sponsor-a');
    expect(g.fromAnOpenCall).toContain('/rounds/r1');
  });
  it('donations360 emits giving records', () => {
    const d: Donation = { id: 'd1', roundId: 'r1', needNodeId: 'n1', donor: 'x',
      amount: 5, currency: 'USD', settlement: 'pledged', at: '2026-10-20T00:00:00Z' };
    expect(donations360(round, [d])).toHaveLength(1);
    expect(donations360(round, [{ ...d, roundId: 'other' }])).toHaveLength(0);
  });
});
