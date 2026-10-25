# World Foundation Grants — Spark Track application draft

*Rolling. world.org/grants → Spark Track Mini App Grant. World Chain, World App distribution (12M+ verified humans, 160 countries).*

## Portal status (2026-10-25)

- **Account**: terexmaps@gmail.com (passwordless Auth0) — created
- **Team**: Springforth (`team_3f8668fcc675d57c7cdd1ecad387fc38`)
- **App**: Springforth — `app_efecf064b55a17dc15e0de2728245121`, type **Mini App**
- **App URL**: `https://springforth.widespread.workers.dev/mini` (live — edge forwards HTML GETs to springforth-web)
- **Store listing**: Finance category, support email, all countries, en+fr localized, 3 showcase shots + content card; permissions: `springforth.widespread.workers.dev` + `springforth-web.widespread.workers.dev` whitelisted, notifications 1/day
- **Status**: **submitted for review** — editing locked until review completes
- Next: set `app_id` in `MiniKit.install()` in `web/app/routes/mini.tsx` once review passes; World Spark grant application references this app.

## One-line
Springforth Mini App: communities coordinate possibilities and pool funding inside World App — with proof-of-personhood actor binding so the trust graph can't be sybil-farmed.

## What the Mini App does
- `/mini` route (shipped, this repo `web/app/routes/mini.tsx`): inside World App, `MiniKit.walletAuth` (SIWE) signs a bind message; the edge worker verifies it server-side via ERC-1271 on World Chain and binds the World wallet to the actor.
- Why it matters: Springforth's trust layer is mutual recognition — `min(a→b, b→a)` pairwise appreciation driving matching and surplus distribution. Personhood is the missing anti-sybil primitive; World App supplies it without us storing any biometric data (the wallet binding is the personhood proof — one human, one World account, one actor).
- Deeper integration path: World Chain tx settlement for pledges/streams (sendTransaction command), MiniKit `pay` for WLD donations into rounds.

## Entities shipped
- `ActorPersonhood` (actor ↔ World-verified wallet, one-to-one)
- `ActorNonce` (one-shot SIWE nonces — replay protection)
- `GET /actors/{id}/worldid` (nonce issue), `POST /actors/{id}/worldid` (verify + bind)

## Team / status
Solo founder + Devin agent co-build; live production deployment (Cloudflare Workers, 2,163 ledger events); AGPL-3.0; verified integrations across Giveth/Karma GAP/Open Collective/Regen/Silvi/Restor.

## Fit to Spark criteria
- Clear problem: sybil-able trust graphs in community coordination — the exact debate live on Gitcoin governance (t/25407, our reply).
- Working demo: live site + `/mini`; walletAuth flow implemented end-to-end.
- Milestones: (1) Developer Portal registration + World App listing, (2) World Chain settlement lane for pledges, (3) `/mini` extended into a full possibility-card flow inside World App.

## Pre-submission checklist
- [x] Register app in Developer Portal → `app_efecf064b55a17dc15e0de2728245121` → set in MiniKit.install(appId)
- [ ] `MiniKit.user.username` optional capture on bind (already wired as `username`)
- [ ] World Chain settlement builders (viem worldchain — chain id 480; same pattern as Celo lane)
