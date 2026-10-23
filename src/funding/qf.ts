import type { Donation, FundingRound } from '../core';

// Quadratic matching — Weyl, Buterin & Hitzig, "Liberal Radicalism"
// (2018), as implemented by Gitcoin Grants / Allo Protocol.
//
// A need node's match weight is (Σ √cᵢ)² over its donations: many small
// donors outweigh one large one. Matching shares are proportional to
// weight and scaled so the total never exceeds the sponsor matching
// fund. An optional per-node capPct (Gitcoin's cap mechanism) prevents
// any single node absorbing the whole fund; overflow redistributes.
//
// Reference implementation for verification: gitcoinco/quadratic-funding
// (MIT). Test vectors in ../test mirror its published examples.

export interface NodeMatch {
  needNodeId: string;
  donations: number;          // Σ cᵢ — direct amount given
  donorCount: number;         // distinct donors — the breadth signal
  weight: number;             // (Σ √cᵢ)²
  match: number;              // matching-fund share, capped if configured
  total: number;              // donations + match
}

export function allocateMatching(
  round: Pick<FundingRound, 'matchingFund' | 'eligibleNeedIds'>,
  donations: Donation[],
  opts: { capPct?: number; weightMultiplier?: (needNodeId: string) => number } = {},
): NodeMatch[] {
  const byNeed = new Map<string, Donation[]>();
  for (const id of round.eligibleNeedIds) byNeed.set(id, []);
  for (const d of donations) {
    if (!byNeed.has(d.needNodeId)) continue;
    byNeed.get(d.needNodeId)!.push(d);
  }
  const rows = [...byNeed.entries()].map(([needNodeId, ds]) => {
    const donors = new Set(ds.map((d) => d.donor));
    const sumSqrt = ds.reduce((a, d) => a + Math.sqrt(d.amount), 0);
    return {
      needNodeId,
      donations: ds.reduce((a, d) => a + d.amount, 0),
      donorCount: donors.size,
      weight: sumSqrt * sumSqrt * (opts.weightMultiplier?.(needNodeId) ?? 1),
      match: 0,
      total: 0,
    };
  });
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0);
  if (totalWeight <= 0) return rows;
  const fund = round.matchingFund.amount;
  // Water-filling: distribute capped shares until the fund is exhausted
  // or every uncapped row carries its proportional share.
  const cap = opts.capPct != null ? fund * opts.capPct : Infinity;
  let remaining = fund, open = new Set(rows.map((r) => r.needNodeId));
  while (remaining > 1e-9 && open.size) {
    const openWeight = rows.filter((r) => open.has(r.needNodeId))
      .reduce((a, r) => a + r.weight, 0);
    if (openWeight <= 0) break;
    for (const r of rows) {
      if (!open.has(r.needNodeId)) continue;
      const share = Math.min((r.weight / openWeight) * remaining, cap - r.match);
      r.match += Math.max(0, share);
      if (r.match >= cap - 1e-9) open.delete(r.needNodeId);
    }
    // Recompute remaining after this pass.
    remaining = fund - rows.reduce((a, r) => a + r.match, 0);
    if (rows.every((r) => r.match >= cap - 1e-9)) break;
  }
  for (const r of rows) { r.match = +r.match.toFixed(2); r.total = +(r.donations + r.match).toFixed(2); }
  return rows;
}
