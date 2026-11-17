// CLC (Cosmo-Local Credit) sync — reads the hosted clc-core API and
// projects its pools, vouchers, and curation state into the native
// entities as source:'clc' rows (docs/CLC-INTEGRATION.md). CLC is the
// settlement layer: these rows are *observations*, never authority —
// every record carries the chainAddress it was seen at so consumers can
// verify against Gnosis instead of trusting the mirror.
//
// Each cycle ends with one `clc.synced` summary event carrying the new-id
// lists plus a digest of everything observed — provenance without an
// event per row.

import { createHash } from 'node:crypto';
import { parseAbi } from 'viem';
import { createHttpClient } from '@clc/api/client/http-client';
import { BackendApiError } from '@clc/api/client/errors';
import { createPoolsClient } from '@clc/api/features/pools/client';
import { createPoolDeployClient } from '@clc/api/features/pools/deploy-client';
import { createAccountsClient } from '@clc/api/features/accounts/client';
import type { PoolDeployPayload } from '@clc/core/features/pools/logic';
import type { ActorWallet, CommitmentPool, Voucher, VoucherHolding } from '../entities';
import { del, get, list, ledgerAppend, put, putMany } from '../store';
import { GNOSIS, publicClientFor } from '../chain';
import { UA } from './fetch';

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// Structural env type — avoids importing Env (index.ts imports us).
export type ClcEnv = {
  DB: D1Database;
  CLC_API?: string;
  CLC_APP?: string;
  CLC_SERVICE_TOKEN?: string;
  GNOSIS_RPC?: string;
};

export const CLC_API_DEFAULT = 'https://api.cosmolocal.credit';
export const CLC_APP_DEFAULT = 'https://cosmolocal.credit';
export const CLC_CHAIN_ID = 100; // Gnosis — all CLC contracts settle here

const PER_PAGE = 100;
const SYNC_TIMEOUT_MS = 15_000;
// Be a good API citizen: detail reads (pool vouchers) are capped per
// cycle and paced — a full catalog sync stays well under rate limits.
const DETAIL_READ_CAP = 60;
const DETAIL_PACE_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRateLimited = (e: unknown) =>
  e instanceof BackendApiError && e.kind === 'rate-limited';

// fetchOk's discipline (UA + 15s timeout) inside the vendored client's
// envelope handling — createHttpClient parses the {ok,result} wrapper.
// When a service token is configured every call carries it: public
// reads ignore it, and account-read/auth-gated routes need it.
const clcFetchWith = (token?: string): typeof fetch => (input, init = {}) =>
  fetch(input, {
    ...init,
    headers: {
      'user-agent': UA,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
    signal: init?.signal ?? AbortSignal.timeout(SYNC_TIMEOUT_MS),
  });

export function clcClient(env: ClcEnv) {
  const http = createHttpClient({
    baseUrl: env.CLC_API ?? CLC_API_DEFAULT,
    fetch: clcFetchWith(env.CLC_SERVICE_TOKEN),
  });
  return { http, pools: createPoolsClient(http),
    accounts: createAccountsClient(http) };
}

// SwapPool public getters — read on-chain so the projection carries the
// contract's own configuration (sealState is the param-freeze bitmask;
// feeAddress is where pool fees accrue), not just the catalog record.
const POOL_STATE_ABI = parseAbi([
  'function sealState() view returns (uint8)',
  'function feeAddress() view returns (address)',
]);

// One multicall batch: [sealState, feeAddress] per pool, allowFailure so
// a single unresponsive pool can't sink the cycle.
async function poolStateOnChain(env: ClcEnv, addrs: `0x${string}`[]) {
  const client = publicClientFor(GNOSIS, env.GNOSIS_RPC);
  const calls = addrs.flatMap((address) => ([
    { address, abi: POOL_STATE_ABI, functionName: 'sealState' as const },
    { address, abi: POOL_STATE_ABI, functionName: 'feeAddress' as const },
  ]));
  const rs = await client.multicall({ contracts: calls, allowFailure: true })
    .catch(() => null);
  if (!rs) return new Map<string, { sealState?: number; feeAddress?: string }>();
  const out = new Map<string, { sealState?: number; feeAddress?: string }>();
  addrs.forEach((a, i) => {
    const seal = rs[i * 2], fee = rs[i * 2 + 1];
    out.set(a.toLowerCase(), {
      sealState: seal?.status === 'success' ? Number(seal.result) : undefined,
      feeAddress: fee?.status === 'success' ? String(fee.result) : undefined,
    });
  });
  return out;
}

// Service-token client for server-side writes (pool deployment). The
// vendored deploy client POSTs /api/v2/contracts/pool; clc-core expects
// the service JWT as a bearer — injected by the fetch wrapper.
export function clcAuthedClient(env: ClcEnv) {
  const token = env.CLC_SERVICE_TOKEN;
  if (!token) return null;
  const http = createHttpClient({
    baseUrl: env.CLC_API ?? CLC_API_DEFAULT,
    fetch: clcFetchWith(token),
  });
  return { http, deploy: createPoolDeployClient(http) };
}

// Deep-link target for wallet-side flows (swap, redeem, pool pages) —
// CLC's app owns signing UX; we point at it, never replicate it.
export const clcAppUrl = (env: ClcEnv, path: string) =>
  `${env.CLC_APP ?? CLC_APP_DEFAULT}${path}`;

export const clcVoucherId = (address: string) => `clc-${address.toLowerCase()}`;
export const clcPoolId = (address: string) => `clc-${address.toLowerCase()}`;

// Token balance → holding projection. Pure: the sync's DB-write path is
// exercised by pools/vouchers; this mapping is what's unit-tested.
export const projectHolding = (
  actor: string,
  t: { tokenAddress?: string; balance?: string; tokenDecimals?: number },
  observedAt: string,
): VoucherHolding | null => {
  const addr = (t.tokenAddress ?? '').toLowerCase();
  if (!addr.startsWith('0x')) return null;
  return {
    id: `hold-${actor}-${clcVoucherId(addr)}`, holder: actor,
    voucherId: clcVoucherId(addr),
    amount: Number(t.balance ?? 0) / 10 ** (t.tokenDecimals ?? 0),
    updatedAt: observedAt,
    source: 'clc', chainAddress: addr, chainId: CLC_CHAIN_ID, observedAt,
  };
};

type MarketVoucher = {
  address?: string; name?: string; symbol?: string;
  locationName?: string; kind?: string; chainId?: number;
  iconUrl?: string | null;
};

type VoucherPage = { vouchers?: MarketVoucher[]; first?: number; last?: number };

async function* pages<T extends { last?: number }>(
  fetch: (cursor?: number) => Promise<T>,
  startCursor?: number,
) {
  let cursor: number | undefined = startCursor;
  for (;;) {
    const page = await fetch(cursor);
    yield page;
    const count = (page as { vouchers?: unknown[]; pools?: unknown[] });
    const n = (count.vouchers ?? count.pools ?? []).length;
    if (page.last === undefined || n < PER_PAGE) return;
    cursor = page.last;
  }
}

// ── Resumable sync state ─────────────────────────────────────────────
// The Worker invocation runs under a ~50-subrequest budget (free plan —
// every D1-proxy call AND every upstream fetch bills one). A full
// first-time catalog sync needs ~150; the state row lets one logical
// cycle span multiple invocations: each resumes exactly where the last
// budget check tripped. Steady-state cycles finish in one invocation.
type SyncState = {
  detailsRemaining?: `0x${string}`[]; // pool addrs still needing curation reads
  voucherCursor?: number;             // market-voucher keyset resume point
  walletIdx?: number;                 // actor-wallet resume index
};
const SYNC_STATE_ID = 'clc-sync-state';
// Upstream fetch cap per invocation — ~34 upstream + ~12 proxy calls
// stays under the free-plan 50-subrequest ceiling.
const UPSTREAM_BUDGET = 34;

// One sync cycle: pull pools + market vouchers + bound-wallet holdings,
// write projections in batches, ledger one digest event.
//
// Cost discipline: preload existing projections once per kind, diff in
// memory (minus observedAt), putMany only the dirty rows — a steady-state
// cycle is ~6 reads + 1 ledger append and ~15 upstream fetches. The
// single `clc.synced` event carries new-id lists plus a digest of
// everything observed — provenance without an event per row.
export async function syncClc(env: ClcEnv, opts?: { budget?: number }): Promise<{
  pools: number; vouchers: number; newPools: number; newVouchers: number;
  holdings: number; detailReads: number; partial: boolean; resumed: boolean;
  upstreamCalls: number;
}> {
  const budget = opts?.budget ?? UPSTREAM_BUDGET;
  // Every upstream call (clc-core API + chain RPC) bills one subrequest;
  // meter them all through the client fetch wrapper.
  const meter = { n: 0 };
  const meteredFetch: typeof fetch = (input, init) => {
    meter.n++;
    return clcFetchWith(env.CLC_SERVICE_TOKEN)(input, init);
  };
  const http = createHttpClient({
    baseUrl: env.CLC_API ?? CLC_API_DEFAULT, fetch: meteredFetch,
  });
  const pools = createPoolsClient(http);
  const accounts = createAccountsClient(http);
  const overBudget = () => meter.n >= budget;

  const observedAt = new Date().toISOString();
  let detailReads = 0, partial = false, resumed = false;
  const seenHash: string[] = [];

  const [existingPools, existingVouchers, prior] = await Promise.all([
    list<CommitmentPool>(env.DB, 'commitment-pool'),
    list<Voucher>(env.DB, 'voucher'),
    get<SyncState>(env.DB, 'clc-sync', SYNC_STATE_ID),
  ]);
  const poolById = new Map(existingPools.map((p) => [p.id, p]));
  const voucherById = new Map(existingVouchers.map((v) => [v.id, v]));
  const state: SyncState = prior ?? {};

  // Steady-state writes: observedAt refreshes every cycle, so compare
  // content minus observedAt — an unchanged upstream row keeps its
  // existing row (observedAt then reads "when this projection last
  // changed", which is the provenance a verifier wants anyway). Only
  // dirty rows reach putMany — zero wasted writes.
  const stripObs = (o: unknown) =>
    JSON.stringify({ ...(o as object), observedAt: undefined });
  const dirty = <T extends { id: string }>(rows: { id: string; obj: T }[],
    byId: Map<string, T>) =>
    rows.filter((r) => {
      const ex = byId.get(r.id);
      return !ex || stripObs(ex) !== stripObs(r.obj);
    });

  // ── Phase: pool catalog (needed by details — always refetched) ────
  type PoolInput = { row: CommitmentPool; addr: `0x${string}`; updatedAt?: string };
  const poolInputs: PoolInput[] = [];
  try {
    for await (const page of pages((cursor) =>
      // `next` only travels with a cursor — a bare next:true reads as
      // "page after cursor 0" and returns an empty page.
      pools.getPools(cursor === undefined
        ? { perPage: PER_PAGE }
        : { perPage: PER_PAGE, cursor, next: true }))) {
      for (const p of page.pools) {
        const addr = (p.address ?? '').toLowerCase();
        if (!addr.startsWith('0x')) continue;
        const id = clcPoolId(addr);
        const existing = poolById.get(id);
        poolInputs.push({
          addr: addr as `0x${string}`, updatedAt: p.updatedAt,
          row: {
            ...(existing ?? {}),
            id,
            name: p.name ?? addr,
            description: p.description ?? '',
            operator: p.ownerAddress ?? 'clc',
            indexUnit: p.unitOfAccount ?? 'index',
            accepted: existing?.accepted ?? [],
            poolFeeBps: p.feePpm != null ? Math.round(p.feePpm / 100)
              : (existing?.poolFeeBps ?? 0),
            protocolFeeBps: existing?.protocolFeeBps ?? 0,
            protocolFeeSink: existing?.protocolFeeSink ?? 'protocol',
            feeAddress: p.feeAddress ?? existing?.feeAddress,
            quoterType: p.quoterType ?? existing?.quoterType,
            state: p.active === false ? 'paused' : 'open',
            createdAt: existing?.createdAt ?? observedAt,
            source: 'clc', chainAddress: addr, chainId: CLC_CHAIN_ID,
            observedAt,
          },
        });
      }
      if (overBudget()) break;
    }
  } catch (e) {
    if (isRateLimited(e)) partial = true; else throw e;
  }

  // ── Phase: on-chain pool config (one multicall ≈ 1 RPC fetch) ─────
  if (poolInputs.length && !overBudget()) {
    try {
      meter.n++; // the multicall is ~1 RPC request
      const states = await poolStateOnChain(env, poolInputs.map((x) => x.addr));
      for (const x of poolInputs) {
        const s = states.get(x.addr.toLowerCase());
        if (!s) continue;
        if (s.sealState !== undefined) x.row.sealState = s.sealState;
        if (s.feeAddress) x.row.feeAddress = s.feeAddress;
      }
    } catch (e) {
      console.error('clc sync: pool state multicall failed', e);
    }
  }

  // ── Phase: curation detail reads — resumable, capped, paced ───────
  const detailsTodo = state.detailsRemaining ?? poolInputs.filter((x) => {
    const existing = poolById.get(x.row.id);
    return !existing
      || !existing.accepted?.length
      || (!!x.updatedAt && x.updatedAt > (existing.observedAt ?? ''));
  }).map((x) => x.addr);
  const byAddr = new Map(poolInputs.map((x) => [x.addr, x]));
  const remaining: `0x${string}`[] = [];
  let skipped = false;
  for (const addr of detailsTodo.slice(0, DETAIL_READ_CAP)) {
    if (skipped || overBudget() || detailReads >= DETAIL_READ_CAP) {
      remaining.push(addr);
      continue;
    }
    const x = byAddr.get(addr.toLowerCase() as `0x${string}`);
    if (!x) continue;                    // pool left the catalog — drop it
    detailReads++;
    await sleep(DETAIL_PACE_MS);
    try {
      const accepted: CommitmentPool['accepted'] = [];
      for await (const vpage of pages((cursor) =>
        pools.getPoolVouchers(addr, cursor === undefined
          ? { perPage: PER_PAGE }
          : { perPage: PER_PAGE, cursor, next: true }))) {
        for (const v of vpage.vouchers) {
          const va = (v.tokenAddress ?? '').toLowerCase();
          if (!va.startsWith('0x')) continue;
          accepted.push({
            voucherId: clcVoucherId(va),
            // Rate/valuation lives in the pool's quoter on-chain —
            // getAmountOut is authoritative; this entry records
            // curation + the limitation cap, not a price.
            rate: 1,
            limit: v.tokenLimit ? Number(v.tokenLimit) || Number.MAX_SAFE_INTEGER
              : Number.MAX_SAFE_INTEGER,
            state: v.active === false ? 'suspended' : 'accepted',
          });
        }
        if (overBudget()) break;
      }
      if (accepted.length) x.row.accepted = accepted;
    } catch (e) {
      if (isRateLimited(e)) { partial = true; skipped = true; continue; }
      /* a failed voucher page leaves prior accepted[] intact */
    }
    if (overBudget()) skipped = true;
  }
  const detailsDone = remaining.length === 0 && !skipped;

  // ── Phase: market vouchers — resumable keyset pagination ─────────
  const voucherRows: { id: string; obj: Voucher }[] = [];
  let vouchersDone = detailsDone;
  if (vouchersDone) {
    try {
      for await (const page of pages((cursor) =>
        http.request<VoucherPage>(
          `/api/v2/vouchers?perPage=${PER_PAGE}${cursor !== undefined ? `&cursor=${cursor}&next=true` : ''}`),
        state.voucherCursor)) {
        delete state.voucherCursor;      // consumed — recompute per page
        for (const v of page.vouchers ?? []) {
          const addr = (v.address ?? '').toLowerCase();
          if (!addr.startsWith('0x')) continue;
          const id = clcVoucherId(addr);
          const existing = voucherById.get(id);
          voucherRows.push({
            id,
            obj: {
              ...(existing ?? {}),
              id,
              issuer: 'clc',             // issuer identity is issuer-side;
                                         // contract address is the projection key
              title: v.name ?? v.symbol ?? addr,
              unit: v.symbol ?? 'unit',
              description: v.locationName
                ? `CLC voucher — ${v.locationName}` : 'CLC voucher',
              terms: '',
              supply: existing?.supply ?? 1, // market read doesn't expose
                                             // supply; chain is authoritative
              expiresAt: existing?.expiresAt,
              state: 'issued',
              createdAt: existing?.createdAt ?? observedAt,
              source: 'clc', chainAddress: addr,
              chainId: v.chainId ?? CLC_CHAIN_ID, observedAt,
            },
          });
        }
        if (overBudget() && page.last !== undefined) {
          state.voucherCursor = page.last;
          vouchersDone = false;
          break;
        }
      }
    } catch (e) {
      if (isRateLimited(e)) partial = true; else throw e;
    }
  }

  // ── Phase: actor holdings — bound wallets → CLC balances ──────────
  const holdingRows: { id: string; obj: VoucherHolding }[] = [];
  let holdingsDone = vouchersDone;
  if (holdingsDone) {
    try {
      const wallets = await list<ActorWallet>(env.DB, 'actor-wallet');
      let i = state.walletIdx ?? 0;
      delete state.walletIdx;
      for (; i < wallets.length; i++) {
        if (overBudget()) { state.walletIdx = i; holdingsDone = false; break; }
        const { tokens } = await accounts.getLatestAccountTokens(wallets[i].address)
          .catch(() => ({ tokens: [] }));
        for (const t of tokens ?? []) {
          const h = projectHolding(wallets[i].actor, t, observedAt);
          if (!h) continue;
          holdingRows.push({ id: h.id, obj: h });
          seenHash.push(h.id);
        }
      }
    } catch (e) {
      console.error('clc sync: holdings sync failed', e);
    }
  }

  // ── Writes: dirty rows only, batched — then state + ledger ────────
  const poolRows = poolInputs.map((x) => ({ id: x.row.id, obj: x.row }));
  const dirtyPools = dirty(poolRows, poolById);
  const dirtyVouchers = dirty(voucherRows, voucherById);
  await Promise.all([
    dirtyPools.length ? putMany(env.DB, 'commitment-pool', dirtyPools) : null,
    dirtyVouchers.length ? putMany(env.DB, 'voucher', dirtyVouchers) : null,
    holdingRows.length ? putMany(env.DB, 'voucher-holding', holdingRows) : null,
  ]);
  for (const x of poolInputs) seenHash.push(
    `${x.row.id}:${x.row.accepted.length}:${x.row.state}`);
  for (const r of voucherRows) seenHash.push(r.id);
  const newPoolIds = poolInputs.filter((x) => !poolById.has(x.row.id))
    .map((x) => x.row.id);
  const newVoucherIds = voucherRows.filter((r) => !voucherById.has(r.id))
    .map((r) => r.id);

  const done = detailsDone && vouchersDone && holdingsDone && !partial;
  if (done) {
    delete state.detailsRemaining;
    if (prior) await del(env.DB, 'clc-sync', SYNC_STATE_ID)
      .catch(() => undefined);
    await ledgerAppend(env.DB, 'clc', 'clc.synced', {
      pools: poolRows.length, vouchers: voucherRows.length,
      holdings: holdingRows.length,
      newPoolIds: newPoolIds.slice(0, 200),
      newVouchers: newVoucherIds.length,
      written: { pools: dirtyPools.length, vouchers: dirtyVouchers.length,
        holdings: holdingRows.length },
      detailReads, partial, upstreamCalls: meter.n,
      hash: digest(seenHash.sort().join('\n')),
    });
  } else {
    state.detailsRemaining = remaining;
    await put(env.DB, 'clc-sync', SYNC_STATE_ID, state);
  }
  return {
    pools: poolRows.length, vouchers: voucherRows.length,
    newPools: newPoolIds.length, newVouchers: newVoucherIds.length,
    holdings: holdingRows.length, detailReads, partial,
    resumed: !done, upstreamCalls: meter.n,
  };
}
