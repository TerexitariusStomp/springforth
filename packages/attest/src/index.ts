import type { ImpactClaim, OracleCheck } from '@springforth/core';
import { createHash } from 'node:crypto';

// EAS attestation payloads — Ethereum Attestation Service (open schema
// registry; MIT eas-sdk). Schemas are ABI-typed strings registered
// on-chain; the payload builder produces the encoded values + a
// content hash. On-chain write happens in @springforth/chain-celo
// (Alfajores first); this package is chain-free and worker-safe.

export const SCHEMAS = {
  // what was verified, by which evidence, at what confidence
  'springforth.outcome.v1':
    'bytes32 nodeRef, bytes32 evidenceHash, uint8 score, string sourceURI',
  // reviewer evaluation of an impact claim
  'springforth.evaluation.v1':
    'bytes32 claimRef, uint8 verdict, string note',
} as const;
export type SchemaRef = keyof typeof SCHEMAS;

const sha256 = (s: string) =>
  `0x${createHash('sha256').update(s).digest('hex')}`;

export function outcomePayload(opts: {
  nodeId: string; checks: OracleCheck[]; sourceURI?: string;
}) {
  const evidenceHash = sha256(JSON.stringify(
    opts.checks.map((c) => [c.id, c.source, c.result, c.score])));
  const score = Math.round(
    (opts.checks.filter((c) => c.result === 'match').length
      / Math.max(opts.checks.length, 1)) * 100);
  return {
    schema: SCHEMAS['springforth.outcome.v1'],
    values: {
      nodeRef: sha256(opts.nodeId),
      evidenceHash,
      score,
      sourceURI: opts.sourceURI
        ?? `https://springforth.widespread.workers.dev/nodes/${opts.nodeId}`,
    },
  };
}

export function evaluationPayload(opts: {
  claim: ImpactClaim; verdict: 'positive' | 'neutral' | 'negative'; note?: string;
}) {
  const verdictCode = { positive: 1, neutral: 0, negative: 2 }[opts.verdict];
  return {
    schema: SCHEMAS['springforth.evaluation.v1'],
    values: {
      claimRef: sha256(opts.claim.id),
      verdict: verdictCode,
      note: (opts.note ?? '').slice(0, 280),
    },
  };
}
