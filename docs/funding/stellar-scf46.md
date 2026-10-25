# Stellar SCF #46 — Build Award application draft

*Deadline: Nov 8, 2026. Path: interest form → invite → SCF Build Award (up to $150k XLM). Handbook: stellar.gitbook.io/scf-handbook.*

## Interest form (file now — fields approximate)

- **Project name:** Springforth
- **Contact:** TerexitariusStomp (GitHub: github.com/TerexitariusStomp/springforth)
- **One-liner:** Open-source coordination infrastructure where communities declare "I want to…" possibilities, pool commitments, and fund each other — with pledge-secured assurance escrow on Stellar claimable balances and replayable evidence.
- **Status:** live at https://springforth.widespread.workers.dev (2,163 ledger events, verified hash chain)
- **Tracks of interest:** SCF Build Award; open to Public Goods Awards / Wave
- **Repo:** github.com/TerexitariusStomp/springforth (AGPL-3.0-only)

## Build Award narrative

### Problem
Community funding mechanisms leak money to trust failures: pledges that never settle, matchers that never appear, milestones nobody verifies. On-chain versions either need custom escrow contracts (audit cost, deployment risk) or degrade to promises.

### What we built on Stellar
Stellar's **claimable balances are a native dominant-assurance primitive** (Tabarrok 1998) — no Soroban contract required:

- `GET /chain/stellar/tx?kind=pledge` returns unsigned XDR for a `createClaimableBalance` op where the destination can claim **before** the deadline and the pledger reclaims **after** — the refund path is enforced by ledger predicates, not promises. If quorum fails, every pledge returns trustlessly.
- `kind=unlock` — claimable only at/after a timestamp: milestone-gated disbursement with zero contract surface.
- `kind=payment` — settlement once a bound pledge releases.

Builders live in `src/chain.ts` (stellar section), tested in `test/chain-stellar.test.ts` — the XDR round-trips through the official SDK, predicate structure verified. Non-custodial end to end: the worker never signs; wallets (Freighter et al.) hold keys; submitted hashes record on the hash-chained ledger via `POST /chain/stellar/record`.

### Why Stellar, concretely
- Claimable balances: dominant assurance with no contract deploys — uniquely Stellar.
- Fee/throughput fit for community-scale pledges (small amounts, many participants).
- Heritage: Grassroots Economics' Sarafu commitment pooling and chrissmpta's Samaipata sandbox (discussed on gov.gitcoin.co) ran on Stellar — this is the production-grade version of that idea.
- Asset flexibility: pledges in XLM or any issued asset (USDC, community currencies).

### Full stack context
The Stellar lane slots into existing verified rails: Celo mainnet (Allo QF rounds, EAS attestations, Hypercert claims, Superfluid streams — contract addresses verified on-chain 2026-10-20), a hash-chained ledger (`/ledger/verify`), multi-source evidence oracle, and 10 ecosystem adapters (Giveth, Karma GAP, Open Collective, Restor, Silvi…).

### Milestones (Build Award asks for concrete deliverables)
1. Claimable-balance pledge lifecycle on Stellar mainnet — build → wallet sign → record → claim/refund path end-to-end on a live possibility (demo on the site).
2. Community-currency asset support + issuer registry for commitment pools.
3. Soroban path evaluation: when pooled pledges need programmable splits, a thin Soroban wrapper — documented decision, not speculative build.
4. Horizon confirmation cron (pending → confirmed via Horizon ingestion).

### Ask
$50k XLM for milestones 1–3 (+4 scoped), ~4 months, AGPL-3.0 throughout.

## Evidence to attach
- Live: springforth.widespread.workers.dev — `/docs` lists the Stellar endpoints; test output in `test/chain-stellar.test.ts`
- Ledger integrity: `/ledger/verify` → `{"ok":true,"events":2163}`
- Demonstrator: Mida Creek mangrove coordination (64,699 trees, Treegens-sourced)
