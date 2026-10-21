import { describe, expect, it } from 'vitest';
import { valueCoordinated } from '../src/valuation.ts';

const GB = { key: 'GB', hourRate: 14.43, currency: 'GBP', source: 'ONS HHSA 2017',
             riskPerHome: 30000, riskSource: 'EA / ABI (2025)' };

describe('valueCoordinated', () => {
  it('sums components per currency without converting', () => {
    const v = valueCoordinated({
      hours: [4, 3, 2],
      donations: [{ amount: 30, currency: 'GBP' }, { amount: 25, currency: 'GBP' },
                  { amount: 1500, currency: 'KES' }],
      matched: [{ amount: 200, currency: 'GBP' }],
      inKind: [{ amount: 120, currency: 'GBP' }],
      needsCost: [{ amount: 150, currency: 'GBP' }],
      benchmark: GB,
    });
    const g = v.byCurrency.GBP, k = v.byCurrency.KES;
    expect(g.committed).toBe(55);
    expect(g.matched).toBe(200);
    expect(g.inKind).toBe(120);
    expect(g.asked).toBe(150);                        // cost of the ask — outside total
    expect(g.volunteerTime).toBeCloseTo(129.87, 2);   // 9h × 14.43
    expect(g.total).toBeCloseTo(504.87, 2);
    expect(k.committed).toBe(1500);
    expect(k.matched).toBe(0);                        // no KES match invented
    expect(k.total).toBe(1500);
    expect(v.hoursTotal).toBe(9);
    expect(v.method.join(' ')).toContain('ONS HHSA 2017');
    expect(v.method.join(' ')).toContain('declared need budgets');
  });

  it('keeps declared hours visible even with no cited rate', () => {
    const v = valueCoordinated({ hours: [5], donations: [], matched: [], inKind: [], needsCost: [] });
    expect(v.hoursTotal).toBe(5);
    expect(Object.keys(v.byCurrency)).toHaveLength(0);
    expect(v.method.join(' ')).toContain('no cited local rate');
  });

  it('returns an empty valuation for a bare card', () => {
    const v = valueCoordinated({ hours: [], donations: [], matched: [], inKind: [], needsCost: [], benchmark: GB });
    expect(v.byCurrency).toEqual({});
    expect(v.hoursTotal).toBe(0);
    expect(v.method).toHaveLength(0);
  });

  it('computes risk mitigated outside the value total', () => {
    const v = valueCoordinated({
      hours: [], donations: [{ amount: 10, currency: 'GBP' }],
      matched: [], inKind: [], needsCost: [],
      householdsProtected: 12, benchmark: GB,
    });
    const g = v.byCurrency.GBP;
    expect(g.riskAvoided).toBe(360_000);
    expect(g.total).toBe(10);                          // risk stays out of total
    expect(v.method.join(' ')).toContain('12 homes declared');
    expect(v.method.join(' ')).toContain('EA / ABI (2025)');
  });

  it('shows protected homes without a cited damage rate', () => {
    const v = valueCoordinated({
      hours: [], donations: [], matched: [], inKind: [], needsCost: [],
      householdsProtected: 5,
    });
    expect(v.method.join(' ')).toContain('5 homes declared protected');
    expect(Object.keys(v.byCurrency)).toHaveLength(0);
  });

  it('never lets volunteer time leak into an uncited currency', () => {
    const v = valueCoordinated({
      hours: [2],
      donations: [{ amount: 100, currency: 'USD' }],
      matched: [], inKind: [], needsCost: [], benchmark: GB,
    });
    expect(v.byCurrency.GBP.volunteerTime).toBeCloseTo(28.86, 2);
    expect(v.byCurrency.USD.committed).toBe(100);
    expect(v.byCurrency.USD.volunteerTime).toBe(0);
  });
});
