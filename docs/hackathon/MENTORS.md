# Mentor map — who cares about what

Each named mentor/judge from the SF Live bootcamp, mapped to the Springforth
surface that speaks to their concern. Names and affiliations from
`bootcamp-slides-2026.pdf` and `onenote-Resources.txt` (vendor/).

## Standards, valuation, evidence

**Chryssi** (standards/valuation reviewer — see `FEEDBACK-2026-10-22.md`,
`NOTES-CHRYSSI-2026-10-22.md`)
Care about: verifiable evidence, distinct value categories (money mobilized
vs cost vs avoided loss vs time saved), capitals accounting (NCP, SHCP, SVI,
SEEA, VAN), published citations, verifier replay.
Show: `VALUATION.md` · card overlay "value coordinated" block with the
verifier-replay `<details>` · `/impact#evidence` methodology citations ·
`/ledger/verify` · the capital column on `/impact#results`.

## Marketplace / organisational story

**Richard Peers** (organiser — Responsible Risk / Finextra)
Care about: "a market place of marketplaces" — liquidity of opportunity,
contribution, assets, funding, outcomes, stewardship.
Show: the 6-stage liquidity model maps 1:1 onto our lifecycle —
declare(Surface) → commit/quorum(Match) → pledge(Fund) → report(Deliver) →
verify(Measure) → council(Steward). Landing + `/map` tell it visually.

**Sarah Sinclair** (Co Labs Global)
Care about: community fabric, how people actually coordinate.
Show: `/possibilities` feed (yes/no learning loop), quorum-gated forum,
appreciation→trust graph on `/community#trust`, councils.

## Challenge owners

**Pooran Desai** (OnePlanet — BRP challenge owner)
Care about: joined-up funding for BRP, co-benefit quantification, avoided
costs harvested for community work, the MCP connection working.
Show: `packages/oneplanet-adapter` (implemented per the official MCP guide —
**verified live**: the SFLive Sandbox flood + climate plans are imported,
183 real OAI nodes in `/collaborate`, Brighton outcomes like "Reduce Flood
Risk to Property in Brighton and Hove" surface with contribution-gap
detection), `/impact#data` imports block, scenario block on GB cards,
`PITCH-LIVE.md` BRP section.

**Mohammed Sohail** (Grassroots Economics CTO) / **Will Ruddick** (founder)
Care about: Sarafu commitment pools, fulfilment histories, investability
evidence beyond cash flow; regenerative-bonds framing (arxiv 2606.23922).
Show: commitment-pool-compatible `Participation`/fulfilment records,
trust-graph reliability scoring, Kenya seed geography (Mida Creek), the
endowment lane for regenerative-finance continuity.
Data on hand: Zenodo export (zenodo.org/records/20120190),
viz.sarafu.network, sarafu.network/map.

## Earth observation / physical risk

**Luisa Doughty, Liz Scott, Isabelle Crozier-Morris, Anuradha DamaleDay**
(Satellite Applications Catapult / EO Data Hub)
Care about: Sentinel-2 and EO evidence actually used, not name-dropped;
physical risk priced, not asserted.
Show: `packages/oracle/src/sources.ts` — keyless Sentinel-2 Earth Search
STAC lane live today; EO Data Hub lane implemented but key-gated
(`EODATAHUB_KEY` requested via Help Desk); Alpha-Klima physrisk source for
hazard→asset-impact→portfolio-loss; evidence rows with methodology refs on
`/impact#evidence`; NDVI readings on cards.
Action pending (user): email contacto@alpha-klima.com with team name for
the event platform account.

**Manuel Carmona / Eduardo Mateos González** (Alpha-Klima)
Care about: physrisk API usage during the event.
Show: `alphaKlima` source registration in `sources.ts` + the avoided-loss
value lane that consumes hazard metrics.

## Infrastructure / legal / capital

**Danyal Hussain** (Cloudscaler) / **David Gristwood** (Microsoft)
Care about: where compute runs, cloud economics, Planetary Computer.
Show: `ARCHITECTURE.md` — Cloudflare edge at near-zero marginal cost is the
delivery choice; Planetary Computer/STAC compatibility is the data path;
AWS/Azure credit notes vendored but not load-bearing.

**Annamarie** (Ashurst / Transition Family Value Partners) & legal mentors
Care about: custody, regulatory posture, who holds money.
Show: non-custodial transaction builders (unsigned Celo lanes — user signs,
we never hold keys/funds), `IMPACT.md` claims-not-certificates stance,
settlement fee as the only money-touching surface.

**Gerrit Sindermann** (Green Digital Finance Alliance)
Care about: digital bonds, settlement, endowment mechanics.
Show: the endowment lane (streams + stewarded yield, non-custodial),
`/fund#rounds`, `VALUATION.md` monetized-labour methodology.

## Insurance / avoided loss

**Anthony Hobbly** (insurance/reinsurance closing talk — conference Oct 20)
Care about: quantified avoided losses, damage-avoidance spend vs payout,
insurance-grade attribution.
Show: `riskAvoided` capital lane + scenario block (expires vs activates),
ABI/Howdens damage-avoidance framing in `VALUATION.md`, oracle-backed
flood/NDVI evidence rows.
Action pending (user): watch the talk recording if it posts.
