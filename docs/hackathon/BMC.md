# Springforth — Business Model Canvas (PS1)

| Block | |
|---|---|
| **Customer segments** | Communities coordinating local action (primary, free); funders matching community needs (councils, foundations, regen networks); ecosystem operators deploying the layer (NGOs, platforms); data consumers (researchers, rating agencies) |
| **Value propositions** | Communities: overlapping plans become coordinated, funded action — "resourced before it's funded". Funders: matching with collusion resistance built in, evidence-coupled allocation. Operators: the layer as infrastructure — typed client, OpenAPI, adapters. Data consumers: signed, anchored, provenance-clean records |
| **Channels** | Telegram bot (where coordination already happens), server-rendered portal (zero-install), API + typed client, dataset releases + IPFS |
| **Customer relationships** | Community self-service; appreciation→trust graph compounds retention (trust earned in one card improves the next); governance franchise rewards standing, not spending |
| **Revenue streams** | 1. **Settlement fee** — small % on funded needs (funder-side, opt-in per round). 2. **Yield spread** — stewarded pools/streams earn protocol fee on accrual, non-custodial. 3. **Consented data revenue** — signed dataset releases; premium raw feeds via payment-verified access grants (aggregates stay public). 4. **Hosted deployments** — managed instances for councils/funders |
| **Key resources** | The appreciation→EigenTrust graph (the moat — sybil resistance competitors can't copy without the coordination layer); hash-chained ledger + Bitcoin anchoring; adapter network; OSS stack (~1.7% custom) |
| **Key activities** | Overlap detection + human validation; oracle evidence scoring; matching allocation; ledger anchoring; dataset releases; adapter maintenance |
| **Key partnerships** | OnePlanet (PS1 data backbone + MCP), Treegens (field evidence), Silvi (reforestation MRV, per-project keys), Holons, Artizen, Open Collective, ValueFlows, Sarafu/CLC, oracle data providers (Sentinel-2/GBIF/NASA POWER/OpenAQ) |
| **Cost structure** | Cloudflare edge (D1 + Workers — near-zero marginal cost), oracle API tiers, engineering; communities pay nothing |

## Why this wins at unit level

- A funding round's settlement fee needs no new behavior — donations
  already flow through rounds.
- Stewarded-pool yield is passive once sponsors hold positions
  (non-custodial — they keep the aTokens).
- Dataset releases turn the audit trail into a product: the same
  hash-chained records that prove integrity are the data being sold.
- The moat compounds: every coordination event deepens the trust graph,
  which improves matching, which attracts more coordination.
