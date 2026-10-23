# Springforth

Community coordination infrastructure. People declare what they want to make
happen; the system matches needs to offers across plans and communities;
quorum binds the commitment; open-evidence sources check what actually
happened.

**Live:** https://springforth.widespread.workers.dev

## What it does

- **Possibility cards** — "I want to make X happen" with what you bring, what
  you need, a threshold, a place and a deadline. Cards activate at quorum;
  deadlines expire what never reaches it.
- **Resource matching** — needs and offers are first-class nodes in a shared
  plan graph. Community currencies, neighbourhood hubs, fund projects and
  council plans all import into the same graph through adapters.
- **Overlap detection** — same work stated in different systems surfaces as
  explainable proposed overlaps (evidence + counter-evidence + reasoning);
  human validation promotes them; coordinated proposals materialise as
  shared action nodes.
- **Trust** — post-event appreciation rounds build pairwise edges;
  mutual recognition = `min(a→b, b→a)`; transitive trust via EigenTrust.
  Dominant-assurance credits recognise pledgers of cards that expire.
- **Open-evidence oracle** — hourly readings from public sources (Sentinel-2,
  OpenAQ, Sensor.Community, NASA POWER, GBIF, Treegens filmed plantings,
  plus hackathon-endorsed UK sources: EA Flood Monitoring, Open-Meteo,
  EA Water Quality, FSA hygiene ratings, iNaturalist — more key-gated on
  `/sources`). Score movement against baselines; evidence for review —
  human approval stays authoritative. Full matrix:
  `docs/hackathon/DATA-SOURCES.md`.
- **Audit ledger** — every state change is a hash-chained event; heads are
  anchored to Bitcoin via OpenTimestamps public calendars.
- **Funding layer** — quadratic rounds (Liberal Radicalism) over the needs
  coordination surfaces, dominant-assurance pledges that bind only at
  quorum, retro rounds reviewed by EigenTrust-derived badgeholders, and
  hypercert-shaped impact claims evaluated by EAS attestations. Nothing
  custodies funds — see `docs/funding-layer.md` + `docs/PROVENANCE.md`.
- **Telegram bot** — declare, join, flag needs and appreciate from group chat;
  quorum announcements post back to the declaring group.

**Judging?**  — the 3- and 8-minute live paths.

![Logical architecture](docs/hackathon/demo-assets/architecture.svg)

## Stack

Single TypeScript package → Cloudflare Worker + D1 (plus a React Router
frontend worker in `web/`). Domain logic lives in `src/`; the worker entry
(`src/index.ts`) is a thin HTTP shell.

| Module | Role |
|---|---|
| `src/entities·gate·ledger·valuation` (`core.ts`) | entity schemas + hash-chained audit ledger |
| `src/graph·resolve·possibility·tri·geo` (`coordination.ts`) | plan graph, overlap detection/validation, possibility lifecycle, trust |
| `src/index` (`edge`) | Cloudflare Worker API + Telegram webhook + hourly oracle cron |
| `src/portal/` | server-rendered pages (landing, possibilities, coordination, portfolio, outcomes, verify) |
| `src/oracle.ts` | open-source readers (remote sensing, air quality, biodiversity, field evidence) |
| `src/agent.ts` | deterministic NL query over the coordination graph — cited, read-only |
| `src/adapters/` | OnePlanet (incl. MCP write lane), Sarafu/CLC, Holons, Artizen, Open Collective, ValueFlows, Treegens, Silvi, Giveth, GAP, Restor, Regen, Bloom, Soulutions, Atlas |
| `src/attest.ts` | EAS schema payloads + sha256 manifests → ledger; OpenTimestamps anchoring |
| `src/funding.ts` | quadratic matching, assurance pledges, retro tally, claim builder |
| `src/exports.ts` | public-spec emitters: 360Giving, IATI |
| `src/chain.ts` | viem clients: EAS attest, Allo rounds, hypercert mint, Superfluid streams, Aave yield — celo-sepolia/celo |
| `src/client.ts` | typed SDK — `new SpringforthClient({baseUrl}).rounds()` |
| `web/` | React Router frontend worker (own vite/wrangler config, deps hoisted from root) |

## How it compares

Springforth spans coordination → evidence → funding → governance. Most
public-goods tools cover one camp; the differentiators are where they
can't follow:

| Capability | Springforth | Gitcoin/Allo | Giveth | Coordinape | Karma GAP | Octant |
|---|---|---|---|---|---|---|
| Pre-funding coordination (declare/commit/quorum) | ✅ core model | — | — | partial | — | — |
| Overlap/complement detection across plans | ✅ | — | — | — | — | — |
| Sybil resistance | **internal** EigenTrust graph + pairwise `k_ij` | external Passport | GIV staking | — | — | GLM lock |
| Matching | standard + **trust-aware pairwise** + conviction | cluster-match (external signal) | QF | — | — | — |
| Evidence → funding coupling | oracle trajectory boosts match weight | — | — | — | verify only | — |
| Measure-to-earn (field evidence → credits) | ✅ | — | — | — | partial | — |
| Recurring support | Superfluid streams | — | — | circles only | — | — |
| Governance | EigenTrust-gated quadratic parameter ballots | token | token | — | — | token |
| Data layer | signed/anchored dataset releases + IPFS + grants | — | — | — | — | — |
| Custody | **none** — all tx unsigned calldata | — | — | — | — | staking |

The moat: appreciation → pairwise trust → EigenTrust is a *live* social
signal competitors would need our whole coordination layer to replicate.

## Develop

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev                              # wrangler dev — local worker
pnpm web:dev                          # React frontend dev server
```

## Deploy

```bash
wrangler d1 create springforth-coord    # then set database_id in wrangler.toml
wrangler d1 migrations apply springforth-coord --remote
pnpm deploy                           # edge worker
pnpm web:deploy                       # frontend worker
node --experimental-strip-types scripts/seed-d1.mjs   # demo fixture
```

Secrets (`wrangler secret put`): `ADMIN_TOKEN` (write endpoints),
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` (bot), `OPENAQ_API_KEY`
(optional), `NOTIFY_WEBHOOK` (optional quorum notifications).

## License

AGPL-3.0-only — see [LICENSE](LICENSE). Custom orchestration layer only;
the systems it composes are under their own licenses (see
[docs/OSS-STACK.md](docs/OSS-STACK.md)).
