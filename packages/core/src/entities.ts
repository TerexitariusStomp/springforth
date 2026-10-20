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
