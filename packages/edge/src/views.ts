// Shared data loaders — the computation that used to live inline in route
// handlers, extracted so JSON routes and hub pages read the same shape.
// Every loader returns exactly the object its JSON route returns today
// (same key order = byte-identical serialization).
import {
  Possibility, Participation, Appreciation, Pass, Interest, AssuranceCredit,
  OracleCheck, FundingRound, Donation, Pledge, ImpactClaim,
  RetroRound, ActorWallet, RecurringSupport, YieldStream,
  GovernanceProposal, GovernanceBallot, GovernanceParam, DatasetRelease,
  CouncilSeat, ForumPost,
  valueCoordinated, roundDemand, endowmentAccrual,
} from '@springforth/core';
import {
  allocateMatching, pairwiseAllocate, badgeholders, eligibleVoters,
  paramValue, GOVERNABLE,
} from '@springforth/funding';
import {
  PlanNode, OverlapRecord,
  isNeed, inferCapital, effectiveStatus, trustEdges,
  earnedRecognition, eigenTrust, successfulCoordinationsPerWeek,
  resolvePlace,
} from '@springforth/coordination';
import { SOURCES, evidenceBoost } from '@springforth/oracle';
import { list, ledgerEvents, ledgerVerify } from './store.js';
import type { Env } from './index.js';

// Volunteer-time benchmark (treasury lane): ONS Household Satellite
// Accounts 2017 rate, as cited by NCVO and the DCMS volunteering-value
// methodology (replacement-cost method). Applied only to GB-placed
// cards — no cited Kenya rate is carried yet, an honest gap.
export const VOLUNTEER_GB = {
  key: 'GB', hourRate: 14.43, currency: 'GBP',
  source: 'ONS Household Satellite Accounts (2017)',
  riskPerHome: 30_000, riskSource: 'Environment Agency / ABI (2025)',
};
export const GB_PLACE = /shrewsbury|severn|london|england|britain|uk\b|manchester|bristol|oxford|cardiff|edinburgh|birmingham|leeds|glasgow|hebden|calder|thorntree|middlesbrough|yorkshire/i;

// Which store slices are exportable as datasets.
export const DATASET_SOURCES: Record<string, { kind: string; describe: string }> = {
  plannodes:    { kind: 'plannode',    describe: 'plan graph nodes — actions, needs, offers, outcomes' },
  signals:      { kind: 'signal',      describe: 'support/interest/field-report signals' },
  donations:    { kind: 'donation',    describe: 'donation records incl. settlement refs' },
  'oracle-checks': { kind: 'oracle-check', describe: 'evidence scores per node per source' },
  overlaps:     { kind: 'overlap',     describe: 'detected overlap/complement records' },
  appreciations:{ kind: 'appreciation',describe: 'pairwise appreciation edges' },
};

export interface Snapshot { nodeId: string; key?: string; source: string; value: number; unit: string; at: string }

// Donations + derived match per need node (match is computed per round,
// mapped back by needNodeId). Shared by the deck and /metrics.
export async function fundingMaps(env: Env) {
  const [dons, rnds] = await Promise.all([
    list<Donation>(env.DB, 'donation'), list<FundingRound>(env.DB, 'round'),
  ]);
  const matchByNeed = new Map<string, { needNodeId: string; amount: number; currency: string }>();
  const [pledges, nodes] = await Promise.all([
    list<Pledge>(env.DB, 'pledge'), list<PlanNode>(env.DB, 'plannode'),
  ]);
  const needPoss = new Map(nodes.filter((n) => n.possibilityId != null)
    .map((n) => [n.id, n.possibilityId!]));
  for (const r of rnds) {
    // Demand gate + endowment: locked rounds contribute no match — proven
    // demand before treasury flows (Commons mechanic); endowment never
    // allocates its locked principal.
    if (r.endowment || !roundDemand(r, pledges, needPoss).active) continue;
    const alloc = await allocFor(env, r, dons.filter((d) => d.roundId === r.id));
    for (const a of alloc) {
      // Two rounds can fund the same need — matches accumulate per currency.
      const key = `${a.needNodeId}|${r.matchingFund.currency}`;
      const prev = matchByNeed.get(key);
      matchByNeed.set(key, { needNodeId: a.needNodeId,
        amount: (prev?.amount ?? 0) + a.match, currency: r.matchingFund.currency });
    }
  }
  return { dons, rnds, matchByNeed };
}

// Round allocation dispatcher — 'lr' is classic quadratic; 'pairwise'
// discounts coordinated donor pairs via the appreciation trust graph +
// bound-wallet clusters (Phase A moat). Conviction adds time-weight.
export async function allocFor(env: Env, round: FundingRound, donations: Donation[]) {
  // Evidence→allocation coupling: oracle trajectory per need becomes a
  // 0.8–1.2 weight multiplier (Phase E). Governance can disable it.
  const checks = await list<OracleCheck>(env.DB, 'oracle-check');
  const govParams = await list<GovernanceParam>(env.DB, 'gov-param');
  const evidenceOn = paramValue(govParams, 'evidence.boost') !== '0';
  const boost = (needNodeId: string) =>
    evidenceOn ? evidenceBoost(needNodeId, checks) : 1;
  if (round.matchingMode !== 'pairwise' && !round.conviction)
    return allocateMatching(round, donations, { weightMultiplier: boost });
  const [apps, wallets] = await Promise.all([
    list<Appreciation>(env.DB, 'appreciation'),
    list<ActorWallet>(env.DB, 'actor-wallet'),
  ]);
  const walletToActor = new Map(wallets.map((w) => [w.address.toLowerCase(), w.actor]));
  return pairwiseAllocate(round, donations, trustEdges(apps), {
    alpha: Number(paramValue(govParams, 'pairwise.alpha')) || 4,
    beta: Number(paramValue(govParams, 'pairwise.beta')) || 2,
    gamma: round.conviction ? Number(paramValue(govParams, 'conviction.gamma')) || 0.5 : 0,
    weightMultiplier: boost,
    walletFor: (donor) => {
      const lower = donor.toLowerCase();
      return walletToActor.get(lower) ?? donor;
    },
  });
}

/* ── loaders ──────────────────────────────────────────────────────── */

// GET /metrics — north-star + funnel metrics incl. valueByCurrency.
export async function loadMetrics(env: Env) {
  const [poss, parts, apps, recs, { dons, matchByNeed }, nodes] = await Promise.all([
    list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
    list<Appreciation>(env.DB, 'appreciation'), list<OverlapRecord>(env.DB, 'overlap'),
    fundingMaps(env), list<PlanNode>(env.DB, 'plannode'),
  ]);
  const now = Date.now();
  const statuses = poss.map((p) => ({ p, s: effectiveStatus(p, now) }));
  const activated = statuses.filter((x) => x.s === 'quorum' || x.s === 'completed').length;
  const completedIds = new Set(statuses.filter((x) => x.s === 'completed').map((x) => x.p.id));
  const completedParts = parts.filter((x) => completedIds.has(x.possibilityId)).length;
  const completedApps = apps.filter((a) => a.possibilityId && completedIds.has(a.possibilityId)).length;
  const first = Math.min(...statuses.map((x) => Date.parse(x.p.createdAt)), now);
  const weeks = Math.max(1, (now - first) / (7 * 86_400_000));
  const passes = await list<Pass>(env.DB, 'pass');
  const expiringSoon = statuses.filter((x) =>
    (x.s === 'active' || x.s === 'draft') && x.p.deadline
    && Date.parse(x.p.deadline) - now < 3 * 86_400_000).length;
  // Evidence coverage: quorum/completed cards carrying at least one
  // oracle check on their nodes or a filed completion report.
  const checks = await list<OracleCheck>(env.DB, 'oracle-check');
  const nodeToPoss = new Map(nodes.map((n) => [n.id, n.possibilityId]));
  const checkedPoss = new Set(checks.map((c) => nodeToPoss.get(c.nodeId ?? '')).filter(Boolean));
  const activatedIds = statuses.filter((x) => x.s === 'quorum' || x.s === 'completed').map((x) => x.p);
  const withEvidence = activatedIds.filter((p) => checkedPoss.has(p.id) || !!p.report).length;
  const completed = statuses.filter((x) => x.s === 'completed').length;
  const payload: Record<string, unknown> = {
    possibilities: statuses.length, activated, expired: statuses.filter((x) => x.s === 'expired').length,
    quorumRate: statuses.length ? +(activated / statuses.length).toFixed(3) : 0,
    completionRate: activated ? +(completed / activated).toFixed(3) : 0,
    evidenceCoverage: activated ? +(withEvidence / activated).toFixed(3) : 0,
    appreciationRatio: completedParts ? +(completedApps / completedParts).toFixed(3) : 0,
    coordinationsPerWeek: +(activated / weeks).toFixed(3),
    successfulCoordinationsPerWeek: successfulCoordinationsPerWeek(poss, apps, now),
    expiringSoon, passesLogged: passes.length,
    complementsConfirmed: recs.filter((r) => r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated')).length,
    // Monetary value, per currency (never converted) — committed and
    // matched are ledger-derived; volunteer time is declared hours ×
    // the cited ONS rate where the card places in GB. Aggregated per
    // card so rates stay local.
    ...(() => {
      const possByNeed = new Map(nodes.filter((n) => n.kind === 'need')
        .map((n) => [n.id, n.possibilityId]));
      const acc: Record<string, { committed: number; matched: number; inKind: number; volunteerTime: number; total: number; asked: number; riskAvoided: number; leverage: number; riskPerUnit: number; capitals?: { financial: number; human: number; social: number; natural: number } }> = {};
      let hoursTotal = 0;
      for (const p of poss) {
        const mine = parts.filter((x) => x.possibilityId === p.id);
        const v = valueCoordinated({
          hours: mine.map((x) => x.hours ?? 0).filter((h) => h > 0),
          donations: dons.filter((d) => possByNeed.get(d.needNodeId) === p.id)
            .map((d) => ({ amount: d.amount, currency: d.currency })),
          matched: [...matchByNeed.values()].filter((m) => possByNeed.get(m.needNodeId) === p.id)
            .map((m) => ({ amount: m.amount, currency: m.currency })),
          inKind: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'offer' && n.budget != null)
            .map((n) => ({ amount: n.budget!,
              currency: n.budgetCurrency ?? (GB_PLACE.test(p.place ?? '') ? 'GBP' : 'USD') })),
          needsCost: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'need' && n.budget != null)
            .map((n) => ({ amount: n.budget!,
              currency: n.budgetCurrency ?? (GB_PLACE.test(p.place ?? '') ? 'GBP' : 'USD') })),
          householdsProtected: p.householdsProtected,
          benchmark: GB_PLACE.test(p.place ?? '') ? VOLUNTEER_GB : undefined,
        });
        hoursTotal += v.hoursTotal;
        for (const [cur, cv] of Object.entries(v.byCurrency)) {
          const a = (acc[cur] ??= { committed: 0, matched: 0, inKind: 0, volunteerTime: 0, total: 0, asked: 0, riskAvoided: 0, leverage: 0, riskPerUnit: 0 });
          a.committed += cv.committed; a.matched += cv.matched;
          a.inKind += cv.inKind; a.volunteerTime += cv.volunteerTime; a.total += cv.total;
          a.asked += cv.asked; a.riskAvoided += cv.riskAvoided;
          if (cv.capitals) {
            const cap = (a.capitals ??= { financial: 0, human: 0, social: 0, natural: 0 });
            cap.financial += cv.capitals.financial; cap.human += cv.capitals.human;
            cap.social += cv.capitals.social; cap.natural += cv.capitals.natural;
          }
        }
      }
      // Ratios are derived post-sum — they must never be summed across cards.
      for (const a of Object.values(acc)) {
        a.leverage = a.committed > 0 ? Math.round(a.total / a.committed * 100) / 100 : 0;
        a.riskPerUnit = a.total > 0 && a.riskAvoided > 0 ? Math.round(a.riskAvoided / a.total * 100) / 100 : 0;
      }
      for (const a of Object.values(acc)) {
        for (const k of Object.keys(a) as (keyof typeof a)[])
          if (k !== 'capitals') (a[k] as number) = Math.round((a[k] as number) * 100) / 100;
        if (a.capitals)
          for (const k of Object.keys(a.capitals) as (keyof typeof a.capitals)[])
            a.capitals[k] = Math.round(a.capitals[k] * 100) / 100;
      }
      return { valueByCurrency: acc, declaredHoursTotal: Math.round(hoursTotal * 100) / 100 };
    })(),
  };
  return payload;
}

// GET /commitments — {commitments, byCapital}; params = URLSearchParams
// (role/org/unmet filters).
export async function loadCommitments(env: Env, params: URLSearchParams) {
  const nodes = await list<PlanNode>(env.DB, 'plannode');
  const recs = await list<OverlapRecord>(env.DB, 'overlap');
  const matchedBy = new Map<string, number>();
  for (const r of recs) {
    if (r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated'))
      matchedBy.set(r.nodeIds[0]!, (matchedBy.get(r.nodeIds[0]!) ?? 0) + 1);
  }
  const org = params.get('org');
  const rows = nodes
    .filter((n) => n.kind === 'offer' || n.kind === 'need' || isNeed(n))
    .map((n) => ({
      ...n,
      role: n.kind === 'offer' ? 'offer' : 'need',
      inferred: n.kind === 'action',      // verb-inferred, not declared
      offersMatched: n.kind === 'offer' ? undefined : (matchedBy.get(n.id) ?? 0),
      capital: inferCapital(n),           // explicit field or heuristic
    }))
    .filter((n) => !params.get('role') || n.role === params.get('role'))
    .filter((n) => !org || n.orgIds.some((o) => o.includes(org)))
    .filter((n) => params.get('unmet') !== '1' || (n.role === 'need' && !n.offersMatched));
  const byCapital: Record<string, number> = {};
  for (const n of rows) if (n.capital) byCapital[n.capital] = (byCapital[n.capital] ?? 0) + 1;
  return { commitments: rows, byCapital };
}

// GET /resources — every published offer + contribution count.
export async function loadResources(env: Env) {
  const nodes = await list<PlanNode>(env.DB, 'plannode');
  const recs = await list<OverlapRecord>(env.DB, 'overlap');
  const times = new Map<string, number>();
  for (const r of recs)
    if (r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated'))
      times.set(r.nodeIds[1]!, (times.get(r.nodeIds[1]!) ?? 0) + 1);
  const resources = nodes.filter((n) => n.kind === 'offer').map((o) => ({
    id: o.id, label: o.label, owner: o.orgIds[0] ?? 'unknown',
    terms: o.terms, capacity: o.capacity, capital: inferCapital(o),
    timesContributed: times.get(o.id) ?? 0, source: o.source,
  }));
  return { resources };
}

// GET /trust — {rule, edges, mutual, actors}.
export async function loadTrust(env: Env) {
  const [apps, credits] = await Promise.all([
    list<Appreciation>(env.DB, 'appreciation'),
    list<AssuranceCredit>(env.DB, 'assurance-credit'),
  ]);
  const edges = trustEdges(apps);
  const earned = earnedRecognition(edges, credits);
  const vec = eigenTrust(edges);   // uniform seed — global scores
  const actorIds = new Set<string>([
    ...Object.keys(earned), ...edges.flatMap((e) => [e.from, e.to]),
    ...credits.map((c) => c.actor),
  ]);
  const rule = 'mutual recognition = min(a→b, b→a); recognition ∝ √earned (Bloom √-norm); propagation: EigenTrust';
  return {
    rule,
    edges, mutual: edges.filter((e) => e.mutual > 0),
    actors: [...actorIds].map((id) => ({
      id, earned: earned[id] ?? 0,
      trustScore: +((vec[id] ?? 0) / Math.max(...Object.values(vec), 1e-9)).toFixed(4),
      assuranceCredits: credits.filter((c) => c.actor === id).length,
    })).sort((a, b) => b.trustScore - a.trustScore || b.earned - a.earned),
  };
}

// GET /actors — the directory rows (id, created, joined, earned, trust).
export async function loadActorsDirectory(env: Env) {
  const [poss, parts, apps, credits] = await Promise.all([
    list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
    list<Appreciation>(env.DB, 'appreciation'), list<AssuranceCredit>(env.DB, 'assurance-credit'),
  ]);
  const edges = trustEdges(apps);
  const vec = eigenTrust(edges);
  const mean = Object.values(vec).length
    ? Object.values(vec).reduce((a, b) => a + b, 0) / Object.values(vec).length : 0;
  const earnedMap = earnedRecognition(edges, credits);
  const actorIds = new Set<string>([
    ...poss.map((p) => p.declarerId), ...parts.map((x) => x.actor),
    ...apps.flatMap((a) => [a.fromActor, a.toActor]),
    ...credits.map((c) => c.actor),
  ]);
  return [...actorIds].map((aid) => ({
    id: aid,
    created: poss.filter((p) => p.declarerId === aid).length,
    joined: parts.filter((x) => x.actor === aid).length,
    earned: earnedMap[aid] ?? 0,
    trustScore: mean > 0 ? +((vec[aid] ?? 0) / mean).toFixed(4) : 0,
  }));
}

// GET /rounds — the list view the JSON/HTML handler assembled.
export async function loadRoundsView(env: Env) {
  const rounds = await list<FundingRound>(env.DB, 'round');
  const [dons, pledges, rnodes] = await Promise.all([
    list<Donation>(env.DB, 'donation'), list<Pledge>(env.DB, 'pledge'),
    list<PlanNode>(env.DB, 'plannode'),
  ]);
  const needPoss = new Map(rnodes.filter((n) => n.possibilityId != null)
    .map((n) => [n.id, n.possibilityId!]));
  const gates = new Map(rounds.map((r) => [r.id, roundDemand(r, pledges, needPoss)]));
  const endow = endowmentAccrual(rounds, dons);
  return { rounds, dons, gates, endow };
}

// GET /retro — retro rounds + EigenTrust-derived badgeholders.
export async function loadRetro(env: Env) {
  const rounds = await list<RetroRound>(env.DB, 'retroround');
  const apps = await list<Appreciation>(env.DB, 'appreciation');
  const badgeholderList = badgeholders(apps, 8);
  const rule = 'badgeholders = top EigenTrust on the appreciation graph; quadratic ballot on attested claims';
  return { rounds, badgeholders: badgeholderList, rule };
}

// GET /governance — proposals, ballots, params + the eligible cohort.
export async function loadGovernance(env: Env) {
  const [proposals, ballots, params, govApps] = await Promise.all([
    list<GovernanceProposal>(env.DB, 'gov-proposal'),
    list<GovernanceBallot>(env.DB, 'gov-ballot'),
    list<GovernanceParam>(env.DB, 'gov-param'),
    list<Appreciation>(env.DB, 'appreciation'),
  ]);
  return {
    proposals, ballots, params,
    governable: GOVERNABLE, eligibleVoters: eligibleVoters(govApps),
  };
}

// GET /streams — recurring support + yield streams.
export async function loadStreams(env: Env) {
  const [streams, yieldStreams] = await Promise.all([
    list<RecurringSupport>(env.DB, 'recurring-support'),
    list<YieldStream>(env.DB, 'yieldstream'),
  ]);
  return { streams, yieldStreams };
}

// GET /datasets — releases + available slices.
export async function loadDatasets(env: Env) {
  const releases = await list<DatasetRelease>(env.DB, 'dataset-release');
  const available = Object.fromEntries(
    Object.entries(DATASET_SOURCES).map(([k, v]) => [k, v.describe]));
  return { releases, available };
}

// Source registry rows — provenance + configured/lastFetch status.
export async function loadSources(env: Env) {
  const snapshots = await list<Snapshot & { latest?: { at: string } }>(env.DB, 'oracle-snapshot');
  return SOURCES.map((s) => ({
    ...s,
    configured: s.needs ? !!env[s.needs as 'OPENAQ_API_KEY'] : true,
    lastFetch: snapshots.filter((x) => x.source === s.source).at(-1)?.latest?.at ?? null,
  }));
}

// GET /verify — open-evidence readings + their target nodes + sources.
export async function loadEvidence(env: Env) {
  const [checks, nodes, sources] = await Promise.all([
    list<OracleCheck & { nodeId?: string }>(env.DB, 'oracle-check'),
    list<PlanNode>(env.DB, 'plannode'),
    loadSources(env),
  ]);
  return { checks, nodes, sources };
}

// GET /ledger — verify result + recent events.
export async function loadLedgerSummary(env: Env) {
  const [verify, events] = await Promise.all([ledgerVerify(env.DB), ledgerEvents(env.DB)]);
  return { verify, events };
}

// Extra 1 — card ↔ hub links + the megaplan extras. For each
// possibility card: overlaps touching its plan nodes, rounds whose
// eligible needs it owns, committed donations + pledge count, claim
// id, report flag — plus the audit trail (ledger events naming the
// card), council seats, forum posts, appreciation notes, and the
// resolved geo point for the map.
export interface CardConnections {
  overlapCount: number;
  focusNodeId?: string;
  rounds: { id: string; title: string }[];
  committed: Record<string, number>;
  pledges: number;
  claimId?: string;
  hasReport: boolean;
  trail?: { seq: number; at: string; actor: string; kind: string }[];
  seats?: { actor: string; role: string }[];
  posts?: { id: string; parentId?: string; actor: string; kind: string; text: string; at: string }[];
  notes?: { from: string; to: string; note: string }[];
  geo?: { lat: number; lon: number };
  interestCount?: number;
  personal?: { joined: boolean; interested: boolean; recognized: number; near?: string; newSince: number; lastEvent?: string };
}
export async function loadCardConnections(
  env: Env,
  cards: { id: string; report?: unknown; place?: string; h3?: string }[],
): Promise<Record<string, CardConnections>> {
  const [nodes, recs, rounds, dons, pledges, claims, events, seats, posts, apps, interests] = await Promise.all([
    list<PlanNode>(env.DB, 'plannode'), list<OverlapRecord>(env.DB, 'overlap'),
    list<FundingRound>(env.DB, 'round'), list<Donation>(env.DB, 'donation'),
    list<Pledge>(env.DB, 'pledge'), list<ImpactClaim>(env.DB, 'claim'),
    ledgerEvents(env.DB), list<CouncilSeat>(env.DB, 'council-seat'),
    list<ForumPost>(env.DB, 'forum-post'), list<Appreciation>(env.DB, 'appreciation'),
    list<Interest>(env.DB, 'interest'),
  ]);
  const out: Record<string, CardConnections> = {};
  for (const card of cards) {
    const myNodes = nodes.filter((n) => n.possibilityId === card.id);
    const myNodeIds = new Set(myNodes.map((n) => n.id));
    const myNeeds = myNodes.filter((n) => n.kind === 'need');
    const myNeedIds = new Set(myNeeds.map((n) => n.id));
    const myOverlaps = recs.filter((r) => r.status !== 'rejected'
      && r.nodeIds.some((id) => myNodeIds.has(id)));
    const committed: Record<string, number> = {};
    for (const d of dons)
      if (myNeedIds.has(d.needNodeId))
        committed[d.currency] = (committed[d.currency] ?? 0) + d.amount;
    // Audit trail: ledger events whose payload names this card
    // (payload.id, payload.possibilityId) or one of its nodes.
    const trail = events.filter((e) => {
      const pl = e.payload as Record<string, unknown>;
      if (pl?.id === card.id || pl?.possibilityId === card.id) return true;
      if (typeof pl?.nodeId === 'string' && myNodeIds.has(pl.nodeId)) return true;
      if (typeof pl?.id === 'string' && myNodeIds.has(pl.id)) return true;
      return false;
    }).map((e) => ({ seq: e.seq, at: e.at, actor: e.actor, kind: e.kind }));
    const geo = resolvePlace(
      { id: card.id, place: card.place, h3: card.h3 }, nodes);
    out[card.id] = {
      overlapCount: myOverlaps.length,
      focusNodeId: myNeeds[0]?.id,
      rounds: rounds
        .filter((r) => r.eligibleNeedIds.some((id) => myNeedIds.has(id)))
        .map((r) => ({ id: r.id, title: r.title })),
      committed,
      pledges: pledges.filter((p) => p.possibilityId === card.id).length,
      claimId: claims.find((c) => c.possibilityId === card.id)?.id,
      hasReport: !!card.report,
      trail,
      seats: seats.filter((s) => s.possibilityId === card.id)
        .map((s) => ({ actor: s.actor, role: s.role })),
      posts: posts.filter((f) => f.possibilityId === card.id)
        .map((f) => ({ id: f.id, parentId: f.parentId, actor: f.actor, kind: f.kind, text: f.text, at: f.at })),
      notes: apps.filter((a) => a.possibilityId === card.id && a.note.trim())
        .map((a) => ({ from: a.fromActor, to: a.toActor, note: a.note })),
      interestCount: interests.filter((i) => i.possibilityId === card.id).length,
      ...(geo ? { geo: { lat: geo.lat, lon: geo.lon } } : {}),
    };
  }
  return out;
}
