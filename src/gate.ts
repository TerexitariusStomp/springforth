// Demand-gate evaluation for funding rounds (Commons-proven mechanic).
// Matching stays locked until pledged backing reaches the goal across
// enough distinct pledgers — proven demand before treasury yield flows.
// Pure function: pledges and need→possibility mappings in, verdict out.
import type { FundingRound, Pledge } from './entities.js';

export interface DemandGate {
  // committed pledge total in the gate currency (pledgeGoalCurrency ?? fund's)
  pledged: number;
  backers: string[];       // distinct pledgers on gated needs
  gated: boolean;          // does this round have a gate configured?
  active: boolean;         // gate satisfied (or unconfigured)
  goal: number;            // pledgeGoal ?? 0
  minBackers: number;      // minBackers ?? 0
}

// A pledge signals demand for a round when it targets an eligible need
// directly, or the possibility that owns an eligible need. Pending and
// bound pledges count (committed intent); refunded/released do not.
export function roundDemand(
  round: FundingRound,
  pledges: Pledge[],
  needPoss: Map<string, string>,        // needNodeId → possibilityId
): DemandGate {
  const gated = round.pledgeGoal != null || round.minBackers != null;
  const gate = { pledged: 0, backers: [] as string[], gated, active: true,
    goal: round.pledgeGoal ?? 0, minBackers: round.minBackers ?? 0 };
  if (!gated) return gate;
  const currency = round.pledgeGoalCurrency ?? round.matchingFund.currency;
  const backers = new Set<string>();
  for (const pl of pledges) {
    if (pl.state === 'refunded' || pl.state === 'released') continue;
    const hits = pl.needNodeId != null
      ? round.eligibleNeedIds.includes(pl.needNodeId)
      : [...needPoss.entries()].some(
          ([nid, pid]) => pid === pl.possibilityId && round.eligibleNeedIds.includes(nid));
    if (!hits) continue;
    backers.add(pl.pledger);
    if (pl.currency === currency) gate.pledged += pl.amount;
  }
  gate.backers = [...backers];
  gate.active = gate.pledged >= gate.goal && backers.size >= gate.minBackers;
  return gate;
}

// Accrued endowment fees: bps skim off every donation to non-endowment
// rounds, per currency. Derived at render — the donation ledger stays
// the record; the endowment never mints claims on locked principal.
export function endowmentAccrual(
  rounds: FundingRound[],
  donations: { roundId: string; amount: number; currency: string }[],
): { accrued: Record<string, number>; principal: Record<string, number> } {
  const skimByRound = new Map(rounds.map((r) => [r.id, r.skimBps ?? 0]));
  const accrued: Record<string, number> = {};
  const principal: Record<string, number> = {};
  for (const r of rounds.filter((x) => x.endowment))
    principal[r.matchingFund.currency] =
      (principal[r.matchingFund.currency] ?? 0) + r.matchingFund.amount;
  for (const d of donations) {
    const bps = skimByRound.get(d.roundId) ?? 0;
    if (!bps) continue;
    accrued[d.currency] = (accrued[d.currency] ?? 0) + d.amount * bps / 10_000;
  }
  return { accrued, principal };
}
