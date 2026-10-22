import type { Attestation, ImpactClaim } from '@springforth/core';
import { walletScript } from './wallet.ts';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, displayName } from './ui.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title: string, body: string, lang: Lang = 'en') =>
  pageShell({ title: `${title} — Springforth`, htmx: false, lang,
    extraCss: `.page code{word-break:break-all}.page button.done{background:var(--sf-ok-soft)}` },
    `<div class="page">${body}</div>`);

// Claim page — the claim, its attestations, and signer-facing publish
// buttons. Each button carries data-tx-build pointing at the calldata
// endpoint; walletScript connects the injected wallet, sends, and
// POSTs the hash to /chain/record. Worker never touches keys.
export function renderClaimPage(
  claim: ImpactClaim, attestations: Attestation[],
  opts: { chainReady: boolean },
  lang: Lang = 'en',
): string {
  const atts = attestations.map((a) => `<tr>
<td><code>${esc(a.id)}</code></td><td>${displayName(a.attester)}</td>
<td><code>${esc(a.schemaRef)}</code></td>
<td class="muted">${a.uid ? `${esc(t(lang, 'detail.claim.onchain'))} <code>${esc(a.uid.slice(0, 14))}…</code>` : esc(t(lang, 'detail.claim.ledger'))}</td>
<td>${!a.uid && opts.chainReady
  ? `<button data-tx-build="/attestations/${esc(a.id)}/tx" data-tx-kind="attestation.publish" data-tx-entity="${esc(a.id)}">${esc(t(lang, 'detail.claim.publish'))}</button>`
  : ''}</td></tr>`).join('\n');
  return shell(`${t(lang, 'detail.claim.kicker')} ${claim.id}`, `
${pageHeader({
    kicker: t(lang, 'detail.claim.kicker'),
    title: claim.workScope || claim.id,
    back: { href: '/impact#claims', label: t(lang, 'nav.impact') },
  })}
<p class="muted">${esc(t(lang, 'detail.actor.id'))} <code>${esc(claim.id)}</code> · ${esc(t(lang, 'detail.report.state'))} <span class="badge">${esc(claim.state)}</span> ·
${esc(t(lang, 'detail.claim.scope'))}: ${esc(claim.workScope)} ·
${claim.contributors.length} ${esc(t(lang, 'detail.claim.contributors'))} · ${claim.oracleCheckIds.length} ${esc(t(lang, 'detail.claim.checks'))}</p>
${claim.artifactRefs.length ? `<p>${esc(t(lang, 'detail.claim.artifacts'))}: ${claim.artifactRefs.map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(' · ')}</p>` : ''}
<h2>${esc(t(lang, 'detail.claim.atts'))}</h2>
<table><tr><th scope="col">ID</th><th scope="col">${esc(t(lang, 'col.attester'))}</th><th scope="col">${esc(t(lang, 'col.schema'))}</th><th scope="col">${esc(t(lang, 'col.anchored'))}</th><th scope="col">${esc(t(lang, 'col.action'))}</th></tr>
${atts || `<tr><td colspan="5"><em>${esc(t(lang, 'detail.claim.none'))}</em></td></tr>`}</table>
${opts.chainReady
  ? `<p class="muted">${esc(t(lang, 'detail.claim.chainReady'))}</p>`
  : `<p class="muted">${esc(t(lang, 'detail.claim.chainOff'))}</p>`}
<details class="how-note"><summary>${esc(t(lang, 'detail.data'))}</summary>
<div class="hn-body"><a href="?format=lexicon">${esc(t(lang, 'detail.claim.lexicon'))}</a> ·
<a href="/claims/${esc(claim.id)}/metadata">${esc(t(lang, 'detail.claim.metadata'))}</a></div></details>
${opts.chainReady ? walletScript() : ''}`, lang);
}
