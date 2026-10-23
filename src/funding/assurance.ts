import type { PlanNode, OverlapRecord } from '../coordination';
import { effectiveStatus, quorumMet } from '../coordination';
import type { Possibility, Participation, Pledge } from '../core';

// Dominant-assurance pledge lifecycle — Tabarrok, "The private provision
// of public goods via dominant assurance contracts" (Journal of Public
// Economics, 1998). The same mechanism that credits pledgers of expired
// cards (AssuranceCredit) governs financial commitments: a pledge binds
// iff the card reaches quorum; nothing else ever collects it.
//
// pending  → bound    when quorumMet() flips true
// pending  → refunded when the card expires (pledge never moved — the
//                      "refund" is non-collection; AssuranceCredit is
//                      minted by the sweep, as for participants)
// bound    → released when the card completes (funds can now move on the
//                      external rail of the pledger's choice)

export function refreshPledge(
  pledge: Pledge,
  possibility: Possibility,
  ctx: { nodes: PlanNode[]; overlaps: OverlapRecord[]; participations: Participation[] },
  now = Date.now(),
): Pledge {
  const eff = effectiveStatus(possibility, now);
  if (pledge.state === 'pending') {
    const count = ctx.participations.filter((p) => p.possibilityId === possibility.id).length;
    if (quorumMet(possibility, ctx.nodes, ctx.overlaps, count).met || eff === 'quorum' || eff === 'completed')
      return { ...pledge, state: 'bound', stateAt: new Date(now).toISOString() };
    if (eff === 'expired')
      return { ...pledge, state: 'refunded', stateAt: new Date(now).toISOString() };
  }
  if (pledge.state === 'bound' && eff === 'completed')
    return { ...pledge, state: 'released', stateAt: new Date(now).toISOString() };
  return pledge;
}
