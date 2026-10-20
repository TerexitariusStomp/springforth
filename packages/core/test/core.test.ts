import { describe, expect, it } from 'vitest';
import { Possibility, Participation, Appreciation, Pass, AssuranceCredit, Signal, OracleCheck } from '../src/entities.ts';
import { AuditLedger } from '../src/ledger.ts';

describe('entities', () => {
  it('parses a possibility card', () => {
    const p = Possibility.parse({
      id: 'p1', title: 'Plant mangroves at Mida Creek', declarerId: 'aisha',
      minParticipants: 3, status: 'active', createdAt: new Date().toISOString(),
    });
    expect(p.status).toBe('active');
  });
  it('parses participation/appreciation/pass/credit/signal/check', () => {
    expect(Participation.parse({ id: 'x', possibilityId: 'p1', actor: 'b', at: '2026-10-20T00:00:00Z' }).actor).toBe('b');
    expect(Appreciation.parse({ id: 'x', fromActor: 'a', toActor: 'b', at: '2026-10-20T00:00:00Z' }).toActor).toBe('b');
    expect(Pass.parse({ id: 'x', possibilityId: 'p1', actor: 'b', at: '2026-10-20T00:00:00Z' }).actor).toBe('b');
    expect(AssuranceCredit.parse({ id: 'x', possibilityId: 'p1', actor: 'b', at: '2026-10-20T00:00:00Z' }).actor).toBe('b');
    expect(Signal.parse({ id: 'x', actor: 'b', targetId: 'n1', targetKind: 'node', intent: 'support', at: '2026-10-20T00:00:00Z' }).intent).toBe('support');
    expect(OracleCheck.parse({
      id: 'x', source: 'remote-sensing', domain: 'environmental',
      result: 'match', score: 0.8, detail: 'd', at: '2026-10-20T00:00:00Z',
    }).result).toBe('match');
  });
});

describe('ledger chain', () => {
  it('chains and verifies', () => {
    const l = new AuditLedger();
    l.append('a', 'possibility.declared', { id: 'p1' });
    l.append('b', 'possibility.joined', { id: 'p1' });
    expect(l.length).toBe(2);
    expect(l.verify().ok).toBe(true);
  });
  it('detects tampering', () => {
    const l = new AuditLedger();
    l.append('a', 'k', { x: 1 });
    const evs = l.toJSON();
    evs.push({ ...evs[0]!, seq: 1, hash: 'bogus' });
    expect(AuditLedger.fromJSON(evs).verify().ok).toBe(false);
  });
});
