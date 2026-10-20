import type { ImpactClaim } from '@springforth/core';
import { toHypercertLexicon } from '@springforth/funding';

// Hypercerts ATProto export — emits org.hypercerts.claim.activity-shaped
// records (lexicon: hypercerts-org/hypercerts-lexicon, MIT). Records are
// data — a writer holding an ATProto session publishes them; this lane
// only produces spec-valid JSON.
export { toHypercertLexicon };

export function exportClaims(claims: ImpactClaim[]) {
  return claims.map((c) => toHypercertLexicon(c));
}
