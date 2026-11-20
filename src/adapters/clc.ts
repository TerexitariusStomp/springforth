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
import { decodeEventLog, parseAbi } from 'viem';
import { createHttpClient } from '@clc/api/client/http-client';
import { BackendApiError } from '@clc/api/client/errors';
import { createPoolsClient } from '@clc/api/features/pools/client';
import { createPoolDeployClient } from '@clc/api/features/pools/deploy-client';
import { createAccountsClient } from '@clc/api/features/accounts/client';
import type { OtxTrackResult } from '@clc/api/features/auth/client';
import type { PoolDeployPayload } from '@clc/core/features/pools/logic';
import { swapPoolSwapEventAbi, swapPoolSwapSettlementEventAbi }
  from '@clc/core/features/pool-swaps/logic';
import type { ActorWallet, CommitmentPool, PoolExchange, Voucher, VoucherHolding }
  from '../entities';
import type { ClcTrack } from '../opsexport';
import { get, list, ledgerAppend, put, putMany } from '../store';
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

// SwapPool.sol seal bits (protocol repo): seal() freezes parameters one
// bit at a time; registry bit sealed = curation is frozen — the charter's
// "frozen parameters" invariant. 31 = fully sealed.
export const SEAL_BITS: Record<number, string> = {
  1: 'fee', 2: 'feeAddress', 4: 'quoter', 8: 'registry', 16: 'limiter',
};

// Attribution record (POST /clc/track) — submitted until a chain receipt
// or the owner-scoped /otx/track endpoint resolves it.

// Decoded Swap/SwapSettlement log → pool_exchange projection. Pure —
// the receipt-decode path feeds it; unit tests exercise the mapping.
// SwapPool.sol: totalFee + protocolFee are both carved out of the
// user's OUTPUT — fees are tokenOut-denominated (fees[_outToken],
// IERC20(_outToken).transfer), so the fees record keys to the receive
// voucher, not the give voucher.
export const projectExchange = (
  ev: { poolAddress: string; initiator: string; tokenIn: string;
    tokenOut: string; amountIn: bigint; amountOut: bigint;
    poolFee: bigint; protocolFee: bigint },
  logIndex: number, txHash: string,
  decimalsFor: (addr: string) => number,
  actorFor: (initiator: string) => string,
  observedAt: string,
): PoolExchange | null => {
  const inAddr = ev.tokenIn.toLowerCase(), outAddr = ev.tokenOut.toLowerCase();
  const give = Number(ev.amountIn) / 10 ** decimalsFor(inAddr);
  const receive = Number(ev.amountOut) / 10 ** decimalsFor(outAddr);
  if (!(give > 0 && receive > 0)) return null;
  return {
    id: `clcex-${txHash}-${logIndex}`,
    poolId: clcPoolId(ev.poolAddress),
    actor: actorFor(ev.initiator),
    give: { voucherId: clcVoucherId(inAddr), amount: give },
    receive: { voucherId: clcVoucherId(outAddr), amount: receive },
    fees: {
      voucherId: clcVoucherId(outAddr),
      pool: Number(ev.poolFee) / 10 ** decimalsFor(outAddr),
      protocol: Number(ev.protocolFee) / 10 ** decimalsFor(outAddr),
    },
    // Realized price at execution: 1 give → receive/give receive units.
    // Curation rates are caps, not prices — this is what actually cleared.
    rates: { give: 1, receive: receive / give },
    at: observedAt,
    source: 'clc', chainRef: txHash,
    chainAddress: ev.poolAddress.toLowerCase(), chainId: CLC_CHAIN_ID,
    observedAt,
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

// SwapPool emits Swap AND SwapSettlement as a pair per swap leg
// (SwapPool.sol ~L420). Dedupe to one row per leg — prefer the
// settlement variant: it carries the real pool/protocol fee split.
export const dedupeSwapLegs = <D extends { settlement: boolean;
  ev: { poolAddress: string; tokenIn: string; tokenOut: string;
    amountIn: bigint } }>(decoded: D[]): D[] => {
  const legs = new Map<string, D>();
  for (const d of decoded) {
    const key = [d.ev.poolAddress, d.ev.tokenIn, d.ev.tokenOut,
      d.ev.amountIn.toString()].join('|').toLowerCase();
    const cur = legs.get(key);
    if (!cur || d.settlement) legs.set(key, d);
  }
  return [...legs.values()];
};

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
// Ambient piggyback cadence — a request advances the mirror when the last
// completed cycle is older than this, or a cycle is mid-resume.
export const CLC_SYNC_INTERVAL_MS = 15 * 60_000;

// Called from fetch() via ctx.waitUntil — a cheap state-row read decides
// whether this invocation should spend its spare subrequests advancing
// the projection. Resumable cycles always continue; a fresh one starts
// only when the mirror is stale.
export async function maybeAdvanceClcSync(env: ClcEnv) {
  const state = await get<SyncState & { lastDone?: string }>(
    env.DB, 'clc-sync', SYNC_STATE_ID).catch(() => null);
  const inProgress = !!(state?.detailsRemaining?.length
    || state?.voucherCursor !== undefined || state?.walletIdx !== undefined);
  const fresh = !inProgress && state?.lastDone
    && Date.now() - Date.parse(state.lastDone) < CLC_SYNC_INTERVAL_MS;
  if (fresh) return;
  console.log('clc ambient: advancing (inProgress=%s lastDone=%s)',
    inProgress, state?.lastDone ?? 'none');
  await syncClc(env).then((r) =>
    console.log('clc ambient: done=%s upstream=%s pools=%s vouchers=%s',
      !r.resumed, r.upstreamCalls, r.pools, r.vouchers))
    .catch((e) => console.error('clc ambient failed', e));
}

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
  upstreamCalls: number; confirmedTracks: number; exchanges: number;
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
  // Seal transitions ledger as `clc.pool.seal` — the moment a pool's
  // parameters freeze is itself evidence (charter "frozen parameters").
  const sealEvents: { poolId: string; sealState: number; newlySealed: string[] }[] = [];
  if (poolInputs.length && !overBudget()) {
    try {
      meter.n++; // the multicall is ~1 RPC request
      const states = await poolStateOnChain(env, poolInputs.map((x) => x.addr));
      for (const x of poolInputs) {
        const s = states.get(x.addr.toLowerCase());
        if (!s) continue;
        if (s.sealState !== undefined) {
          const prev = poolById.get(x.row.id)?.sealState ?? 0;
          if (s.sealState !== prev) {
            x.row.sealState = s.sealState;
            const newly = Object.entries(SEAL_BITS)
              .filter(([b]) => (s.sealState! & Number(b)) !== 0 && (prev & Number(b)) === 0)
              .map(([, n]) => n);
            if (newly.length) sealEvents.push(
              { poolId: x.row.id, sealState: s.sealState, newlySealed: newly });
          }
        }
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

  // Bound wallets are read once — the tracks phase maps swap initiators
  // to actors and the holdings phase mirrors balances.
  let wallets: ActorWallet[] | undefined;
  const boundWallets = async () =>
    (wallets ??= await list<ActorWallet>(env.DB, 'actor-wallet').catch(() => []));

  // ── Phase: track confirmation — receipts → pool_exchange rows ─────
  // A submitted clc-track resolves on Gnosis: txHash rows read the
  // public receipt (free); trackingId-only rows go through /otx/track,
  // which clc-core scopes to the token owner — they stay submitted
  // until CLC_SERVICE_TOKEN lands. Swap/SwapSettlement logs decode to
  // real pool_exchange observations (chainRef=txHash); anything without
  // a receipt stays submitted — 'submitted' IS the resume queue, so no
  // state key is needed.
  const trackWrites: { id: string; obj: ClcTrack }[] = [];
  const exchangeWrites: { id: string; obj: PoolExchange }[] = [];
  const confirmedTracks: ClcTrack[] = [];
  let tracksDone = vouchersDone;
  if (tracksDone) {
    const open = (await list<ClcTrack>(env.DB, 'clc-track').catch(() => []))
      .filter((t) => t.status === 'submitted');
    if (open.length) {
      const walletActor = new Map(
        (await boundWallets()).map((w) => [w.address.toLowerCase(), w.actor]));
      const actorFor = (initiator: string) =>
        walletActor.get(initiator.toLowerCase()) ?? `addr:${initiator.toLowerCase()}`;
      const chain = publicClientFor(GNOSIS, env.GNOSIS_RPC);
      // Pass 1: receipts → decoded swap events (raw uint256 amounts).
      // Pass 2: one decimals() multicall covers every touched token —
      // GiftableToken decimals are per-instance, so they can't be
      // assumed from the voucher projection.
      const decoded: { t: ClcTrack; li: number; txHash: string;
        settlement: boolean; ev: Parameters<typeof projectExchange>[0] }[] = [];
      for (const t of open.slice(0, 20)) {
        if (overBudget()) { tracksDone = false; break; }
        let txHash = t.txHash;
        if (!txHash && t.trackingId && env.CLC_SERVICE_TOKEN) {
          try {
            const r = await http.request<OtxTrackResult>(
              `/api/v2/otx/track/${encodeURIComponent(t.trackingId)}`);
            txHash = r.otx?.find((o) => o.txHash)?.txHash;
          } catch { /* permissioned or unknown — stays submitted */ }
        }
        if (!txHash) continue;
        meter.n++;                              // each receipt is a chain RPC fetch
        const rc = await chain.getTransactionReceipt({ hash: txHash as `0x${string}` })
          .catch(() => null);
        if (!rc) continue;                      // not mined yet — try next cycle
        if (rc.status !== 'success') {
          t.status = 'failed'; t.confirmedAt = observedAt; t.txHash = txHash;
          t.blockNumber = Number(rc.blockNumber);
          trackWrites.push({ id: t.id, obj: t });
          continue;
        }
        for (const [li, log] of rc.logs.entries()) {
          for (const [si, abi] of
            [swapPoolSwapSettlementEventAbi, swapPoolSwapEventAbi]
              .entries() as unknown as [number, typeof swapPoolSwapEventAbi][]) {
            let a: { initiator: string; tokenIn: string; tokenOut: string;
              amountIn: bigint; amountOut: bigint;
              fee?: bigint; poolFee?: bigint; protocolFee?: bigint };
            try {
              a = decodeEventLog(
                { abi, data: log.data, topics: log.topics }).args as typeof a;
            } catch { continue; }               // not this event
            decoded.push({ t, li, txHash, settlement: si === 0, ev: {
              poolAddress: log.address, initiator: a.initiator,
              tokenIn: a.tokenIn, tokenOut: a.tokenOut,
              amountIn: a.amountIn, amountOut: a.amountOut,
              poolFee: a.poolFee ?? a.fee ?? 0n,
              protocolFee: a.protocolFee ?? 0n,
            } });
            break;
          }
        }
        t.status = 'confirmed'; t.confirmedAt = observedAt; t.txHash = txHash;
        t.blockNumber = Number(rc.blockNumber);
        trackWrites.push({ id: t.id, obj: t });
        confirmedTracks.push(t);
      }
      if (open.length > 20) tracksDone = false; // backlog resumes next cycle
      decoded.splice(0, decoded.length, ...dedupeSwapLegs(decoded));
      // Pass 2: decimals for every token appearing in decoded swaps.
      if (decoded.length && !overBudget()) {
        const addrs = [...new Set(decoded.flatMap((d) =>
          [d.ev.tokenIn.toLowerCase(), d.ev.tokenOut.toLowerCase()]))]
          .map((a) => a as `0x${string}`);
        const DEC_ABI = parseAbi(['function decimals() view returns (uint8)']);
        meter.n++;
        const ds = await chain.multicall({
          contracts: addrs.map((address) =>
            ({ address, abi: DEC_ABI, functionName: 'decimals' as const })),
          allowFailure: true }).catch(() => []);
        const decOf = new Map(addrs.map((a, i) =>
          [a, ds?.[i]?.status === 'success' ? Number(ds[i].result) : 6]));
        for (const d of decoded) {
          const ex = projectExchange(d.ev, d.li, d.txHash,
            (a) => decOf.get(a.toLowerCase() as `0x${string}`) ?? 6,
            actorFor, observedAt);
          if (ex) exchangeWrites.push({ id: ex.id, obj: ex });
        }
        // Link the written exchange ids back onto their track rows.
        for (const d of decoded) {
          const w = trackWrites.find((x) => x.id === d.t.id);
          if (!w) continue;
          const id = `clcex-${d.txHash}-${d.li}`;
          if (exchangeWrites.some((x) => x.id === id)) {
            w.obj.exchanges = [...(w.obj.exchanges ?? []), id];
          }
        }
      }
    }
  }

  // ── Phase: actor holdings — bound wallets → CLC balances ──────────
  const holdingRows: { id: string; obj: VoucherHolding }[] = [];
  let holdingsDone = tracksDone;
  if (holdingsDone) {
    try {
      const ws = await boundWallets();
      let i = state.walletIdx ?? 0;
      delete state.walletIdx;
      for (; i < ws.length; i++) {
        if (overBudget()) { state.walletIdx = i; holdingsDone = false; break; }
        const { tokens } = await accounts.getLatestAccountTokens(ws[i].address)
          .catch(() => ({ tokens: [] }));
        for (const t of tokens ?? []) {
          const h = projectHolding(ws[i].actor, t, observedAt);
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
    trackWrites.length ? putMany(env.DB, 'clc-track', trackWrites) : null,
    exchangeWrites.length ? putMany(env.DB, 'pool-exchange', exchangeWrites)
      : null,
  ]);
  // Seal + confirmation events are real observations — ledgered even on
  // a partial cycle (each append is one subrequest; both are rare).
  for (const s of sealEvents) {
    await ledgerAppend(env.DB, 'clc', 'clc.pool.seal', s).catch(() => undefined);
  }
  for (const t of confirmedTracks) {
    await ledgerAppend(env.DB, 'clc', 'clc.swap.confirmed', {
      trackId: t.id, txHash: t.txHash, blockNumber: t.blockNumber,
      possibilityId: t.possibilityId, actor: t.actor,
      exchanges: t.exchanges ?? [],
    }).catch(() => undefined);
  }
  for (const x of poolInputs) seenHash.push(
    `${x.row.id}:${x.row.accepted.length}:${x.row.state}`);
  for (const r of voucherRows) seenHash.push(r.id);
  const newPoolIds = poolInputs.filter((x) => !poolById.has(x.row.id))
    .map((x) => x.row.id);
  const newVoucherIds = voucherRows.filter((r) => !voucherById.has(r.id))
    .map((r) => r.id);

  const done = detailsDone && vouchersDone && tracksDone && holdingsDone
    && !partial;
  if (done) {
    // Keep a lastDone marker — the ambient lane reads it to decide
    // freshness; resume keys are cleared so a new cycle starts clean.
    await put(env.DB, 'clc-sync', SYNC_STATE_ID, { lastDone: observedAt })
      .catch(() => undefined);
    await ledgerAppend(env.DB, 'clc', 'clc.synced', {
      pools: poolRows.length, vouchers: voucherRows.length,
      holdings: holdingRows.length,
      confirmedTracks: confirmedTracks.length,
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
    confirmedTracks: confirmedTracks.length, exchanges: exchangeWrites.length,
  };
}
