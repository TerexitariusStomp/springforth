import { describe, expect, it } from 'vitest';
import { exportClaims, toHypercertLexicon } from '../src/index.ts';
import type { ImpactClaim } from '@springforth/core';

const claim: ImpactClaim = {
  id: 'c1', possibilityId: 'p1', nodeIds: ['n1'],
  workScope: 'Plant 1,200 mangrove propagules',
  timeframe: { from: '2027-01-15T08:00:00Z', to: '2027-01-16T14:00:00Z' },
  contributors: ['alice', 'bob'], oracleCheckIds: ['chk1'],
  appreciationIds: [], artifactRefs: ['https://artizen.example/artifact/7'],
  state: 'attested', createdAt: '2026-10-20T00:00:00Z',
};

describe('hypercerts lexicon export', () => {
  it('emits org.hypercerts.claim.activity records', () => {
    const lx = toHypercertLexicon(claim);
    expect(lx.$type).toBe('org.hypercerts.claim.activity');
    expect(lx.workTimeframeFrom).toBe('2027-01-15T08:00:00Z');
    expect(exportClaims([claim])).toHaveLength(1);
  });
});
