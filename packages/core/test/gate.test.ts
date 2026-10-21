import { describe, expect, it } from 'vitest';
import { endowmentAccrual, roundDemand } from '../src/gate.js';
import type { FundingRound, Pledge } from '../src/entities.js';

const round = (o: Partial<FundingRound> = {}): FundingRound => ({
  id: 'r1', title: 't', description: '', sponsorIds: [],
  matchingFund: { amount: 100, currency: 'GBP' },
  eligibleNeedIds: ['n1', 'n2'], opensAt: '2026-01-01T00:00:00Z',
  closesAt: '2026-12-31T00:00:00Z', state: 'open', matchingMode: 'lr',
  conviction: false, acceptedTokens: {}, endowment: false, ...o,
});
const pledge = (o: Partial<Pledge>): Pledge => ({
  id: 'p', possibilityId: 'c1', pledger: 'a', amount: 10, currency: 'GBP',
  state: 'pending', stateAt: '2026-01-01T00:00:00Z', ...o,
});
const poss = new Map([['n1', 'c1'], ['n2', 'c2']]);

describe('roundDemand — proven demand before treasury flows', () => {
  it('ungated rounds are always active', () => {
    const g = roundDemand(round(), [], poss);
    expect(g.gated).toBe(false); expect(g.active).toBe(true);
  });
  it('locks until goal and backers met; released pledges do not count', () => {
    const r = round({ pledgeGoal: 100, minBackers: 2 });
    const pls = [
      pledge({ needNodeId: 'n1', pledger: 'a', amount: 60 }),
      pledge({ needNodeId: 'n1', pledger: 'b', amount: 50, state: 'refunded' }),
      pledge({ possibilityId: 'c1', pledger: 'b', amount: 45 }), // via card
    ];
    const g = roundDemand(r, pls, poss);
    expect(g.backers.sort()).toEqual(['a', 'b']);
    expect(g.pledged).toBe(105); expect(g.active).toBe(true);
    expect(roundDemand(r, pls.slice(0, 1), poss).active).toBe(false);
  });
  it('honours the gate currency only', () => {
    const r = round({ pledgeGoal: 100, pledgeGoalCurrency: 'KES' });
    const pls = [pledge({ needNodeId: 'n1', amount: 500 })];
    const g = roundDemand(r, pls, poss);
    expect(g.pledged).toBe(0); expect(g.active).toBe(false);
  });
});

describe('endowmentAccrual — activity fees compound, principal locked', () => {
  it('skims bps off donations to skim rounds only', () => {
    const rnds = [
      round({ id: 'r1', skimBps: 50 }),
      round({ id: 'e1', endowment: true,
        matchingFund: { amount: 1000, currency: 'GBP' } }),
    ];
    const dons = [
      { roundId: 'r1', amount: 200, currency: 'GBP' },
      { roundId: 'e1', amount: 50, currency: 'GBP' },   // no self-skim
      { roundId: 'rx', amount: 999, currency: 'GBP' },  // unknown round
    ];
    const { accrued, principal } = endowmentAccrual(rnds, dons);
    expect(accrued.GBP).toBe(1);                       // 0.5% of 200
    expect(principal.GBP).toBe(1000);
  });
});
