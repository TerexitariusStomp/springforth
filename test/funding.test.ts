import { describe, expect, it } from 'vitest';
import { allocateMatching, refreshPledge, badgeholders, tallyRound, buildClaim, toHypercertLexicon } from '../src/funding/index.ts';
import type { Donation, Possibility, Pledge, RetroBallot, Appreciation, OracleCheck } from '../src/core';
import type { PlanNode, OverlapRecord } from '../src/coordination';

const round = {
  matchingFund: { amount: 1000, currency: 'USD' },
  eligibleNeedIds: ['n1', 'n2'],
};
const d = (needNodeId: string, donor: string, amount: number): Donation => ({
  id: `d-${needNodeId}-${donor}-${amount}`, roundId: 'r1', needNodeId, donor,
  amount, currency: 'USD', settlement: 'pledged', at: '2026-10-20T00:00:00Z',
});

describe('quadratic matching (Liberal Radicalism)', () => {
  // Published LR example shape: two equal donation totals, different
  // breadth — the broader-supported project takes the larger match.
  it('breadth beats depth: 100×$1 outmatches 1×$100', () => {
    const broad = Array.from({ length: 10 }, (_, i) => d('n1', `donor${i}`, 10));
    const narrow = [d('n2', 'whale', 100)];
    const rows = allocateMatching(round, [...broad, ...narrow]);
    const n1 = rows.find((r) => r.needNodeId === 'n1')!, n2 = rows.find((r) => r.needNodeId === 'n2')!;
    expect(n1.donations).toBe(n2.donations);          // equal direct amounts
    expect(n1.weight).toBeCloseTo(1000);              // (10×√10)² = 1000
    expect(n2.weight).toBeCloseTo(100);               // (1×√100)² = 100
    expect(n1.match).toBeGreaterThan(n2.match);
    expect(n1.match + n2.match).toBeCloseTo(1000, 0); // full fund distributed
  });

  it('empty round distributes nothing', () => {
    const rows = allocateMatching(round, []);
    expect(rows.every((r) => r.match === 0 && r.total === 0)).toBe(true);
  });

  it('capPct limits any single node', () => {
    const rows = allocateMatching(round,
      [d('n1', 'a', 50), d('n1', 'b', 50), d('n2', 'c', 1)], { capPct: 0.5 });
    expect(rows.find((r) => r.needNodeId === 'n1')!.match).toBeLessThanOrEqual(500.01);
  });

  it('ignores donations to non-eligible nodes', () => {
    const rows = allocateMatching(round, [d('nX', 'a', 10), d('n1', 'b', 4)]);
    expect(rows.find((r) => r.needNodeId === 'n1')!.donations).toBe(4);
    expect(rows).toHaveLength(2);
  });
});

const poss = (over: Partial<Possibility>): Possibility => ({
  id: 'p1', title: 'Plant mangroves', description: '', declarerId: 'alice',
  minParticipants: 1, status: 'active',
  createdAt: '2026-10-01T00:00:00Z', ...over,
});
const pledge = (state: Pledge['state'] = 'pending'): Pledge => ({
  id: 'pl1', possibilityId: 'p1', pledger: 'bob', amount: 50, currency: 'USD',
  state, stateAt: '2026-10-10T00:00:00Z',
});
const ctx = (n = 0): { nodes: PlanNode[]; overlaps: OverlapRecord[]; participations: any[] } => ({
  nodes: [], overlaps: [],
  participations: Array.from({ length: n }, (_, i) => ({
    id: `pt${i}`, possibilityId: 'p1', actor: `u${i}`, at: '2026-10-10T00:00:00Z',
  })),
});

describe('dominant-assurance pledges (Tabarrok 1998)', () => {
  it('binds at quorum', () => {
    const p = poss({ minParticipants: 2 });
    expect(refreshPledge(pledge(), p, ctx(2)).state).toBe('bound');
  });
  it('stays pending below quorum', () => {
    const p = poss({ minParticipants: 3 });
    expect(refreshPledge(pledge(), p, ctx(1)).state).toBe('pending');
  });
  it('refunds on expiry — pledge never collected', () => {
    const p = poss({ minParticipants: 5, deadline: '2026-10-15T00:00:00Z' });
    const out = refreshPledge(pledge(), p, ctx(0), Date.parse('2026-10-20T00:00:00Z'));
    expect(out.state).toBe('refunded');
  });
  it('releases when the card completes', () => {
    const p = poss({ status: 'completed' });
    expect(refreshPledge(pledge('bound'), p, ctx()).state).toBe('released');
  });
});

const app = (fromActor: string, toActor: string): Appreciation => ({
  id: `a-${fromActor}-${toActor}`, fromActor, toActor, note: '', at: '2026-10-20T00:00:00Z',
});

describe('retro rounds (RetroPGF)', () => {
  it('badgeholders derive from EigenTrust standing', () => {
    const apps = [app('a', 'b'), app('b', 'a'), app('a', 'c'), app('c', 'a'), app('b', 'c')];
    const holders = badgeholders(apps, 2);
    expect(holders).toHaveLength(2);
    expect(holders).toContain('a');
  });

  it('tally: quadratic aggregation, over-budget ballots discarded', () => {
    const r = { fund: { amount: 100, currency: 'USD' }, claimIds: ['c1', 'c2'], pointsPerBallot: 10 };
    const ballots: RetroBallot[] = [
      { id: 'b1', roundId: 'r', badgeholder: 'h1', weights: { c1: 9, c2: 1 }, at: '2026-10-20T00:00:00Z' },
      { id: 'b2', roundId: 'r', badgeholder: 'h2', weights: { c1: 4, c2: 4 }, at: '2026-10-20T00:00:00Z' },
      { id: 'b3', roundId: 'r', badgeholder: 'h3', weights: { c2: 20 }, at: '2026-10-20T00:00:00Z' }, // over budget — dropped
    ];
    const rows = tallyRound(r, ballots);
    // c1: (√9 + √4)² = (3+2)² = 25 ; c2: (√1 + √4)² = (1+2)² = 9
    const c1 = rows.find((x) => x.claimId === 'c1')!, c2 = rows.find((x) => x.claimId === 'c2')!;
    expect(c1.points).toBeCloseTo(25); expect(c2.points).toBeCloseTo(9);
    expect(c1.amount).toBeCloseTo(100 * 25 / 34, 1);
  });
});

describe('impact claims (hypercerts lexicon shape)', () => {
  it('builds a draft claim from a completed card', () => {
    const p = poss({ status: 'completed', timeStart: '2026-10-05T00:00:00Z' });
    const node: PlanNode = {
      id: 'n1', kind: 'action', label: 'Planting', canonical: 'planting',
      source: 'possibility:p1', orgIds: [], tags: [], timeframe: {}, description: '',
    };
    const chk: OracleCheck = {
      id: 'chk1', nodeId: 'n1', source: 'remote-sensing', domain: 'environmental',
      result: 'match', score: 0.8, detail: '', at: '2026-10-19T00:00:00Z',
    };
    const claim = buildClaim({ possibility: p, nodes: [node], checks: [chk], appreciations: [app('a', 'b')] });
    expect(claim.state).toBe('draft');
    expect(claim.contributors).toContain('alice');
    expect(claim.oracleCheckIds).toEqual(['chk1']);
    const lx = toHypercertLexicon(claim);
    expect(lx.$type).toBe('org.hypercerts.claim.activity');
    expect(lx.contributors).toHaveLength(3);  // declarer + from + to
  });
});
