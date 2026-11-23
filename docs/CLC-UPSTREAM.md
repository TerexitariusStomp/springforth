# CLC upstream register

| | |
|---|---|
| Source repo | https://github.com/cosmo-local-credit/clc-app |
| Pinned commit | `d6c9464b2a16e4e3089c969294526b5e60bc1db0` |
| License | AGPL-3.0 — `vendor/clc/LICENSE` (Springforth is AGPL-3.0-only) |
| Vendored | `vendor/clc/{api,core}` — 43 files, transitive closure of `src/adapters/clc.ts` imports |
| Regenerate | `node scripts/vendor-clc.mjs [git-ref]` — updates `VENDOR.md` pin |
| Externals | `viem`, `zod4` (npm:zod@4 alias — repo stays on zod v3) |
| Resolution | `tsconfig.paths` (`@clc/api/*`, `@clc/core/*`); `vitest.config.ts` mirrors as `resolve.alias` |

Why vendored: `@clc/api` / `@clc/core` are private workspace packages in
clc-app — not published to npm — so a subtree-style vendor is the only
dependency path. The closure excludes TanStack/React-coupled `queries`
modules; entry points are `client/*`, `features/pools`, `features/vouchers`,
`features/accounts`, `features/marketplace`, `features/market-map`,
`features/wants`, `features/offerings`, `features/oracle-feeds`,
`features/deployments`, `features/auth`, `features/credit-router`,
`features/pool-swaps` logic, plus `lib/*` support.

## Sibling CLC repos (reference, not vendored)

- `cosmo-local-credit/clc-core` — Go backend behind `api.cosmolocal.credit`.
- `cosmo-local-credit/protocol` — Solidity (SwapPool, GiftableToken,
  SwapRouter, quoters, limiters, seal). Gnosis chainId 100.
- `cosmo-local-credit/sim` — pool network simulator (GPL-3.0); the
  rehearsal venue we point at instead of our retired D1 lane.

## Upstream PR queue

Gaps we shimmed locally that belong upstream:

1. **~~`sealState` on pool reads~~ → PR filed** —
   [clc-core#64](https://github.com/cosmo-local-credit/clc-core/pull/64):
   `/api/v2/pools` exposed `feePpm`, `feeAddress`, `quoterType`,
   `limiterAddress` (all projected) but not `sealState` — we read it
   on-chain via multicall instead. The PR joins `pool_chain_state` in
   the four catalog queries + `poolPageProjection` and exposes
   `sealState` on every pool read (list, detail, vouchers, offerings,
   wants); `TestPoolCatalogExposesChainSealState` covers the route→store
   path. When merged, one RPC call drops per sync cycle.
2. **~~`GET /api/v2/vouchers` pagination docs~~ → shipped** —
   [clc-core#52](https://github.com/cosmo-local-credit/clc-core/pull/52):
   a cursorless `next` (the first-page shape every naive pager sends)
   silently returned an empty page (`id < 0`); now normalizes to the
   canonical first-page request. Unit + route→store PostgreSQL tests,
   docs line added.
3. **~~external-consumability for `@clc/api`/`@clc/core`~~ → filed** —
   [clc-app#461](https://github.com/cosmo-local-credit/clc-app/issues/461):
   export maps already complete; only `private:true` + `workspace:*`
   block install. Publishing cadence is a maintainer decision → issue,
   not a PR.
4. **~~`otx/track` public read~~ → PR filed** —
   [clc-core#65](https://github.com/cosmo-local-credit/clc-core/pull/65):
   `GET /api/v2/otx/status/:trackingId` — public, rate-limited,
   minimal-disclosure (`status` PENDING/SUCCESS/FAILED + `txHashes`
   only; `raw_tx`, signers, nonces stay on the authenticated route).
   `/otx/track` remains owner-scoped for the full chain; the new
   endpoint answers only "did it land." When merged, trackingId
   resolution stops needing `CLC_SERVICE_TOKEN`.

Rules for upstream PRs: AGPL headers preserved, changes offered under
upstream's license, no Springforth secrets in examples, test with their
suite (`clc-core/AGENTS.md` commands).
