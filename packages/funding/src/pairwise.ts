import type { Donation, FundingRound } from '@springforth/core';
import { mutualWeight, type TrustEdge } from '@springforth/coordination';
import type { NodeMatch } from './qf.ts';

// Pairwise coordination-subsidy quadratic matching — Buterin,
// "Pairwise coordination subsidies" (ethresear.ch/5553, 2020);
// cluster-match variant shipped by Gitcoin (qf-calculator, MIT).
//
// Classic LR treats every pair (i,j) of donors as uncoordinated and
// pays a subsidy 2√(cᵢ·cⱼ) per pair. The pairwise mechanism multiplies
// each pair by a discoordination coefficient kᵢⱼ ∈ (0,1] — pairs that
// are already socially coordinated (mutual appreciation edges, shared
// bound wallets, co-donating the same set of needs) earn less subsidy,
// so colluding cliques cannot farm the matching fund.
//
// Our uniqueness vs Gitcoin Passport/cluster-match: the coefficient
// comes from OUR live trust graph (appreciation → mutual recognition),
// not an external identity oracle. A clique that appreciates each other
// is detectably coordinated; a diverse crowd is not.
//
// kᵢⱼ = 1 / (1 + α·mutual(i,j) + β·coDonate(i,j))
//   mutual(i,j)  — trust-graph mutual recognition, 0..1
//   coDonate(i,j) — fraction of needs in this round both donated to, 0..1
//   shared bound wallet — k forced to 0 (same actor, no subsidy)
//
// Conviction weighting (optional, Gardens conviction-voting model):
// donation weight scales by (1 + γ·daysHeld/roundDays) — earlier backing
// earns modestly more voice; γ kept small so it never drowns breadth.

const DAY_MS = 86_400_000;

export interface PairwiseOpts {
  alpha?: number;      // trust-graph discount strength (default 4)
  beta?: number;       // co-donation discount strength (default 2)
  gamma?: number;      // conviction time-weight (default 0 — off)
  capPct?: number;
  // wallet→actor map: donors sharing a bound wallet count as one actor.
  walletFor?: (donor: string) => string;
  // evidence multiplier per need (oracle trajectory → match weight).
  weightMultiplier?: (needNodeId: string) => number;
  now?: number;        // ms epoch for conviction timing (tests)
}

interface Agg {
  actor: string;             // resolved actor (wallet map applied)
  amount: number;            // Σ raw donations
  eff: number;               // conviction-weighted amount
  needs: Set<string>;        // needs this actor backed
}

export function pairwiseAllocate(
  round: Pick<FundingRound, 'matchingFund' | 'eligibleNeedIds' | 'opensAt' | 'closesAt'>,
  donations: Donation[],
  edges: TrustEdge[] = [],
  opts: PairwiseOpts = {},
): NodeMatch[] {
  const alpha = opts.alpha ?? 4, beta = opts.beta ?? 2, gamma = opts.gamma ?? 0;
  const actorOf = opts.walletFor ?? ((d: string) => d);
  const now = opts.now ?? Date.now();
  const roundDays = Math.max(1,
    (Date.parse(round.closesAt) - Date.parse(round.opensAt)) / DAY_MS);

  // Aggregate per resolved actor — wallet-bound donors merge.
  const byNeed = new Map<string, Map<string, Agg>>();
  for (const id of round.eligibleNeedIds) byNeed.set(id, new Map());
  for (const d of donations) {
    if (!byNeed.has(d.needNodeId)) continue;
    const actor = actorOf(d.donor);
    const held = Math.max(0, Math.min(now - Date.parse(d.at),
      Date.parse(round.closesAt) - Date.parse(d.at))) / DAY_MS;
    const eff = d.amount * (1 + gamma * (held / roundDays));
    const agg = byNeed.get(d.needNodeId)!.get(actor)
      ?? { actor, amount: 0, eff: 0, needs: new Set<string>() };
    agg.amount += d.amount; agg.eff += eff;
    byNeed.get(d.needNodeId)!.set(actor, agg);
  }
  // Co-donation sets per actor across the whole round.
  const allNeeds = new Map<string, Set<string>>();
  for (const [needId, m] of byNeed)
    for (const actor of m.keys()) {
      const s = allNeeds.get(actor) ?? new Set<string>();
      s.add(needId); allNeeds.set(actor, s);
    }
  const nNeeds = Math.max(1, round.eligibleNeedIds.length);

  const rows = [...byNeed.entries()].map(([needNodeId, m]) => {
    const actors = [...m.values()];
    let weight = 0;
    for (const a of actors) weight += a.eff;                    // self terms
    for (let i = 0; i < actors.length; i++) {
      for (let j = i + 1; j < actors.length; j++) {
        const a = actors[i]!, b = actors[j]!;
        const mutual = mutualWeight(edges, a.actor, b.actor);
        let co = 0;
        for (const n of allNeeds.get(a.actor)!)
          if (allNeeds.get(b.actor)!.has(n)) co += 1;
        const k = 1 / (1 + alpha * mutual + beta * (co / nNeeds));
        weight += k * 2 * Math.sqrt(a.eff * b.eff);
      }
    }
    return {
      needNodeId,
      donations: actors.reduce((s, a) => s + a.amount, 0),
      donorCount: actors.length,
      weight: weight * (opts.weightMultiplier?.(needNodeId) ?? 1),
      match: 0, total: 0,
    };
  });

  // Same water-filling distribution as allocateMatching.
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0);
  if (totalWeight <= 0) return rows;
  const fund = round.matchingFund.amount;
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
    remaining = fund - rows.reduce((a, r) => a + r.match, 0);
    if (rows.every((r) => r.match >= cap - 1e-9)) break;
  }
  for (const r of rows) { r.match = +r.match.toFixed(2); r.total = +(r.donations + r.match).toFixed(2); }
  return rows;
}
