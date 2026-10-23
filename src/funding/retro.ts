import type { Appreciation, RetroBallot, RetroRound } from '../core';
import { eigenTrust, trustEdges } from '../coordination';

// Retroactive allocation — Optimism RetroPGF model: sponsors fund a
// round; a badgeholder cohort votes on demonstrated outcomes; the fund
// distributes by ballot weight. Ex-post reward for what happened, not
// ex-ante funding of what might.
//
// Difference that matters: the reviewer cohort is not appointed — it is
// *derived*. `badgeholders()` selects the top-N actors by EigenTrust
// standing on the pairwise appreciation graph (mutual recognition →
// transitive propagation, already implemented in @springforth/coordination).
// The community's own recognition record decides who reviews.

export function badgeholders(
  appreciations: Appreciation[],
  n: number,
  exclude: string[] = [],
): string[] {
  const edges = trustEdges(appreciations);
  const vec = eigenTrust(edges);
  const skip = new Set(exclude);
  return Object.entries(vec)
    .filter(([id]) => !skip.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);
}

export interface RetroShare {
  claimId: string;
  points: number;        // Σ √points across ballots (quadratic aggregation)
  rawPoints: number;     // Σ points as cast
  share: number;         // portion of fund (0–1)
  amount: number;        // share × fund
}

// Quadratic ballot tally: each ballot's points aggregate by √ before
// summing across badgeholders — broad support outweighs concentrated
// conviction, same LR principle as donation matching.
export function tallyRound(
  round: Pick<RetroRound, 'fund' | 'claimIds' | 'pointsPerBallot'>,
  ballots: RetroBallot[],
): RetroShare[] {
  const acc = new Map<string, { sqrt: number; raw: number }>();
  for (const id of round.claimIds) acc.set(id, { sqrt: 0, raw: 0 });
  for (const b of ballots) {
    const cast = Object.entries(b.weights).filter(([id]) => acc.has(id));
    const total = cast.reduce((a, [, w]) => a + w, 0);
    if (total > round.pointsPerBallot) continue;   // over-budget ballot discarded
    for (const [id, w] of cast) {
      const row = acc.get(id)!;
      row.raw += w;
      row.sqrt += Math.sqrt(w);
    }
  }
  const rows = [...acc.entries()].map(([claimId, v]) => ({
    claimId, points: v.sqrt * v.sqrt, rawPoints: v.raw, share: 0, amount: 0,
  }));
  const totalPoints = rows.reduce((a, r) => a + r.points, 0);
  for (const r of rows) {
    r.share = totalPoints > 0 ? +(r.points / totalPoints).toFixed(6) : 0;
    r.amount = +(r.share * round.fund.amount).toFixed(2);
  }
  return rows.sort((a, b) => b.amount - a.amount);
}
