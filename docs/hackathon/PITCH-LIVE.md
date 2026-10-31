# Live pitch — 8 minutes (Emerging class)

Timing target: 7:30, leaving buffer. Rehearse with a visible timer.
This file is self-contained — the demo legs are scripted inline below.

Honesty beat if asked (one line, don't dwell): "The platform underneath
predates the event — what I built *here* is the evidence layer, the
Brighton framing, and the funding path you're about to see."

## 0:00–1:00 — Problem + the organizer's own model

> "Communities' plans live in different systems. Strategies conflict or
> duplicate, and it's invisible until it's too late. Your own bootcamp
> slide described the unlock: a marketplace for community liquidity —
> Surface, Match, Fund, Deliver, Measure, Steward. That is literally our
> lifecycle: declare → quorum → pledge → report → verify → council."

Show the architecture SVG for ~10s only — point at the right rail.

## 1:00–5:00 — Live demo (six legs, 4 min)

Base: https://springforth.widespread.workers.dev
Each leg ends on a line that maps to a judging criterion.

1. **Possibilities feed** (/possibilities?actor=priya) — the deck learns
   yes/no: "Not now" records a pass, "I'm interested" records interest;
   reason lines show "you're in / watching this / N people you recognise";
   since-engagement badges show what moved. *Criterion: demo — live, not
   slides.* 30s.
2. **Quorum card overlay** (click the Severn flood card) — audit trail
   (#seq → /ledger), council seats auto-seated at quorum, council-gated
   forum, participant reviews, "Coordinated value" split by capital
   (financial/human/social/natural), and the verifier-replay `<details>`
   on every figure. Pledge form is live at quorum. *Criterion: technical
   implementation.* 60s.
3. **Outcomes** (/collaborate#outcomes) — "4 pursuing this outcome":
   Kilifi County's plan, the community card, and Treegens' real filmed
   plots at Kisiwani + Dabaso. Overlap shows evidence **and**
   counter-evidence; humans validate. *Criterion: impact potential.* 45s.
4. **Impact → data + evidence** (/impact#data, /impact#evidence) — the
   endorsed-sources block: EA Flood, Open-Meteo, EA WQ, FHRS, Sentinel-2
   STAC live keyless; Companies House / OS / EO Data Hub / Alpha-Klima
   honestly marked key-gated; OnePlanet MCP + Sarafu imports listed with
   provenance. Evidence rows carry methodology citations. *Criterion: use
   of datasets.* 45s.
5. **Fund → rounds** (/fund#rounds) — demand met vs matching locked;
   quadratic allocation with visible clique discount; permanent endowment
   (locked principal + accrued activity fees). *Criterion: business
   idea.* 30s.
6. **Map + ledger** (/map, /ledger/verify) — Kenya + UK pins on one map;
   hash-chain verify + OpenTimestamps anchor. *Criterion: feasibility —
   it runs now, across two countries.* 30s.

Telegram lane (optional +20s): /new declares a card from a group chat;
quorum announcements post back to the declaring group.

Backup: `docs/hackathon/demo-assets/` screenshots numbered in this order.
If the live demo fails: walk the screenshots and narrate the same beats.

## 5:00–6:15 — BRP answer + value categories

> "For Brighton Resilience Partnership: joined-up projects need co-benefit
> quantification and avoided-cost harvesting. Our cards compute four
> capital classes — financial committed, human volunteer hours at the ONS
> rate, social in-kind, natural risk-avoided — kept *distinct*, every
> figure replayable from the ledger. The £1→£10 NHS-style claim becomes an
> auditable number, not a slogan."

Name the OnePlanet MCP import + Sarafu commitment-pool fit here.

## 6:15–7:15 — Business model + feasibility

> "Revenue: funder-side settlement fee on rounds — no new behavior —
> then hosted deployments for councils, then consented dataset revenue
> once the audit corpus is worth selling. Non-custodial by construction;
> the only money we touch is the fee. Pilot path: BRP in the UK, a Sarafu
> community in Kenya — the seed data already spans both."

## 7:15–7:30 — Close on impact

> "The criteria ask for demo, business idea, technical implementation,
> datasets, feasibility, scalability, impact. You just watched a live,
> ledger-anchored system across two countries answer all eight. The
> coordination problem that motivated this build is the one we sell the
> fix for."

## Judge-Q&A pocket answers

- **"Isn't this just a crowdfunding site?"** — Coordination first: quorum
  binds commitment before money; matching is demand-gated; councils
  steward after delivery.
- **"Why wouldn't OnePlanet just do this?"** — They map plans; we activate
  and fund them. We import their graph via MCP — complementary layer.
- **"Data provenance?"** — Every figure labels ledger-derived / declared /
  cited-estimate; sources tier visible at `/impact#data`; key-gated lanes
  are honestly marked as such.
- **"Team?"** — Solo build on open source (MIT-clean, ~2% custom code
  over vendored libraries) — the coordination layer, not the institution,
  is what scales.
