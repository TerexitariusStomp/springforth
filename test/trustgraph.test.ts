import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildScoreTree, canonicalEdges, computeEpoch, inputHash,
  paramsHash, quantizeScores, scoreLeaf, scoreProof, scoresHash,
  trustParams, verifyScoreProof,
} from '../src/trustgraph.ts';
import { eigenTrust } from '../src/possibility.ts';
import type { Appreciation } from '../src/core';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const app = (fromActor: string, toActor: string): Appreciation => ({
  id: `a-${fromActor}-${toActor}`, fromActor, toActor,
  note: '', at: '2026-10-20T00:00:00Z',
});

// Diamond graph: a↔b mutual, b↔c mutual, a→c one-way (no mutual → no flow)
const APPS = [app('a', 'b'), app('b', 'a'), app('a', 'c'), app('b', 'c'), app('c', 'b')];

describe('canonical inputs', () => {
  it('edges sort by (from,to) — inputHash is order-invariant on rows', () => {
    const shuffled = [...APPS].reverse();
    expect(canonicalEdges(shuffled)).toEqual(canonicalEdges(APPS));
    expect(inputHash(canonicalEdges(shuffled))).toBe(inputHash(canonicalEdges(APPS)));
  });

  it('inputHash binds the edge set — a weight change moves it', () => {
    const h = inputHash(canonicalEdges(APPS));
    const fewer = inputHash(canonicalEdges(APPS.slice(0, 4)));
    expect(fewer).not.toBe(h);
  });

  it('paramsHash binds params — alpha change moves it', () => {
    const p = trustParams();
    const q = trustParams({ alpha: 0.5 });
    expect(paramsHash(p)).not.toBe(paramsHash(q));
    expect(paramsHash(p)).toBe(sha(JSON.stringify(p)));
  });
});

describe('quantizeScores', () => {
  const params = trustParams();

  it('remainder invariant: Σ values === poolScale exactly', () => {
    const vecs: Record<string, number>[] = [
      { a: 1, b: 1, c: 1 },
      { a: 0.37, b: 0.63, c: 0.001, d: 0.999 },
      { a: 7, b: 13, c: 19, d: 23, e: 29, f: 31 },
    ];
    for (const vec of vecs) {
      const s = quantizeScores(vec, params.poolScale);
      expect(s.reduce((t, r) => t + r.value, 0)).toBe(params.poolScale);
    }
  });

  it('deterministic: same vector → same split every run', () => {
    const vec = { a: 1 / 3, b: 1 / 3, c: 1 / 3 };
    expect(quantizeScores(vec, 1_000_000)).toEqual(quantizeScores(vec, 1_000_000));
  });

  it('ties break on actor id, not insertion order', () => {
    const fwd = quantizeScores({ x1: 0.5, x2: 0.5 }, 999_999);
    const rev = quantizeScores({ x2: 0.5, x1: 0.5 }, 999_999);
    expect(fwd).toEqual(rev);
    expect(fwd.find((r) => r.actor === 'x1')!.value)
      .toBe(fwd.find((r) => r.actor === 'x2')!.value + 1);
  });

  it('drops zero/negative entries; empty → empty', () => {
    expect(quantizeScores({ a: 0, b: -1 }, 100)).toEqual([]);
    expect(quantizeScores({}, 100)).toEqual([]);
  });
});

describe('score tree + proofs', () => {
  const edges = canonicalEdges(APPS);
  const { scores, outputRoot } = computeEpoch(edges, trustParams());

  it('every leaf verifies against the published root', () => {
    for (const s of scores) {
      const p = scoreProof(scores, s.actor)!;
      expect(p).not.toBeNull();
      expect(verifyScoreProof(outputRoot, s.actor, s.value, p.proof)).toBe(true);
    }
  });

  it('tampered value fails verification', () => {
    const s = scores[0]!;
    const p = scoreProof(scores, s.actor)!;
    expect(verifyScoreProof(outputRoot, s.actor, s.value + 1, p.proof)).toBe(false);
  });

  it('unknown actor → null proof; absent from root', () => {
    expect(scoreProof(scores, 'mallory')).toBeNull();
    const leaf = scoreLeaf('mallory', 500_000);
    expect(verifyScoreProof(outputRoot, 'mallory', 500_000, [leaf])).toBe(false);
  });

  it('odd leaf counts promote without doubling', () => {
    const three = buildScoreTree(
      scores.slice(0, 3).map((s, i) => ({ actor: s.actor, value: 100 + i })));
    const p0 = scoreProof(
      scores.slice(0, 3).map((s, i) => ({ actor: s.actor, value: 100 + i })),
      scores[2]!.actor)!;
    expect(verifyScoreProof(three.root, p0.actor, p0.value, p0.proof)).toBe(true);
  });
});

describe('computeEpoch', () => {
  const edges = canonicalEdges(APPS);
  const params = trustParams();
  const out = computeEpoch(edges, params);

  it('totalValue === poolScale; scoresHash binds the scores blob', () => {
    expect(out.totalValue).toBe(String(params.poolScale));
    expect(out.scoresHash).toBe(scoresHash(out.scores));
    expect(out.scoresHash).toBe(sha(JSON.stringify({ scores: out.scores })));
  });

  it('root recomputes — this is the verifier contract', () => {
    // Independent recompute: re-derive the vector and re-quantize.
    const vec = eigenTrust(edges, { alpha: params.alpha, iters: params.iters });
    const rescores = quantizeScores(vec, params.poolScale);
    expect(rescores).toEqual(out.scores);
    expect(buildScoreTree(rescores).root).toBe(out.outputRoot);
  });

  it('deterministic across param-equal runs', () => {
    expect(computeEpoch(edges, trustParams())).toEqual(out);
  });
});

describe('eigenTrust prior (phase 3 hook)', () => {
  const edges = canonicalEdges(APPS);

  it('no prior → identical to plain eigenTrust', () => {
    const base = eigenTrust(edges);
    expect(eigenTrust(edges, { priorShare: 0 })).toEqual(base);
  });

  it('prior shifts mass toward prior-weighted actors', () => {
    const base = eigenTrust(edges);
    const withPrior = eigenTrust(edges, { prior: { c: 1 }, priorShare: 0.5 });
    // c had no incoming mutual influence beyond b→c flow; prior pulls it up
    expect(withPrior.c!).toBeGreaterThan(base.c ?? 0);
    // mass conserved — sums track at the same order of magnitude
    const sum = (v: Record<string, number>) =>
      Object.values(v).reduce((s, x) => s + x, 0);
    expect(sum(withPrior)).toBeCloseTo(sum(base), 6);
  });

  it('prior-only actor (no edges) gets restart mass', () => {
    const v = eigenTrust(edges, { prior: { ghost: 1 }, priorShare: 0.5 });
    expect(v.ghost).toBeGreaterThan(0);
  });
});
