import type {
  Appreciation, GovernanceBallot, GovernanceParam, GovernanceProposal,
} from '../core';
import { eigenTrust, trustEdges } from '../coordination';

// Trust-gated governance — parameter ballots voted by the EigenTrust-
// eligible cohort (the same derivation as retro badgeholders). Quadratic
// cost: a ballot spends `points`, weight = √points, so spreading
// conviction across voters beats concentrating it in one. No token —
// standing in the appreciation graph is the franchise.

// Voters must have nonzero EigenTrust standing — the sybil gate is the
// graph itself, not an external identity service.
export function eligibleVoters(
  appreciations: Appreciation[], minTrust = 0,
): string[] {
  const vec = eigenTrust(trustEdges(appreciations));
  return Object.entries(vec)
    .filter(([, v]) => v > minTrust)
    .map(([actor]) => actor);
}

export interface GovTally {
  proposalId: string;
  forWeight: number;          // Σ √points for
  againstWeight: number;      // Σ √points against
  turnout: number;            // ballots cast
  passed: boolean;
}

export function tallyProposal(
  proposal: GovernanceProposal,
  ballots: GovernanceBallot[],
  eligible: string[],
): GovTally {
  const elig = new Set(eligible);
  let forW = 0, againstW = 0, n = 0;
  for (const b of ballots) {
    if (b.proposalId !== proposal.id || !elig.has(b.voter)) continue;
    const w = Math.sqrt(b.points);
    if (b.support) forW += w; else againstW += w;
    n++;
  }
  return {
    proposalId: proposal.id,
    forWeight: +forW.toFixed(4), againstWeight: +againstW.toFixed(4),
    turnout: n, passed: forW > againstW,
  };
}

// Governable parameters — edge reads with these defaults; a passed
// proposal overrides. All are mechanism parameters, not policy gates.
export const GOVERNABLE: Record<string, { default: string; describe: string }> = {
  'qf.capPct':        { default: '',   describe: 'per-need match cap as fraction of fund (empty = uncapped)' },
  'pairwise.alpha':   { default: '4',  describe: 'trust-graph discoordination strength' },
  'pairwise.beta':    { default: '2',  describe: 'co-donation discoordination strength' },
  'conviction.gamma': { default: '0.5', describe: 'time-weight on donations in conviction rounds' },
  'trust.cap':        { default: '3',  describe: 'max trust multiplier applied to surfacing' },
  'evidence.boost':   { default: '1',  describe: '0 disables evidence-weighted allocation' },
};

export function paramValue(
  params: GovernanceParam[], key: string,
): string {
  return params.find((p) => p.id === key)?.value
    ?? GOVERNABLE[key]?.default ?? '';
}
