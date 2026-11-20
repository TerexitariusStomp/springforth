import { createHash } from 'node:crypto';
import { concat, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import type { D1Database } from '@cloudflare/workers-types';
import type { Appreciation, GovernanceParam, TrustEpoch, TrustEpochData } from './entities.ts';
import { eigenTrust, trustEdges, type TrustEdge } from './possibility.ts';
import { get, ledgerAppend, list, listWhere, put } from './store.js';

// Trust epochs — the trustgraphs.xyz epoch model applied natively to the
// mutual-recognition graph (spec: docs/TRUSTGRAPH.md). A checkpoint
// freezes the canonical edge set and params at a ledger cut, computes
// the EigenTrust vector, quantizes it into a fixed score pool, and
// publishes a Merkle root anyone can recompute. The ledger is the input
// commitment: replay `possibility.appreciated` events ≤ cut.seq and the
// edge set — and therefore inputHash — is fully determined.
//
// Honest divergence from the external system, stated once: this is a
// *different program* than their standard directed-vouch PageRank
// (ours gates influence on min(a→b,b→a) mutuality), and the proof is
// recompute-ability — hash commitments plus a deterministic pure
// function — not zero knowledge. Scores from a published trustgraphs
// network (phase 2) are a complementary signal, never merged silently.

export const TRUST_PROGRAM = 'springforth-mutual-recognition' as const;
export const TRUST_PROGRAM_VERSION = 1;
export const TRUST_INPUTS_SPEC = 'springforth.trust-inputs/v1';
export const TRUST_SCORES_SPEC = 'springforth.trust-scores/v1';

export interface TrustParams {
  program: typeof TRUST_PROGRAM;
  programVersion: typeof TRUST_PROGRAM_VERSION;
  alpha: number;            // EigenTrust damping factor
  iters: number;            // power-iteration count
  mutualRule: 'min';        // mutual = min(a→b, b→a)
  seedPolicy: 'uniform';    // epochs pin the GLOBAL vector — viewer-seeded
                          // vectors are derived products, not epoch outputs
  poolScale: number;        // fixed integer pool scores quantize into
}

export const DEFAULT_TRUST_PARAMS = {
  alpha: 0.85, iters: 20, poolScale: 1_000_000,
};

export const trustParams = (
  opts: { alpha?: number; iters?: number; poolScale?: number } = {},
): TrustParams => ({
  program: TRUST_PROGRAM, programVersion: TRUST_PROGRAM_VERSION,
  alpha: opts.alpha ?? DEFAULT_TRUST_PARAMS.alpha,
  iters: opts.iters ?? DEFAULT_TRUST_PARAMS.iters,
  mutualRule: 'min', seedPolicy: 'uniform',
  poolScale: opts.poolScale ?? DEFAULT_TRUST_PARAMS.poolScale,
});

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// ── Canonical input ───────────────────────────────────────────────────
// Whitespace-free JSON; key order fixed by construction. inputHash binds
// the edge set — the ledger replay is the authority behind it.
export interface CanonicalEdge { from: string; to: string; weight: number; mutual: number }

export function canonicalEdges(apps: Appreciation[]): CanonicalEdge[] {
  return trustEdges(apps)
    .map(({ from, to, weight, mutual }) => ({ from, to, weight, mutual }))
    .sort((a, b) => a.from === b.from
      ? a.to.localeCompare(b.to)
      : a.from.localeCompare(b.from));
}

export const canonicalEdgeJson = (edges: CanonicalEdge[]) =>
  JSON.stringify({ edges });
export const inputHash = (edges: CanonicalEdge[]) =>
  digest(canonicalEdgeJson(edges));
export const paramsHash = (p: TrustParams) => digest(JSON.stringify(p));

// ── Quantization ──────────────────────────────────────────────────────
// Float EigenTrust → integer pool: normalize to poolScale, floor, then
// distribute the remainder by largest fractional part (deterministic
// tiebreak: actor id). The quantization absorbs sub-1e-15 float noise —
// the recompute contract is this function, not bit-exact floats.
export interface TrustScore { actor: string; value: number }

export function quantizeScores(
  vec: Record<string, number>, poolScale: number,
): TrustScore[] {
  const entries = Object.entries(vec).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!entries.length || total <= 0) return [];
  const rows = entries.map(([actor, v]) => {
    const exact = (v / total) * poolScale;
    const value = Math.floor(exact);
    return { actor, value, frac: exact - value };
  });
  let remainder = poolScale - rows.reduce((s, r) => s + r.value, 0);
  for (const r of [...rows].sort(
    (a, b) => b.frac - a.frac || a.actor.localeCompare(b.actor))) {
    if (remainder <= 0) break;
    r.value += 1; remainder -= 1;
  }
  return rows.map(({ actor, value }) => ({ actor, value }))
    .sort((a, b) => a.actor.localeCompare(b.actor));
}

export const canonicalScoresJson = (scores: TrustScore[]) =>
  JSON.stringify({ scores });
export const scoresHash = (scores: TrustScore[]) =>
  digest(canonicalScoresJson(scores));

// ── Merkle tree ───────────────────────────────────────────────────────
// Leaf domain 'springforth.trust-score/v1':
//   leaf = keccak256(keccak256(abi.encode(string actor, uint256 value)))
// Leaves sort by hash; pairs hash commutative keccak256(concat(min,max));
// an unpaired node promotes unchanged — OpenZeppelin StandardMerkleTree
// conventions over our own leaf domain (not their address domain — do
// not feed these proofs to address-keyed verifiers).
const ABI_LEAF = parseAbiParameters('string actor, uint256 value');
const ZERO_ROOT = `0x${'0'.repeat(64)}` as `0x${string}`;

export function scoreLeaf(actor: string, value: number | bigint): `0x${string}` {
  return keccak256(keccak256(encodeAbiParameters(ABI_LEAF, [actor, BigInt(value)])));
}

const pairHash = (a: `0x${string}`, b: `0x${string}`): `0x${string}` =>
  keccak256(a < b ? concat([a, b]) : concat([b, a]));

export function buildScoreTree(scores: TrustScore[]): {
  root: `0x${string}`;
  leaves: `0x${string}`[];
  layers: `0x${string}`[][];
} {
  const leaves = scores.map((s) => scoreLeaf(s.actor, s.value)).sort() as `0x${string}`[];
  const layers: `0x${string}`[][] = [leaves];
  while (layers.at(-1)!.length > 1) {
    const lvl = layers.at(-1)!;
    const next: `0x${string}`[] = [];
    for (let i = 0; i < lvl.length; i += 2)
      next.push(i + 1 < lvl.length ? pairHash(lvl[i]!, lvl[i + 1]!) : lvl[i]!);
    layers.push(next);
  }
  return { root: layers.at(-1)?.[0] ?? ZERO_ROOT, leaves, layers };
}

export function scoreProof(scores: TrustScore[], actor: string): {
  actor: string; value: number; leaf: string; index: number; proof: string[];
} | null {
  const s = scores.find((x) => x.actor === actor);
  if (!s) return null;
  const { leaves, layers } = buildScoreTree(scores);
  const leaf = scoreLeaf(s.actor, s.value);
  const index = leaves.indexOf(leaf);
  const proof: string[] = [];
  for (let l = 0, i = index; l < layers.length - 1; l++, i = Math.floor(i / 2)) {
    const lvl = layers[l]!;
    const sib = i % 2 === 0 ? i + 1 : i - 1;
    if (sib < lvl.length) proof.push(lvl[sib]!);
  }
  return { actor, value: s.value, leaf, index, proof };
}

export function verifyScoreProof(
  root: string, actor: string, value: number, proof: string[],
): boolean {
  let h = scoreLeaf(actor, value) as `0x${string}`;
  for (const p of proof) h = pairHash(h, p as `0x${string}`);
  return h === root;
}

// ── Epoch compute ─────────────────────────────────────────────────────
export function computeEpoch(
  edges: CanonicalEdge[], params: TrustParams,
): {
  scores: TrustScore[]; outputRoot: string; totalValue: string; scoresHash: string;
} {
  const vec = eigenTrust(edges, { alpha: params.alpha, iters: params.iters });
  const scores = quantizeScores(vec, params.poolScale);
  const { root } = buildScoreTree(scores);
  return {
    scores, outputRoot: root,
    totalValue: String(scores.reduce((s, r) => s + r.value, 0)),
    scoresHash: scoresHash(scores),
  };
}

// ── Store layer ───────────────────────────────────────────────────────
const TRUST_EPOCH_KIND = 'trust-epoch';
const TRUST_EPOCH_DATA_KIND = 'trust-epoch-data';
export const epochId = (n: number) => `te-${String(n).padStart(6, '0')}`;

export async function latestTrustEpoch(db: D1Database): Promise<TrustEpoch | null> {
  const epochs = await listWhere<TrustEpoch>(db, TRUST_EPOCH_KIND, "id LIKE 'te-%'");
  return epochs.at(-1) ?? null;   // zero-padded ids — id order IS epoch order
}

export async function getTrustEpoch(db: D1Database, epoch: number) {
  return get<TrustEpoch>(db, TRUST_EPOCH_KIND, epochId(epoch));
}

export async function getTrustEpochData(db: D1Database, epoch: number) {
  return get<TrustEpochData>(db, TRUST_EPOCH_DATA_KIND, epochId(epoch));
}

// Edges committed in a pinned epoch — what allocation, badgeholders and
// governance eligibility compute over once a round/proposal pins.
export async function epochEdges(
  db: D1Database, epoch: number,
): Promise<TrustEdge[] | null> {
  const data = await getTrustEpochData(db, epoch);
  return data?.edges ?? null;
}

// Parameter resolution — gov-param rows override the program defaults,
// same rule as paramValue() for the trust.* keys (kept local so this
// module stays free of the funding import graph).
const trustParam = (govParams: GovernanceParam[], key: string, dflt: number) =>
  Number(govParams.find((p) => p.id === key)?.value) || dflt;

// Checkpoint: freeze inputs+params, compute, store journal + recompute
// package, append 'trust.epoch'. Mirrors the external rule set —
// · no checkpoint while edgeCount is 0 (nothing to score)
// · no new epoch when inputHash AND paramsHash are unchanged
// · a seq-gap cadence (trust.epochMinSeqGap) so input churn doesn't mint
//   an epoch per event; `force` bypasses the gap (admin / pre-D0 runs)
export async function maybeTrustCheckpoint(
  env: { DB: D1Database },
  opts: { force?: boolean } = {},
): Promise<{ created: boolean; epoch: TrustEpoch | null; skipped?: string }> {
  const [govParams, latest, head] = await Promise.all([
    list<GovernanceParam>(env.DB, 'gov-param'),
    latestTrustEpoch(env.DB),
    env.DB.prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')
      .first<{ seq: number; hash: string }>(),
  ]);
  const seq = head?.seq ?? -1;
  const ledgerHead = head?.hash ?? '0'.repeat(64);
  // Seq-gap first: a deferred checkpoint skips the appreciation scan
  // entirely — this runs on every appreciate write during input churn.
  const minGap = trustParam(govParams, 'trust.epochMinSeqGap', 25);
  if (!opts.force && latest && seq - latest.cut.seq < minGap)
    return { created: false, epoch: latest, skipped: `seq gap ${seq - latest.cut.seq} < ${minGap}` };

  const apps = await list<Appreciation>(env.DB, 'appreciation');
  const edges = canonicalEdges(apps);
  if (!edges.length)
    return { created: false, epoch: latest, skipped: 'no edges' };

  const params = trustParams({
    alpha: trustParam(govParams, 'trust.alpha', DEFAULT_TRUST_PARAMS.alpha),
    iters: trustParam(govParams, 'trust.iters', DEFAULT_TRUST_PARAMS.iters),
    poolScale: trustParam(govParams, 'trust.poolScale', DEFAULT_TRUST_PARAMS.poolScale),
  });
  const ih = inputHash(edges);
  const ph = paramsHash(params);
  if (!opts.force && latest && latest.inputHash === ih && latest.paramsHash === ph)
    return { created: false, epoch: latest, skipped: 'unchanged' };

  const { scores, outputRoot, totalValue, scoresHash: sh } = computeEpoch(edges, params);
  const n = (latest?.epoch ?? 0) + 1;
  const epoch: TrustEpoch = {
    id: epochId(n), epoch: n,
    program: TRUST_PROGRAM, programVersion: TRUST_PROGRAM_VERSION,
    cut: { seq, ledgerHead, at: new Date().toISOString() },
    inputHash: ih, edgeCount: edges.length,
    actorCount: new Set(edges.flatMap((e) => [e.from, e.to])).size,
    paramsHash: ph, params: params as unknown as Record<string, unknown>,
    outputRoot, totalValue, scoresHash: sh,
    createdAt: new Date().toISOString(),
  };
  const data: TrustEpochData = { id: epochId(n), epoch: n, edges, scores };
  await put(env.DB, TRUST_EPOCH_KIND, epoch.id, epoch);
  await put(env.DB, TRUST_EPOCH_DATA_KIND, data.id, data);
  await ledgerAppend(env.DB, 'system', 'trust.epoch', {
    epoch: n, cut: epoch.cut, inputHash: ih, paramsHash: ph, outputRoot,
  });
  return { created: true, epoch };
}

// Best-effort pin — call at round/proposal open so decisions cite a
// committed epoch. Never blocks the caller's write on a checkpoint
// failure: returns the latest epoch (or null on an empty graph).
export async function ensureTrustEpoch(
  env: { DB: D1Database },
): Promise<TrustEpoch | null> {
  try {
    const r = await maybeTrustCheckpoint(env);
    return r.epoch;
  } catch (e) {
    console.error('trust epoch ensure failed', e);
    return null;
  }
}
