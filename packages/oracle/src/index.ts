import { OracleCheck } from '@springforth/core';
export * from './sources.ts';

// Open-evidence oracle — fuses independent source classes into ONE shown
// confidence score. Confidence is reported, never auto-truth: human
// verification stays authoritative.

// Source-class weights — direct observation > proxied > self-reported.
export const SOURCE_WEIGHT: Record<OracleCheck['source'], number> = {
  'remote-sensing': 1.0,
  iot: 1.0,
  bioacoustic: 0.9,
  connector: 0.8,
  atlas: 0.9,
  'field-evidence': 0.8,
  'community-report': 0.6,
};

export interface Triangulation {
  confidence: number;
  verified: boolean;
  sourcesMatched: string[];
  sourcesTotal: string[];
  disagreements: { id: string; source: string; detail: string }[];
}

export function triangulate(
  checks: OracleCheck[],
  opts: { minConfidence?: number; requiredValidators?: number } = {},
): Triangulation {
  const minConfidence = opts.minConfidence ?? 0.5;
  const requiredValidators = opts.requiredValidators ?? 2;
  const matched = checks.filter((c) => c.result === 'match');
  const mismatched = checks.filter((c) => c.result === 'mismatch');
  const wNum = matched.reduce((s, c) => s + SOURCE_WEIGHT[c.source] * c.score, 0);
  const wDen = checks.reduce((s, c) => s + SOURCE_WEIGHT[c.source], 0);
  const distinctSources = new Set(matched.map((c) => c.source));
  const confidence = wDen > 0 ? wNum / wDen : 0;
  return {
    confidence: Math.round(confidence * 1000) / 1000,
    // verified requires BOTH ≥N independent matching source classes AND min confidence
    verified: distinctSources.size >= requiredValidators && confidence >= minConfidence,
    sourcesMatched: [...distinctSources],
    sourcesTotal: [...new Set(checks.map((c) => c.source))],
    // disagreements are preserved — never collapsed (gate: honesty over score)
    disagreements: mismatched.map((c) => ({ id: c.id, source: c.source, detail: c.detail })),
  };
}

// Field-evidence check: an anchored evidence manifest exists in the ledger —
// integrity-verified, not content-verified (score reflects anchoring only).
export function checkEvidence(opts: {
  evidenceSha256: string;
  manifestVerified: boolean;
  domain?: OracleCheck['domain'];
  at: string;
}): OracleCheck {
  return OracleCheck.parse({
    id: `oc-ev-${opts.evidenceSha256.slice(0, 12)}`,
    source: 'field-evidence', domain: opts.domain ?? 'social',
    methodologyRef: 'sha256-manifest-anchored',
    result: opts.manifestVerified ? 'match' : 'pending',
    score: opts.manifestVerified ? 1 : 0,
    detail: opts.manifestVerified
      ? `evidence sha256:${opts.evidenceSha256.slice(0, 16)}… anchored`
      : 'manifest not found in ledger',
    at: opts.at,
  });
}
