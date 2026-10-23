import type { OverlapRecord, PlanNode } from './graph.js';

// Tri-indicator scoring (Community Overlap Report spec §8): three separate
// signals rather than one magic number — reviewers see strength, scale and
// readiness independently. Materiality uses only supplied budget values;
// when neither side declares one it reports undefined, never invented data.

export interface TriScore {
  strength: number;            // match quality — the resolver's confidence
  materiality?: number;        // portfolio scale — log-normalised budgets
  readiness: number;           // evidence complete + owners named + reviewed
  materialityNote?: string;    // 'no budget data' when materiality is absent
}

export function triScore(
  rec: OverlapRecord,
  byId: Map<string, PlanNode>,
  maxBudget = 0,
): TriScore {
  const [a, b] = rec.nodeIds.map((id) => byId.get(id));

  const budgets = [a?.budget, b?.budget]
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  const materiality = budgets.length
    ? Math.log1p(budgets.reduce((s, n) => s + n, 0))
      / Math.log1p(Math.max(maxBudget, budgets.reduce((s, n) => s + n, 0)))
    : undefined;

  if (rec.status === 'rejected')
    return { strength: rec.confidence, materiality, readiness: 0,
      materialityNote: materiality === undefined ? 'no budget data' : undefined };

  const completeness = Math.min(1, rec.evidence.length / 5);
  const owners = (a?.orgIds.length ?? 0) > 0 && (b?.orgIds.length ?? 0) > 0 ? 1 : 0;
  const reviewed = Math.min(1, rec.validations.length / 2);
  const readiness = Math.round(
    (0.5 * completeness + 0.25 * owners + 0.25 * reviewed) * 100) / 100;

  return {
    strength: rec.confidence, materiality, readiness,
    materialityNote: materiality === undefined ? 'no budget data' : undefined,
  };
}
