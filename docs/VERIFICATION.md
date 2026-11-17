# How to verify this system

Everything Springforth asserts is checkable without trusting the
operator. Three independent layers: recompute the export, replay the
ledger, verify on-chain.

## Layer 1 — recompute the export

```bash
curl -s https://springforth.widespread.workers.dev/export/ops.ndjson -o ops.ndjson
sed '$d' ops.ndjson | sha256sum        # must equal manifest.file_sha256
tail -1 ops.ndjson | python3 -m json.tool   # manifest: revision, build, cut, counts
```

- `manifest.cut.ledger_head` is byte-identical to `/ledger/verify`'s
  `head` at the same tip — the export is bound to the ledger, not
  asserted alongside it.
- `manifest.build` is the deployed git revision (`BUILD_ID` stamped at
  deploy); the source for it is at
  `github.com/TerexitariusStomp/springforth` — ask for the matching
  commit if it's `null` or `+dirty`.
- `manifest.counts` tallies by record type; `records` = line count − 1.

## Layer 2 — replay the ledger

```bash
curl -s 'https://springforth.widespread.workers.dev/ledger/verify?seq=N'
# → { head, verified, events } — hash chain integrity to seq N
```

Each event's `hash` = sha256 of `[seq, at, actor, kind, payload,
prev_hash]`; `verify` recomputes the chain incrementally from a stored
checkpoint. `clc.*` events are **observation records** — they attest
what the sync saw and when, never claim to be the state.

## Layer 3 — verify on-chain (the new dual check)

Every `source:'clc'` record carries `chainAddress` + `chainId:100` +
`observedAt`; `chainRef` carries txHashes where they exist. These are
emitted **raw** (deliberately unpseudonymized — public on-chain data):

```bash
# Pool exists + is a SwapPool:
#   https://gnosisscan.io/address/<chainAddress>
# Contract config matches the projection:
#   cast call <chainAddress> 'sealState()(uint8)' --rpc-url https://rpc.gnosischain.com
#   cast call <chainAddress> 'feeAddress()(address)' --rpc-url https://rpc.gnosischain.com
# A tracked tx happened:
#   https://gnosisscan.io/tx/<clc_track.txHash>
# A quote is the contract's own math:
curl 'https://springforth.widespread.workers.dev/pools/clc-<addr>/quote?give=<voucher>&receive=<voucher>&amount=<raw-int>'
#   → amountOut == SwapPool.getAmountOut(receive, give, amount) on Gnosis
```

## What each record type proves

| Record | Proves | Doesn't prove |
|---|---|---|
| `pool`/`voucher` (source:clc) | this contract was observed in the CLC catalog at `observedAt` | current state — re-check on-chain |
| `pool.accepted[]` | curation + limiter caps at observation | price — `rate:1` is a marker; `getAmountOut` is the quote |
| `clc_track` | a CLC tx was attributed to a possibility/actor | fulfillment — that needs a `redemption` record |
| `redemption` | an outstanding→fulfilled/rejected discharge, issuer-resolved | that goods were good — the issuer attests, evidence is upstream |
| `pool_exchange` (source:clc) | a swap with a `chainRef` txHash | — verify the tx directly |
| actor pseudonyms `a_*`/`x_*` | stable joins within the file | identity — sha256(salt, actor), salt is server-side |

## Known limitations (stated, not hidden)

- `holding` rows for CLC vouchers project only wallets bound via
  `POST /actors/:id/bind-wallet`, and require `CLC_SERVICE_TOKEN`
  (clc-core account reads are auth-gated — E06 verified).
- `pool.sealState` comes from the contract (multicall), not the API —
  clc-core doesn't expose it; upstream PR queued
  (docs/CLC-UPSTREAM.md).
- Sync is hourly; `observedAt` tells you how stale a projection is.
  The chain is never stale.
- **Production sync history (2026-11-17):** the hourly cron had not
  completed a cycle since 2026-10-23 — an uncaught `sweepPossibilities`
  failure killed `scheduled()` after the oracle-check phase, before
  `syncClc` and the `oracle.cycle` summary (ledger evidence:
  `oracle.check` events at 06:00:16–21Z, then nothing). Diagnosed from
  the ledger, fixed by failure-isolating the sweep (`cron.sweep_failed`
  is now ledgered instead of fatal), moving `syncClc` ahead of the
  legacy pipeline, and making the sync batch-first (~6 reads + 1 ledger
  append steady-state instead of ~2,700 sequential writes). If
  `clc.synced` / `cron.sweep_failed` events stop appearing again, that
  is itself the evidence — check `/ledger` for them.
