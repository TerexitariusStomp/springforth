import { z } from 'zod';

// Coordination layer — PS1 "Collaboration Reverse" plan graph.
// Nodes mirror the OnePlanet model (outcomes/actions/organisations/places/
// indicators) plus framework links, so imported plans from any source
// land in one graph where duplication can be detected and resolved.

export const NodeKind = z.enum([
  'outcome', 'action', 'organisation', 'place', 'indicator', 'framework',
  'offer',    // CLC vocabulary: a published commitment to provide goods/services
  'need',     // a stated requirement an offer can fulfil (see detectComplements)
]);
export type NodeKind = z.infer<typeof NodeKind>;

// Eight forms of capital (the resource-irrigation model): the same channels
// carry non-monetary flows — an offer of hours, tools or seeds is as
// first-class as an offer of money. `capital` marks which of the eight
// flows a commitment rides on; money is one stream among eight.
export const CapitalForm = z.enum([
  'material', 'living', 'social', 'intellectual',
  'experiential', 'cultural', 'spiritual', 'financial',
]);
export type CapitalForm = z.infer<typeof CapitalForm>;

export const PlanNode = z.object({
  id: z.string().min(1),
  kind: NodeKind,
  label: z.string().min(1),
  // canonical, lowercase, punctuation-stripped form used for matching
  canonical: z.string().min(1),
  source: z.string().min(1),                        // 'oneplanet:<plan-id>' | 'csv:<file>' | 'manual'
  placeId: z.string().optional(),                   // link to a 'place' node or H3 cell
  h3: z.string().optional(),                        // resolved cell when known
  parentOutcomeId: z.string().optional(),           // action→outcome edge
  // set when parentage was reconstructed by inference (OnePlanet's customer
  // API withholds links) rather than declared by the source — rendered as
  // inferred, never as source truth.
  parentInferred: z.boolean().optional(),
  orgIds: z.array(z.string()).default([]),          // responsible organisations
  tags: z.array(z.string()).default([]),
  timeframe: z.object({ from: z.string().optional(), to: z.string().optional() }).default({}),
  budget: z.number().optional(),
  // ISO currency for `budget` — needs carry the declared cost of the ask,
  // offers the in-kind value brought. Never converted; shown per-currency.
  budgetCurrency: z.string().optional(),
  description: z.string().default(''),
  // CLC fields — present on offer/need nodes. `terms` is the voucher's
  // published conditions (unit of account, symbol, redemption notes);
  // `capacity` is the issuer's stated availability where declared.
  terms: z.string().optional(),
  capacity: z.string().optional(),
  // Which of the eight capital flows this commitment carries — explicit on
  // well-formed exports (Holons `capital` field), inferred otherwise (below).
  capital: CapitalForm.optional(),
  // Crowdsurfing possibility link: needs declared inside a possibility card.
  // `required` distinguishes blocking needs from nice-to-haves — quorum
  // fires only when every required need is coordinated.
  possibilityId: z.string().optional(),
  required: z.boolean().optional(),
  // GDD need categories (equipment|venue|skill|person|consumable) —
  // free string, the five above are the documented vocabulary.
  category: z.string().optional(),
  // Opt-in escalation: needs a *participant* flags on the card
  // ("anyone have cups?") vs the declarer's declared needs.
  flaggedBy: z.string().optional(),
});
export type PlanNode = z.infer<typeof PlanNode>;

// Fallback capital classification for sources that don't declare a form —
// the unit/terms carry the signal (hours→experiential, KES→financial, …).
// Explicit `capital` always wins; order is specific-before-generic.
const CAPITAL_HINTS: ReadonlyArray<readonly [RegExp, CapitalForm]> = [
  [/\b(seeds?|seedlings?|saplings?|compost|soil|manure|livestock|plants?)\b/i, 'living'],
  [/\b(tools?|equipment|workspace|venue|trucks?|vehicles?|materials?|supplies|excavator)\b/i, 'material'],
  [/\b(hours?|hrs|sessions?|mentoring|tutoring|driving|labou?r|childcare)\b/i, 'experiential'],
  [/\b(training|workshops?|skills?|knowledge|advice|expertise|design|curriculum)\b/i, 'intellectual'],
  [/\b(introductions?|network|volunteers?|membership|community reach)\b/i, 'social'],
  [/\b(art|music|stories|heritage|ceremony|artifact|archive)\b/i, 'cultural'],
  [/\b(ritual|spiritual|faith|prayer|blessing)\b/i, 'spiritual'],
  [/\b(kes|usd|eur|gbp|cash|money|voucher|credit|token|shillings?|donation)\b/i, 'financial'],
];
export const inferCapital = (n: PlanNode): CapitalForm | undefined =>
  n.capital ?? CAPITAL_HINTS.find(([re]) =>
    re.test(`${n.label} ${n.description} ${n.terms ?? ''} ${n.capacity ?? ''}`))?.[1];

// One imported plan — the unit the OnePlanet adapter produces.
export const ExternalPlan = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().optional(),
  importedAt: z.string().datetime(),
  nodes: z.array(PlanNode).min(1),
});
export type ExternalPlan = z.infer<typeof ExternalPlan>;

export const OverlapKind = z.enum([
  'duplicate',    // same thing stated twice — merge candidate
  'overlap',      // partially shared scope — coordinate
  'complement',   // adjacent and reinforcing — link, don't merge
  'conflict',     // contradictory targets in the same place — escalate
]);
export type OverlapKind = z.infer<typeof OverlapKind>;

export const OverlapStatus = z.enum([
  'proposed',     // machine-flagged, awaiting human validation
  'confirmed',    // a human reviewer affirmed the overlap
  'rejected',     // reviewed and dismissed — retained for audit
  'coordinated',  // acted on: a shared coordination node materialises
]);
export type OverlapStatus = z.infer<typeof OverlapStatus>;

export const EvidenceField = z.enum([
  'label', 'place', 'outcome', 'org', 'timeframe', 'indicator', 'embedding',
]);

export const OverlapRecord = z.object({
  id: z.string().min(1),
  kind: OverlapKind,
  nodeIds: z.tuple([z.string().min(1), z.string().min(1)]),
  // evidence trail — every field that contributed, with the observed values.
  // The record must be explainable without re-running the resolver.
  evidence: z.array(z.object({
    field: EvidenceField,
    a: z.string(),
    b: z.string(),
    score: z.number().min(0).max(1),
  })).min(1),
  confidence: z.number().min(0).max(1),
  // counter-signals — fields compared on both sides that argued AGAINST
  // the match (evidence-card pattern: supporting evidence and
  // counter-evidence shown together; reviewers correct with full sight).
  counterEvidence: z.array(z.object({
    field: EvidenceField,
    a: z.string(),
    b: z.string(),
    score: z.number().min(0).max(1),
  })).optional(),
  reasoning: z.string().min(1),
  status: OverlapStatus.default('proposed'),
  validations: z.array(z.object({
    actor: z.string().min(1),
    verdict: z.enum(['confirm', 'reject']),
    note: z.string().default(''),
    at: z.string().datetime(),
  })).default([]),
  // Scenario record (overlap-report spec): the coordination path a named
  // human chose — kept with rationale and objections so a later reviewer
  // sees the decision, not just the outcome.
  scenario: z.object({
    choice: z.enum(['separate', 'coordinate', 'combine']),
    actor: z.string().min(1),
    at: z.string().datetime(),
    rationale: z.string().default(''),
    objections: z.string().default(''),
  }).optional(),
  // filled once acted on — who coordinated it and when. The coordinated
  // proposal materialises as a shared action node in the graph.
  resolution: z.object({
    coordinationNodeId: z.string().optional(),
    decidedBy: z.string().min(1),
    at: z.string().datetime(),
  }).optional(),
  createdAt: z.string().datetime(),
});
export type OverlapRecord = z.infer<typeof OverlapRecord>;

export const canonicalize = (s: string) =>
  s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|of|for|and|in|to|project|programme|program|plan|initiative|scheme)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
