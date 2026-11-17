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

// ── CLC integration lane (src/adapters/clc.ts) ────────────────────────
// The v2 lane projects cosmolocal.credit API state into native entities;
// native write routes are retired (410 + deep link).
import worker, { type Env } from '../src/index.ts';
import {
  clcAppUrl, clcPoolId, clcVoucherId, CLC_API_DEFAULT, CLC_APP_DEFAULT,
} from '../src/adapters/clc.ts';
import { Voucher, CommitmentPool } from '../src/entities.ts';

describe('clc-integration', () => {
  it('projection ids key on the lowercase chain address', () => {
    expect(clcPoolId('0xAbC123')).toBe('clc-0xabc123');
    expect(clcVoucherId('0xDEF')).toBe('clc-0xdef');
  });
  it('clcAppUrl deep-links into the CLC app, env-overridable', () => {
    expect(clcAppUrl({} as Env, '/pools/0xabc'))
      .toBe(`${CLC_APP_DEFAULT}/pools/0xabc`);
    expect(clcAppUrl({ CLC_APP: 'https://app.test' } as Env, '/x'))
      .toBe('https://app.test/x');
  });
  it('API base defaults to api.cosmolocal.credit', () => {
    expect(CLC_API_DEFAULT).toBe('https://api.cosmolocal.credit');
  });
  it('entity schemas carry the projection fields', () => {
    const v = Voucher.parse({
      id: 'clc-0xabc', issuer: 'clc', title: 'KALI', unit: 'KALI',
      supply: 1, createdAt: '2026-01-01T00:00:00.000Z',
      source: 'clc', chainAddress: '0xabc', chainId: 100,
      observedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(v.source).toBe('clc');
    expect(v.chainAddress).toBe('0xabc');
    const p = CommitmentPool.parse({
      id: 'clc-0xpool', name: 'Bay', operator: 'clc', indexUnit: 'index',
      accepted: [], createdAt: '2026-01-01T00:00:00.000Z',
      source: 'clc', chainAddress: '0xpool', chainId: 100, sealState: 7,
      feeAddress: '0xfee', quoterType: 'decimal',
    });
    expect(p.sealState).toBe(7);
    // Local records default source:'local' — no field required.
    expect(Voucher.parse({
      id: 'v', issuer: 'a', title: 't', unit: 'u', supply: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    }).source).toBe('local');
  });
  it('POST /vouchers is retired — 410 with a CLC deep link', async () => {
    const res = await worker.handle(new Request('https://x.test/vouchers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issuer: 'a', supply: 10 }),
    }), {} as Env);
    expect(res.status).toBe(410);
    const body = await res.json() as { error: string; clcUrl: string };
    expect(body.clcUrl).toBe(CLC_APP_DEFAULT + '/');
  });
  it('POST /pools is retired — 410 with a CLC deep link', async () => {
    const res = await worker.handle(new Request('https://x.test/pools', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operator: 'a', name: 'x' }),
    }), {} as Env);
    expect(res.status).toBe(410);
    const body = await res.json() as { clcUrl: string };
    expect(body.clcUrl).toBe(CLC_APP_DEFAULT + '/');
  });
});

describe('clc-holdings projection', () => {
  const T = '2026-11-17T05:00:00.000Z';
  it('projects a raw CLC account-token balance into a clc holding', async () => {
    const { projectHolding } = await import('../src/adapters/clc.ts');
    // Shape of /api/v2/accounts/:a/tokens/latest rows (AccountToken).
    const h = projectHolding('aisha', {
      tokenAddress: '0xAbC4204A5cbdeDDE1e1cf0169C9C29C1a492C778',
      balance: '2500000', tokenDecimals: 6,
    }, T);
    expect(h).not.toBeNull();
    expect(h!.voucherId).toBe('clc-0xabc4204a5cbdedde1e1cf0169c9c29c1a492c778');
    expect(h!.holder).toBe('aisha');
    expect(h!.amount).toBe(2.5);          // raw units ÷ 10^decimals
    expect(h!.source).toBe('clc');
    expect(h!.chainId).toBe(100);
    expect(h!.id).toContain('aisha');
  });
  it('skips rows without a token address', async () => {
    const { projectHolding } = await import('../src/adapters/clc.ts');
    expect(projectHolding('a', { tokenAddress: 'KES', balance: '5' }, T)).toBeNull();
    expect(projectHolding('a', {}, T)).toBeNull();
  });
});

describe('clc-exchange projection', () => {
  const T = '2026-11-17T06:00:00.000Z';
  const POOL_A = '0x1111111111111111111111111111111111111111';
  const TOK_IN = '0x2222222222222222222222222222222222222222';
  const TOK_OUT = '0x3333333333333333333333333333333333333333';
  const INITIATOR = '0x4444444444444444444444444444444444444444';
  const TX = '0x' + 'ab'.repeat(32);
  const EV = {
    poolAddress: POOL_A, initiator: INITIATOR, tokenIn: TOK_IN,
    tokenOut: TOK_OUT, amountIn: 1_000_000n, amountOut: 999_800n,
    poolFee: 200n, protocolFee: 0n,
  };
  const six = () => 6;
  const anon = (a: string) => `addr:${a.toLowerCase()}`;

  it('projects a decoded SwapSettlement into a clc pool_exchange', async () => {
    const { projectExchange } = await import('../src/adapters/clc.ts');
    const ex = projectExchange(EV, 3, TX, six, anon, T);
    expect(ex).not.toBeNull();
    expect(ex!.id).toBe(`clcex-${TX}-3`);
    expect(ex!.poolId).toBe(`clc-${POOL_A}`);
    expect(ex!.actor).toBe(`addr:${INITIATOR}`);
    expect(ex!.give).toEqual({ voucherId: `clc-${TOK_IN}`, amount: 1 });
    expect(ex!.receive).toEqual({ voucherId: `clc-${TOK_OUT}`, amount: 0.9998 });
    expect(ex!.fees.pool).toBeCloseTo(0.0002);       // 200 raw @ 6 dec
    expect(ex!.fees.voucherId).toBe(`clc-${TOK_OUT}`); // fees settle in tokenOut
    expect(ex!.rates.receive).toBeCloseTo(0.9998);   // realized price
    expect(ex!.source).toBe('clc');
    expect(ex!.chainRef).toBe(TX);
    expect(ex!.chainId).toBe(100);
  });
  it('maps a bound wallet initiator to the actor id', async () => {
    const { projectExchange } = await import('../src/adapters/clc.ts');
    const ex = projectExchange(EV, 0, TX, six,
      () => 'actor-aisha', T);
    expect(ex!.actor).toBe('actor-aisha');
  });
  it('drops zero-amount events instead of writing junk rows', async () => {
    const { projectExchange } = await import('../src/adapters/clc.ts');
    expect(projectExchange({ ...EV, amountOut: 0n }, 0, TX, six, anon, T))
      .toBeNull();
  });
});

describe('seal bits', () => {
  it('names the SwapPool.sol parameter bits', async () => {
    const { SEAL_BITS } = await import('../src/adapters/clc.ts');
    expect(SEAL_BITS[1]).toBe('fee');
    expect(SEAL_BITS[8]).toBe('registry');   // curation freeze bit
    expect(Object.keys(SEAL_BITS)).toHaveLength(5);
  });
});

describe('swap-leg dedupe', () => {
  const EV = (li: number, settlement: boolean) => ({
    settlement,
    ev: { poolAddress: '0xAAA', tokenIn: '0xBBB', tokenOut: '0xCCC',
      amountIn: 100n, amountOut: 99n, poolFee: 0n, protocolFee: 0n,
      initiator: '0xDDD' },
    li,
  });
  it('collapses the Swap+SwapSettlement pair to one leg', async () => {
    const { dedupeSwapLegs } = await import('../src/adapters/clc.ts');
    const out = dedupeSwapLegs([EV(6, false), EV(7, true)]);
    expect(out).toHaveLength(1);
    expect(out[0].settlement).toBe(true);        // fee-split variant wins
    expect(out[0].li).toBe(7);                   // settlement log index kept
  });
  it('keeps distinct legs (multi-hop router tx)', async () => {
    const { dedupeSwapLegs } = await import('../src/adapters/clc.ts');
    const a = EV(6, false), aS = EV(7, true);
    const b = { ...EV(14, false), ev: { ...EV(14, false).ev,
      poolAddress: '0xEEE' } };
    expect(dedupeSwapLegs([a, aS, b])).toHaveLength(2);
  });
});
