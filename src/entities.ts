import { z } from 'zod';

// Springforth core entities — the coordination schema only.
// Crowdsurfing loop (GDD v1.0): "I want to…" + what I bring + what I need
// + thresholds + a deadline. Opt-in participation and required-need
// fulfilment activate group coordination at quorum; the deadline expires
// what never reaches quorum; post-event appreciation feeds a pairwise
// trust graph that improves future surfacing.

export const Signal = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  targetId: z.string().min(1),
  targetKind: z.enum(['node']).default('node'),
  intent: z.enum(['support', 'interest', 'concern', 'field-report']).default('support'),
  ref: z.string().optional(),   // evidence ref for field-report (photo/doc URI)
  note: z.string().default(''),
  at: z.string().datetime(),
});
export type Signal = z.infer<typeof Signal>;

export const PossibilityStatus = z.enum([
  'draft',      // declared, not yet open
  'active',     // open for participation
  'quorum',     // thresholds met — group coordination activated
  'completed',  // event happened (timeEnd passed post-quorum)
  'expired',    // deadline passed without quorum
]);
export type PossibilityStatus = z.infer<typeof PossibilityStatus>;

// Design brief — the transcript's six-field brief (place / problem /
// purpose / participants / boundaries-deadline / resources). Place,
// participants and deadline stay first-class Possibility fields, so
// only the four narrative fields live here. Wiki-editable by any actor
// ("anyone can contribute — but it's linked"): every field carries
// per-field attribution and every edit lands on the ledger.
const BriefField = z.object({
  text: z.string().default(''),
  by: z.string().optional(),          // last contributor
  at: z.string().datetime().optional(),
});

export const Possibility = z.object({
  id: z.string().min(1),
  title: z.string().min(1),                   // the "I want to…" statement
  description: z.string().default(''),
  declarerId: z.string().min(1),              // Possibility Declarer role
  place: z.string().optional(),               // free-text location / placeId
  h3: z.string().optional(),                  // resolved cell when the place is known — powers the map surface
  timeStart: z.string().datetime().optional(),
  timeEnd: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(), // quorum by this date
  minParticipants: z.number().int().min(0).default(0),
  status: PossibilityStatus.default('draft'),
  quorumAt: z.string().datetime().optional(),
  maxParticipants: z.number().int().min(0).optional(), // optional cap (GDD field)
  // Declarer-stated households the action protects — feeds the derived
  // "risk mitigated" estimate (valuation.ts × cited per-home damage avg).
  // Declared, not verified — always labelled est. downstream.
  householdsProtected: z.number().int().min(0).optional(),
  // Completion report (Bloom Action Report analog) — what happened, the
  // evidence, the learnings. `nextNeeds` spawn new need nodes at
  // completion ("what support would help" — the loop continues).
  report: z.object({
    summary: z.string().default(''),
    evidence: z.string().default(''),
    learnings: z.string().default(''),
    at: z.string().datetime(),
  }).optional(),
  // External-data context attached at declare/seed time and cached — place-
  // verification and dataset enrichment. Read-only surfaces show it as
  // "verified context"; it never affects quorum.
  context: z.object({
    datasets: z.array(z.object({
      name: z.string(),
      value: z.string(),
      source: z.string().default(''),
      fetchedAt: z.string().datetime(),
    })).default([]),
  }).optional(),
  // The structured brief — the four fields not already first-class
  // (place/min-max/deadline render alongside, from the card itself).
  brief: z.object({
    problem: BriefField.optional(),     // the tension being addressed
    purpose: BriefField.optional(),     // intended outcome
    boundaries: BriefField.optional(),  // scope — what's in / out
    resources: BriefField.optional(),   // what's already available
  }).optional(),
  // The CLC SwapPool this possibility's delivery flows through, when one
  // is linked — the allocation/quorum layer pointing at the pooling layer.
  clcPool: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  // Validation-design fields (Alena's four-phase test): which arm of a
  // staggered rollout this card belongs to, and whether organizer
  // facilitation was withdrawn. Both optional — absence means
  // unclassified, never silently 'platform'.
  cohort: z.string().optional(),             // e.g. 'mars-2026', 'kilifi-2025'
  arm: z.enum(['baseline', 'platform', 'delayed']).optional(),
  facilitation: z.enum(['full', 'minimal']).optional(),
  // Data-model dimensions (encounter-configuration vocabulary): the
  // recurring occasion this card serves, and whom the outcome benefits.
  occasion: z.string().optional(),
  beneficiary: z.enum(['self', 'group', 'community']).optional(),
  createdAt: z.string().datetime(),
});
export type Possibility = z.infer<typeof Possibility>;

// Opt-in commitment step: "I'm coming" (+ optionally "I'm bringing X" —
// an offer node linked via bringingNodeId). Interest is a Signal; this is
// the commitment step.
export const Participation = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  bringingNodeId: z.string().optional(),      // offer node for "I'm bringing X"
  // Participant-declared hours pledged to this possibility — feeds the
  // derived "coordinated value" estimate (valuation.ts). Declared, not
  // verified; always labelled as such downstream.
  hours: z.number().positive().optional(),
  // Provenance dimensions: how the actor arrived (organic/referral/
  // direct/ops) and their self-described tie to the declarer — feeds
  // organic-rate and relation-type analysis. Optional; absence = unknown.
  source: z.enum(['organic', 'referral', 'direct', 'ops']).optional(),
  relation: z.enum(['known', 'vouched', 'stranger']).optional(),
  at: z.string().datetime(),
});
export type Participation = z.infer<typeof Participation>;

// Pairwise appreciation — the GDD's TrustEdge source. Deliberately
// directional (from→to) so mutual recognition = min(a→b, b→a) can be
// derived — the free-association semantics that shape standing and surfacing.
export const Appreciation = z.object({
  id: z.string().min(1),
  fromActor: z.string().min(1),
  toActor: z.string().min(1),
  possibilityId: z.string().optional(),       // post-event appreciation round
  note: z.string().default(''),
  at: z.string().datetime(),
});
export type Appreciation = z.infer<typeof Appreciation>;

// Swipe-left — a logged "pass" on a possibility card. Never rendered
// publicly (demand-shape data for the community, not shame); excluded
// from the actor's own deck surfacing.
export const Pass = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  at: z.string().datetime(),
});
export type Pass = z.infer<typeof Pass>;

// Swipe-right — a logged "I'm interested" on a possibility card. The
// warm signal short of joining: counts may render publicly (momentum),
// identity stays under the same gradation rules as participants.
// `level` is the GDD's "how juiced up am I" — optional intensity 1–3
// (warm → all-in); the heat aggregate stays demand-shape data.
export const Interest = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  level: z.number().int().min(1).max(3).optional(),
  source: z.enum(['organic', 'referral', 'direct', 'ops']).optional(),
  relation: z.enum(['known', 'vouched', 'stranger']).optional(),
  at: z.string().datetime(),
});
export type Interest = z.infer<typeof Interest>;

// Engaged-curiosity layer — indexed uncertainties made askable. Needs are
// the declarer's answers; open questions are the community's uncertainties.
// Any actor asks, any actor answers ("whoever's motivated should do that")
// — the transcript's act-or-infer loop before commitment hardens.
export const Question = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  text: z.string().min(1),
  state: z.enum(['open', 'answered']).default('open'),
  answer: z.object({
    actor: z.string().min(1),
    text: z.string().min(1),
    at: z.string().datetime(),
  }).optional(),
  at: z.string().datetime(),
});
export type Question = z.infer<typeof Question>;

// Council decision — the decision matrix made concrete: consent when many
// are affected and context is wide; advice when many are affected but few
// hold the context; duocracy when few are affected and context is wide
// ("just do it", logged); empowered when rights/permissions are doled out
// by role (few affected + few with context). `rationale` is mandatory on
// resolve — the storyboard "why" is the auditable trail.
export const DecisionMode = z.enum(['consent', 'advice', 'duocracy', 'empowered']);
export type DecisionMode = z.infer<typeof DecisionMode>;

export const CouncilDecision = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  title: z.string().min(1),
  mode: DecisionMode,
  proposer: z.string().min(1),
  decider: z.string().optional(),           // advice/empowered: who decides
  closesAt: z.string().datetime().optional(),
  state: z.enum(['open', 'decided', 'withdrawn']).default('open'),
  outcome: z.string().optional(),
  rationale: z.string().optional(),         // required on resolve
  responses: z.array(z.object({
    actor: z.string().min(1),
    kind: z.enum(['support', 'objection', 'input']),
    text: z.string().default(''),
    at: z.string().datetime(),
  })).default([]),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().optional(),
});
export type CouncilDecision = z.infer<typeof CouncilDecision>;

// Referral — "do I know a nerd?" A named nudge from a trusted peer toward
// a card that could use them. Idempotent per (card, from, to): the unique
// id is derived, repeat refers update the note rather than duplicating.
export const Referral = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  fromActor: z.string().min(1),
  toActor: z.string().min(1),
  note: z.string().default(''),
  at: z.string().datetime(),
});
export type Referral = z.infer<typeof Referral>;

// Test card — the transcript's experiment record: the field vocabulary
// (belief / action / measure / expected failure) is the Strategyzer
// test-card shape (CC-BY-SA — names are public field vocabulary, the
// wording here is original). Any actor proposes; any actor takes it on
// (running); resolution (passed/failed + the inference on the record)
// is council-gated like forum/decisions — pre-quorum, when no seats
// exist yet, the declarer resolves as the card's steward. `questionId`
// links the test to the indexed uncertainty it was spawned from — the
// engaged-curiosity chain: uncertainty → experiment → inference.
export const TestCard = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  questionId: z.string().optional(),
  actor: z.string().min(1),            // proposer
  belief: z.string().min(1),           // the assumption under test
  action: z.string().min(1),           // the experiment
  measure: z.string().min(1),          // key results — how we'll know
  failState: z.string().default(''),   // expected failure state
  state: z.enum(['proposed', 'running', 'passed', 'failed'])
    .default('proposed'),
  runner: z.string().optional(),       // whoever took it on
  result: z.object({                   // the inference that landed
    actor: z.string().min(1),
    text: z.string().min(1),
    at: z.string().datetime(),
  }).optional(),
  at: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type TestCard = z.infer<typeof TestCard>;

// Dominant-assurance credit (Tabarrok 1998): participants who committed to
// a possibility that *expired* earn append-only recognition — "they were
// willing when willingness wasn't enough." Makes joining dominant;
// part of the earned ledger (append-only, never spendable).
export const AssuranceCredit = z.object({
  id: z.string().min(1),
  possibilityId: z.string().optional(),       // pledge lane: the card pledged
  nodeId: z.string().optional(),              // evidence lane: corroborated node
  actor: z.string().min(1),
  source: z.string().optional(),              // 'pledge' | 'field-evidence'
  at: z.string().datetime(),
});
export type AssuranceCredit = z.infer<typeof AssuranceCredit>;

// ── Funding layer — public-mechanism vocabulary only ────────────────────
// Every mechanism below is published public prior art, cited at its use
// site: quadratic funding (Weyl, Buterin & Hitzig, "Liberal Radicalism",
// 2018 — Gitcoin/Allo Protocol implementation), dominant assurance
// (Tabarrok, J. Public Economics 1998), retroactive allocation (Optimism
// RetroPGF), impact claims (hypercerts ATProto lexicon), attestations
// (EAS). Nothing custodies funds — donations and pledges are ledger
// records of intent; settlement rides public rails.

export const FundingRoundState = z.enum(['open', 'closed', 'allocated']);
export const MatchingMode = z.enum(['lr', 'pairwise']);

// A bounded allocation event: sponsors add a matching fund; donors give
// small amounts to eligible financial need nodes; the fund distributes by
// quadratic allocation (breadth of support, not depth of pocket).
export const FundingRound = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  sponsorIds: z.array(z.string()).default([]),
  matchingFund: z.object({ amount: z.number().min(0), currency: z.string().min(1) }),
  // eligible targets are financial need nodes in the plan graph.
  eligibleNeedIds: z.array(z.string()).default([]),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  state: FundingRoundState.default('open'),
  // matching mechanism: 'lr' = classic (Σ√c)²; 'pairwise' = coordination-
  // subsidised QF (Buterin ethresear.ch/5553) with per-pair discount
  // coefficients from the appreciation trust graph + wallet clusters.
  matchingMode: MatchingMode.default('lr'),
  // time-weighted support (Gardens conviction-voting): earlier backing
  // counts more within the round window.
  conviction: z.boolean().default(false),
  // accepted donation tokens on the chain rail (symbol → address).
  acceptedTokens: z.record(z.string(), z.string()).default({}),
  // on-chain mirror — Allo round id once created (phase 3).
  chainRef: z.string().optional(),
  // Demand gate (Commons-proven mechanic): matching stays locked until
  // committed pledges reach pledgeGoal across minBackers distinct pledgers
  // — proven demand before treasury flows. Unset = always active.
  pledgeGoal: z.number().min(0).optional(),
  pledgeGoalCurrency: z.string().optional(),  // defaults to matchingFund.currency
  minBackers: z.number().int().min(0).optional(),
  // Activity-fee skim: this many bps of each donation accrues to the
  // endowment round — recurring revenue from transaction flow, not a
  // one-way tax on donations.
  skimBps: z.number().int().min(0).max(10000).optional(),
  // Upstream split (love.fund criterion #6): bps of each settled
  // donation routed upstream (ecosystem share), donor-overridable.
  upstreamSplitBps: z.number().int().min(0).max(10000).optional(),
  // Permanent endowment: matchingFund is locked principal; only accrued
  // skim is allocable. Endowment rounds never allocate match themselves.
  endowment: z.boolean().default(false),
  // Trust epoch pinned at open — pairwise allocation computes
  // discoordination over this epoch's committed edges, not the live
  // graph, so the match is recomputable at close (docs/TRUSTGRAPH.md).
  trustEpoch: z.number().int().min(1).optional(),
});
export type FundingRound = z.infer<typeof FundingRound>;

// Actor ↔ wallet binding. A wallet proves control of an address by
// EIP-191 personal_sign over a canonical message; actors may bind several
// addresses. Pairwise matching merges donors sharing a bound wallet —
// one wallet, one actor, k = 0 with itself.
export const ActorWallet = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  at: z.string().datetime(),
});
export type ActorWallet = z.infer<typeof ActorWallet>;

// Actor ↔ World ID binding (proof of personhood). The Mini App lane:
// MiniKit walletAuth returns a SIWE message signed by a World-verified
// account's wallet (World App accounts are human-gated — orb or
// document level). The worker re-verifies the SIWE via ERC-1271 on
// World Chain and stores the verified wallet as the personhood anchor.
// One World wallet = one actor — mutual-recognition matching can't be
// sybil-farmed. Personhood, not identity: no orb data ever stored.
export const ActorPersonhood = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),  // World-verified wallet
  username: z.string().optional(),                  // World App username (optional)
  at: z.string().datetime(),
});
export type ActorPersonhood = z.infer<typeof ActorPersonhood>;

// One-shot SIWE nonce for the World ID bind handshake — issued by
// GET /actors/{id}/worldid, consumed (deleted) by the POST. Prevents
// replay of a signed walletAuth message.
export const ActorNonce = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  nonce: z.string().min(8),
  expiresAt: z.string().datetime(),
});
export type ActorNonce = z.infer<typeof ActorNonce>;

// A need node's application to join a round — the public intake lane.
// Sponsors/operators review; approval appends to eligibleNeedIds.
export const RoundApplication = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  needNodeId: z.string().min(1),
  applicant: z.string().min(1),               // actor id
  statement: z.string().default(''),
  state: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  at: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
});
export type RoundApplication = z.infer<typeof RoundApplication>;

// A donation toward one need node inside a round. `pledged` = intent
// recorded; `settled` = moved on an external rail (Allo round, Open
// Collective, CAV transfer — recorded by reference, never custodied).
export const Donation = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  needNodeId: z.string().min(1),
  donor: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  settlement: z.enum(['pledged', 'settled']).default('pledged'),
  settlementRef: z.string().optional(),   // tx hash / OC expense id / CAV receipt
  at: z.string().datetime(),
});
export type Donation = z.infer<typeof Donation>;

export const PledgeState = z.enum(['pending', 'bound', 'released', 'refunded']);

// Dominant-assurance pledge (Tabarrok 1998): a commitment against one
// possibility (optionally one of its needs) that binds only if the card
// reaches quorum. Pending pledges on expired cards resolve `refunded`
// (they never moved) and earn AssuranceCredit — willingness was real.
export const Pledge = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  needNodeId: z.string().optional(),
  pledger: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  state: PledgeState.default('pending'),
  stateAt: z.string().datetime(),
});
export type Pledge = z.infer<typeof Pledge>;

// Recurring support via a Superfluid constant-flow stream on Celo.
// The supporter creates the flow in their own wallet (calldata built by
// /rounds/:id/stream/tx); once the tx confirms the stream is `active`
// and the cron accrues elapsed·flowRate into periodic Donation records.
// Nothing custodies — the stream lives in the user's Superfluid account.
export const RecurringSupport = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  needNodeId: z.string().optional(),       // optional need targeting; else general
  supporter: z.string().min(1),            // actor id / wallet
  token: z.string().min(1),                // superToken address
  receiver: z.string().regex(/^0x[0-9a-fA-F]{40}$/),  // round payout address
  flowRate: z.string().min(1),             // int96 units/sec, stored as decimal string
  txHash: z.string().optional(),           // createFlow hash once submitted
  state: z.enum(['pending', 'active', 'closed']).default('pending'),
  accruedUnits: z.string().default('0'),   // total units donated so far
  lastAccrualAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type RecurringSupport = z.infer<typeof RecurringSupport>;

// An impact claim — hypercerts ATProto lexicon shape (org.hypercerts
// vocabulary, MIT spec): a *claim about work done* over a scope and
// timeframe by named contributors, backed by oracle checks and
// appreciations. A claim is not an instrument: no price, no ownership
// split, no secondary market. Evaluation happens via attestations.
export const ImpactClaim = z.object({
  id: z.string().min(1),
  possibilityId: z.string().optional(),      // the card it attests, if any
  nodeIds: z.array(z.string()).default([]),  // coordinated action nodes
  workScope: z.string().min(1),              // free-form scope (lexicon workScope)
  timeframe: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).default({}),
  contributors: z.array(z.string()).default([]),
  oracleCheckIds: z.array(z.string()).default([]),
  appreciationIds: z.array(z.string()).default([]),
  artifactRefs: z.array(z.string()).default([]),   // artizen artifact URIs — external work evidence
  chainRef: z.string().optional(),                // mint tx / hypercert id once on-chain
  state: z.enum(['draft', 'attested']).default('draft'),
  createdAt: z.string().datetime(),
});
export type ImpactClaim = z.infer<typeof ImpactClaim>;

// An attestation — EAS-shaped (Ethereum Attestation Service, open
// schema registry): a named attester signs a payload under a schema ref.
// `uid` fills once anchored on-chain (celo-sepolia/celo); until then the
// ledger row + payload hash is the record.
// Per-card council — seated the moment a card reaches quorum. The
// declarer and every participant hold seats automatically; verifiers
// self-seat (publicly marked self-declared); sponsors seat when a
// pledge binds. The council is who may post to the card's forum —
// deliberation scoped to the people with something at stake.
export const CouncilSeat = z.object({
  id: z.string().min(1),                      // seat-<poss>-<actor>-<role>
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  role: z.enum(['declarer', 'participant', 'verifier', 'sponsor']),
  at: z.string().datetime(),
});
export type CouncilSeat = z.infer<typeof CouncilSeat>;

// Forum post — threaded note/evidence/objection/review on one card.
// Opens at quorum only ("no group chat for a thing that doesn't
// exist"); writes are gated to council members; every post is
// ledger-attributed. `parentId` threads replies.
export const ForumPost = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  parentId: z.string().optional(),
  actor: z.string().min(1),
  kind: z.enum(['note', 'evidence', 'objection', 'review']),
  text: z.string().min(1),
  at: z.string().datetime(),
});
export type ForumPost = z.infer<typeof ForumPost>;

export const Attestation = z.object({
  id: z.string().min(1),
  claimId: z.string().optional(),            // evaluating a claim
  nodeId: z.string().optional(),             // or attesting a node's outcome
  attester: z.string().min(1),
  schemaRef: z.string().min(1),              // e.g. 'springforth.outcome.v1'
  payload: z.string(),                       // schema-encoded JSON payload
  uid: z.string().optional(),                // EAS uid when on-chain
  at: z.string().datetime(),
});
export type Attestation = z.infer<typeof Attestation>;

export const RetroRoundState = z.enum(['open', 'tallied', 'distributed']);

// A retroactive allocation round (Optimism RetroPGF model): a sponsor
// fund distributes across *attested claims* by quadratic ballot of
// badgeholders — the reviewer cohort selected by EigenTrust standing on
// the appreciation graph. Ex-post reward for demonstrated outcomes,
// not ex-ante funding of proposals.
export const RetroRound = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  fund: z.object({ amount: z.number().min(0), currency: z.string().min(1) }),
  claimIds: z.array(z.string()).default([]),
  badgeholderCount: z.number().int().min(1).default(8),
  pointsPerBallot: z.number().int().min(1).default(100),
  ballotClose: z.string().datetime(),
  state: RetroRoundState.default('open'),
  // Trust epoch pinned at open — badgeholders derive from its committed
  // edges, not the live graph, so the cohort is checkable at tally.
  trustEpoch: z.number().int().min(1).optional(),
});
export type RetroRound = z.infer<typeof RetroRound>;

export const RetroBallot = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  badgeholder: z.string().min(1),
  // claimId → points allocated (sum <= pointsPerBallot)
  weights: z.record(z.string(), z.number().min(0)),
  at: z.string().datetime(),
});
export type RetroBallot = z.infer<typeof RetroBallot>;

// Governance — trust-gated parameter ballots, not token voting.
// Proposals change protocol parameters; voters are the EigenTrust-
// eligible cohort (same derivation as retro badgeholders); ballots are
// quadratic (cost = points²) so breadth of conviction wins over depth.
export const GovernanceProposal = z.object({
  id: z.string().min(1),
  param: z.string().min(1),                  // the parameter being changed
  title: z.string().min(1),
  description: z.string().default(''),
  proposedValue: z.string().min(1),
  proposer: z.string().min(1),
  closesAt: z.string().datetime(),
  state: z.enum(['open', 'passed', 'rejected']).default('open'),
  createdAt: z.string().datetime(),
  // Trust epoch pinned at proposal — the eligible-voter cohort comes
  // from its committed edges, not the graph at tally time.
  trustEpoch: z.number().int().min(1).optional(),
});
export type GovernanceProposal = z.infer<typeof GovernanceProposal>;

export const GovernanceBallot = z.object({
  id: z.string().min(1),
  proposalId: z.string().min(1),
  voter: z.string().min(1),
  // quadratic cost: points spent, weight = √points
  points: z.number().positive(),
  support: z.boolean(),                      // for or against
  at: z.string().datetime(),
});
export type GovernanceBallot = z.infer<typeof GovernanceBallot>;

// A governable parameter — current value + who set it. Edge reads these
// with defaults; a passed proposal writes the new value.
export const GovernanceParam = z.object({
  id: z.string().min(1),                     // param name
  value: z.string().min(1),
  setBy: z.string().min(1),                  // 'default' | proposal id
  updatedAt: z.string().datetime(),
});
export type GovernanceParam = z.infer<typeof GovernanceParam>;

// Trust epoch — a frozen, committed scoring round over the appreciation
// graph (the trustgraphs.xyz epoch model applied natively): input edges
// and params committed at a ledger cut, output published as a Merkle
// root anyone can recompute. Acceptance is itself a ledger event
// ('trust.epoch') — appended, never edited. Spec: docs/TRUSTGRAPH.md.
export const TrustEpoch = z.object({
  id: z.string().min(1),                     // 'te-000001' — zero-padded so id sort = epoch order
  epoch: z.number().int().min(1),
  program: z.literal('springforth-mutual-recognition'),
  programVersion: z.literal(1),
  cut: z.object({
    seq: z.number().int(),                   // ledger seq the inputs froze at
    ledgerHead: z.string().min(1),           // /ledger/verify?seq=N head at that cut
    at: z.string().datetime(),
  }),
  inputHash: z.string().min(1),              // sha256 of the canonical edge set
  edgeCount: z.number().int().min(0),
  actorCount: z.number().int().min(0),
  paramsHash: z.string().min(1),
  params: z.record(z.string(), z.unknown()), // published in full — public anyway
  outputRoot: z.string().min(1),             // 0x merkle root over (actor, value) leaves
  totalValue: z.string().min(1),             // fixed-point pool total (string for int safety)
  scoresHash: z.string().min(1),             // sha256 of the canonical scores blob
  createdAt: z.string().datetime(),
});
export type TrustEpoch = z.infer<typeof TrustEpoch>;

// The epoch's recompute package — canonical edges + scores, served by
// /trust/epochs/:n/inputs.json and /scores.json. Separate row so listing
// journals stays light; same id as the journal.
export const TrustEpochData = z.object({
  id: z.string().min(1),                     // 'te-000001'
  epoch: z.number().int().min(1),
  edges: z.array(z.object({
    from: z.string().min(1), to: z.string().min(1),
    weight: z.number(), mutual: z.number(),
  })),
  scores: z.array(z.object({ actor: z.string().min(1), value: z.number() })),
});
export type TrustEpochData = z.infer<typeof TrustEpochData>;

// On-chain vouch mirror (phase 2) — maps a published EAS vouch back to
// the appreciation + ledger event it mirrors, so the on-chain graph
// stays auditable against the chain of record.
export const VouchMirror = z.object({
  id: z.string().min(1),
  appreciationId: z.string().min(1),
  uid: z.string().optional(),                // EAS attestation uid
  txHash: z.string().optional(),
  from: z.string().min(1),                   // actor ids
  to: z.string().min(1),
  weight: z.number().min(0).default(1),
  state: z.enum(['pending', 'published', 'revoked']).default('pending'),
  at: z.string().datetime(),
});
export type VouchMirror = z.infer<typeof VouchMirror>;

// External proven score (phase 3) — an entry verified against a
// trustgraphs network's accepted Merkle root, keyed by a bound wallet.
export const ExternalScore = z.object({
  id: z.string().min(1),                     // `${network}:${root}:${account}`
  network: z.string().min(1),                // 'trustgraphs:<chain>:<snapshot>'
  root: z.string().min(1),                   // the accepted root this leaf was verified against
  account: z.string().min(1),                // 0x account the leaf scores
  actor: z.string().min(1),                  // bound actor id
  value: z.string().min(1),                  // leaf value (string for uint safety)
  totalValue: z.string().min(1),
  verifiedAt: z.string().datetime(),
});
export type ExternalScore = z.infer<typeof ExternalScore>;

// Signed dataset release — a frozen graph slice (JSONL) with a sha256
// manifest, OTS-anchored, optionally pinned to IPFS. CC-BY-SA licensed;
// the manifest is the provenance record.
export const DatasetRelease = z.object({
  id: z.string().min(1),
  name: z.string().min(1),                   // dataset name, e.g. 'plannodes'
  records: z.number().int().min(0),
  manifest: z.record(z.string(), z.unknown()),  // sha256 manifest (evidence-anchor)
  sha256: z.string().min(1),                 // hash of the bundle
  cid: z.string().optional(),                // IPFS content id once pinned
  otsStatus: z.string().optional(),          // anchor status ref
  license: z.string().default('CC-BY-SA-4.0'),
  createdAt: z.string().datetime(),
});
export type DatasetRelease = z.infer<typeof DatasetRelease>;

// Premium data lane — verified payment reference → time-boxed access
// grant for raw SourceReading payloads. Aggregates stay public; only
// the raw/high-resolution feed is granted. No custody — the tx hash is
// evidence of payment on an external rail, verified by the chain client.
export const DataAccessGrant = z.object({
  id: z.string().min(1),
  dataset: z.string().min(1),
  grantee: z.string().min(1),                // actor / wallet address
  paymentRef: z.string().min(1),             // tx hash / receipt reference
  verified: z.boolean().default(false),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type DataAccessGrant = z.infer<typeof DataAccessGrant>;

// Notification subscription — actor opts in to lifecycle events on a
// target (possibility quorum, round allocation, proposal close…).
// Channel: 'telegram' (tg chat), 'webhook' (POST JSON), 'email' (stub —
// recorded, delivered by an external relay once configured).
export const Subscription = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  target: z.string().min(1),                 // possibilityId | roundId | '*' 
  events: z.array(z.string().min(1)).default(['quorum', 'closed', 'tallied']),
  channel: z.enum(['telegram', 'webhook', 'email']).default('telegram'),
  address: z.string().optional(),            // chatId / webhook URL / email
  createdAt: z.string().datetime(),
});
export type Subscription = z.infer<typeof Subscription>;

// Open-evidence check on a coordination node — a single source reading
// (remote-sensing, IoT, field evidence, public dataset connector) scored
// independently. Confidence is reported, never auto-truth: human
// verification stays authoritative.
export const OracleCheck = z.object({
  id: z.string().min(1),
  // The plannode this check was run against (id in the plan graph).
  nodeId: z.string().optional(),
  source: z.enum([
    'field-evidence', 'community-report',
    'remote-sensing', 'iot', 'bioacoustic', 'connector', 'atlas',
  ]),
  domain: z.enum(['environmental', 'social', 'financial', 'governance']),
  methodologyRef: z.string().optional(),
  extensionSet: z.string().optional(),
  result: z.enum(['match', 'mismatch', 'pending']),
  score: z.number().min(0).max(1),
  detail: z.string().default(''),
  // demo marks hand-posted/synthetic checks — never shown as real evidence.
  demo: z.boolean().optional(),
  at: z.string().datetime(),
});
export type OracleCheck = z.infer<typeof OracleCheck>;

// A submitted chain transaction awaiting confirmation. The worker never
// signs or holds keys — signers (wallets, Safes, portal connect) submit
// txs built by the /chain endpoints and POST the hash here; the hourly
// cron polls the public client until the receipt lands. `kind` says
// which entity the confirm applies to.
export const ChainTx = z.object({
  id: z.string().min(1),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  chainId: z.number().int(),
  kind: z.enum([
    'round.create', 'donation.settle', 'claim.mint', 'attestation.publish',
    'stream.create', 'stream.delete',
  ]),
  entityId: z.string().min(1),
  status: z.enum(['submitted', 'confirmed', 'failed']).default('submitted'),
  result: z.string().optional(),   // poolId / attestation uid once decoded
  submittedAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
});
export type ChainTx = z.infer<typeof ChainTx>;

// Yield-backed matching (Phase 6): a sponsor holds a yield-bearing
// position in their OWN wallet — nothing custodies — and pledges the
// yield to a round's matching fund. `tokenAddress` is an Aave-v3-style
// aToken (rebasing ERC20); the cron reads balanceOf(sponsor) and the
// delta over the last reading credits round.matchingFund. Settlement
// of the credited yield into the round rides the normal donation rail.
export const YieldStream = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  sponsor: z.string().min(1),                    // actor id
  holderAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  label: z.string().default('aave aToken'),
  decimals: z.number().int().min(0).max(36).default(18),
  principalUnits: z.string().optional(),         // raw balance at first read
  lastUnits: z.string().optional(),              // raw balance at last read
  yieldAccrued: z.number().min(0).default(0),    // credited to the match, stable units
  state: z.enum(['active', 'closed']).default('active'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type YieldStream = z.infer<typeof YieldStream>;

// ── Commitment pools — CPP lane (Grassroots Economics' Commitment
// Pooling Protocol shape, docs.cosmolocal.credit) ──────────────────────
// A different economic layer from the funding/attestation mechanisms
// above: allocation decides where resources go; a commitment pool is a
// governed marketplace of redeemable commitments that keeps economic
// exchange going after any funding campaign ends. Issuers publish
// vouchers — commitments to deliver goods or services on stated terms;
// pools curate which vouchers they accept, value them against a common
// index unit, cap exposure per voucher, and let commitments circulate
// between participants via exchanges. Pool fees + protocol fees are the
// sustainability lane. Balances are ledger records — the voucher is the
// commitment, settlement with the issuer happens on redemption.

// A redeemable commitment issued by one actor — essentially a tokenized
// promise of goods/services ("$5 of produce", "1 hour carpentry"),
// redeemable with the issuer under published terms.
// Projection fields — rows mirrored from an external system carry the
// observation provenance alongside the domain fields. source:'clc' rows
// are written by the CLC sync (src/adapters/clc.ts); source:'local' rows
// are legacy/sample data. chainRef is the on-chain pointer (txHash or
// address) the row was observed at — the dual-verification join.
const Projection = {
  source: z.enum(['local', 'clc']).default('local'),
  chainAddress: z.string().optional(),
  chainId: z.number().int().optional(),
  observedAt: z.string().datetime().optional(),
  chainRef: z.string().optional(),
};

export const Voucher = z.object({
  id: z.string().min(1),
  issuer: z.string().min(1),               // actor standing behind redemption
  title: z.string().min(1),
  unit: z.string().min(1),                 // denomination label: 'USD', 'hour', 'kg'…
  description: z.string().default(''),
  terms: z.string().default(''),           // published redemption terms
  supply: z.number().positive(),           // total units issued to the issuer
  possibilityId: z.string().optional(),    // born from a card's offer node, when it is
  expiresAt: z.string().datetime().optional(),
  state: z.enum(['issued', 'suspended', 'retired']).default('issued'),
  createdAt: z.string().datetime(),
  ...Projection,
});
export type Voucher = z.infer<typeof Voucher>;

// Who holds how much of a voucher. `holder` is an actor id, `pool:<id>`
// for pool inventory, or `protocol:<sink>` for accrued protocol fees.
export const VoucherHolding = z.object({
  id: z.string().min(1),                   // hold-<holder>-<voucherId>
  holder: z.string().min(1),
  voucherId: z.string().min(1),
  amount: z.number().min(0),
  updatedAt: z.string().datetime(),
  ...Projection,
});
export type VoucherHolding = z.infer<typeof VoucherHolding>;

// The governed marketplace: curation (which vouchers/issuers are
// accepted), valuation (rate = index units per voucher unit), and
// limitation (limit = max pool inventory of the voucher) are all
// operator-set and written to the ledger on change.
export const CommitmentPool = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  operator: z.string().min(1),             // pool steward — curates, sets params
  indexUnit: z.string().min(1).default('index'),  // common unit of account label
  accepted: z.array(z.object({
    voucherId: z.string().min(1),
    rate: z.number().positive(),           // index units per 1 voucher unit
    limit: z.number().positive(),          // exposure cap: max pool inventory
    state: z.enum(['accepted', 'suspended']).default('accepted'),
  })).default([]),
  poolFeeBps: z.number().int().min(0).max(10000).default(0),    // accrues in pool inventory
  protocolFeeBps: z.number().int().min(0).max(10000).default(0), // accrues to protocolFeeSink
  protocolFeeSink: z.string().min(1).default('protocol'),
  state: z.enum(['open', 'paused', 'closed']).default('open'),
  createdAt: z.string().datetime(),
  ...Projection,
  // CLC SwapPool projection — contract configuration mirrored from the
  // chain/API so the governed parameters are legible without a node.
  sealState: z.number().int().min(0).optional(),  // SwapPool seal bitmask
  feeAddress: z.string().optional(),              // pool-fee recipient
  quoterType: z.string().optional(),              // decimal|oracle|relative
});
export type CommitmentPool = z.infer<typeof CommitmentPool>;

// One exchange: actor deposits `give` units, receives `receive` units
// priced through the pool's index unit. Fees are recorded in give-voucher
// units — the pool fee is the spread retained in pool inventory, the
// protocol fee moves to the `protocol:<sink>` holding.
export const PoolExchange = z.object({
  id: z.string().min(1),
  poolId: z.string().min(1),
  actor: z.string().min(1),
  give: z.object({ voucherId: z.string().min(1), amount: z.number().positive() }),
  receive: z.object({ voucherId: z.string().min(1), amount: z.number().positive() }),
  fees: z.object({
    voucherId: z.string().min(1),          // always the give voucher
    pool: z.number().min(0),
    protocol: z.number().min(0),
  }),
  rates: z.object({ give: z.number().positive(), receive: z.number().positive() }),
  at: z.string().datetime(),
  ...Projection,
});
export type PoolExchange = z.infer<typeof PoolExchange>;

// Redemption — the commitment loop closing: a holder returns units to
// the issuer for the underlying goods/services. Units burn at redeem
// (obligation discharged); the record tracks outstanding → fulfilled so
// fulfillment is measurable, not assumed.
export const VoucherRedemption = z.object({
  id: z.string().min(1),
  voucherId: z.string().min(1),
  holder: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().default(''),
  state: z.enum(['outstanding', 'fulfilled', 'rejected']).default('outstanding'),
  at: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  resolvedBy: z.string().optional(),
  chainRef: z.string().optional(),        // return-transfer txHash, when on-chain
});
export type VoucherRedemption = z.infer<typeof VoucherRedemption>;

// Ops report — self-reported offline coordination filed by the ops leg
// (WhatsApp threads, in-person meetings). Always labeled self-reported:
// the ledger records the claim, never the observation. Exported as
// evidence via:'ops-report' so off-platform activity has an attributed,
// honest lane instead of invisibility.
export const OpsReport = z.object({
  id: z.string().min(1),
  possibilityId: z.string().optional(),
  actor: z.string().min(1),               // who filed it (ops leg member)
  channel: z.enum(['whatsapp', 'in-person', 'call', 'other']).default('other'),
  text: z.string().min(1),
  at: z.string().datetime(),
});
export type OpsReport = z.infer<typeof OpsReport>;

// Coordination effort — the denominator of the coordination-leverage
// metric: human hours spent coordinating, self-reported. Never mixed
// with platform-observed data; the export marks selfReported:true.
export const CoordinationEffort = z.object({
  id: z.string().min(1),
  week: z.string().regex(/^\d{4}-W\d{2}$/), // ISO week
  actor: z.string().min(1),
  possibilityId: z.string().optional(),
  hours: z.number().positive(),
  activity: z.string().default(''),
  selfReported: z.literal(true).default(true),
  at: z.string().datetime(),
});
export type CoordinationEffort = z.infer<typeof CoordinationEffort>;

// Baseline report — pre-platform coordination stats for a cohort,
// filed before the platform arm starts. Self-reported by definition;
// gives the four-phase validation its phase-1 baseline as data.
export const BaselineReport = z.object({
  id: z.string().min(1),
  cohort: z.string().min(1),
  actor: z.string().min(1),
  period: z.string().min(1),              // e.g. '2026-09' or '8 weeks'
  summary: z.string().min(1),             // what coordination looked like offline
  collector: z.enum(['self', 'enumerator', 'ops']).optional(),
  at: z.string().datetime(),
});
export type BaselineReport = z.infer<typeof BaselineReport>;

// Readout — the pilot's published result as a ledgered artifact.
// `result` admits negative/null outcomes explicitly: a readout exists
// to be cited, not to be flattering.
export const Readout = z.object({
  id: z.string().min(1),
  possibilityId: z.string().optional(),
  roundId: z.string().optional(),
  title: z.string().min(1),
  result: z.enum(['positive', 'null', 'negative', 'mixed']),
  body: z.string().default(''),
  // Decision-grade fields (the review's "final board line"): a
  // three-answer decision space — yes / no / not enough evidence —
  // plus what the next proof would be and who owns it. Optional so
  // partial readouts stay fileable.
  decision: z.enum(['scale', 'refine', 'stop', 'insufficient-evidence']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  nextEvidence: z.string().optional(),
  decisionOwner: z.string().optional(),
  reviewDate: z.string().optional(),
  sampleRationale: z.string().optional(), // CONSORT item: why this n
  actor: z.string().min(1),
  at: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
});
export type Readout = z.infer<typeof Readout>;

// Dispute — a flag on a claim, attestation edge, or record. Flags are
// events, never edits: the export carries them so contested evidence is
// visible in the denominator, not silently absent.
export const Dispute = z.object({
  id: z.string().min(1),
  targetKind: z.enum(['claim', 'attestation', 'evidence', 'edge']),
  targetId: z.string().min(1),
  by: z.string().min(1),
  reason: z.string().min(1),
  state: z.enum(['open', 'resolved', 'dismissed']).default('open'),
  at: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type Dispute = z.infer<typeof Dispute>;

// Outcome report — post-encounter micro-survey (the instrument that turns
// attestation claims into outcome data). `incremental` is the IER probe
// ("would this have happened without the platform?"), `energyDelta` is
// the pre/post energy measure, `wouldRepeat` the repeat-intention proxy.
// `collector` + `lang` follow the Sarafu enumerator-survey method —
// instruments may be administered by a trained collector, not only
// self-filed. CIDS-aligned naming where the concepts match. Always
// self-reported, never platform-observed.
export const OutcomeReport = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  outcome: z.enum(['positive', 'neutral', 'negative']),
  energyDelta: z.number().min(-2).max(2).optional(),
  wouldRepeat: z.boolean().optional(),
  incremental: z.enum(['true', 'false', 'unknown']).optional(),
  costReport: z.string().optional(),
  collector: z.enum(['self', 'enumerator', 'ops']).default('self'),
  lang: z.string().optional(),
  selfReported: z.literal(true).default(true),
  at: z.string().datetime(),
});
export type OutcomeReport = z.infer<typeof OutcomeReport>;

// Exposure — first named-actor view of a possibility card. First-view
// only (id-deduped per actor×possibility): reach data for the
// opportunity-to-intent rate, not attention tracking. Anonymous views
// are never recorded.
export const Exposure = z.object({
  id: z.string().min(1),              // exposure-<possibilityId>-<actor>
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
  at: z.string().datetime(),
});
export type Exposure = z.infer<typeof Exposure>;

// Intervention — an explicit ops/organizer action on the record: the
// denominator for ambassador-dependency analysis. Pool-health research
// (UNC commitment-pool study) finds leadership/facilitation is the
// dominant success condition — measuring it is the design, not a
// confound to hide.
export const Intervention = z.object({
  id: z.string().min(1),
  type: z.enum(['nudge', 'facilitation', 'reminder', 'matchmaking', 'other']),
  targetKind: z.enum(['possibility', 'actor', 'cohort']),
  targetId: z.string().min(1),
  channel: z.string().default(''),
  actor: z.string().min(1),           // who intervened
  at: z.string().datetime(),
});
export type Intervention = z.infer<typeof Intervention>;

// Exit — a churn record. Self-filed or ops-observed; the "why they
// stopped" stream item.
export const Exit = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  reason: z.string().default(''),
  at: z.string().datetime(),
});
export type Exit = z.infer<typeof Exit>;

// Access exclusion — ops-observed would-be participants blocked by
// channel constraints (no wallet, no device, no Telegram). Aggregate
// counts only: filed by an observer, never per-person telemetry — we
// cannot detect failed loads and don't pretend to.
export const AccessExclusion = z.object({
  id: z.string().min(1),
  channel: z.string().min(1),
  reason: z.enum(['no-wallet', 'no-device', 'no-telegram', 'other']),
  count: z.number().int().min(1).default(1),
  actor: z.string().min(1),
  at: z.string().datetime(),
});
export type AccessExclusion = z.infer<typeof AccessExclusion>;

// Amendment — a labeled change to frozen parameters, metric definitions,
// or cohort membership after data collection began. The ledger's
// append-only property makes post-hoc rules changes visible by
// construction; `independent` marks approvers with no stake in the
// outcome being measured (growth owners don't redefine proof criteria
// their work is scored by).
export const Amendment = z.object({
  id: z.string().min(1),
  subject: z.enum(['param', 'metric', 'threshold', 'cohort', 'instrument']),
  field: z.string().min(1),
  oldValue: z.string().default(''),
  newValue: z.string().default(''),
  reason: z.string().min(1),
  approver: z.string().min(1),
  independent: z.boolean().default(false),
  effectiveSeq: z.number().int().min(0).optional(),
  at: z.string().datetime(),
});
export type Amendment = z.infer<typeof Amendment>;
