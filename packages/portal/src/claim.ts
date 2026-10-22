import type { Attestation, ImpactClaim } from '@springforth/core';
import { walletScript } from './wallet.ts';
import { pageShell } from './theme.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title: string, body: string) =>
  pageShell({ title: `${title} — Springforth`, htmx: false,
    extraCss: `.page code{word-break:break-all}.page button.done{background:var(--sf-ok-soft)}` },
    `<div class="page">${body}</div>`);

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
