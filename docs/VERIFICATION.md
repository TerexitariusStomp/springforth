# How to verify this system

Everything Springforth asserts is checkable without trusting the
operator. The honest decomposition — adopted from the 2026-11-21
three-validity review — is that verification answers three *different*
questions, and no single check covers all three:

1. **Record integrity** — is the file/chain internally consistent and
   unmodified? (Layers 1–2 below: recompute, replay, prefix-verify.)
2. **Authorization** — did the named actor actually do the thing?
   Receipt confirmation proves a tx *mined*; actor↔initiator joins
   need wallet binding + signed intent. `self-reported` lanes
   (`via:'ops-report'`, `coordination_effort`, `baseline_report`)
   record claims, never observations.
3. **Outcome truth** — did the claimed impact happen? Attestation
   edges record that ≥N participants *attested* completion
   (`attesterCount` makes N checkable); they do not prove mangroves
   were planted. Evidence records are pointers (`uriHash`/`textHash`),
   not validated content. `readout.result` admits `null`/`negative`
   precisely because this dimension stays open.

What the system *does* guarantee: every claim above is labeled, and
the labels are in the file — a reviewer never has to guess which
validity a record speaks to.

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
# Full chain recompute — every event's hash re-derived, links checked:
curl -s 'https://springforth.widespread.workers.dev/ledger/verify'
# → { ok, events, head }

# Prefix verify through an exact cut (dated-export replay):
curl -s 'https://springforth.widespread.workers.dev/ledger/verify?seq=N&verify=1'
# → { ok, verifiedThrough, head } or { ok:false, brokenAt }

# Stored-head lookup at a cut — cheap, does NOT recompute:
curl -s 'https://springforth.widespread.workers.dev/ledger/verify?seq=N'
# → { ok, seq, head, verified:false }  (adds a note saying so)

# Inclusion proof for one event (SCITT-style receipt):
curl -s 'https://springforth.widespread.workers.dev/ledger/proof?seq=N'
# → { ok, seq, event{...}, position{seq,headSeq,depth},
#     integrity, anchor{...}|null, semantics }
```

`/ledger/proof` returns the event row, its position in the chain, the
current head, a pointer to `?verify=1` for recomputation, and the
newest OTS anchor at-or-after that seq when one exists. Its `semantics`
field says it plainly: **inclusion only** — the record exists at that
position; nothing about truth, authorization, or outcome.

`?seq=N` alone returns the **stored** hash at that sequence — useful to
confirm the export's `cut.ledger_head` names a real ledger position,
but it is not chain verification. `&verify=1` recomputes every event's
`hash` (= sha256 of `[seq, at, actor, kind, payload, prev_hash]`) from
the genesis event through seq N and compares the recomputed tip to the
stored head — that IS verification of the prefix.

## Layer 2b — external timestamp (OpenTimestamps)

The ledger head is anchored to the public Bitcoin calendar network —
proof that a given head hash existed by a wall-clock time, independent
of this service staying up:

```bash
curl -s 'https://springforth.widespread.workers.dev/ledger/anchor'
# → { anchors: [{seq, hash, calendar, status, submittedAt, ...}] }
```

- `pending` → the calendar accepted the digest; `attested` → the
  receipt was upgraded after Bitcoin aggregation (verify the `.ots`
  receipt with `ots verify`).
- Anchoring runs automatically (~hourly, head-moved only) from cron +
  ambient traffic; `POST /ledger/anchor` (admin) forces a round.
- Each anchor also lands in the export as an `anchor` record, so the
  timestamp evidence is bound to the same cut it timestamps.
- An anchor proves *existence by time*, nothing more — same boundary
  as SCITT receipts: inclusion, not truth.

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
| `clc_track` (`confirmed`) | the tx mined successfully; `exchanges[]` links decoded `pool_exchange` rows with amounts straight from the `Swap`/`SwapSettlement` logs | that the swap was *intended* by the attributed actor — the initiator↔actor join needs a wallet binding |
| `redemption` | an outstanding→fulfilled/rejected discharge, issuer-resolved | that goods were good — the issuer attests, evidence is upstream |
| `pool_exchange` (source:clc) | a swap with a `chainRef` txHash | — verify the tx directly |
| actor pseudonyms `a_*`/`x_*` | stable joins within the file | identity — sha256(salt, actor), salt is server-side |

## Known limitations (stated, not hidden)

- `holding` rows for CLC vouchers project only wallets bound via
  `POST /actors/:id/bind-wallet`, and require `CLC_SERVICE_TOKEN`
  (clc-core account reads are auth-gated — E06 verified).
- `clc_track` rows with only a `trackingId` stay `submitted` until
  `CLC_SERVICE_TOKEN` lands — clc-core's `/otx/track` is owner-scoped.
  `txHash` rows resolve on-chain with no token. `submitted` therefore
  means "not yet resolved" (pending, unmined, or gated), not "failed."
- `pool.sealState` comes from the contract (multicall), not the API —
  clc-core doesn't expose it; upstream PR queued
  (docs/CLC-UPSTREAM.md).
- Sync is hourly; `observedAt` tells you how stale a projection is.
  The chain is never stale.
- **Production sync history (2026-11-17):** the account is on the
  Workers **free plan** — ~50 subrequests per invocation and 5 cron
  triggers account-wide (both confirmed by wrangler). Because the D1
  proxy bills every query as a `fetch()` subrequest, the cron's oracle
  loop alone exhausts the budget ~8 nodes in (tail: "Too many
  subrequests" at `runOracleSources`); no `oracle.cycle` summary has
  been written since 2026-10-23. The CLC mirror is designed around the
  cap: `syncClc` runs first in the hourly cron and meters upstream
  calls (≤34/invocation), persists resume state in a `clc-sync` row,
  and advances on ambient traffic via `ctx.waitUntil`
  (`maybeAdvanceClcSync`). First prod sync completed 2026-11-17
  (104 pools, 1,187 vouchers; `clc.synced` in `/ledger`). If `clc.*`
  events stop appearing again, that is itself the evidence.
