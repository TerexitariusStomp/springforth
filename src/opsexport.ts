import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import {
  AccessExclusion, Amendment, Appreciation, Attestation, BaselineReport,
  CommitmentPool, CoordinationEffort, CouncilDecision, Dispute, Donation,
  Exit, Exposure, ExternalScore, ForumPost, FundingRound, ImpactClaim,
  Interest, Intervention, OracleCheck, OpsReport, OutcomeReport,
  Participation, Pass, Pledge, PoolExchange, Possibility, Question,
  Readout, RecurringSupport, Referral, TestCard, TrustEpoch, Voucher,
  VoucherHolding, VoucherRedemption, YieldStream,
} from './entities.ts';
import type { PlanNode } from './graph.ts';
import { endowmentAccrual } from './gate.ts';
import { del, get, ledgerAppend, listWhere, put, putIfAbsent } from './store.js';

// Ops export — the pilot charter §5 interface. A read-only materialized
// view of the round as NDJSON, snapshotted so the ops leg polls stored
// bytes instead of recomputing. The manifest is always the last line
// and carries `ledger_head` (the chain head at export cut, identical to
// /ledger/verify's `head`) plus `file_sha256` over every line before it
// — recompute with: sed '$d' ops.ndjson | sha256sum
// Pseudonymous actors: deterministic `a_<hash>` ids, stable across
// daily files, so ops joins records over time without names.

export const OPS_EXPORT_SPEC = 'springforth.ops-export/v1';
// OpenTimestamps public calendars — shared by the ledger-head lane
// (index.ts) and the dated-snapshot lane below. Free, keyless.
export const OTS_CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];
// Additive schema level — record types added post-v1 bump the revision,
// not the spec: v1 consumers keep parsing. History in docs/OPS-EXPORT.md.
export const OPS_EXPORT_REVISION = 'v1.6';
export const OPS_EXPORT_KIND = 'ops-export';

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// Pseudonymous, not anonymous — a stable courtesy layer over actor ids
// that are already handles. env.EXPORT_SALT overrides; absent a secret,
// refreshOpsExport resolves a random salt minted once and persisted
// server-side. The spec string is never a production salt — a public
// salt makes pseudonyms dictionary-reversible.
export const pseudonym = (actor: string, salt = OPS_EXPORT_SPEC) =>
  `a_${digest(`${salt}:${actor}`).slice(0, 16)}`;

// Opaque identifiers — record ids and id-shaped join fields get the same
// salted-hash treatment as actors. Entity ids embed handles and text
// ('app-a-b', 'part-…-offer-name', 'fp-…-post-title', claim-artifact
// '${claim}:${uri}'), so shipping them raw defeats the actor pseudonyms.
// Same input → same output, so every join the readout needs still holds;
// the ':id:' namespace keeps x_ values disjoint from a_ actor hashes.
const oid = (x: string, salt: string) =>
  `x_${digest(`${salt}:id:${x}`).slice(0, 16)}`;

export interface OpsExportInput {
  possibilities: Possibility[];
  participations: Participation[];
  linkedNodes: PlanNode[];        // plannodes carrying possibilityId
  appreciations: Appreciation[];
  attestations: Attestation[];
  checks: OracleCheck[];          // demo rows excluded upstream
  forumEvidence: ForumPost[];     // kind === 'evidence' only
  claims: ImpactClaim[];
  pledges: Pledge[];
  donations: Donation[];
  streams: RecurringSupport[];
  yields: YieldStream[];
  rounds: FundingRound[];
  epochs?: TrustEpoch[];
  externalScores?: ExternalScore[];
  // CPP lane — commitment pools (docs/CPP.md, docs/CLC-INTEGRATION.md)
  vouchers?: Voucher[];
  holdings?: VoucherHolding[];
  pools?: CommitmentPool[];
  exchanges?: PoolExchange[];
  redemptions?: VoucherRedemption[];
  clcTracks?: ClcTrack[];
  // Validation-hardening lane (2026-11 Alena review): the denominator —
  // failed tests, disputes, self-reported offline coordination, effort,
  // baselines, published readouts, and OTS anchors.
  tests?: TestCard[];
  opsReports?: OpsReport[];
  efforts?: CoordinationEffort[];
  baselines?: BaselineReport[];
  readouts?: Readout[];
  disputes?: Dispute[];
  anchors?: AnchorRow[];
  // Beacon-review lane (2026-11): the full event stream — outcomes,
  // exposures, interventions, churn, access exclusion, amendments —
  // plus export coverage for entities that existed but were invisible
  // to reviewers (referrals, interests, questions, council decisions).
  outcomes?: OutcomeReport[];
  exposures?: Exposure[];
  interventions?: Intervention[];
  exits?: Exit[];
  accessExclusions?: AccessExclusion[];
  amendments?: Amendment[];
  referrals?: Referral[];
  interests?: Interest[];
  questions?: Question[];
  decisions?: CouncilDecision[];
  passes?: Pass[];
  head: { seq: number; hash: string };
  generatedAt: string;
  salt?: string;
  build?: string;                 // deployed revision (env.BUILD_ID)
}

// Attribution record for a CLC transaction a Springforth flow
// coordinated — POST /clc/track writes these.
export interface ClcTrack {
  id: string; trackingId?: string; txHash?: string;
  possibilityId?: string; actor: string; status: string;
  chainId?: number; at: string;
  confirmedAt?: string; blockNumber?: number; exchanges?: string[];
}

// OTS anchor rows (kind 'anchor') — written by the /ledger/anchor lane
// (subject 'ledger-head') and the dated-snapshot lane ('export-file').
export interface AnchorRow {
  id: string; seq: number; hash: string; calendar: string;
  receipt: string; status: string; submittedAt: string; upgradedAt?: string;
  subject?: 'ledger-head' | 'export-file';
}

type Line = Record<string, unknown>;
const byAt = (a: Line, b: Line) => String(a.at).localeCompare(String(b.at));

export function buildOpsExport(i: OpsExportInput): {
  body: string;
  payload: string;              // pre-manifest lines — what file_sha256 covers
  manifest: Record<string, unknown>;
} {
  const salt = i.salt ?? OPS_EXPORT_SPEC;
  const ps = (a: string) => pseudonym(a, salt);
  const nodesByPoss = new Map<string, PlanNode[]>();
  for (const n of i.linkedNodes) {
    if (!n.possibilityId) continue;
    nodesByPoss.set(n.possibilityId, [...(nodesByPoss.get(n.possibilityId) ?? []), n]);
  }
  const partsByPoss = new Map<string, Participation[]>();
  for (const p of i.participations) {
    partsByPoss.set(p.possibilityId, [...(partsByPoss.get(p.possibilityId) ?? []), p]);
  }
  const nodePoss = new Map<string, string>();
  for (const n of i.linkedNodes) if (n.possibilityId) nodePoss.set(n.id, n.possibilityId);

  const lines: Line[] = [];

  // declared → the funnel's first stage.
  for (const p of [...i.possibilities].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const nodes = nodesByPoss.get(p.id) ?? [];
    lines.push({
      type: 'declaration', possibilityId: p.id, actor: ps(p.declarerId),
      at: p.createdAt, status: p.status,
      threshold: { min: p.minParticipants, max: p.maxParticipants ?? null },
      needs: nodes.filter((n) => n.kind === 'need')
        .map((n) => ({ id: oid(n.id, salt), required: n.required ?? false, category: n.category ?? null })),
      brings: nodes.filter((n) => n.kind === 'offer').map((n) => oid(n.id, salt)),
      deadline: p.deadline ?? null, place: p.place ?? null, h3: p.h3 ?? null,
      cohort: p.cohort ?? null, arm: p.arm ?? null,
      facilitation: p.facilitation ?? null,
      occasion: p.occasion ?? null, beneficiary: p.beneficiary ?? null,
    });
  }

  // commitments — the "I bring" half of the funnel.
  for (const c of [...i.participations].sort(byAt)) {
    lines.push({
      type: 'commitment', id: oid(c.id, salt), possibilityId: c.possibilityId,
      actor: ps(c.actor), at: c.at,
      bringingNodeId: c.bringingNodeId ? oid(c.bringingNodeId, salt) : null, hours: c.hours ?? null,
      source: c.source ?? null, relation: c.relation ?? null,
    });
  }

  // quorum — activation cut. committed = declarer + participants whose
  // join landed at or before activation.
  for (const p of i.possibilities.filter((x) => x.quorumAt)) {
    const joined = (partsByPoss.get(p.id) ?? [])
      .filter((c) => c.at <= p.quorumAt!)
      .map((c) => ps(c.actor));
    lines.push({
      type: 'quorum', possibilityId: p.id, activated_at: p.quorumAt,
      committed: [...new Set([ps(p.declarerId), ...joined])],
    });
  }

  // delivery evidence — pointers, never footage. URIs ship hashed;
  // free-text refs ship only a hash.
  for (const c of [...i.checks].sort(byAt)) {
    lines.push({
      type: 'evidence', id: oid(c.id, salt), via: 'oracle-check', source: c.source,
      nodeId: c.nodeId ? oid(c.nodeId, salt) : null, possibilityId: c.nodeId ? nodePoss.get(c.nodeId) ?? null : null,
      result: c.result, score: c.score,
      refHash: digest(`${c.methodologyRef ?? ''}:${c.detail}`), at: c.at,
    });
  }
  for (const f of [...i.forumEvidence].sort(byAt)) {
    lines.push({
      type: 'evidence', id: oid(f.id, salt), via: 'forum-post', possibilityId: f.possibilityId,
      actor: ps(f.actor), textHash: digest(f.text), at: f.at,
    });
  }
  for (const p of i.possibilities.filter((x) => x.report?.evidence)) {
    lines.push({
      type: 'evidence', id: oid(`report-${p.id}`, salt), via: 'report', possibilityId: p.id,
      textHash: digest(p.report!.evidence), at: p.report!.at,
    });
  }
  for (const c of i.claims) {
    for (const ref of c.artifactRefs) {
      lines.push({
        type: 'evidence', id: oid(`${c.id}:${ref}`, salt), via: 'claim-artifact',
        claimId: oid(c.id, salt), possibilityId: c.possibilityId ?? null,
        uriHash: digest(ref), at: c.createdAt,
      });
    }
  }

  // claims — every claim an edge can target gets a row, evidence or
  // none: absent evidence is a state, not an omission. Without this an
  // outside reviewer can't distinguish unsupported from out-of-scope.
  for (const c of [...i.claims].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    lines.push({
      type: 'claim', claimId: oid(c.id, salt), possibilityId: c.possibilityId ?? null,
      state: c.state, contributors: c.contributors.map(ps),
      nodeIds: c.nodeIds.map((n) => oid(n, salt)),
      checks: c.oracleCheckIds.length, appreciations: c.appreciationIds.length,
      artifacts: c.artifactRefs.length, scopeHash: digest(c.workScope), at: c.createdAt,
    });
  }

  // attestation edges — attester→subject, once per pair (earliest wins).
  // attesterCount = distinct attesters per subject across BOTH lanes —
  // the charter's ≥3-distinct-attesters rule becomes checkable in-file.
  const attestCount = new Map<string, Set<string>>();
  const bumpAttest = (to: string, from: string) => {
    if (!to) return;
    attestCount.set(to, (attestCount.get(to) ?? new Set()).add(from));
  };
  for (const a of [...i.appreciations]) bumpAttest(a.toActor, a.fromActor);
  for (const a of [...i.attestations]) bumpAttest(a.claimId ?? a.nodeId ?? '', a.attester);
  const seenPairs = new Set<string>();
  for (const a of [...i.appreciations].sort(byAt)) {
    const k = `app:${a.fromActor}>${a.toActor}:${a.possibilityId ?? ''}`;
    if (seenPairs.has(k)) continue;
    seenPairs.add(k);
    lines.push({
      type: 'attestation_edge', via: 'appreciation', id: oid(a.id, salt),
      from: ps(a.fromActor), to: ps(a.toActor),
      possibilityId: a.possibilityId ?? null, at: a.at,
      attesterCount: attestCount.get(a.toActor)?.size ?? 1,
    });
  }
  for (const a of [...i.attestations].sort(byAt)) {
    const to = a.claimId ?? a.nodeId ?? '';
    const k = `att:${a.attester}>${to}`;
    if (seenPairs.has(k)) continue;
    seenPairs.add(k);
    lines.push({
      type: 'attestation_edge', via: 'attestation', id: oid(a.id, salt),
      // Claim targets oid-join the claim rows above; node targets oid-join
      // needs[].id / evidence.nodeId / needNodeId — same function, same salt.
      from: ps(a.attester), to: to ? oid(to, salt) : '', schemaRef: a.schemaRef, uid: a.uid ?? null, at: a.at,
      attesterCount: attestCount.get(to)?.size ?? 1,
    });
  }

  // match flow amounts — every lane, one record each.
  for (const r of i.rounds) {
    lines.push({
      type: 'match_flow', lane: 'matching_fund', id: oid(r.id, salt), roundId: r.id,
      amount: r.matchingFund.amount, currency: r.matchingFund.currency,
      state: r.state, endowment: r.endowment ?? false,
      skimBps: r.skimBps ?? 0, upstreamSplitBps: r.upstreamSplitBps ?? 0,
      at: r.opensAt,
    });
  }
  // revshare lane — accrued skim (revshareBps of each settled donation
  // into the round) and upstream split, derived like gate.ts
  // endowmentAccrual: the ledger stays the record, this is a pointer to
  // what accrues to the endowment. Emitted only when nonzero.
  {
    const { accrued } = endowmentAccrual(i.rounds,
      i.donations.filter((d) => d.settlement === 'settled'));
    for (const [currency, amount] of Object.entries(accrued)) {
      if (amount <= 0) continue;
      lines.push({
        type: 'match_flow', lane: 'revshare', id: `revshare-${currency}`,
        currency, amount: Math.round(amount * 1e6) / 1e6,
        state: 'accrued', at: i.generatedAt,
      });
    }
  }
  for (const p of [...i.pledges].sort((a, b) => a.stateAt.localeCompare(b.stateAt))) {
    lines.push({
      type: 'match_flow', lane: 'pledge', id: oid(p.id, salt), possibilityId: p.possibilityId,
      needNodeId: p.needNodeId ? oid(p.needNodeId, salt) : null, actor: ps(p.pledger),
      amount: p.amount, currency: p.currency, state: p.state, at: p.stateAt,
    });
  }
  for (const d of [...i.donations].sort(byAt)) {
    lines.push({
      type: 'match_flow', lane: 'donation', id: oid(d.id, salt), roundId: d.roundId,
      needNodeId: d.needNodeId ? oid(d.needNodeId, salt) : null, actor: ps(d.donor),
      amount: d.amount, currency: d.currency, state: d.settlement,
      settlementRef: d.settlementRef ?? null, at: d.at,
    });
  }
  for (const s of i.streams) {
    lines.push({
      type: 'match_flow', lane: 'stream', id: oid(s.id, salt), roundId: s.roundId,
      needNodeId: s.needNodeId ? oid(s.needNodeId, salt) : null, actor: ps(s.supporter),
      flowRate: s.flowRate, accruedUnits: s.accruedUnits, state: s.state,
      at: s.createdAt,
    });
  }
  for (const y of i.yields) {
    lines.push({
      type: 'match_flow', lane: 'yield', id: oid(y.id, salt), roundId: y.roundId,
      actor: ps(y.sponsor), amount: y.yieldAccrued,
      state: y.state, at: y.updatedAt,
    });
  }

  // trust epochs — journal pointers, not score blobs: a reviewer
  // fetches /trust/epochs/:n/inputs.json + /scores.json against the
  // same cut and recomputes (docs/TRUSTGRAPH.md).
  for (const e of [...(i.epochs ?? [])].sort((a, b) => a.epoch - b.epoch)) {
    lines.push({
      type: 'trust_epoch', epoch: e.epoch,
      program: `${e.program}/v${e.programVersion}`,
      cut: { seq: e.cut.seq, ledger_head: e.cut.ledgerHead },
      inputHash: e.inputHash, paramsHash: e.paramsHash,
      outputRoot: e.outputRoot, totalValue: e.totalValue,
      scoresHash: e.scoresHash, edgeCount: e.edgeCount, actorCount: e.actorCount,
      at: e.createdAt,
    });
  }

  // external trust — entries verified against a trustgraphs network's
  // accepted root (phase 3). `account` stays raw: it's the public leaf
  // key the proof checks against; `actor` pseudonymizes as usual.
  for (const s of i.externalScores ?? []) {
    lines.push({
      type: 'external_trust', id: oid(s.id, salt), network: s.network,
      root: s.root, account: s.account, actor: ps(s.actor),
      value: s.value, totalValue: s.totalValue, at: s.verifiedAt,
    });
  }

  // CPP lane — the pooling readout Will Ruddick named: exchanges,
  // redemption, fulfillment, and pool sustainability as records, not
  // narrative. holdings = the circulating-inventory snapshot.
  // CLC lane — pools/vouchers/exchanges carry observation provenance:
  // `source` distinguishes projections from local records, `chainAddress`
  // + `chainId` + `chainRef` are the verification join (emitted raw —
  // public on-chain data, deliberately not pseudonymized).
  for (const v of [...(i.vouchers ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    lines.push({
      type: 'voucher', id: oid(v.id, salt), issuer: ps(v.issuer), unit: v.unit,
      supply: v.supply, state: v.state, termsHash: digest(v.terms), at: v.createdAt,
      source: v.source ?? 'local',
      chainAddress: v.chainAddress ?? null, chainId: v.chainId ?? null,
      observedAt: v.observedAt ?? null,
    });
  }
  for (const h of [...(i.holdings ?? [])].sort(byAt)) {
    lines.push({
      type: 'holding', id: oid(h.id, salt), holder: ps(h.holder),
      voucherId: oid(h.voucherId, salt), amount: h.amount, at: h.updatedAt,
      source: h.source ?? 'local', chainRef: h.chainRef ?? null,
    });
  }
  for (const p of [...(i.pools ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    lines.push({
      type: 'pool', id: oid(p.id, salt), operator: ps(p.operator), indexUnit: p.indexUnit,
      accepted: p.accepted.map((a) => ({
        voucherId: oid(a.voucherId, salt), rate: a.rate, limit: a.limit, state: a.state })),
      poolFeeBps: p.poolFeeBps, protocolFeeBps: p.protocolFeeBps,
      state: p.state, at: p.createdAt,
      source: p.source ?? 'local',
      chainAddress: p.chainAddress ?? null, chainId: p.chainId ?? null,
      observedAt: p.observedAt ?? null,
      sealState: p.sealState ?? null, feeAddress: p.feeAddress ?? null,
      quoterType: p.quoterType ?? null,
    });
  }
  for (const x of [...(i.exchanges ?? [])].sort(byAt)) {
    lines.push({
      type: 'pool_exchange', id: oid(x.id, salt), poolId: oid(x.poolId, salt),
      actor: ps(x.actor),
      give: { voucherId: oid(x.give.voucherId, salt), amount: x.give.amount },
      receive: { voucherId: oid(x.receive.voucherId, salt), amount: x.receive.amount },
      fees: { voucherId: oid(x.fees.voucherId, salt), pool: x.fees.pool, protocol: x.fees.protocol },
      rates: x.rates, at: x.at,
      source: x.source ?? 'local', chainRef: x.chainRef ?? null,
    });
  }
  for (const r of [...(i.redemptions ?? [])].sort(byAt)) {
    lines.push({
      type: 'redemption', id: oid(r.id, salt), voucherId: oid(r.voucherId, salt),
      holder: ps(r.holder), amount: r.amount, state: r.state,
      at: r.at, resolvedAt: r.resolvedAt ?? null, chainRef: r.chainRef ?? null,
    });
  }
  for (const t of [...(i.clcTracks ?? [])]
    .sort((a, b) => a.at.localeCompare(b.at))) {
    lines.push({
      type: 'clc_track', id: oid(t.id, salt),
      trackingId: t.trackingId ?? null, txHash: t.txHash ?? null,
      possibilityId: t.possibilityId ? oid(t.possibilityId, salt) : null,
      actor: ps(t.actor), status: t.status,
      chainId: t.chainId ?? null, at: t.at,
      confirmedAt: t.confirmedAt ?? null, blockNumber: t.blockNumber ?? null,
      exchanges: t.exchanges ?? null,
    });
  }

  // ops-report lane — self-reported offline coordination. verification
  // stays 'self-reported' forever: the ledger records the claim, the
  // label is the honesty boundary (Alena's observational-completeness
  // point — off-platform activity gets an attributed lane, not silence).
  for (const r of [...(i.opsReports ?? [])].sort(byAt)) {
    lines.push({
      type: 'evidence', id: oid(r.id, salt), via: 'ops-report',
      possibilityId: r.possibilityId ?? null, actor: ps(r.actor),
      channel: r.channel, textHash: digest(r.text),
      verification: 'self-reported', at: r.at,
    });
  }

  // test resolutions — failed experiments are evidence too (the
  // denominator includes what didn't work).
  for (const t of [...(i.tests ?? [])].sort((a, b) => a.at.localeCompare(b.at))) {
    lines.push({
      type: 'test_resolution', id: oid(t.id, salt), possibilityId: t.possibilityId,
      questionId: t.questionId ? oid(t.questionId, salt) : null,
      actor: ps(t.actor), state: t.state, runner: t.runner ? ps(t.runner) : null,
      beliefHash: digest(t.belief), failState: t.failState || null,
      result: t.result ? { actor: ps(t.result.actor), textHash: digest(t.result.text), at: t.result.at } : null,
      at: t.at, resolvedAt: t.resolvedAt ?? null,
    });
  }

  // disputes — flags are events, never edits; contested evidence stays
  // visible in the denominator.
  for (const d of [...(i.disputes ?? [])].sort(byAt)) {
    lines.push({
      type: 'dispute', id: oid(d.id, salt), targetKind: d.targetKind,
      targetId: oid(d.targetId, salt), by: ps(d.by), reasonHash: digest(d.reason),
      state: d.state, at: d.at, resolvedAt: d.resolvedAt ?? null,
    });
  }

  // coordination effort — self-reported hours; the denominator of the
  // coordination-leverage metric. Always labeled.
  for (const e of [...(i.efforts ?? [])].sort(byAt)) {
    lines.push({
      type: 'coordination_effort', id: oid(e.id, salt), week: e.week,
      actor: ps(e.actor), possibilityId: e.possibilityId ? oid(e.possibilityId, salt) : null,
      hours: e.hours, activity: e.activity || null,
      selfReported: true, at: e.at,
    });
  }

  // baseline reports — pre-platform coordination stats, self-reported.
  for (const b of [...(i.baselines ?? [])].sort(byAt)) {
    lines.push({
      type: 'baseline_report', id: oid(b.id, salt), cohort: oid(b.cohort, salt),
      actor: ps(b.actor), period: b.period, summaryHash: digest(b.summary),
      collector: b.collector ?? null, at: b.at,
    });
  }

  // readouts — published results as ledgered artifacts; negative/null
  // outcomes are first-class.
  for (const r of [...(i.readouts ?? [])].sort(byAt)) {
    lines.push({
      type: 'readout', id: oid(r.id, salt),
      possibilityId: r.possibilityId ? oid(r.possibilityId, salt) : null,
      roundId: r.roundId ? oid(r.roundId, salt) : null,
      titleHash: digest(r.title), result: r.result, bodyHash: digest(r.body),
      decision: r.decision ?? null, confidence: r.confidence ?? null,
      nextEvidenceHash: r.nextEvidence ? digest(r.nextEvidence) : null,
      decisionOwner: r.decisionOwner ?? null, reviewDate: r.reviewDate ?? null,
      sampleRationaleHash: r.sampleRationale ? digest(r.sampleRationale) : null,
      actor: ps(r.actor), at: r.at, publishedAt: r.publishedAt ?? null,
    });
  }

  // outcome reports — the post-encounter instrument (IER/NPOR/energy
  // delta/repeat-intention probes). selfReported forever; collector and
  // lang follow the enumerator-survey method so a filed survey says who
  // administered it and in what language.
  for (const o of [...(i.outcomes ?? [])].sort(byAt)) {
    lines.push({
      type: 'outcome_report', id: oid(o.id, salt), possibilityId: o.possibilityId,
      actor: ps(o.actor), outcome: o.outcome, energyDelta: o.energyDelta ?? null,
      wouldRepeat: o.wouldRepeat ?? null, incremental: o.incremental ?? null,
      costReportHash: o.costReport ? digest(o.costReport) : null,
      collector: o.collector, lang: o.lang ?? null,
      selfReported: true, at: o.at,
    });
  }

  // exposures — first-view reach. Platform-observed (the one record that
  // is), entity-backed rather than ledger-backed: each row is the fact
  // that a named actor's deck served this card. Reach, never attention.
  for (const x of [...(i.exposures ?? [])].sort(byAt)) {
    lines.push({
      type: 'exposure', id: oid(x.id, salt), possibilityId: x.possibilityId,
      actor: ps(x.actor), via: 'deck-serve', attribution: 'self-asserted', at: x.at,
    });
  }

  // referrals — organic invites (the event stream's distribution probe).
  for (const r of [...(i.referrals ?? [])].sort(byAt)) {
    lines.push({
      type: 'referral', id: oid(r.id, salt), possibilityId: r.possibilityId,
      fromActor: ps(r.fromActor), toActor: ps(r.toActor),
      noteHash: digest(r.note), at: r.at,
    });
  }

  // interests — warm intent short of joining.
  for (const n of [...(i.interests ?? [])].sort(byAt)) {
    lines.push({
      type: 'interest', id: oid(n.id, salt), possibilityId: n.possibilityId,
      actor: ps(n.actor), level: n.level ?? null,
      source: n.source ?? null, relation: n.relation ?? null, at: n.at,
    });
  }

  // questions — intention responses (engaged-curiosity, askable).
  for (const q of [...(i.questions ?? [])].sort(byAt)) {
    lines.push({
      type: 'question', id: oid(q.id, salt), possibilityId: q.possibilityId,
      actor: ps(q.actor), state: q.state, textHash: digest(q.text),
      answer: q.answer
        ? { actor: ps(q.answer.actor), textHash: digest(q.answer.text), at: q.answer.at }
        : null,
      at: q.at,
    });
  }

  // council decisions — the consent trail; rationale mandatory on resolve.
  for (const d of [...(i.decisions ?? [])].sort(byAt)) {
    lines.push({
      type: 'council_decision', id: oid(d.id, salt), possibilityId: d.possibilityId,
      titleHash: digest(d.title), mode: d.mode, proposer: ps(d.proposer),
      decider: d.decider ? ps(d.decider) : null, state: d.state,
      outcome: d.outcome ?? null,
      rationaleHash: d.rationale ? digest(d.rationale) : null,
      responses: d.responses.map((r) => ({
        actor: ps(r.actor), kind: r.kind, textHash: digest(r.text), at: r.at,
      })),
      closesAt: d.closesAt ?? null, at: d.createdAt,
    });
  }

  // pass summaries — per-card AGGREGATE counts only. Passes are
  // demand-shape data, never identity: the viewer-scoped privacy
  // invariant holds in the export (no actor field exists here).
  const passCounts = new Map<string, number>();
  for (const p of i.passes ?? []) {
    passCounts.set(p.possibilityId, (passCounts.get(p.possibilityId) ?? 0) + 1);
  }
  for (const [possibilityId, count] of [...passCounts].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push({ type: 'pass_summary', possibilityId, count });
  }

  // interventions — explicit ops/organizer actions: the ADR denominator.
  for (const x of [...(i.interventions ?? [])].sort(byAt)) {
    lines.push({
      type: 'intervention', id: oid(x.id, salt), interventionType: x.type,
      targetKind: x.targetKind, targetId: oid(x.targetId, salt),
      channel: x.channel || null, actor: ps(x.actor), at: x.at,
    });
  }

  // exits — churn records.
  for (const x of [...(i.exits ?? [])].sort(byAt)) {
    lines.push({
      type: 'exit', id: oid(x.id, salt), actor: ps(x.actor),
      reasonHash: x.reason ? digest(x.reason) : null, at: x.at,
    });
  }

  // access exclusions — ops-observed channel exclusions, aggregate only.
  for (const x of [...(i.accessExclusions ?? [])].sort(byAt)) {
    lines.push({
      type: 'access_exclusion', id: oid(x.id, salt), channel: x.channel,
      reason: x.reason, count: x.count, actor: ps(x.actor), at: x.at,
    });
  }

  // amendments — labeled post-hoc changes; governance visibility.
  for (const a of [...(i.amendments ?? [])].sort(byAt)) {
    lines.push({
      type: 'amendment', id: oid(a.id, salt), subject: a.subject,
      field: a.field, oldValue: a.oldValue, newValue: a.newValue,
      reasonHash: digest(a.reason), approver: ps(a.approver),
      independent: a.independent, effectiveSeq: a.effectiveSeq ?? null, at: a.at,
    });
  }

  // OTS anchors — external timestamp proofs over ledger heads. Raw seq
  // + hash stay un-pseudonymized: they're public chain data by design.
  for (const a of [...(i.anchors ?? [])].sort((x, y) => x.seq - y.seq)) {
    lines.push({
      type: 'anchor', id: oid(a.id, salt), seq: a.seq, hash: a.hash,
      subject: a.subject ?? (a.id.startsWith('anchor-file-') ? 'export-file' : 'ledger-head'),
      calendar: new URL(a.calendar).host, status: a.status,
      submittedAt: a.submittedAt, upgradedAt: a.upgradedAt ?? null,
      receiptBytes: a.receipt.length,
    });
  }

  const payload = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  const counts: Record<string, number> = {};
  for (const l of lines) counts[String(l.type)] = (counts[String(l.type)] ?? 0) + 1;
  // The funnel — the denominator Alena asked for, computed from the cut:
  // every declared card lands somewhere, including the ones that failed.
  const funnel = {
    declared: i.possibilities.length,
    quorum: i.possibilities.filter((p) => p.quorumAt).length,
    completed: i.possibilities.filter((p) => p.status === 'completed').length,
    expired: i.possibilities.filter((p) => p.status === 'expired').length,
    disputed: (i.disputes ?? []).length,
    testFailed: (i.tests ?? []).filter((t) => t.state === 'failed').length,
    surveyed: (i.outcomes ?? []).length,
    interventions: (i.interventions ?? []).length,
    exits: (i.exits ?? []).length,
    amendments: (i.amendments ?? []).length,
  };
  const manifest = {
    type: 'manifest', spec: OPS_EXPORT_SPEC, revision: OPS_EXPORT_REVISION,
    generatedAt: i.generatedAt,
    build: i.build ?? null,
    cut: { seq: i.head.seq, ledger_head: i.head.hash },
    counts, records: lines.length, funnel,
    file_sha256: digest(payload),
    recompute: "sed '$d' ops.ndjson | sha256sum",
  };
  return { body: payload + JSON.stringify(manifest) + '\n', payload, manifest };
}

// Manifest signing — upgrades the export to a SCITT 'signed statement':
// a reviewer with the published key verifies the operator issued THIS
// cut, not just that the file is self-consistent. Ed25519 via jose
// (dynamic import — the signing path stays out of the hot bundle).
// EXPORT_SIGNING_JWK is a full JWK (has 'd'); the public half serves
// /.well-known/springforth-keys.json. Absent key → signature: null,
// exported honestly rather than omitted.
async function signManifest(
  env: EnvLike, manifest: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const jwkJson = (env as { EXPORT_SIGNING_JWK?: string }).EXPORT_SIGNING_JWK;
  if (!jwkJson) return { ...manifest, signature: null, keyId: null };
  try {
    const { importJWK, SignJWT } = await import('jose');
    const jwk = JSON.parse(jwkJson) as Record<string, unknown>;
    const key = await importJWK(jwk as Parameters<typeof importJWK>[0], 'Ed25519');
    const cut = manifest.cut as { seq: number; ledger_head: string };
    const signingInput = `${manifest.file_sha256}:${cut.ledger_head}:${cut.seq}`;
    const kid = `sf-export-${digest(String(jwk.x ?? '')).slice(0, 12)}`;
    const signature = await new SignJWT({ signingInput })
      .setProtectedHeader({ alg: 'EdDSA', kid })
      .sign(key);
    return { ...manifest, signature, keyId: kid };
  } catch {
    return { ...manifest, signature: null, keyId: null, signatureError: true };
  }
}

// The public half of the signing key, as a JWK — what the well-known
// endpoint serves and what verify-export.mjs verifies against.
export async function exportVerifyJwk(env: EnvLike): Promise<Record<string, unknown> | null> {
  const jwkJson = (env as { EXPORT_SIGNING_JWK?: string }).EXPORT_SIGNING_JWK;
  if (!jwkJson) return null;
  try {
    // The public JWK is the stored JWK minus 'd' — no key import needed
    // (imported CryptoKeys default non-extractable, which made exportJWK
    // throw and left the well-known serving keys:[]).
    const jwk = JSON.parse(jwkJson) as Record<string, unknown>;
    const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x } as Record<string, unknown>;
    if (!pub.x) return null;
    pub.kid = `sf-export-${digest(String(pub.x)).slice(0, 12)}`;
    pub.use = 'sig'; pub.alg = 'EdDSA';
    return pub;
  } catch { return null; }
}

export interface OpsExportSnapshot {
  day: string; generatedAt: string;
  cut: { seq: number; ledger_head: string };
  counts: Record<string, number>; records: number;
  file_sha256: string; body: string;
}

interface EnvLike {
  DB: D1Database;
  EXPORT_SALT?: string;
  BUILD_ID?: string;              // deployed revision, set at deploy time
  EXPORT_SIGNING_JWK?: string;    // full Ed25519 JWK (secret) — manifest signer
}

// Refresh the snapshot only when the ledger head moved — steady-state
// polls cost one head query + one entity read. `force` (POST rebuild)
// rebuilds unconditionally for the pre-D0 sample run.
// Salt resolution: env.EXPORT_SALT wins. With no secret configured, a
// random salt is minted once and persisted under the same kind — server-
// side only, stable across rebuilds. putIfAbsent makes the first write
// atomic: concurrent callers all re-read and return the persisted
// winner, never divergent salts. (The previous default, the spec
// string, was documented and therefore dictionary-reversible; existing
// a_/x_ values rotate once at first rebuild under the new salt, which
// the readout should note rather than hide.)
async function exportSalt(env: EnvLike): Promise<string> {
  if (env.EXPORT_SALT) return env.EXPORT_SALT;
  const existing = await get<{ salt: string }>(env.DB, OPS_EXPORT_KIND, 'salt');
  if (existing?.salt) return existing.salt;
  const minted = { salt: crypto.randomUUID(), at: new Date().toISOString() };
  const winner = await putIfAbsent<{ salt: string }>(env.DB, OPS_EXPORT_KIND, 'salt', minted);
  return winner?.salt ?? minted.salt;
}

// Entity kinds the export materializes, in batch order. The head query
// leads the batch so every read below it describes the same database
// instant — one consistent ledger cut, never head-at-T/entities-at-T′.
const ENTITY_READS: [kind: string, where?: string][] = [
  ['possibility'],
  ['participation'],
  ['plannode', "json_extract(json,'$.possibilityId') IS NOT NULL"],
  ['appreciation'],
  ['attestation'],
  ['oracle-check', "COALESCE(json_extract(json,'$.demo'),0)=0"],
  ['forum-post', "json_extract(json,'$.kind')='evidence'"],
  ['claim'],
  ['pledge'],
  ['donation'],
  ['recurring-support'],
  ['yieldstream'],
  ['round'],
  ['trust-epoch'],
  ['external-score'],
  ['voucher'],
  ['voucher-holding'],
  ['commitment-pool'],
  ['pool-exchange'],
  ['redemption'],
  ['clc-track'],
  ['test'],
  ['ops-report'],
  ['coordination-effort'],
  ['baseline-report'],
  ['readout'],
  ['dispute'],
  ['anchor'],
  ['outcome-report'],
  ['exposure'],
  ['intervention'],
  ['exit'],
  ['access-exclusion'],
  ['amendment'],
  ['referral'],
  ['interest'],
  ['question'],
  ['council-decision'],
  ['pass'],
];

// One atomic read transaction: head + every entity table in a single
// db.batch. A claim that lands mid-build either joins the whole cut
// (head moves with it) or waits for the next one — it can no longer
// appear in an export labelled with a seq its ledger event postdates
// on lanes that write entity+event atomically (store.ledgerAppendWith).
async function snapshotReads(env: EnvLike) {
  const rs = await env.DB.batch<{ seq?: number; hash?: string; json?: string }>([
    env.DB.prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1'),
    ...ENTITY_READS.map(([kind, where]) => env.DB.prepare(
      `SELECT json FROM entities WHERE kind=?${where ? ` AND ${where}` : ''} ORDER BY id`,
    ).bind(kind)),
  ]);
  const head = (rs[0]?.results?.[0] ?? null) as { seq: number; hash: string } | null;
  const rows = rs.slice(1).map((r) =>
    (r.results ?? []).map((x) => JSON.parse(String((x as { json: string }).json))));
  return { head, rows };
}

// Bounded retry for the data write when a marker for identical bytes
// exists: the marker dedupes the failure EVENT (ledger spam) and sets
// nextAttemptAt, but never suppresses the write itself — a transient
// failure that healed must not leave a permanent hole (2026-11
// CoWizardex finding: marker+event-fail left the dated file missing
// forever). New content (different file_sha256) retries immediately.
const SNAPSHOT_RETRY_MS = 10 * 60_000;
// Dated write with a deduped failure marker: a deterministic failure
// (oversized row, missing column) would otherwise retry on every poll —
// appending snapshot_failed, moving the head, and forcing a rebuild,
// forever. The marker keys on file_sha256 so identical bytes produce
// one ledger event per backoff window, not one per request.
// Returns true when the dated row now exists.
async function stampDatedSnapshot(env: EnvLike, snap: OpsExportSnapshot): Promise<boolean> {
  const id = `day-${snap.day}`;
  const failId = `dayfailed-${snap.day}`;
  const prev = await get<{ file_sha256?: string; nextAttemptAt?: string }>(
    env.DB, OPS_EXPORT_KIND, failId);
  const sameFile = prev?.file_sha256 === snap.file_sha256;
  if (sameFile && prev?.nextAttemptAt
    && Date.now() < Date.parse(prev.nextAttemptAt)) return false;
  try {
    await put(env.DB, OPS_EXPORT_KIND, id, snap);
    await del(env.DB, OPS_EXPORT_KIND, failId).catch(() => undefined);
    await anchorDatedFile(env, snap);
    return true;
  } catch (e) {
    console.error('ops-export: dated snapshot write failed', snap.day, e);
    await put(env.DB, OPS_EXPORT_KIND, failId, {
      day: snap.day, file_sha256: snap.file_sha256,
      error: String(e), at: new Date().toISOString(),
      nextAttemptAt: new Date(Date.now() + SNAPSHOT_RETRY_MS).toISOString(),
    }).catch(() => undefined);
    // One failure event per file_sha256 — retries within the backoff
    // window stay silent; a *new* snapshot for the same day always logs.
    if (!sameFile) {
      await ledgerAppend(env.DB, 'ops-export', 'ops-export.snapshot_failed',
        { day: snap.day, seq: snap.cut.seq, error: String(e) }).catch(() => undefined);
    }
    return false;
  }
}

// Dated-snapshot anchoring — submits the day's file_sha256 to the OTS
// calendars once per unique file per day ("this exact export existed
// on this date", independent of the live service). Marker under
// 'anchor-state' id `file-<day>` dedupes identical bytes; new content
// (head moved → new cut → new hash) anchors again. Additive evidence —
// failures never block the export.
async function anchorDatedFile(env: EnvLike, snap: OpsExportSnapshot) {
  try {
    const markerId = `file-${snap.day}`;
    const prev = await get<{ file_sha256?: string }>(env.DB, 'anchor-state', markerId);
    if (prev?.file_sha256 === snap.file_sha256) return;
    const digestBytes = Uint8Array.from(
      snap.file_sha256.match(/../g)!.map((h) => parseInt(h, 16)));
    const at = new Date().toISOString();
    let ok = 0;
    for (const cal of OTS_CALENDARS) {
      const host = new URL(cal).host;
      try {
        const r = await fetch(`${cal}/digest`, { method: 'POST', body: digestBytes });
        if (!r.ok) continue;
        const receipt = btoa(String.fromCharCode(...new Uint8Array(await r.arrayBuffer())));
        await put(env.DB, 'anchor', `anchor-file-${snap.day}-${snap.cut.seq}-${host}`, {
          id: `anchor-file-${snap.day}-${snap.cut.seq}-${host}`,
          seq: snap.cut.seq, hash: snap.file_sha256, subject: 'export-file',
          calendar: cal, receipt, status: 'pending', submittedAt: at,
        });
        ok++;
      } catch { /* calendar unreachable */ }
    }
    if (ok > 0) {
      await put(env.DB, 'anchor-state', markerId, { file_sha256: snap.file_sha256, at });
      await ledgerAppend(env.DB, 'ops-export', 'ops-export.file_anchored',
        { day: snap.day, seq: snap.cut.seq, file_sha256: snap.file_sha256,
          calendars: ok }).catch(() => undefined);
    }
  } catch (e) {
    console.error('ops-export: dated anchor failed', snap.day, e);
  }
}

// Fast-path self-heal: a dated file can be missing when its write AND
// the snapshot_failed event write both failed — an unchanged head must
// not leave that hole unretried (2026-11 review finding). The re-put is
// byte-identical (same stored snapshot), and the heal lands on the
// ledger the same way the failure did.
async function ensureDatedSnapshot(env: EnvLike, snap: OpsExportSnapshot) {
  if (await get(env.DB, OPS_EXPORT_KIND, `day-${snap.day}`)) return;
  if (await stampDatedSnapshot(env, snap)) {
    await ledgerAppend(env.DB, 'ops-export', 'ops-export.snapshot_recovered',
      { day: snap.day, seq: snap.cut.seq }).catch(() => undefined);
  }
}

export async function refreshOpsExport(
  env: EnvLike, opts: { force?: boolean } = {},
): Promise<OpsExportSnapshot> {
  const headNow = await env.DB
    .prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')
    .first<{ seq: number; hash: string }>();
  const latest = await get<OpsExportSnapshot>(env.DB, OPS_EXPORT_KIND, 'latest');
  if (!opts.force && latest && headNow
    && latest.cut.seq === headNow.seq
    && latest.cut.ledger_head === headNow.hash) {
    await ensureDatedSnapshot(env, latest);
    return latest;
  }

  const generatedAt = new Date().toISOString();
  const { head, rows } = await snapshotReads(env);
  const seq = head?.seq ?? -1;
  const headHash = head?.hash ?? '0'.repeat(64);
  const [
    possibilities, participations, linkedNodes, appreciations, attestations,
    checks, forumEvidence, claims, pledges, donations, streams, yields, rounds,
    epochs, externalScores, vouchers, holdings, pools, exchanges, redemptions,
    clcTracks, tests, opsReports, efforts, baselines, readouts, disputes, anchors,
    outcomes, exposures, interventions, exits, accessExclusions, amendments,
    referrals, interests, questions, decisions, passes,
  ] = rows as [
    Possibility[], Participation[], PlanNode[], Appreciation[], Attestation[],
    OracleCheck[], ForumPost[], ImpactClaim[], Pledge[], Donation[],
    RecurringSupport[], YieldStream[], FundingRound[],
    TrustEpoch[], ExternalScore[],
    Voucher[], VoucherHolding[], CommitmentPool[], PoolExchange[], VoucherRedemption[],
    ClcTrack[], TestCard[], OpsReport[], CoordinationEffort[], BaselineReport[],
    Readout[], Dispute[], AnchorRow[],
    OutcomeReport[], Exposure[], Intervention[], Exit[], AccessExclusion[],
    Amendment[], Referral[], Interest[], Question[], CouncilDecision[], Pass[],
  ];

  const { payload, manifest } = buildOpsExport({
    possibilities, participations, linkedNodes, appreciations, attestations,
    checks, forumEvidence, claims, pledges, donations, streams, yields, rounds,
    epochs, externalScores, vouchers, holdings, pools, exchanges, redemptions,
    clcTracks, tests, opsReports, efforts, baselines, readouts, disputes, anchors,
    outcomes, exposures, interventions, exits, accessExclusions, amendments,
    referrals, interests, questions, decisions, passes,
    head: { seq, hash: headHash }, generatedAt,
    salt: await exportSalt(env),
    build: env.BUILD_ID,
  });
  const signed = await signManifest(env, manifest);
  const signedBody = payload + JSON.stringify(signed) + '\n';
  const snap: OpsExportSnapshot = {
    day: generatedAt.slice(0, 10), generatedAt,
    cut: { seq, ledger_head: headHash },
    counts: signed.counts as Record<string, number>,
    records: signed.records as number,
    file_sha256: signed.file_sha256 as string, body: signedBody,
  };
  await put(env.DB, OPS_EXPORT_KIND, 'latest', snap);
  // Dated file = last build of that UTC day; overwritten same-day is
  // idempotent because the payload is a pure function of the cut. A
  // failed dated write is recorded, not swallowed — a missing day is
  // explainable from the ledger rather than a silent hole, and the
  // fast-path self-heal retries it rather than leaving it unfilled.
  await stampDatedSnapshot(env, snap);
  return snap;
}

export async function getOpsExport(
  env: EnvLike, day?: string,
): Promise<OpsExportSnapshot | null> {
  return day
    ? get<OpsExportSnapshot>(env.DB, OPS_EXPORT_KIND, `day-${day}`)
    : get<OpsExportSnapshot>(env.DB, OPS_EXPORT_KIND, 'latest');
}

export async function listOpsExportDays(
  env: EnvLike,
): Promise<Omit<OpsExportSnapshot, 'body'>[]> {
  const days = await listWhere<OpsExportSnapshot>(
    env.DB, OPS_EXPORT_KIND, "id LIKE 'day-%'");
  return days.map(({ body: _body, ...meta }) => meta);
}
