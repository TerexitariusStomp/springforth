import { describe, expect, it, vi } from 'vitest';
import { fromClcJson as fromJson, normalizeVoucher, normalizeClcPool, fetchSarafu } from '../src/adapters/formats.ts';

const VOUCHER = {
  id: 42, voucher_address: '0xABC', voucher_name: 'Kalimbo',
  voucher_description: 'I have a tree nursery that i sell trees',
  geo: { x: -4.1735, y: 39.4521 },               // Kwale, Kenya (x=lat, y=lng)
  location_name: 'Kwale', voucher_type: 'GIFTABLE',
  voucher_uoa: 'KES', symbol: 'KALI', voucher_value: 1,
  transaction_count: 5, created_at: '2026-09-01T00:00:00Z',
};
const POOL = {
  contract_address: '0xPOOL', pool_name: 'Kenya ROLA Pool', pool_symbol: 'ROLA',
  description: 'Communities pooling labour vouchers', geo: { x: -1.76, y: 37.65 },
  tags: ['Regenerative Agriculture'], swap_count: '1640', voucher_count: '141',
};

describe('clc-adapter', () => {
  it('normalizes a voucher into an offer node with geo cell + terms', () => {
    const n = normalizeVoucher(VOUCHER, 'sarafu');
    expect(n.kind).toBe('offer');
    expect(n.label).toBe('Kalimbo');
    expect(n.h3).toMatch(/^[0-9a-f]{15}$/);
    expect(n.placeId).toBe('kwale');
    expect(n.terms).toContain('KALI');
    expect(n.terms).toContain('KES');
    expect(n.tags).toContain('voucher');
    expect(n.tags).toContain('active');        // transaction_count > 0
    expect(n.canonical).toContain('nursery');  // description folded into match surface
  });
  it('skips h3 on out-of-range coordinates', () => {
    const n = normalizeVoucher({ ...VOUCHER, geo: { x: 999, y: 0 } });
    expect(n.h3).toBeUndefined();
  });
  it('normalizes a commitment pool into a framework node', () => {
    const n = normalizeClcPool(POOL, 'sarafu');
    expect(n.kind).toBe('framework');
    expect(n.tags).toContain('commitment-pool');
    expect(n.terms).toContain('141 vouchers');
  });
  it('fromJson produces one ExternalPlan of offers + frameworks', () => {
    const plan = fromJson({ vouchers: [VOUCHER], pools: [POOL] }, 'clc:test');
    expect(plan.nodes.map((n) => n.kind).sort()).toEqual(['framework', 'offer']);
    expect(plan.source).toBe('clc:test');
  });
  it('fromJson rejects an empty dataset', () => {
    expect(() => fromJson({ vouchers: [], pools: [] })).toThrow();
  });
  it('fetchSarafu reads the public tRPC surface and honours limit', async () => {
    const trpc = (json: unknown) => ({ result: { data: { json } } });
    const fetchMock = vi.fn(async (u: string | URL) => ({
      ok: true,
      json: async () => String(u).includes('voucher.list') ? trpc([VOUCHER, VOUCHER]) : trpc([POOL]),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);
    const plan = await fetchSarafu('https://example.test', { limit: 1, source: 'sarafu' });
    vi.unstubAllGlobals();
    expect(plan.nodes.filter((n) => n.kind === 'offer')).toHaveLength(1);
    expect(plan.nodes.filter((n) => n.kind === 'framework')).toHaveLength(1);
  });
});
