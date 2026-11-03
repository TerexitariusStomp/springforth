// Participatory knowledge — Vervaeke's fourth knowledge type: what an
// actor knows by *having done*. The other three already live on the
// card (propositional = needs/questions, procedural = plans/bringings,
// perspectival = context.datasets); this is the missing field, and like
// the ecocycle it is *derived from the ledger, never stored* — so the
// record can't drift from what actually happened.
//
// A card confers enactments only once the doing happened — quorum or
// completed. Draft/active are intentions; expired released them. Roles
// are the distinct ways of having been inside:
//   declared      — convened the possibility
//   joined        — committed inside the commitment pool
//   council       — held a seat once the constellation formed
//   test-ran      — ran a belief/action/measure experiment
//   test-resolved — closed one, writing the inference back

export const ENACTMENT_ROLES = [
  'declared', 'joined', 'council', 'test-ran', 'test-resolved',
] as const;
export type EnactmentRole = typeof ENACTMENT_ROLES[number];

export interface ParticipatoryEntry {
  possibilityId: string;
  title: string;
  status: 'quorum' | 'completed';
  at: string;                  // report.at ?? quorumAt ?? createdAt
  roles: EnactmentRole[];
}

export function enactments(actor: string, ctx: {
  possibilities: {
    id: string; title: string; declarerId: string;
    status: string;            // effective status, resolved by caller
    quorumAt?: string; createdAt: string;
    report?: { at: string };
  }[];
  parts: { possibilityId: string; actor: string }[];
  seats: { possibilityId: string; actor: string }[];
  tests: {
    possibilityId: string; runner?: string;
    result?: { actor: string };
  }[];
}): ParticipatoryEntry[] {
  const joined = new Set(ctx.parts.filter((x) => x.actor === actor).map((x) => x.possibilityId));
  const seated = new Set(ctx.seats.filter((x) => x.actor === actor).map((x) => x.possibilityId));
  const ran = new Set(ctx.tests.filter((x) => x.runner === actor).map((x) => x.possibilityId));
  const resolved = new Set(ctx.tests.filter((x) => x.result?.actor === actor).map((x) => x.possibilityId));
  const out: ParticipatoryEntry[] = [];
  for (const p of ctx.possibilities) {
    if (p.status !== 'quorum' && p.status !== 'completed') continue;
    const roles: EnactmentRole[] = [];
    if (p.declarerId === actor) roles.push('declared');
    if (joined.has(p.id)) roles.push('joined');
    if (seated.has(p.id)) roles.push('council');
    if (ran.has(p.id)) roles.push('test-ran');
    if (resolved.has(p.id)) roles.push('test-resolved');
    if (!roles.length) continue;
    out.push({
      possibilityId: p.id, title: p.title, status: p.status,
      at: p.report?.at ?? p.quorumAt ?? p.createdAt, roles,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// Portfolio view — one pass for metrics: total enactments + the number
// of distinct actors carrying participatory knowledge.
export function enactmentStats(ctx: Parameters<typeof enactments>[1] & {
  actors: string[];
}): { total: number; actorsEnacted: number } {
  let total = 0, actorsEnacted = 0;
  for (const a of ctx.actors) {
    const n = enactments(a, ctx).length;
    total += n;
    if (n) actorsEnacted++;
  }
  return { total, actorsEnacted };
}
