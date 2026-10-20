import { describe, expect, it } from 'vitest';
import {
  effectiveStatus, quorumMet, trustEdges, mutualWeight,
  earnedRecognition, eigenTrust, relTrust,
  scoreCard, identitiesRevealed, viewerDeck, successfulCoordinationsPerWeek,
  PlanNode, OverlapRecord, canonicalize,
} from '../src/index.ts';
import { Appreciation, AssuranceCredit, Pass, Participation, Possibility } from '@springforth/core';

const poss = (over: Partial<Possibility>): Possibility => Possibility.parse({
  id: 'p1', title: 'Plant 500 mangrove seedlings', declarerId: 'coast',
  createdAt: '2026-10-01T00:00:00Z', status: 'active', ...over,
});
const node = (over: Partial<PlanNode>): PlanNode => PlanNode.parse({
  id: 'n1', kind: 'need', label: 'Seedlings',
  canonical: canonicalize('Seedlings'), source: 'possibility:p1', ...over,
});
const rec = (over: Partial<OverlapRecord>): OverlapRecord => OverlapRecord.parse({
  id: 'c1', kind: 'complement', nodeIds: ['need1', 'offer1'],
  evidence: [{ field: 'label', a: 'x', b: 'y', score: 0.8 }],
  confidence: 0.8, reasoning: 'need↔offer', status: 'proposed',
  createdAt: '2026-10-01T00:00:00Z', ...over,
});
const part = (over: Partial<Participation>): Participation => Participation.parse({
  id: 'pt1', possibilityId: 'p1', actor: 'kalimbo', at: '2026-10-05T00:00:00Z', ...over,
});
const appr = (over: Partial<Appreciation>): Appreciation => Appreciation.parse({
  id: 'a1', fromActor: 'coast', toActor: 'kalimbo',
  at: '2026-10-20T00:00:00Z', ...over,
});
const pass = (over: Partial<Pass>): Pass => Pass.parse({
  id: 'ps1', possibilityId: 'p1', actor: 'sandra',
  at: '2026-10-10T00:00:00Z', ...over,
});
const credit = (over: Partial<AssuranceCredit>): AssuranceCredit => AssuranceCredit.parse({
  id: 'ac1', possibilityId: 'p-expired', actor: 'marcus',
  at: '2026-10-11T00:00:00Z', ...over,
});

describe('effectiveStatus — demurrage + completion', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  it('keeps an open possibility active before its deadline', () => {
    expect(effectiveStatus(poss({ deadline: '2027-02-10T00:00:00Z' }), now)).toBe('active');
  });
  it('expires a possibility whose deadline passed without quorum', () => {
    expect(effectiveStatus(poss({ deadline: '2026-10-15T00:00:00Z' }), now)).toBe('expired');
    expect(effectiveStatus(poss({ status: 'draft', deadline: '2026-10-15T00:00:00Z' }), now)).toBe('expired');
  });
  it('completes a quorum possibility once its event window closes', () => {
    expect(effectiveStatus(poss({ status: 'quorum', timeEnd: '2026-10-20T00:00:00Z' }), now)).toBe('completed');
    expect(effectiveStatus(poss({ status: 'quorum', timeEnd: '2027-02-20T00:00:00Z' }), now)).toBe('quorum');
  });
  it('never un-expires or re-opens a terminal state', () => {
    expect(effectiveStatus(poss({ status: 'expired', deadline: '2027-01-01T00:00:00Z' }), now)).toBe('expired');
    // a filed report is terminal — future timeEnd must not revert it
    expect(effectiveStatus(poss({ status: 'completed', timeEnd: '2027-02-20T00:00:00Z' }), now)).toBe('completed');
  });
});

describe('quorumMet — required needs × participant threshold', () => {
  const needs = [
    node({ id: 'need1', possibilityId: 'p1', required: true }),
    node({ id: 'need2', possibilityId: 'p1', required: false }),
    node({ id: 'other', possibilityId: 'other', required: true }),
  ];
  it('requires every required need coordinated AND min participants', () => {
    const coord = [rec({ nodeIds: ['need1', 'offer1'], status: 'coordinated' })];
    expect(quorumMet(poss({ minParticipants: 3 }), needs, coord, 3).met).toBe(true);
    expect(quorumMet(poss({ minParticipants: 3 }), needs, coord, 2).met).toBe(false);
  });
  it('nice-to-have needs never block quorum', () => {
    const coord = [rec({ nodeIds: ['need1', 'offer1'], status: 'confirmed' })];
    const q = quorumMet(poss({ minParticipants: 0 }), needs, coord, 0);
    expect(q).toEqual({ met: true, required: 1, requiredMet: 1 });
  });
  it('proposed complements do not count — human validation gates quorum', () => {
    const proposed = [rec({ nodeIds: ['need1', 'offer1'], status: 'proposed' })];
    expect(quorumMet(poss({ minParticipants: 0 }), needs, proposed, 9).met).toBe(false);
  });
  it('ignores needs from other possibilities', () => {
    expect(quorumMet(poss({ minParticipants: 0 }),
      [node({ id: 'other', possibilityId: 'other', required: true })], [], 0)).toEqual(
      { met: true, required: 0, requiredMet: 0 });
  });
});

describe('trust graph — pairwise edges, mutual recognition', () => {
  const rounds = [
    appr({ fromActor: 'coast', toActor: 'kalimbo' }),
    appr({ id: 'a2', fromActor: 'coast', toActor: 'kalimbo' }),
    appr({ id: 'a3', fromActor: 'kalimbo', toActor: 'coast' }),
    appr({ id: 'a4', fromActor: 'coast', toActor: 'mike' }),
  ];
  it('weights directed edges by round count', () => {
    const e = trustEdges(rounds);
    expect(e.find((x) => x.from === 'coast' && x.to === 'kalimbo')?.weight).toBe(2);
    expect(e.find((x) => x.from === 'coast' && x.to === 'mike')?.mutual).toBe(0);
  });
  it('mutual recognition = min(a→b, b→a)', () => {
    const e = trustEdges(rounds);
    expect(mutualWeight(e, 'coast', 'kalimbo')).toBe(1);  // min(2,1)
    expect(mutualWeight(e, 'coast', 'mike')).toBe(0);      // one-way = none
  });
  it('earned recognition counts mutual-recognition totals only', () => {
    const w = earnedRecognition(trustEdges(rounds));
    // both sides of the mutual pair are credited; mike (one-way) gets nothing
    expect(w).toEqual({ coast: 1, kalimbo: 1 });
    expect(w.mike).toBeUndefined();
  });
});

describe('scoreCard — trust × urgency × cover', () => {
  const needs = [node({ id: 'need1', possibilityId: 'p1', required: true })];
  const parts = [part({}), part({ id: 'pt2', actor: 'mike' })];
  const edges = trustEdges([
    appr({ fromActor: 'viewer', toActor: 'coast' }),
    appr({ id: 'a2', fromActor: 'coast', toActor: 'viewer' }),
  ]);
  const soon = Date.parse('2026-10-18T00:00:00Z');
  it('urgency rises as the deadline approaches', () => {
    const near = scoreCard(poss({ deadline: '2026-10-20T00:00:00Z' }),
      { nodes: needs, overlaps: [], participants: parts, edges: [], now: soon });
    const far = scoreCard(poss({ deadline: '2027-01-01T00:00:00Z' }),
      { nodes: needs, overlaps: [], participants: parts, edges: [], now: soon });
    expect(near.urgency).toBeGreaterThan(far.urgency);
  });
  it('viewer trust proximity personalises ordering', () => {
    const args = { nodes: needs, overlaps: [], participants: parts, edges, now: soon };
    const forViewer = scoreCard(poss({}), { ...args, viewer: 'viewer' });
    const forStranger = scoreCard(poss({}), { ...args, viewer: 'stranger' });
    expect(forViewer.trust).toBeGreaterThan(0);
    expect(forStranger.trust).toBe(0);
    expect(forViewer.score).toBeGreaterThan(forStranger.score);
  });
  it('cover counts coordinated required needs', () => {
    const coord = [rec({ nodeIds: ['need1', 'offer1'], status: 'confirmed' })];
    const met = scoreCard(poss({}), { nodes: needs, overlaps: coord, participants: parts, edges: [], now: soon });
    const unmet = scoreCard(poss({}), { nodes: needs, overlaps: [], participants: parts, edges: [], now: soon });
    expect(met.cover).toBe(1);
    expect(unmet.cover).toBe(0);
    expect(met.score).toBeGreaterThan(unmet.score);
  });
  it('flags the card as tipping once ~30% of quorum progress is reached (KCL finding)', () => {
    // 2/3 participants, 0/1 needs → progress = (2/3 + 0)/2 = 0.33 ≥ 0.3
    const p = poss({ minParticipants: 3 });
    const tipping = scoreCard(p,
      { nodes: needs, overlaps: [], participants: parts, edges: [], now: soon });
    // 0/3 participants → progress 0 → not tipping
    const cold = scoreCard(p,
      { nodes: needs, overlaps: [], participants: [], edges: [], now: soon });
    expect(tipping.tipping).toBe(true);
    expect(cold.tipping).toBe(false);
  });
});

describe('two-ledger reputation + √-normalisation (Bloom FLO)', () => {
  const rounds = [
    appr({ fromActor: 'coast', toActor: 'kalimbo' }),
    appr({ id: 'a2', fromActor: 'coast', toActor: 'kalimbo' }),
    appr({ id: 'a3', fromActor: 'coast', toActor: 'kalimbo' }),
    appr({ id: 'a4', fromActor: 'kalimbo', toActor: 'coast' }),
  ];
  it('earned = Σ mutual received + assurance credits — append-only, unspent', () => {
    const earned = earnedRecognition(trustEdges(rounds), [credit({})]);
    // kalimbo receives mutual=1 (min 3,1); coast receives 1; marcus +1 credit
    expect(earned).toEqual({ coast: 1, kalimbo: 1, marcus: 1 });
  });
  it('steering weights are √(earned) — anti-plutocratic normalization', () => {
    // coast↔kalimbo mutual=4: linear would give weight 4, √ gives 2.
    const big = [
      ...Array.from({ length: 4 }, (_, i) => appr({ id: `f${i}`, fromActor: 'coast', toActor: 'kalimbo' })),
      ...Array.from({ length: 4 }, (_, i) => appr({ id: `b${i}`, fromActor: 'kalimbo', toActor: 'coast' })),
      appr({ id: 's1', fromActor: 'mike', toActor: 'sandra' }),
      appr({ id: 's2', fromActor: 'sandra', toActor: 'mike' }),
    ];
    const w = earnedRecognition(trustEdges(big));
    expect(w.coast).toBe(4);
    expect(w.mike).toBe(1);            // a small bond still counts
  });
});

describe('eigenTrust — transitive propagation on mutual edges', () => {
  it('flows trust through intermediaries (a↔b, b↔c ⇒ c > 0)', () => {
    const edges = trustEdges([
      appr({ fromActor: 'a', toActor: 'b' }),
      appr({ id: 'x1', fromActor: 'b', toActor: 'a' }),
      appr({ id: 'x2', fromActor: 'b', toActor: 'c' }),
      appr({ id: 'x3', fromActor: 'c', toActor: 'b' }),
    ]);
    const vec = eigenTrust(edges);
    expect(vec.c).toBeGreaterThan(0);
    // one-way actors are outside the mutual graph entirely
    expect(vec.d).toBeUndefined();
  });
  it('personalised seeds concentrate near the viewer', () => {
    const edges = trustEdges([
      appr({ fromActor: 'viewer', toActor: 'near' }),
      appr({ id: 'x1', fromActor: 'near', toActor: 'viewer' }),
      appr({ id: 'x2', fromActor: 'near', toActor: 'far' }),
      appr({ id: 'x3', fromActor: 'far', toActor: 'near' }),
    ]);
    const vec = eigenTrust(edges, { seed: 'viewer' });
    expect(vec.near).toBeGreaterThan(vec.far);
    expect(relTrust(vec, 'near')).toBeGreaterThan(relTrust(vec, 'far'));
  });
});

describe('identity gradation + viewer deck (Protocolise Emergence)', () => {
  it('hides participant identities below the reveal threshold', () => {
    const p = poss({});
    expect(identitiesRevealed(p, 0, 'active')).toBe(false);
    expect(identitiesRevealed(p, 0.49, 'active')).toBe(false);
    expect(identitiesRevealed(p, 0.5, 'active')).toBe(true);   // critical mass nears
    expect(identitiesRevealed(p, 0, 'quorum')).toBe(true);     // quorum always reveals
    expect(identitiesRevealed(p, 0, 'completed')).toBe(true);
  });
  it('excludes passed cards from the passer\'s deck only', () => {
    const deck = [poss({}), poss({ id: 'p2' })];
    const passes = [pass({})];
    expect(viewerDeck(deck, passes, 'sandra').map((p) => p.id)).toEqual(['p2']);
    expect(viewerDeck(deck, passes, 'kalimbo')).toHaveLength(2);
    expect(viewerDeck(deck, passes)).toHaveLength(2);          // no viewer → no filtering
  });
});

describe('north-star: successful coordinations (quorum ∧ appreciation)', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  it('counts only quorum cards that got post-event appreciation, within a week', () => {
    const posss = [
      poss({ id: 'win', quorumAt: '2026-10-30T00:00:00Z' }),
      poss({ id: 'quiet', quorumAt: '2026-10-30T00:00:00Z' }),          // quorum, no appreciation
      poss({ id: 'stale', quorumAt: '2026-10-01T00:00:00Z' }),          // appreciated but >7d
    ];
    const apps = [
      appr({ possibilityId: 'win' }),
      appr({ id: 'a2', possibilityId: 'stale' }),
    ];
    expect(successfulCoordinationsPerWeek(posss, apps, now)).toBe(1);
  });
});
