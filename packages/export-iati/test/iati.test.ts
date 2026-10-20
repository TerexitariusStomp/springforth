import { describe, expect, it } from 'vitest';
import { toIati } from '../src/index.ts';
import type { FundingRound } from '@springforth/core';

const round: FundingRound = {
  id: 'r1', title: 'Test round', description: '', sponsorIds: ['sponsor-a'],
  matchingFund: { amount: 500, currency: 'USD' },
  eligibleNeedIds: ['n1'],
  opensAt: '2026-10-15T00:00:00Z', closesAt: '2026-11-15T00:00:00Z', state: 'allocated',
  matchingMode: 'lr', conviction: false, acceptedTokens: {},
};

describe('IATI export', () => {
  it('emits valid 2.03 activity XML', () => {
    const xml = toIati({
      round,
      allocation: [{ needNodeId: 'n1', donations: 100, donorCount: 9, weight: 900, match: 450, total: 550 }],
      needLabels: new Map([['n1', 'Boats']]),
      publisherRef: 'XI-SPRING',
    });
    expect(xml).toContain('version="2.03"');
    expect(xml).toContain('<iati-identifier>r1:n1</iati-identifier>');
    expect(xml).toContain('<title><narrative>Boats</narrative></title>');
    expect(xml).toContain('currency="USD"');
  });
});
