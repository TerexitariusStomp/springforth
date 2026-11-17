# CLC integration — Springforth on Cosmo-Local Credit rails

Springforth's pooling lane runs on **CLC's deployed infrastructure**, not a
parallel implementation. CLC (api.cosmolocal.credit + the Gnosis `SwapPool`
contracts) owns issuance, curation, valuation, exchange, custody UX, and
routing. Springforth owns allocation (quorum/matching/attestation),
evidence (hash-chained ledger + recomputable export), attribution, and the
redemption-discharge record.

## Layers

| Layer | What | Where |
|---|---|---|
| Observe | `syncClc` projects CLC pools/vouchers into `CommitmentPool`/`Voucher` as `source:'clc'` rows keyed `clc-<address>`; pool curation detail reads are capped (60) + paced (120ms) per cycle; `sealState`/`feeAddress` read on-chain via multicall; bound-wallet balances project as `source:'clc'` holdings. Hourly cron + `POST /admin/clc/sync` | `src/adapters/clc.ts` |
| Correlate | `Possibility.clcPool` links a card to a pool; `ActorWallet` (`POST /actors/:id/bind-wallet`) links actors to addresses; `gnosis` is a `CHAIN_MODE` | `src/entities.ts`, `src/chain.ts` |
| Act | `GET /pools/:id/quote` reads `getAmountOut` on-chain; exchanges/curation/issuance deep-link to the CLC app (`clcUrl` on every retired route); `POST /admin/clc/pool` deploys via clc-core's queue | `src/index.ts` |
| Attribute | `POST /clc/track {trackingId\|txHash, possibilityId?, actor?}` → `clc-track` records + `clc.tx.tracked` events → `clc_track` export records. Confirmation: each sync resolves `status:'submitted'` tracks — `txHash` rows read the public Gnosis receipt (free); `trackingId`-only rows need `CLC_SERVICE_TOKEN` (`/otx/track` is owner-scoped). A mined success decodes `Swap`/`SwapSettlement` logs into `source:'clc'` `pool_exchange` rows (`chainRef`=txHash, initiator→actor via wallet bindings) + a `clc.swap.confirmed` event; reverts mark `failed`. | `src/index.ts`, `src/adapters/clc.ts`, `src/opsexport.ts` |
| Discharge | `VoucherRedemption` stays ours — the fulfillment receipt the CLC model names but doesn't store; `chainRef` can carry the return-transfer txHash | `src/entities.ts` |

## Provenance contract

Projected rows are **observations, never authority**:

- `source: 'clc' | 'local'` distinguishes projections from legacy records.
- `chainAddress` + `chainId` (100 = Gnosis) identify the contract row.
- `observedAt` is the sync time; `chainRef` is the on-chain pointer
  (txHash / address) where a record exists.
- `sealState`, `feeAddress`, `quoterType` carry the SwapPool's own
  configuration — `sealState` is the bytecode param-freeze bitmask,
  read directly from the contract, not the catalog. Bit names
  (`SEAL_BITS` in the adapter): 1=fee, 2=feeAddress, 4=quoter,
  8=registry (curation frozen), 16=limiter; 31 = fully sealed.
  Transitions ledger as `clc.pool.seal` with the newly-set bits —
  the freeze itself is evidence.
- The ops export (v1.4) emits these fields **raw** — public on-chain data
  deliberately exempt from actor pseudonymization so reviewers can verify
  every record on gnosisscan.io.
- Ledger events: one `clc.synced` summary per cycle carrying the new-id
  lists plus a digest hash of everything observed — the ledger attests
  what we saw, not what we did. (Per-entity `seen` events were dropped:
  1,300 sequential ledger writes per cycle does not fit the cron's
  wall-clock budget — one digest event carries the same provenance.)
- Write cost: existing projections are preloaded once per kind, rows are
  compared excluding `observedAt` (which therefore reads "when this
  projection last changed"), and only dirty rows are written, batched
  500/`putMany` — a steady-state cycle is ~6 reads + 1 ledger append.
- Subrequest budget (free plan ≈ 50/invocation): upstream fetches are
  metered at 34/invocation; progress persists in a `clc-sync` row
  (`detailsRemaining` / `voucherCursor` / `walletIdx`) so one logical
  cycle can span multiple invocations. The sync advances on the hourly
  cron (first in `scheduled()`) **and** on ambient traffic —
  `maybeAdvanceClcSync` in `ctx.waitUntil` re-checks freshness
  (`lastDone`, 15 min) and continues mid-resume cycles on every request.
  Ambient invocations can race across isolates — concurrent requests
  each see a stale `lastDone` and run parallel cycles; writes are
  idempotent (dirty-only) so the cost is duplicate `clc.synced` events,
  not corruption. There is no cross-isolate mutex on the free plan.
  Phase breadcrumbs (`clc ambient: …`) land in `wrangler tail`.

## Environment

| Var | Purpose |
|---|---|
| `CLC_API` | clc-core base — default `https://api.cosmolocal.credit` |
| `CLC_APP` | deep-link base — default `https://cosmolocal.credit` |
| `CLC_SERVICE_TOKEN` | service JWT (secret) — `/admin/clc/pool` |
| `GNOSIS_RPC` | paid-RPC override for `getAmountOut` reads |

## Retired native write lane

The D1-native pool implementation (`quoteExchange`/`applyExchange`, write
routes) is **removed** — it was allocation mechanics, not a real pool, and
CLC's contracts implement the functions for real. `src/pool.ts` retains
only holder-id conventions; GETs still serve projections, and the
redemption lane stays (see Discharge above). A pool's `accepted[].rate`
is `1` in projections — a curation marker, not a price; `getAmountOut` is
the only authoritative quote. The CLC `sim` repo (GPL-3.0) is the right
place for pre-deployment rehearsal, not our D1.

## Upstream register

Vendored client code, pinned commit, license, and the PR-back queue:
`docs/CLC-UPSTREAM.md`.
