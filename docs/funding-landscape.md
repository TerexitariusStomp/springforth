# Funding Landscape — Springforth

*Researched 2026-10-24. Every status verified against the program's own site/policy, not aggregator listings. `docs/funding/` holds the per-program application drafts.*

## Hard constraint discovered: AI-code policies

**NLnet GenAI policy v2.0 (published 2026-10-20, effective immediately)** — applies to every NLnet call with a deadline after that date: no GenAI-written proposals, and LLM use in project work restricted to read-only. "Mostly LLM-generated" codebases are explicitly ineligible. Springforth is largely AI-built, so the entire NLnet family is out: **OIS Restack** (was due Nov 3), **CodeSupply**, and residual NGI Taler/Fediversity calls. Diligence step for every source below: check for an equivalent AI-provenance policy before applying.

## Deadline calendar

| Date | Item |
|---|---|
| **Oct 27** | SF Live hackathon submission (BMC + presentation) — hard gate |
| Nov 8 | Stellar SCF #46 — Build Award applications close; interest form ASAP |
| Dec 29 | Prezenti Season 3 — Frontier Pool |
| Rolling | World Foundation Spark, Filecoin FF grants, ESP, Octant Atlas, Giveth, Drips Wave |
| Apr 22, 2027 | Ma Earth Funding Round 4 (land projects — partnership angle) |

## Priority lanes (application drafts in `docs/funding/`)

### 1. Stellar SCF #46 — `stellar-scf46.md`
- Interest form → Build Award, up to $150k in XLM.
- **Why we fit:** claimable balances are a native dominant-assurance primitive. Shipped: `GET /chain/stellar/tx?kind=pledge` builds unsigned XDR — destination claims before the deadline, pledger reclaims after; `kind=unlock` is milestone-gated disbursement; `kind=payment` settles. Tested in `test/chain-stellar.test.ts` (XDR round-trips through the official SDK).
- **Narrative:** commitment pooling + assurance pledges for community currencies — Grassroots Economics / Sarafu heritage on Stellar rails.
- **Action:** file interest form immediately; submit full application once the lane is live (this repo, `monolith`).

### 2. World Foundation Grants — Spark Track — `world-spark.md`
- Rolling, no deadline. Spark = validated-idea → working Mini App.
- **Why we fit:** World ID solves the anti-sybil debate live on gov.gitcoin.co. Shipped: `/mini` route + `GET/POST /actors/{id}/worldid` — MiniKit `walletAuth` SIWE verified server-side via ERC-1271 on World Chain; one World wallet = one actor (`ActorPersonhood`).
- **Needed from user:** register the mini app in the World Developer Portal (free) — gives the app_id for World App linking.

### 3. Prezenti Season 3 — Frontier Pool — `prezenti-frontier.md`
- Closes Dec 29, 2026. Funds agent-economy/protocol infrastructure on Celo.
- **Why we fit:** verified Celo mainnet contract reads (Allo, EAS, HypercertMinter, cUSD — verified 2026-10-20), `/mcp/agent` MCP server, full OpenAPI surface. Draft filed when convenient.

### 4. Filecoin Foundation — Builder Next Step ($5–10k) — `filecoin-builder.md`
- Rolling. **Unlock shipped:** `POST /evidence/anchor` now pins the manifest to IPFS (`IPFS_API` env) and returns the `cid`; `POST /datasets/{name}/release` already does JSONL + sha256 manifest + OTS + IPFS pin (`DatasetRelease.cid`).
- **Pitch:** content-addressed evidence packs for public-goods verification.

### 5. Ecosystem listings — `octant-profile.md` + `giveth-listing.md`
- **Octant Atlas** (apply.octant.app): profile queues for next epoch. Between epochs now.
- **Giveth**: project listing + GIVbacks; adapter already syncs their API so the page stays fresh.

### 6. ESP — `esp-fit-check.md`
- Wishlist/RFP-driven only — scan esp.ethereum.foundation wishlist before drafting; don't cold-apply.

### 7. Secondary: Drips Wave on Stellar
- SDF runs monthly paid contribution sprints for Stellar-ecosystem OSS repos. Once the Stellar lane ships, the repo can join a Wave — recurring contribution funding, not a grant.

## Watch / org-gated (entity registration unlocks)

| Program | Status | Unlock |
|---|---|---|
| UNICEF Venture Fund | closed (Mar 2026); ~$100k equity-free | registered startup in programme country |
| Mercy Corps Crypto for Good V | closed (C4G IV ended Jan 2025) | registered org |
| Climate Collective accelerators | cohort-based; $20–50k non-dilutive | registered org; World Bank GPSA link |
| Global Innovation Lab for Climate Finance | 2026 call likely closed | org + finance-instrument framing |
| Sovereign Tech Fund | open-ish, high bar | demonstrated criticality/adoption |
| Ma Earth Round 4 | opens Apr 22, 2027 | land projects; we fit as round *infrastructure* |

## Dead lanes (verified, no action)

- OIS Restack + all NLnet — AI policy (above)
- Optimism RetroPGF — paused since June 2026
- GG24 domain rounds — donation window closed; next cycle watch
- World Build 3 — closed April 2026
- UNICEF current calls, Mercy Corps C4G IV — closed
- NGI Zero Commons Fund — closed June 2026, superseded by OIS (also dead to us)

## Entity registration analysis (`org-gated.md`)

Not a blocker for any priority lane: SCF accepts projects/teams, World/Filecoin/Octant/Giveth accept individuals, ESP accepts individuals. Registration unlocks the philanthropic cohort (UNICEF, MCV, Climate Collective) — all currently closed anyway. **Decision: defer** until a live org-gated call appears or a grant requires it.

## Hygiene lanes (low cost, always-on)

- GitHub Sponsors on the repo
- thanks.dev / Polar for OSS dependency-style microfunding
- Open Collective project page (data already synced by our OC adapter)

## What every application can cite (live today)

- `https://springforth.widespread.workers.dev` — 12 hub routes, ledger `{"ok":true,"events":2163}` at `/ledger/verify`
- `src/chain.ts` — Celo mainnet: Allo pools, EAS attestations, Hypercert mints, Superfluid streams, Silvi rail (all unsigned-calldata builders, verified contract addresses)
- `src/chain.ts` stellar section — claimable-balance pledge/unlock/payment XDR builders
- `src/graph.ts` — mutual recognition (min of pairwise appreciation), EigenTrust, trust edges
- `src/funding.ts` — QF allocation, dominant-assurance pledge lifecycle, retro pools
- `src/attest.ts` — EAS schemas, OTS anchoring, IPFS evidence pinning
- `src/oracle.ts` — multi-source evidence fusion (Sentinel-2, GBIF, OpenAQ, field reports)
- `/mcp/agent` — MCP server for agent-native access
- Mida Creek demonstrator — Treegens-cited 64,699 mangroves
- AGPL-3.0-only, <4% custom code share post-consolidation, PROVENANCE.md tracked

## Gitcoin lane status (already posted, awaiting responses)

- love.fund pilot proposal: `gov.gitcoin.co/t/25438`
- Replies: t/25430 (bread-coop), t/25407 (trust graph), t/25429 (treasury yield)
- Next forum move (not yet): a Community Coordination / Commitment Pooling domain sensemaking report — hold until replies land and post-Oct 27.
