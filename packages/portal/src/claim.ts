import type { Attestation, ImpactClaim } from '@springforth/core';
import { walletScript } from './wallet.ts';
import { footer } from './nav.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Springforth</title>
<style>body{font-family:system-ui,sans-serif;overflow-x:auto;max-width:56rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.45rem;text-align:left;font-size:.92rem}
.muted{color:#666}code{background:#f4f4f4;padding:.1rem .3rem;word-break:break-all}
button{font:inherit;padding:.4rem .8rem;cursor:pointer}button.done{background:#cfe9cf}
.badge{padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem;background:#dfe}</style></head><body>
${body}
${footer()}
</body></html>`;

// Claim page — the claim, its attestations, and signer-facing publish
// buttons. Each button carries data-tx-build pointing at the calldata
// endpoint; walletScript connects the injected wallet, sends, and
// POSTs the hash to /chain/record. Worker never touches keys.
export function renderClaimPage(
  claim: ImpactClaim, attestations: Attestation[],
  opts: { chainReady: boolean },
): string {
  const atts = attestations.map((a) => `<tr>
<td><code>${esc(a.id)}</code></td><td>${esc(a.attester)}</td>
<td><code>${esc(a.schemaRef)}</code></td>
<td class="muted">${a.uid ? `on-chain <code>${esc(a.uid.slice(0, 14))}…</code>` : 'ledger'}</td>
<td>${!a.uid && opts.chainReady
  ? `<button data-tx-build="/attestations/${esc(a.id)}/tx" data-tx-kind="attestation.publish" data-tx-entity="${esc(a.id)}">publish on-chain</button>`
  : ''}</td></tr>`).join('\n');
  return shell(`Claim ${claim.id}`, `
<h1>Impact claim</h1>
<p class="muted">id <code>${esc(claim.id)}</code> · state <span class="badge">${esc(claim.state)}</span> ·
scope: ${esc(claim.workScope)} ·
${claim.contributors.length} contributor(s) · ${claim.oracleCheckIds.length} evidence check(s)</p>
${claim.artifactRefs.length ? `<p>Artifacts: ${claim.artifactRefs.map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(' · ')}</p>` : ''}
<h2>Attestations</h2>
<table><tr><th>ID</th><th>Attester</th><th>Schema</th><th>Anchored</th><th></th></tr>
${atts || '<tr><td colspan="5"><em>No attestations yet — POST /claims/:id/attest.</em></td></tr>'}</table>
${opts.chainReady
  ? `<p class="muted">Publishing is signer-facing: your wallet signs the EAS
attest transaction; the worker only builds calldata and watches the receipt.</p>`
  : `<p class="muted">Chain lane inactive — attestations live on the ledger.</p>`}
<p class="muted"><a href="?format=lexicon">hypercert lexicon JSON</a> ·
<a href="/claims/${esc(claim.id)}/metadata">metadata doc</a></p>
${opts.chainReady ? walletScript() : ''}`);
}
