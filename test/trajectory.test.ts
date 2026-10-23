import { describe, expect, it } from 'vitest';
import { trajectory } from '../src/oracle.ts';
import type { OracleCheck } from '../src/core';

const chk = (id: string, score: number, at: string): OracleCheck & { nodeId: string } => ({
  id, nodeId: 'n1', source: 'remote-sensing', domain: 'environmental',
  result: 'pending', score, detail: '', at,
});

describe('evidence trajectory', () => {
  it('computes slope and naive crossing from reading history', () => {
    const t = trajectory('n1', [
      chk('a', 0.2, '2026-10-01T00:00:00Z'),
      chk('b', 0.4, '2026-10-11T00:00:00Z'),
      chk('c', 0.6, '2026-10-21T00:00:00Z'),
    ]);
    expect(t.readings).toBe(3);
    expect(t.slopePerDay).toBeCloseTo(0.02, 3);
    expect(t.lastScore).toBe(0.6);
    // already above 0.5 → no crossing to project
    expect(t.daysToThreshold).toBeNull();
  });
  it('projects days-to-threshold when trending up from below', () => {
    const t = trajectory('n1', [
      chk('a', 0.1, '2026-10-01T00:00:00Z'),
      chk('b', 0.3, '2026-10-11T00:00:00Z'),
    ], 0.5);
    expect(t.daysToThreshold).toBeCloseTo(10, 0);
  });
  it('handles a single reading honestly — no projection', () => {
    const t = trajectory('n1', [chk('a', 0.9, '2026-10-01T00:00:00Z')]);
    expect(t.daysToThreshold).toBeNull();
    expect(t.slopePerDay).toBe(0);
  });
});
