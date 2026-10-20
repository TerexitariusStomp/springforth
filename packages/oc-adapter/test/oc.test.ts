import { describe, expect, it } from 'vitest';
import { fromJson } from '../src/index.ts';

const DATA = {
  collective: { slug: 'artizen', name: 'Artizen Fund',
    description: 'Fund for culture and creativity', currency: 'USD' },
  members: [{ name: 'Roberto', role: 'ADMIN' }],
  tiers: [
    { slug: 'patron', name: 'Patron', amount: 50, interval: 'month' },
    { name: 'Supporter', amount: 10 },
  ],
  expenses: [
    { id: 'e1', title: 'Payout: spring season creators', amount: 4200,
      currency: 'USD', payee: 'venus', status: 'PENDING',
      createdAt: '2026-09-01T00:00:00Z' },
  ],
};

describe('oc-adapter', () => {
  const plan = fromJson(DATA, 'oc:test');

  it('maps collective → framework, tiers → financial offers, expenses → needs', () => {
    const kinds = plan.nodes.map((n) => n.kind);
    expect(kinds).toContain('framework');
    expect(plan.nodes.filter((n) => n.kind === 'offer')).toHaveLength(2);
    expect(plan.nodes.filter((n) => n.kind === 'need')).toHaveLength(1);
  });
  it('tiers carry access terms (what/for whom/when/how)', () => {
    const patron = plan.nodes.find((n) => n.id === 'oc-offer-artizen-patron');
    expect(patron?.terms).toContain('amount 50');
    expect(patron?.terms).toContain('every month');
    expect(patron?.capital).toBe('financial');
  });
  it('expenses become needs with the payee as owner', () => {
    const need = plan.nodes.find((n) => n.kind === 'need');
    expect(need?.orgIds).toEqual(['oc-artizen-payee-venus']);
    expect(need?.tags).toContain('pending');
  });
  it('admins become the framework stewards', () => {
    const fund = plan.nodes.find((n) => n.kind === 'framework');
    expect(fund?.orgIds).toEqual(['oc-artizen-admin-Roberto']);
  });
});
