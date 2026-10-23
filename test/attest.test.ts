import { describe, expect, it } from 'vitest';
import { outcomePayload, evaluationPayload, gapUpdatePayload, SCHEMAS } from '../src/attest.ts';
import type { ImpactClaim, OracleCheck } from '../src/core';

const chk = (id: string, result: 'match' | 'mismatch'): OracleCheck => ({
  id, nodeId: 'n1', source: 'remote-sensing', domain: 'environmental',
  result, score: 0.8, detail: '', at: '2026-10-20T00:00:00Z',
});

describe('EAS payloads', () => {
  it('outcome payload carries node ref, evidence hash, score', () => {
    const p = outcomePayload({ nodeId: 'n1', checks: [chk('a', 'match'), chk('b', 'mismatch')] });
    expect(p.schema).toBe(SCHEMAS['springforth.outcome.v1']);
    expect(p.values.score).toBe(50);
    expect(p.values.nodeRef).toMatch(/^0x[0-9a-f]{64}$/);
    expect(p.values.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it('evaluation payload encodes verdict', () => {
    const claim = { id: 'c1' } as ImpactClaim;
    const p = evaluationPayload({ claim, verdict: 'positive', note: 'x' });
    expect(p.values.verdict).toBe(1);
    expect(p.values.claimRef).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('gapUpdatePayload (Karma GAP interop)', () => {
  it('emits GAP-shaped project-update values', () => {
    const p = gapUpdatePayload({ claim: {
      id: 'claim-1', workScope: 'Mida Creek mangrove planting', timeframe: {},
      nodeIds: [], contributors: ['a'], oracleCheckIds: [], appreciationIds: [],
      artifactRefs: [], state: 'draft', createdAt: '2026-01-01T00:00:00Z',
    } });
    expect(p.schema).toContain('refUID');
    expect(p.values.type).toBe('impact-claim');
  });
});
