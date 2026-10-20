import type {
  Appreciation, ImpactClaim, OracleCheck, Possibility,
} from '@springforth/core';
import type { PlanNode } from '@springforth/coordination';

// Impact claims — hypercerts ATProto lexicon shape (org.hypercerts
// vocabulary; MIT-licensed spec + @hypercerts-org/lexicon types). A claim
// records *work done*: scope, timeframe, contributors, evidence. It is
// evaluated via attestations — it is never a priced instrument and has
// no ownership split or secondary market.

export function buildClaim(opts: {
  possibility: Possibility;
  nodes: PlanNode[];             // coordinated/linked action nodes
  checks: OracleCheck[];         // evidence readings on those nodes
  appreciations: Appreciation[]; // the card's appreciation round
  id?: string;
}): ImpactClaim {
  const { possibility: p, nodes, checks, appreciations } = opts;
  return {
    id: opts.id ?? `claim-${p.id}`,
    possibilityId: p.id,
    nodeIds: nodes.map((n) => n.id),
    workScope: p.title,
    timeframe: { from: p.timeStart ?? p.createdAt, to: p.timeEnd ?? p.report?.at },
    contributors: [
      p.declarerId,
      ...new Set(appreciations.map((a) => a.fromActor)),
      ...new Set(appreciations.map((a) => a.toActor)),
    ],
    oracleCheckIds: checks.map((c) => c.id),
    appreciationIds: appreciations.map((a) => a.id),
    state: 'draft',
    createdAt: new Date().toISOString(),
  };
}

// Emit the ATProto lexicon record (org.hypercerts.claim.activity shape).
// Field names follow the published lexicon — see
// hypercerts-org/hypercerts-lexicon (MIT).
export function toHypercertLexicon(claim: ImpactClaim): Record<string, unknown> {
  return {
    $type: 'org.hypercerts.claim.activity',
    title: claim.workScope,
    workScope: { string: claim.workScope },
    workTimeframeFrom: claim.timeframe.from,
    workTimeframeTo: claim.timeframe.to,
    contributors: claim.contributors.map((id) => ({
      contributorInformation: { identity: id },
      contribution: { role: 'participant' },
    })),
    measurements: claim.oracleCheckIds.map((id) => ({
      metric: 'oracle-check', evidenceRef: `springforth:check:${id}`,
    })),
    // provenance pointers — resolvable against the public worker.
    externalRefs: [
      claim.possibilityId
        ? { uri: `https://springforth.widespread.workers.dev/possibilities#${claim.possibilityId}` }
        : undefined,
      ...claim.nodeIds.map((id) => ({ uri: `https://springforth.widespread.workers.dev/nodes/${id}` })),
    ].filter(Boolean),
    createdAt: claim.createdAt,
  };
}
