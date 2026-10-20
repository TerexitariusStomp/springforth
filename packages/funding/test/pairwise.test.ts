import { describe, expect, it } from 'vitest';
import { pairwiseAllocate, allocateMatching } from '../src/index.ts';
import type { Donation, Appreciation } from '@springforth/core';
import { trustEdges } from '@springforth/coordination';

const round = {
  matchingFund: { amount: 1000, currency: 'USD' },
  eligibleNeedIds: ['n1', 'n2', 'n3'],
  opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-11-01T00:00:00Z',
};
const NOW = Date.parse('2026-10-20T00:00:00Z');
const d = (needNodeId: string, donor: string, amount: number, at = '2026-10-19T00:00:00Z'): Donation => ({
  id: `d-${needNodeId}-${donor}-${amount}`, roundId: 'r1', needNodeId, donor,
  amount, currency: 'USD', settlement: 'pledged', at,
});
const app = (from: string, to: string, count = 1): Appreciation[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `a-${from}-${to}-${i}`, possibilityId: 'p1', fromActor: from,
    toActor: to, note: '', at: '2026-10-01T00:00:00Z',
  }));

describe('pairwise coordination-subsidy QF', () => {
  it('degenerates to LR when coordination coefficients are disabled (k=1)', () => {
    const ds = [d('n1', 'a', 25), d('n1', 'b', 25), d('n2', 'c', 50)];
    const pw = pairwiseAllocate(round, ds, [], { alpha: 0, beta: 0, now: NOW });
    const lr = allocateMatching(round, ds);
    for (const r of pw)
      expect(r.weight).toBeCloseTo(lr.find((x) => x.needNodeId === r.needNodeId)!.weight, 6);
  });

  it('mutually-appreciating clique earns less subsidy than a diverse crowd', () => {
    const clique = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const edges = trustEdges(clique.flatMap((a) => clique.filter((b) => b !== a).flatMap((b) => app(a, b))));
    const cliqueDs = clique.map((x) => d('n1', x, 10));
    const crowdDs = ['w1', 'w2', 'w3', 'w4', 'w5'].map((x) => d('n2', x, 10));
    const ds = [...cliqueDs, ...crowdDs];
    const rows = pairwiseAllocate(round, ds, edges, { now: NOW });
    const n1 = rows.find((r) => r.needNodeId === 'n1')!;
    const n2 = rows.find((r) => r.needNodeId === 'n2')!;
    // Under plain LR both needs are symmetric — equal match.
    const lr = allocateMatching(round, ds);
    expect(lr.find((r) => r.needNodeId === 'n1')!.match)
      .toBeCloseTo(lr.find((r) => r.needNodeId === 'n2')!.match, 2);
    // Under pairwise the clique's pairs are discounted — diverse crowd wins.
    expect(n2.weight).toBeGreaterThan(n1.weight);
    expect(n2.match).toBeGreaterThan(n1.match);
  });

  it('bound-wallet donors merge into one actor — no pair subsidy', () => {
    const walletFor = (donor: string) => donor === 'alias1' || donor === 'alias2' ? 'actor-X' : donor;
    // n1: two aliases of one wallet. n2: two real donors with distinct profiles.
    const ds = [
      d('n1', 'alias1', 25), d('n1', 'alias2', 25),
      d('n2', 'real1', 25), d('n2', 'real2', 25), d('n3', 'real2', 25),
    ];
    const rows = pairwiseAllocate(round, ds, [], { walletFor, now: NOW });
    const n1 = rows.find((r) => r.needNodeId === 'n1')!;
    const n2 = rows.find((r) => r.needNodeId === 'n2')!;
    // merged actor: self-term only — no pair subsidy at all.
    expect(n1.donorCount).toBe(1);
    expect(n1.weight).toBeCloseTo(50);
    // real donors: 50 self + pair term k·2·√625 where
    // k = 1/(1 + 2·(1/3)) = 0.6 → 50 + 30 = 80, still beats the merged actor.
    expect(n2.weight).toBeCloseTo(80, 4);
  });

  it('conviction: earlier backing weighs more than last-minute', () => {
    const early = d('n1', 'e', 100, '2026-10-02T00:00:00Z');
    const late = d('n2', 'l', 100, '2026-10-20T00:00:00Z');
    const rows = pairwiseAllocate(round, [early, late], [], { gamma: 0.5, now: NOW });
    const n1 = rows.find((r) => r.needNodeId === 'n1')!;
    const n2 = rows.find((r) => r.needNodeId === 'n2')!;
    expect(n1.weight).toBeGreaterThan(n2.weight);
    const flat = pairwiseAllocate(round, [early, late], [], { gamma: 0, now: NOW });
    expect(flat.find((r) => r.needNodeId === 'n1')!.weight)
      .toBeCloseTo(flat.find((r) => r.needNodeId === 'n2')!.weight, 6);
  });

  it('empty round distributes nothing', () => {
    const rows = pairwiseAllocate(round, [], [], { now: NOW });
    expect(rows.every((r) => r.match === 0)).toBe(true);
  });
});

import { eligibleVoters, tallyProposal, paramValue } from '../src/index.ts';
import type { GovernanceBallot, GovernanceProposal } from '@springforth/core';

describe('trust-gated governance', () => {
  const props: GovernanceProposal = {
    id: 'gov-1', param: 'pairwise.alpha', title: 'Raise alpha', description: '',
    proposedValue: '6', proposer: 'alice', closesAt: '2026-11-01T00:00:00Z',
    state: 'open', createdAt: '2026-10-15T00:00:00Z',
  };
  const apps = [...app('alice','bob'), ...app('bob','alice'), ...app('alice','carol'), ...app('carol','alice')];
  const bal = (voter: string, points: number, support: boolean): GovernanceBallot => ({
    id: `gb-${voter}`, proposalId: 'gov-1', voter, points, support,
    at: '2026-10-16T00:00:00Z',
  });

  it('only EigenTrust-eligible actors vote', () => {
    const voters = eligibleVoters(apps);
    expect(voters).toContain('alice');
    const ballots = [bal('alice', 25, true), bal('mallory', 10000, false)];
    const t = tallyProposal(props, ballots, voters);
    // mallory has no trust edges — her 10k points don't count
    expect(t.forWeight).toBeCloseTo(5);
    expect(t.againstWeight).toBe(0);
    expect(t.turnout).toBe(1);
  });

  it('quadratic cost: 4×points = 2×weight', () => {
    const voters = eligibleVoters(apps);
    const t = tallyProposal(props, [bal('alice', 100, true)], voters);
    expect(t.forWeight).toBeCloseTo(10);
    expect(t.passed).toBe(true);
  });

  it('paramValue falls back to GOVERNABLE default', () => {
    expect(paramValue([], 'pairwise.alpha')).toBe('4');
    expect(paramValue([{ id: 'pairwise.alpha', value: '6', setBy: 'gov-1', updatedAt: '2026-01-01T00:00:00Z' }], 'pairwise.alpha')).toBe('6');
  });
});
