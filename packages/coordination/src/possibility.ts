import type { Appreciation, AssuranceCredit, Pass, Participation, Possibility, PossibilityStatus } from '@springforth/core';
import type { OverlapRecord, PlanNode } from './graph.ts';

// Possibility engine — the Crowdsurfing GDD's core loop as pure functions:
//   declare → opt-in participation → quorum (all required needs met +
//   min participants) → group coordination →
//   appreciation → pairwise trust → better surfacing next time.
// Demurrage is the deadline: a possibility that never reaches quorum
// expires rather than lingers — use-it-or-lose-it urgency on purpose.
//
// Trust graph semantics mirror free-association (Sw3q/free-association —
// no LICENSE, reference only): recognition is pairwise and weighted;
// mutual recognition = min(a→b, b→a); standing and card surfacing rank
// by mutual-recognition weights, not one-way appreciation counts.

const DAY = 86_400_000;

// Status is stored but time can advance it — recompute lazily on every
// read so a deadline flip never needs a mutation first.
export function effectiveStatus(p: Possibility, now = Date.now()): PossibilityStatus {
  if (p.status === 'completed') return 'completed';   // terminal — a filed
                                                      // report never reverts
  if (p.status === 'quorum')
    return p.timeEnd && Date.parse(p.timeEnd) <= now ? 'completed' : 'quorum';
  if (p.status === 'expired') return 'expired';
  if (p.deadline && Date.parse(p.deadline) <= now) return 'expired';
  return p.status;
}

// Quorum gate: every *required* need on the card coordinated (nice-to-haves
// never block) AND participant threshold met. Needs link via possibilityId.
export function quorumMet(
  p: Possibility,
  nodes: PlanNode[],
  overlaps: OverlapRecord[],
  participants: number,
): { met: boolean; required: number; requiredMet: number } {
  const required = nodes.filter((n) => n.possibilityId === p.id && n.required);
  const coordinated = new Set(overlaps
    .filter((o) => o.kind === 'complement'
      && (o.status === 'confirmed' || o.status === 'coordinated'))
    .map((o) => o.nodeIds[0]));
  const requiredMet = required.filter((n) => coordinated.has(n.id)).length;
  return {
    met: requiredMet === required.length && participants >= p.minParticipants,
    required: required.length,
    requiredMet,
  };
}

// ── Trust edges ───────────────────────────────────────────────────────────
// Directed edges from Appreciation rows: weight = count of from→to rounds.
// `mutual` on a directed edge = min(ab, ba) — the free-association rule:
// surplus flows by mutual recognition only.

export interface TrustEdge { from: string; to: string; weight: number; mutual: number }

export function trustEdges(appreciations: Appreciation[]): TrustEdge[] {
  const w = new Map<string, number>();
  for (const a of appreciations) {
    const k = `${a.fromActor}→${a.toActor}`;
    w.set(k, (w.get(k) ?? 0) + 1);
  }
  return [...w.entries()].map(([k, weight]) => {
    const [from, to] = k.split('→') as [string, string];
    const mutual = Math.min(weight, w.get(`${to}→${from}`) ?? 0);
    return { from, to, weight, mutual };
  }).sort((a, b) => b.mutual - a.mutual || b.weight - a.weight);
}

// Mutual-recognition weight between two actors — 0 unless both directions
// carry appreciation.
export function mutualWeight(edges: TrustEdge[], a: string, b: string): number {
  const ab = edges.find((e) => e.from === a && e.to === b)?.weight ?? 0;
  const ba = edges.find((e) => e.from === b && e.to === a)?.weight ?? 0;
  return Math.min(ab, ba);
}

// Two-ledger reputation (Bloom FLO pattern): `earned` is append-only —
// Σ mutual recognition received + assurance credits — and never decremented
// by spending. Spendable balances are a different ledger (vouchers,
// contributions); the record of work is not the spendable balance.
export function earnedRecognition(
  edges: TrustEdge[],
  assurance: AssuranceCredit[] = [],
): Record<string, number> {
  const w: Record<string, number> = {};
  for (const e of edges) {
    if (e.mutual > 0) w[e.to] = (w[e.to] ?? 0) + e.mutual;
  }
  for (const c of assurance) w[c.actor] = (w[c.actor] ?? 0) + 1;
  return w;
}

// ── EigenTrust — transitive propagation on the mutual-recognition graph ───
// OpenRank runs this as paid compute; at community scale it's ~40 lines.
// Local trust values = mutual edge weights; personalized seed = the viewer
// (card surfacing), uniform seed = global score (steering/standing).
// Power-iterate: t_{k+1} = α·Mᵀ·t_k + (1−α)·d, M column-normalized.
export function eigenTrust(
  edges: TrustEdge[],
  opts: { seed?: string; alpha?: number; iters?: number } = {},
): Record<string, number> {
  const alpha = opts.alpha ?? 0.85;
  const iters = opts.iters ?? 20;
  const actors = new Set<string>();
  const mut = new Map<string, number>();
  for (const e of edges) {
    if (e.mutual <= 0) continue;
    actors.add(e.from); actors.add(e.to);
    mut.set(`${e.from}→${e.to}`, e.mutual);
  }
  const ids = [...actors];
  if (!ids.length) return {};
  const colSum = new Map<string, number>();
  for (const [k, w] of mut) {
    const [f] = k.split('→');
    colSum.set(f!, (colSum.get(f!) ?? 0) + w);
  }
  const d = new Map(ids.map((a) => [a, opts.seed ? (a === opts.seed ? 1 : 0) : 1]));
  let t = new Map(d);
  for (let k = 0; k < iters; k++) {
    const next = new Map<string, number>(ids.map((a) => [a, 0]));
    for (const [kk, w] of mut) {
      const [f, to] = kk.split('→') as [string, string];
      next.set(to, (next.get(to) ?? 0) + alpha * (w / colSum.get(f)!) * (t.get(f) ?? 0));
    }
    for (const a of ids) next.set(a, (next.get(a) ?? 0) + (1 - alpha) * (d.get(a) ?? 0));
    t = next;
  }
  return Object.fromEntries(t);
}

// Relative trust of `actor` within a trust vector — ratio vs the mean;
// >1 = above-average recognised. Bounded [0,1] for card scoring.
export const relTrust = (vec: Record<string, number>, actor: string): number => {
  const vals = Object.values(vec);
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return mean > 0 ? Math.min(1, (vec[actor] ?? 0) / mean) : 0;
};

// ── Card surfacing ────────────────────────────────────────────────────────
// Public formula: score = 0.5·trust + 0.3·urgency + 0.2·cover.
//   trust   — mean mutual recognition between the viewer and the card's
//             declarer+participants (viewer-agnostic: mean mutual among
//             the card's own actors); bounded by TRUST_CAP.
//   urgency — deadline pressure: 1 inside URGENCY_HORIZON days of the
//             deadline, decaying to 0 beyond it; no deadline → 0.5.
//   cover   — share of required needs already coordinated.
export const TRUST_CAP = 3;
export const URGENCY_HORIZON_DAYS = 14;

export function scoreCard(
  p: Possibility,
  ctx: {
    nodes: PlanNode[];
    overlaps: OverlapRecord[];
    participants: Participation[];
    edges: TrustEdge[];
    viewer?: string;
    now?: number;
    // Precomputed EigenTrust vector — callers scoring many cards for one
    // viewer pass it in so the power iteration runs once per request.
    vec?: Record<string, number>;
  },
): { score: number; trust: number; urgency: number; cover: number; tipping: boolean } {
  const now = ctx.now ?? Date.now();
  const actors = [p.declarerId,
    ...ctx.participants.filter((x) => x.possibilityId === p.id).map((x) => x.actor)];
  const others = ctx.viewer ? actors.filter((a) => a !== ctx.viewer) : actors;
  // Personalized EigenTrust vector seeded at the viewer (uniform otherwise)
  // — transitive trust, not just direct mutual edges.
  const vec = ctx.vec ?? eigenTrust(ctx.edges, { seed: ctx.viewer });
  const trust = others.length
    ? Math.min(1, others.reduce((s, a) => s + relTrust(vec, a), 0) / others.length)
    : 0;
  const urgency = !p.deadline ? 0.5
    : Math.max(0, Math.min(1, 1 - (Date.parse(p.deadline) - now)
      / (URGENCY_HORIZON_DAYS * DAY)));
  const required = ctx.nodes.filter((n) => n.possibilityId === p.id && n.required);
  const coordinated = new Set(ctx.overlaps
    .filter((o) => o.kind === 'complement'
      && (o.status === 'confirmed' || o.status === 'coordinated'))
    .map((o) => o.nodeIds[0]));
  const cover = required.length
    ? required.filter((n) => coordinated.has(n.id)).length / required.length : 0;
  // KCL Pledgebank finding: ~30% of target is the empirical tipping point —
  // commitment accelerates past it. Composite progress = mean(participants,
  // cover) fractions.
  const partCount = ctx.participants.filter((x) => x.possibilityId === p.id).length;
  const partFrac = p.minParticipants
    ? Math.min(1, partCount / p.minParticipants) : 1;
  const progress = (partFrac + cover) / 2;
  const tipping = progress >= 0.3 && progress < 1;
  return { score: 0.5 * trust + 0.3 * urgency + 0.2 * cover, trust, urgency, cover, tipping };
}

// Identity gradation ("personal data hidden until critical mass nears"):
// participant identities reveal once the card approaches quorum — cover
// ≥ REVEAL_THRESHOLD or status quorum/completed. Counts are always public.
export const REVEAL_THRESHOLD = 0.5;
export function identitiesRevealed(
  p: Possibility, cover: number, status: PossibilityStatus,
): boolean {
  return cover >= REVEAL_THRESHOLD || status === 'quorum' || status === 'completed';
}

// Filter a card deck for a viewer: passes are excluded from their deck
// (logged, never public — demand-shape data only).
export const viewerDeck = (
  possibilities: Possibility[], passes: Pass[], viewer?: string,
): Possibility[] => {
  if (!viewer) return possibilities;
  const passed = new Set(passes.filter((x) => x.actor === viewer).map((x) => x.possibilityId));
  return possibilities.filter((p) => !passed.has(p.id));
};

// North-star (GDD): successful coordinations = reached quorum AND resulted
// in post-event appreciation — within the trailing week.
export function successfulCoordinationsPerWeek(
  possibilities: Possibility[],
  appreciations: Appreciation[],
  now = Date.now(),
): number {
  const weekAgo = now - 7 * DAY;
  const appreciated = new Set(appreciations.map((a) => a.possibilityId).filter(Boolean));
  return possibilities.filter((p) =>
    p.quorumAt && Date.parse(p.quorumAt) >= weekAgo && appreciated.has(p.id)).length;
}
