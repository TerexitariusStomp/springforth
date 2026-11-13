import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import {
  Appreciation, Attestation, Donation, ExternalScore, ForumPost, FundingRound,
  ImpactClaim, OracleCheck, Participation, Pledge, Possibility,
  RecurringSupport, TrustEpoch, YieldStream,
} from './entities.ts';
import type { PlanNode } from './graph.ts';
import { endowmentAccrual } from './gate.ts';
import { get, ledgerAppend, list, listWhere, put } from './store.js';

// Ops export — the pilot charter §5 interface. A read-only materialized
// view of the round as NDJSON, snapshotted so the ops leg polls stored
// bytes instead of recomputing. The manifest is always the last line
// and carries `ledger_head` (the chain head at export cut, identical to
// /ledger/verify's `head`) plus `file_sha256` over every line before it
// — recompute with: sed '$d' ops.ndjson | sha256sum
// Pseudonymous actors: deterministic `a_<hash>` ids, stable across
// daily files, so ops joins records over time without names.

export const OPS_EXPORT_SPEC = 'springforth.ops-export/v1';
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
  head: { seq: number; hash: string };
  generatedAt: string;
  salt?: string;
}

type Line = Record<string, unknown>;
const byAt = (a: Line, b: Line) => String(a.at).localeCompare(String(b.at));

export function buildOpsExport(i: OpsExportInput): {
  body: string;
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
    });
  }

  // commitments — the "I bring" half of the funnel.
  for (const c of [...i.participations].sort(byAt)) {
    lines.push({
      type: 'commitment', id: oid(c.id, salt), possibilityId: c.possibilityId,
      actor: ps(c.actor), at: c.at,
      bringingNodeId: c.bringingNodeId ? oid(c.bringingNodeId, salt) : null, hours: c.hours ?? null,
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
  const seenPairs = new Set<string>();
  for (const a of [...i.appreciations].sort(byAt)) {
    const k = `app:${a.fromActor}>${a.toActor}:${a.possibilityId ?? ''}`;
    if (seenPairs.has(k)) continue;
    seenPairs.add(k);
    lines.push({
      type: 'attestation_edge', via: 'appreciation', id: oid(a.id, salt),
      from: ps(a.fromActor), to: ps(a.toActor),
      possibilityId: a.possibilityId ?? null, at: a.at,
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

  const payload = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  const counts: Record<string, number> = {};
  for (const l of lines) counts[String(l.type)] = (counts[String(l.type)] ?? 0) + 1;
  const manifest = {
    type: 'manifest', spec: OPS_EXPORT_SPEC, generatedAt: i.generatedAt,
    cut: { seq: i.head.seq, ledger_head: i.head.hash },
    counts, records: lines.length,
    file_sha256: digest(payload),
    recompute: "sed '$d' ops.ndjson | sha256sum",
  };
  return { body: payload + JSON.stringify(manifest) + '\n', manifest };
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
}

// Refresh the snapshot only when the ledger head moved — steady-state
// polls cost one head query + one entity read. `force` (POST rebuild)
// rebuilds unconditionally for the pre-D0 sample run.
// Salt resolution: env.EXPORT_SALT wins. With no secret configured, a
// random salt is minted once and persisted under the same kind — server-
// side only, stable across rebuilds. (The previous default, the spec
// string, was documented and therefore dictionary-reversible; existing
// a_/x_ values rotate once at first rebuild under the new salt, which
// the readout should note rather than hide.)
async function exportSalt(env: EnvLike): Promise<string> {
  if (env.EXPORT_SALT) return env.EXPORT_SALT;
  const existing = await get<{ salt: string }>(env.DB, OPS_EXPORT_KIND, 'salt');
  if (existing?.salt) return existing.salt;
  const salt = crypto.randomUUID();
  await put(env.DB, OPS_EXPORT_KIND, 'salt',
    { salt, at: new Date().toISOString() });
  return salt;
}

export async function refreshOpsExport(
  env: EnvLike, opts: { force?: boolean } = {},
): Promise<OpsExportSnapshot> {
  const head = await env.DB
    .prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')
    .first<{ seq: number; hash: string }>();
  const seq = head?.seq ?? -1;
  const headHash = head?.hash ?? '0'.repeat(64);
  const latest = await get<OpsExportSnapshot>(env.DB, OPS_EXPORT_KIND, 'latest');
  if (!opts.force && latest && latest.cut.seq === seq
    && latest.cut.ledger_head === headHash) return latest;

  const generatedAt = new Date().toISOString();
  const [
    possibilities, participations, linkedNodes, appreciations, attestations,
    checks, forumEvidence, claims, pledges, donations, streams, yields, rounds,
    epochs, externalScores,
  ] = await Promise.all([
    list<Possibility>(env.DB, 'possibility'),
    list<Participation>(env.DB, 'participation'),
    listWhere<PlanNode>(env.DB, 'plannode',
      "json_extract(json,'$.possibilityId') IS NOT NULL"),
    list<Appreciation>(env.DB, 'appreciation'),
    list<Attestation>(env.DB, 'attestation'),
    listWhere<OracleCheck>(env.DB, 'oracle-check',
      "COALESCE(json_extract(json,'$.demo'),0)=0"),
    listWhere<ForumPost>(env.DB, 'forum-post',
      "json_extract(json,'$.kind')='evidence'"),
    list<ImpactClaim>(env.DB, 'claim'),
    list<Pledge>(env.DB, 'pledge'),
    list<Donation>(env.DB, 'donation'),
    list<RecurringSupport>(env.DB, 'recurring-support'),
    list<YieldStream>(env.DB, 'yieldstream'),
    list<FundingRound>(env.DB, 'round'),
    list<TrustEpoch>(env.DB, 'trust-epoch'),
    list<ExternalScore>(env.DB, 'external-score'),
  ]);

  const { body, manifest } = buildOpsExport({
    possibilities, participations, linkedNodes, appreciations, attestations,
    checks, forumEvidence, claims, pledges, donations, streams, yields, rounds,
    epochs, externalScores,
    head: { seq, hash: headHash }, generatedAt,
    salt: await exportSalt(env),
  });
  const snap: OpsExportSnapshot = {
    day: generatedAt.slice(0, 10), generatedAt,
    cut: { seq, ledger_head: headHash },
    counts: manifest.counts as Record<string, number>,
    records: manifest.records as number,
    file_sha256: manifest.file_sha256 as string, body,
  };
  await put(env.DB, OPS_EXPORT_KIND, 'latest', snap);
  // Dated file = last build of that UTC day; overwritten same-day is
  // idempotent because the payload is a pure function of the cut. A
  // failed dated write is recorded, not swallowed — a missing day is
  // explainable from the ledger rather than a silent hole.
  await put(env.DB, OPS_EXPORT_KIND, `day-${snap.day}`, snap)
    .catch(async (e) => {
      console.error('ops-export: dated snapshot write failed', snap.day, e);
      await ledgerAppend(env.DB, 'ops-export', 'ops-export.snapshot_failed',
        { day: snap.day, seq, error: String(e) }).catch(() => undefined);
    });
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
