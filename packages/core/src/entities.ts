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
  intent: z.enum(['support', 'interest', 'concern']).default('support'),
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

export const Possibility = z.object({
  id: z.string().min(1),
  title: z.string().min(1),                   // the "I want to…" statement
  description: z.string().default(''),
  declarerId: z.string().min(1),              // Possibility Declarer role
  place: z.string().optional(),               // free-text location / placeId
  timeStart: z.string().datetime().optional(),
  timeEnd: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(), // quorum by this date
  minParticipants: z.number().int().min(0).default(0),
  status: PossibilityStatus.default('draft'),
  quorumAt: z.string().datetime().optional(),
  maxParticipants: z.number().int().min(0).optional(), // optional cap (GDD field)
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

// Dominant-assurance credit (Tabarrok 1998): participants who committed to
// a possibility that *expired* earn append-only recognition — "they were
// willing when willingness wasn't enough." Makes joining dominant;
// part of the earned ledger (append-only, never spendable).
export const AssuranceCredit = z.object({
  id: z.string().min(1),
  possibilityId: z.string().min(1),
  actor: z.string().min(1),
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
  // on-chain mirror — Allo round id once created (phase 3).
  chainRef: z.string().optional(),
});
export type FundingRound = z.infer<typeof FundingRound>;

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
  state: z.enum(['draft', 'attested']).default('draft'),
  createdAt: z.string().datetime(),
});
export type ImpactClaim = z.infer<typeof ImpactClaim>;

// An attestation — EAS-shaped (Ethereum Attestation Service, open
// schema registry): a named attester signs a payload under a schema ref.
// `uid` fills once anchored on-chain (Alfajores/Celo); until then the
// ledger row + payload hash is the record.
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
