import { describe, expect, it } from 'vitest';
import {
  fromJson, fromOcAccounts, toOcDonations, fetchOcAccounts, fetchOcOrders,
  ocError, type OcAccount, type OcOrder,
} from '../src/adapters/oc.ts';

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

// ── Discovery lane (public GraphQL v2) ───────────────────────────────
const webpack: OcAccount = {
  slug: 'webpack', name: 'webpack', description: 'JS bundler',
  currency: 'USD', tags: ['open source'],
  location: { country: null },
  stats: { balance: { value: 90529.54, currency: 'USD' },
    totalAmountReceived: { value: 2007614.11, currency: 'USD' },
    contributorsCount: 3016 },
};
const order: OcOrder = {
  id: 'or_abc', amount: { value: 25, currency: 'USD' },
  createdAt: '2026-10-22T09:14:33Z', status: 'PAID',
  fromAccount: { slug: 'sponsor-1' },
};
const fetchJson = (body: unknown, ok = true) =>
  (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;

describe('fromOcAccounts', () => {
  it('collective → action + standing funding need', () => {
    const plan = fromOcAccounts([webpack]);
    const action = plan.nodes.find((n) => n.id === 'oc-webpack-collective')!;
    expect(action.kind).toBe('action');
    expect(action.budget).toBe(2007614.11);
    const need = plan.nodes.find((n) => n.id === 'oc-webpack-need')!;
    expect(need.kind).toBe('need');
    expect(need.capital).toBe('financial');
  });
});

describe('toOcDonations', () => {
  it('PAID order → settled donation w/ oc: order ref', () => {
    const d = toOcDonations([order], 'webpack')[0]!;
    expect(d.settlement).toBe('settled');
    expect(d.settlementRef).toBe('oc:or_abc');
    expect(d.donor).toBe('oc:sponsor-1');
    expect(d.needNodeId).toBe('oc-webpack-need');
  });
  it('non-PAID stays pledged', () => {
    const d = toOcDonations([{ ...order, status: 'PENDING' }], 'webpack')[0]!;
    expect(d.settlement).toBe('pledged');
  });
});

describe('discovery fetchers', () => {
  it('fetchOcAccounts parses accounts page', async () => {
    const f = fetchJson({ data: { accounts: { totalCount: 107, nodes: [webpack] } } });
    const r = await fetchOcAccounts({ searchTerm: 'forest' }, f);
    expect(r?.totalCount).toBe(107);
    expect(r?.accounts[0]!.slug).toBe('webpack');
  });
  it('fetchOcOrders parses order page', async () => {
    const f = fetchJson({ data: { collective: {
      orders: { totalCount: 1569, nodes: [order] } } } });
    const r = await fetchOcOrders('webpack', {}, f);
    expect(r?.orders[0]!.id).toBe('or_abc');
  });
  it('gql error → null + ocError', async () => {
    const f = fetchJson({ errors: [{ message: 'bad field' }] });
    expect(await fetchOcAccounts({}, f)).toBeNull();
    expect(ocError()).toContain('gql:');
  });
  it('http failure → null', async () => {
    expect(await fetchOcOrders('x', {}, fetchJson({}, false))).toBeNull();
  });
});
