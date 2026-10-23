import { Donation, FundingRound, Possibility, Participation, Pledge, Appreciation, ImpactClaim, OracleCheck, RetroBallot, RetroRound, GovernanceBallot, GovernanceParam, GovernanceProposal } from './core';
import { mutualWeight, type TrustEdge, PlanNode, OverlapRecord, effectiveStatus, quorumMet, eigenTrust, trustEdges } from './coordination';

// ── index.ts ────────────────────────────────────────


// ── pairwise.ts ─────────────────────────────────────
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

// ── qf.ts ───────────────────────────────────────────
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

// ── assurance.ts ────────────────────────────────────
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

// ── claims.ts ───────────────────────────────────────
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
    artifactRefs: [],
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
      ...claim.artifactRefs.map((uri) => ({ uri })),
    ].filter(Boolean),
    createdAt: claim.createdAt,
  };
}

// ── retro.ts ────────────────────────────────────────
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

// ── governance.ts ───────────────────────────────────
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
