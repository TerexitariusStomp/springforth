# Crowd Surfing — transcript → implementation map

The Crowd Surfing talk transcript is the origin spec behind the
"Crowdsurfing GDD v1.0" cited in `src/entities.ts`. This document is the
canonical current-repo map: every concept in the talk, where it lives in
the code, and what remains honest-open. (The legacy repo's
`docs/CROWDSURFING.md` references removed features — this file supersedes
it.)

## The core loop (already live before this pass)

| Transcript concept | Implementation |
|---|---|
| Possibility card — "I want to…" + time/place + deadline + thresholds | `Possibility` (`src/entities.ts`), `POST /possibilities` |
| Needs pull / resources brought; required vs nice-to-have | `PlanNode` need/offer + `required`; flagged needs always nice-to-have |
| Swipe left / swipe right | `Pass` (private, deck-excluded) / `Interest` |
| "Do I know a nerd" — card ↔ person matching | complement detection (`detectComplements`) + trusted-peer `suggest` on the deck |
| Demurrage — "use it or lose it", time-box expires | `deadline` → `effectiveStatus`/`sweepPossibilities` → `expired` |
| Commitment pool — every possibility its own pool | `Participation` + dominant-assurance `Pledge` (Tabarrok 1998) |
| Group chat "inside the membrane" at constellation complete | `CouncilSeat` + council-gated `ForumPost`, opens at quorum |
| Appreciation → mutual recognition `min(a→b, b→a)` → shapes the feed | `Appreciation` → `trustEdges` → `eigenTrust` → `scoreCard` |
| "The feed = the nerds I trust most" | personalized `scoreCard` (0.5 trust), `?for=` interest feed |
| Perspectival knowledge — "what it's like here" | `context.datasets` (place verification) |
| Track record — laundry list → verifiable history | `report` + `ImpactClaim` + hash-chained audit ledger |
| Assurance credit for expired cards | `AssuranceCredit` awarded in the sweep |

## The layer added from the transcript (this pass)

| Transcript concept | Implementation |
|---|---|
| Engaged curiosity — "what we know / don't know / are uncertain of" | `Question` entity — indexed, open/answered, anyone asks, whoever's motivated answers. Open questions never block quorum; they mark what the card hasn't figured out. `POST /possibilities/:id/question|answer`, `GET /questions` |
| Decision matrix — consent / advice / duocracy / rule-based empowerment | `CouncilDecision` with `mode`; council-gated propose/respond/resolve; consent refuses to close on open objections; `rationale` mandatory on resolve (the storyboard "why"). `POST /possibilities/:id/decide`, `POST /decisions/:id/respond|resolve`, `GET /decisions` |
| "How juiced am I" — interest intensity | `Interest.level` 1–3; aggregated as `interestHeat` on `CardConnections`, rendered as heat dots |
| "Do I know a nerd" — explicit referral | `Referral` entity, idempotent per (card, from, to); notifies subscribers; `personal.referred` + `referredCount` surfaces |
| "Delete it, don't clog the landscape" — ecocycle compost | expired cards leave the default deck (`renderPossibilitiesPage` + React route); reachable via the Expired filter + deep links for audit; `compostedCount` in `/metrics` |
| "You have everything you need — how will you bring it together" | system `ForumPost` + `constellation.complete` ledger event posted once at quorum in `sweepPossibilities` |
| "Play this game, play that game" — facilitation inside the group | `src/data/structures.ts` — phase-appropriate liberating-structures picks on the card (method names are public; summaries are original — LS site text is NC-licensed) |
| "Loved by those that love me" | `recognizedBy` mutual-recognition peers on `/actors/:id` (HTML + JSON) |
| Design brief — place/problem/purpose/participants/boundaries/resources | `Possibility.brief` — the four narrative fields as `{text, by, at}` records (place, participants, deadline stay first-class card fields, rendered alongside). Any actor edits any field; every field is attributed + ledger'd (`possibility.brief`). `POST /possibilities/:id/brief`, declare-time fields, surfaced on `/report` |
| Test cards — "we believe / we test / we measure / it fails if" | `TestCard` entity (kind `test`) — `belief`/`action`/`measure`/`failState` + optional `questionId` linking the test to the uncertainty it was spawned from (uncertainty → experiment → inference). Anyone proposes (`POST /possibilities/:id/test`) or marks it running (`POST /tests/:id/run`); resolution is council-gated (`POST /tests/:id/resolve`) with a mandatory inference — pre-quorum the declarer resolves as steward. `GET /tests` |
| The ecocycle — seed → sprout → maturity → compost, with the two trap valleys | `src/data/ecocycle.ts` — stage *derived* from `effectiveStatus` (never stored); traps derived from live data (scarcity = deadline closing without quorum; rigidity = completed without a filed report). `ecocycleSvg` renders the ∞ loop server-side, no client JS — per-card ribbon in the overlay, portfolio panel on `/impact`, stage label on Telegram `/cards` |
| Participatory knowledge — "knowing by having done" | `src/data/knowledge.ts` — role-scoped enactments (declared / joined / council / test-ran / test-resolved) on cards that reached quorum. *Derived from the ledger, never stored* — a knowledge-type view, not a claim. Surfaced as `participatory` on `/actors/:id` (HTML + JSON) and `participatory.{total,actorsEnacted}` in `/metrics` |

## Live surpass-gates in `/metrics`

`questionResolutionRate`, `openQuestions`, `decisionRationaleCoverage`
(1.0 by construction — rationale is required to resolve),
`referralConversion`, `compostedCount`, `testsTotal`,
`testResolutionRate`, `ecocycle.stages` + `ecocycle.scarcityTrapped` /
`ecocycle.rigidityTrapped` (the trap counts competitors can't even see),
`participatory.total` / `participatory.actorsEnacted`.

## Honest gaps (talk concepts not yet implemented)

None. Every mechanism named in the transcript maps to live code above —
the four knowledge types are all surfaced (propositional = cards +
questions, procedural = plans/bringings, perspectival = `context.datasets`,
participatory = role-scoped enactments).
