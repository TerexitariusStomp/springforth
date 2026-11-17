# Commitment pools — the CPP lane

> **Status update (v1.4): the pooling layer now runs on CLC rails.** The
> D1-native write lane described in this document is retired — CLC's
> deployed SwapPool contracts + clc-core implement these functions for
> real, and building parallel infrastructure was exactly what the Gitcoin
> thread pushed back on. This document remains as the *entity/evidence*
> map: what the entities mean, how CLC projections populate them, and how
> the export measures pooling activity. The live integration is
> `docs/CLC-INTEGRATION.md`.

Allocation mechanisms decide where resources go. **Commitment Pools
establish ongoing economic relationships through which resources and
obligations can circulate** — exchange continues long after a funding
campaign ends. This document maps the Commitment Pooling Protocol's
core functions (Grassroots Economics / Cosmo-Local Credit,
docs.cosmolocal.credit) onto Springforth's entities, routes, and the
ops export.

## The four pool functions — CLC contract ↔ Springforth entity

| CPP function | CLC (authoritative) | Springforth (projection/evidence) |
|---|---|---|
| **Curation** — which commitments/vouchers/issuers the pool accepts | SwapPool `tokenRegistry` | `CommitmentPool.accepted[]` projected by `syncClc` |
| **Valuation** — relative exchange values | SwapPool `quoter` (relative/oracle/decimal) | `GET /pools/:id/quote` → on-chain `getAmountOut`; `accepted[].rate` is a curation marker, not a price |
| **Limitation** — exposure per commitment | SwapPool `tokenLimiter` | `accepted[].limit` projected |
| **Exchange** — commitments circulating | `SwapPool.withdraw` / `SwapRouter` | `PoolExchange` evidence records + `clc_track` attribution |
| **Parameter freeze** | `seal()` bitmask | `sealState` projected field |
| **Fees** | `feePolicy` + `protocolFeeController` | `poolFeeBps`/`protocolFeeBps`/`feeAddress` projections |

## Entities

- `Voucher` — a redeemable commitment. `source:'clc'` rows are
  projections keyed `clc-<address>`; `source:'local'` are legacy/sample
  records. `supply` on projections is a placeholder — chain
  `totalSupply` is authoritative.
- `VoucherHolding` — who holds how much. Pool inventory
  (`pool:<id>`) and protocol-fee accruals (`protocol:<sink>`) retain
  their id conventions for local records.
- `CommitmentPool` — `source:'clc'` rows mirror a SwapPool:
  `chainAddress`, `chainId`, `observedAt`, `sealState`, `feeAddress`,
  `quoterType`. `accepted[]` mirrors the tokenRegistry +
  tokenLimiter caps.
- `PoolExchange` — one swap's evidence record; `chainRef` carries the
  txHash when the exchange settled on-chain.
- `VoucherRedemption` — the commitment loop closing:
  `outstanding → fulfilled|rejected`, resolved by the issuer. For CLC
  vouchers this is the **discharge record** — the fulfillment receipt
  the CLC model calls for but doesn't store; `chainRef` can carry the
  return-transfer txHash.
- `clc-track` — attribution: a CLC `trackingId`/`txHash` linked to the
  `possibilityId`/actor that coordinated it (`POST /clc/track`).

## Routes

| Route | Status |
|---|---|
| `GET /vouchers`, `/vouchers/:id`, `/pools`, `/pools/:id`, `/redemptions` | live — serve projections + local records |
| `POST /vouchers/:id/redeem` | live — opens a discharge record (no balance debit for CLC vouchers; their balance is on-chain) |
| `POST /redemptions/:id/resolve` | live — issuer attests fulfillment |
| `GET /pools/:id/quote?give&amount&receive` | live — `getAmountOut` on Gnosis for `source:'clc'` pools; `amount` is raw integer units |
| `POST /clc/track`, `GET /clc/tracks` | live — attribution |
| `POST /admin/clc/sync`, `/admin/clc/pool` | live — ADMIN_TOKEN; deploy needs `CLC_SERVICE_TOKEN` |
| `POST /vouchers`, `/vouchers/:id/transfer`, `/vouchers/:id/state`, `/pools`, `/pools/:id/curate`, `/pools/:id/state`, `/pools/:id/exchange` | **retired 410** — returns `{clcUrl}` deep link; the CLC app owns signing UX |

## Crowdfunding in exchange for vouchers

The natural love.fund shape: a funder buys a local business's vouchers
(upfront financing for the issuer), the vouchers circulate through the
pool, redemption closes the loop. On CLC rails the purchase is a voucher
transfer executed in the CLC app; Springforth attributes it via
`/clc/track` and the possibility that coordinated it — allocation
upstream, settlement on CLC, evidence here.

## Measurement — what the readout can check

Ops-export v1.4 emits `voucher`, `holding`, `pool`, `pool_exchange`,
`redemption`, and `clc_track` records — with `source`, `chainAddress`,
`chainId`, `observedAt`, and `chainRef` so every row is independently
verifiable on gnosisscan.io, not just recomputable internally:

- **exchanges** — on-chain swaps attributed to coordinating activity
  (`clc_track.txHash` ↔ `pool_exchange.chainRef`)
- **circulation** — CLC inventory + holdings projections
- **redemption & fulfillment** — discharge records: outstanding→fulfilled
  conversion and time-to-fulfill per issuer (`redemption`) — the metric
  the sector consistently lacks
- **sustainability** — `feeAddress`/`protocolFeeBps` projections show
  where recurring revenue accrues; `sealState` shows which parameters
  are bytecode-frozen

## Honest scope

- **CLC state is authoritative; projections are observations.** Every
  `source:'clc'` row carries its observation provenance — the record
  says what we saw and when, not what is true now. Verify on-chain.
- **Curation ≠ price.** `accepted[].rate: 1` on projections means
  "admitted"; `getAmountOut` is the only quote that matters.
- **Retirement is honest, not silent.** Native writes answer 410 with
  the CLC deep link — no shadow endpoint pretending to swap.
- **Deployment rehearsal belongs to CLC's `sim`** — don't re-create a
  D1 sandbox for it.
