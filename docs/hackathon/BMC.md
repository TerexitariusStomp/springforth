# Springforth — Business Model Canvas (PS1)

| Block | |
|---|---|
| **Customer segments** | Communities coordinating local action (primary, free); funders matching community needs (councils, foundations, regen networks); ecosystem operators deploying the layer (NGOs, platforms); data consumers (researchers, rating agencies) |
| **Value propositions** | Communities: overlapping plans become coordinated, funded action — "resourced before it's funded". Funders: matching with collusion resistance built in, evidence-coupled allocation — and every action quantified in money terms (risk, cost, value creation; see VALUATION.md). Operators: the layer as infrastructure — typed client, OpenAPI, adapters. Data consumers: signed, anchored, provenance-clean records |
| **Channels** | Telegram bot (where coordination already happens), server-rendered portal (zero-install), API + typed client, dataset releases + IPFS |
| **Customer relationships** | Community self-service; appreciation→trust graph compounds retention (trust earned in one card improves the next); governance franchise rewards standing, not spending |
| **Revenue streams** | 1. **Settlement fee** — small % on funded needs (funder-side, opt-in per round). 2. **Yield spread** — stewarded pools/streams earn protocol fee on accrual, non-custodial. 3. **Consented data revenue** — signed dataset releases; premium raw feeds via payment-verified access grants (aggregates stay public). 4. **Hosted deployments** — managed instances for councils/funders |
| **Key resources** | The appreciation→EigenTrust graph (the moat — sybil resistance competitors can't copy without the coordination layer); hash-chained ledger + Bitcoin anchoring; adapter network; OSS stack (~1.7% custom) |
| **Key activities** | Overlap detection + human validation; oracle evidence scoring; matching allocation; ledger anchoring; dataset releases; adapter maintenance; monetary valuation of coordinated effort (VALUATION.md methodology) |
| **Key partnerships** | OnePlanet (PS1 data backbone + MCP), Satellite Applications Catapult / EO Data Hub + Alpha-Klima (endorsed physical-risk data), Geovation (post-event pathway), Treegens (field evidence), Silvi (reforestation MRV, per-project keys), Holons, Artizen, Open Collective, ValueFlows, Sarafu/CLC, oracle data providers (EA Flood Monitoring, Open-Meteo, EA Water Quality, FHRS, Sentinel-2/GBIF/NASA POWER/OpenAQ) |
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

## Benefits Dependency Network

Read right-to-left, per the SF Live template: investment drivers on the
right, benefits on the left, every dependency explicit.

| Investment objective | Business change | Enabling change | Benefit |
|---|---|---|---|
| Fund joined-up community projects, not siloed grants (BRP challenge) | Funders pledge against activated coordination, not proposals | Dominant-assurance pledges bind only at quorum; matching pools price collusion risk | Capital flows to verified activity; matching efficiency improves as the trust graph deepens |
| Quantify co-benefits across capitals | Value measured in money terms per capital class, kept distinct | Four-capital `valueCoordinated` (financial/human/social/natural); verifier-replay disclosures on every figure | Funders see £-denominated avoided cost next to volunteer time without conflating them |
| Harvest avoided-cost savings to fund community work | Avoided loss becomes a revenue argument for sponsors | Oracle evidence (EA Flood, Sentinel-2, physrisk) + LTIS-type benchmarks cited per figure | Insurance/NHS-style avoided-loss claims become auditable numbers a funder can underwrite |
| See reality, not plans | Coordination activates at quorum and reports outcomes on evidence | Live public data (17 sources), hash-chained audit ledger, council-gated forum at quorum | Communities become legible to banks/councils as investable, reliable counterparties |
| Stop scoring clubs as high-risk-low-value | Reliability proven from fulfilment history, not cash flow | Appreciation→EigenTrust graph; Sarafu-compatible commitment/fulfilment records | Community organisations carry portable reputation across funders |

**Dependencies / enabling technologies:** Cloudflare edge (D1+Workers,
near-zero marginal cost) · hash-chained ledger w/ OTS anchoring · oracle
adapter layer (EA/Open-Meteo/STAC/physrisk) · OnePlanet MCP knowledge-graph
import · Sarafu commitment-pool data (Zenodo export) · non-custodial Celo
builders · IPFS dataset releases · typed SDK + OpenAPI.

## Go-to-market — work-back plan

Working back from the first paying deployment:

1. **Pilot/friendly client.** Brighton Resilience Partnership is the
   canonical pilot (their challenge framing); a Kenyan grassroots community
   via Sarafu is the second geography. Both seed live cards, not demos.
2. **Proposition training + partner-led reach.** OnePlanet carries the
   planning-layer story; Grassroots carries the commitment-pool story;
   Geovation is the post-event pathway. Springforth arrives as the
   coordination-and-funding layer those ecosystems already need.
3. **Technology integration testing.** MCP import from OnePlanet, Zenodo
   export from Sarafu, oracle sources — all already wired; the pilot
   exercises them end-to-end.
4. **Commercial model.** Funder-side settlement fee on rounds first
   (no new behavior), then hosted deployments for councils, then consented
   dataset revenue once the audit corpus is large enough to sell.
5. **Client onboarding.** Zero-install portal + Telegram bot; a council or
   foundation joins by declaring a matching round, not by deploying
   software.
6. **Customer-facing materials.** `/docs` + OpenAPI, judge route list
   (JUDGES.md), this canvas, the architecture diagram — all public.
7. **Iterate and simplify.** Every pilot cycle feeds the feed signals
   (join/interest/pass) and council telemetry back into surfacing order.
