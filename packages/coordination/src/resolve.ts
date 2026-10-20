import {
  canonicalize,
  OverlapRecord,
  type OverlapKind,
  type PlanNode,
} from './graph.ts';

type EvidenceField = OverlapRecord['evidence'][number]['field'];

// Entity resolution over the plan graph. Deterministic and explainable by
// construction: every emitted record carries the field-level scores that
// produced it, so a reviewer can audit *why* two nodes were flagged without
// re-running the matcher. An optional external scorer (embedding similarity,
// splink candidates) can be injected — it shows up as 'embedding' evidence
// and never overrides the rule fields.

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'in', 'to']);

// Domain vocabulary expansion — different plans say "wetland" and "marsh",
// "employment hub" and "jobs centre" for the same thing. Small curated sets
// keep the resolver deterministic and explainable: a flagged pair still
// shows exactly which field scored. The embedding hook (DetectOpts.scorer)
// is the open-ended semantic layer on top of this.
const SYNONYMS: ReadonlyArray<readonly string[]> = [
  ['wetland', 'marsh', 'bog', 'fen', 'reedbed', 'reed', 'swamp'],
  ['restore', 'restoration', 'regenerate', 'regeneration', 'renew', 'rehabilitate'],
  ['youth', 'young', 'teen'],
  ['employment', 'job', 'jobs', 'work', 'skills', 'careers', 'livelihood'],
  ['hub', 'centre', 'center', 'facility'],
  ['solar', 'pv', 'photovoltaic', 'renewable'],
  ['tree', 'trees', 'woodland', 'forest', 'planting', 'seedling', 'seedlings', 'sapling', 'saplings', 'nursery'],
  ['flood', 'flooding', 'drainage'],
  ['green', 'greenspace', 'park', 'nature'],
  ['food', 'garden', 'allotment', 'farm'],
  ['tool', 'tools', 'equipment', 'supplies'],
  ['transport', 'boda', 'vehicle', 'logistics', 'truck', 'trucks', 'driver', 'drive', 'driving'],
  ['housing', 'homes', 'shelter'],
  ['health', 'wellbeing', 'care'],
  ['heat', 'cooling', 'shade'],
];
const SYN_MAP = new Map<string, readonly string[]>(
  SYNONYMS.flatMap((g) => g.map((t) => [t, g] as const)),
);

export function tokenSet(s: string, expand = true): Set<string> {
  const base = canonicalize(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t));
  const out = new Set(base);
  if (expand) for (const t of base) for (const syn of SYN_MAP.get(t) ?? []) out.add(syn);
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Place score: exact place / same H3 cell → 1; shared place-name tokens
// (adapters store canonical place names so 'thorntree' matches
// 'thorntree middlesbrough') or H3 prefix proximity scale down; else 0.
export function placeScore(a: PlanNode, b: PlanNode): number {
  if (a.placeId && b.placeId) {
    if (a.placeId === b.placeId) return 1;
    const j = jaccard(tokenSet(a.placeId, false), tokenSet(b.placeId, false));
    if (j > 0) return Math.max(0.5, j);
  }
  if (a.h3 && b.h3) {
    if (a.h3 === b.h3) return 1;
    let prefix = 0;
    while (prefix < Math.min(a.h3.length, b.h3.length) && a.h3[prefix] === b.h3[prefix]) prefix++;
    return Math.min(0.9, Math.max(0, (prefix - 4) / 8));
  }
  return 0;
}

const timeScore = (a: PlanNode, b: PlanNode): number => {
  const af = a.timeframe.from, bf = b.timeframe.from;
  if (!af || !bf) return 0;
  const days = Math.abs(Date.parse(af) - Date.parse(bf)) / 86_400_000;
  return days <= 45 ? 1 : days <= 120 ? 0.6 : days <= 365 ? 0.3 : 0;
};

const orgScore = (a: PlanNode, b: PlanNode): number => {
  const sa = new Set(a.orgIds), inter = b.orgIds.filter((o) => sa.has(o)).length;
  return inter / Math.max(1, Math.min(a.orgIds.length, b.orgIds.length));
};

const WEIGHTS: Record<EvidenceField, number> = {
  label: 0.4, place: 0.25, outcome: 0.15, indicator: 0.1,
  timeframe: 0.05, org: 0.05, embedding: 0.15, // embedding is bonus, not decisive
};

function kindFor(nodes: [PlanNode, PlanNode], label: number, place: number): OverlapKind {
  const [a, b] = nodes;
  if (label >= 0.8 && place >= 0.8) return 'duplicate';
  if (a.parentOutcomeId && a.parentOutcomeId === b.parentOutcomeId) return 'overlap';
  const tagOverlap = jaccard(tokenSet(a.tags.join(' ')), tokenSet(b.tags.join(' ')));
  if (place >= 0.8 && tagOverlap >= 0.5) return 'overlap';
  if (place >= 0.6 && label < 0.4) return 'complement';
  return 'overlap';
}

export interface DetectOpts {
  minConfidence?: number;                        // default 0.3 — flag-for-review floor;
                                                 // humans adjudicate, so favour recall
  scorer?: (a: PlanNode, b: PlanNode) => number | undefined; // injected embedding/ER scorer
  kinds?: PlanNode['kind'][];                    // default ['action','outcome']
  now?: string;
}

export function detectOverlaps(nodes: PlanNode[], opts: DetectOpts = {}): OverlapRecord[] {
  const min = opts.minConfidence ?? 0.3;
  const candidates = nodes.filter((n) => (opts.kinds ?? ['action', 'outcome']).includes(n.kind));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: OverlapRecord[] = [];
  let seq = 0;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!, b = candidates[j]!;
      if (a.source === b.source) continue;        // same plan — intra-plan dup is its data's problem
      const evidence: OverlapRecord['evidence'] = [];
      const counter: NonNullable<OverlapRecord['counterEvidence']> = [];
      // Both sides stated a value and they share nothing → counter-signal.
      // Score zero with an empty side is just missing data, not a conflict.
      const push = (field: EvidenceField, aVal: string, bVal: string, score: number) => {
        const s = Math.round(score * 1000) / 1000;
        if (s > 0) evidence.push({ field, a: aVal, b: bVal, score: s });
        else if (aVal && bVal && counter.length < 4) counter.push({ field, a: aVal, b: bVal, score: s });
      };
      const ls = jaccard(tokenSet(a.label), tokenSet(b.label));
      const ds = jaccard(tokenSet(`${a.label} ${a.description}`), tokenSet(`${b.label} ${b.description}`));
      push('label', a.label, b.label, Math.max(ls, ds * 0.8));
      push('place', a.placeId ?? a.h3 ?? '', b.placeId ?? b.h3 ?? '', placeScore(a, b));
      const ao = a.parentOutcomeId ? byId.get(a.parentOutcomeId)?.label : undefined;
      const bo = b.parentOutcomeId ? byId.get(b.parentOutcomeId)?.label : undefined;
      if (ao && bo) push('outcome', ao, bo, jaccard(tokenSet(ao), tokenSet(bo)));
      push('org', a.orgIds.join(','), b.orgIds.join(','), orgScore(a, b));
      push('timeframe', a.timeframe.from ?? '', b.timeframe.from ?? '', timeScore(a, b));
      const emb = opts.scorer?.(a, b);
      if (emb !== undefined) push('embedding', a.id, b.id, emb);
      if (!evidence.length) continue;

      const confidence = Math.min(1, evidence.reduce((s, e) => s + WEIGHTS[e.field] * e.score, 0));
      if (confidence < min) continue;
      const kind = kindFor([a, b], ls, placeScore(a, b));
      const top = [...evidence].sort((x, y) => y.score - x.score).slice(0, 3)
        .map((e) => `${e.field} ${e.score.toFixed(2)}`).join(', ');
      out.push(OverlapRecord.parse({
        id: `ov-${(seq++).toString(36)}-${a.id.slice(-6)}x${b.id.slice(-6)}`,
        kind, nodeIds: [a.id, b.id], evidence,
        counterEvidence: counter.length ? counter : undefined,
        confidence: Math.round(confidence * 1000) / 1000,
        reasoning: `${kind === 'duplicate' ? 'Likely duplicate' : kind === 'complement' ? 'Adjacent, possibly complementary' : 'Overlapping scope'} — strongest signals: ${top}.`,
        createdAt: opts.now ?? new Date().toISOString(),
      }));
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}

// ── Complement matching (CLC needs × offers) ─────────────────────────────
// The second match direction: a plan's *need* met by another system's *offer*
// (CLC voucher). Directional — records always carry nodeIds [need, offer] —
// and disjoint from detectOverlaps: offer×offer and need×need are never
// flagged, and same-source pairs are skipped as before.

// Implicit needs: community plans rarely declare a 'need' node — they write
// "we need water tanks" as an action. Need-verbs on an action promote it
// into the needs set for this pass (kind stays 'action' in the graph).
const NEED_VERBS = /\b(needs?|needed|seeking|seek|requires?|looking for|short of|lacks?|requesting)\b/i;
export const isNeed = (n: PlanNode) =>
  n.kind === 'need' || (n.kind === 'action' && NEED_VERBS.test(`${n.label} ${n.description}`));

export interface ComplementOpts extends DetectOpts {
  maxRecords?: number;   // top-N cap — offer sets can be thousands of vouchers
}

export function detectComplements(nodes: PlanNode[], opts: ComplementOpts = {}): OverlapRecord[] {
  const min = opts.minConfidence ?? 0.3;
  const cap = opts.maxRecords ?? 50;
  const needs = nodes.filter(isNeed);
  const offers = nodes.filter((n) => n.kind === 'offer');
  const out: OverlapRecord[] = [];
  let seq = 0;

  for (const need of needs) {
    for (const offer of offers) {
      if (need.source === offer.source) continue;
      const evidence: OverlapRecord['evidence'] = [];
      const counter: NonNullable<OverlapRecord['counterEvidence']> = [];
      const push = (field: EvidenceField, aVal: string, bVal: string, score: number) => {
        const s = Math.round(score * 1000) / 1000;
        if (s > 0) evidence.push({ field, a: aVal, b: bVal, score: s });
        else if (aVal && bVal && counter.length < 4) counter.push({ field, a: aVal, b: bVal, score: s });
      };
      // What is needed vs what is offered — description carries the goods
      // terms for vouchers, so it weighs in at full strength here.
      const ls = jaccard(tokenSet(need.label), tokenSet(offer.label));
      const ds = jaccard(
        tokenSet(`${need.label} ${need.description}`),
        tokenSet(`${offer.label} ${offer.description} ${offer.terms ?? ''}`),
      );
      push('label', need.label, offer.label, Math.max(ls, ds * 0.9));
      push('place', need.placeId ?? need.h3 ?? '', offer.placeId ?? offer.h3 ?? '', placeScore(need, offer));
      push('timeframe', need.timeframe.from ?? '', offer.timeframe.from ?? '', timeScore(need, offer));
      const emb = opts.scorer?.(need, offer);
      if (emb !== undefined) push('embedding', need.id, offer.id, emb);
      if (!evidence.length) continue;

      const confidence = Math.min(1, evidence.reduce((s, e) => s + WEIGHTS[e.field] * e.score, 0));
      if (confidence < min) continue;
      const top = [...evidence].sort((x, y) => y.score - x.score).slice(0, 3)
        .map((e) => `${e.field} ${e.score.toFixed(2)}`).join(', ');
      out.push(OverlapRecord.parse({
        id: `cp-${(seq++).toString(36)}-${need.id.slice(-6)}x${offer.id.slice(-6)}`,
        kind: 'complement',
        nodeIds: [need.id, offer.id],          // directional: [need, offer]
        evidence,
        counterEvidence: counter.length ? counter : undefined,
        confidence: Math.round(confidence * 1000) / 1000,
        reasoning: `Need "${need.label}" may be met by offer "${offer.label}" — strongest signals: ${top}.`,
        createdAt: opts.now ?? new Date().toISOString(),
      }));
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence).slice(0, cap);
}

// Human validation is first-class: a record isn't 'confirmed' until a named
// actor affirms it; any rejection dominates (conservative — don't merge on
// contested ground). Multi-party quorum rules are the scale-up path.
export function validateOverlap(
  rec: OverlapRecord, actor: string, verdict: 'confirm' | 'reject', note = '', at = new Date().toISOString(),
): OverlapRecord {
  const validations = [...rec.validations, { actor, verdict, note, at }];
  const status = verdict === 'reject' ? 'rejected' : 'confirmed';
  return { ...rec, validations, status };
}

// Draft a merged-action proposal from a confirmed overlap — starting text
// for the coordination conversation, not an auto-merge.
export function mergeProposal(rec: OverlapRecord, nodes: PlanNode[]) {
  const [a, b] = rec.nodeIds.map((id) => nodes.find((n) => n.id === id)!);
  const shared = [...tokenSet(a.label)].filter((t) => tokenSet(b.label).has(t));
  return {
    title: `Joint ${a.kind}: ${shared.length ? shared.join(' ') : a.label} (${a.placeId ?? 'shared place'})`,
    rationale: `${a.label} (${a.source}) and ${b.label} (${b.source}) were confirmed as ${rec.kind} `
      + `with confidence ${rec.confidence}. Evidence: ${rec.evidence.map((e) => `${e.field}=${e.score}`).join('; ')}.`,
    sources: [a.source, b.source],
    combinedBudget: (a.budget ?? 0) + (b.budget ?? 0),
  };
}
