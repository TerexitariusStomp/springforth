// /ledger + /ledger/verify — the audit trail deep pages, moved out of
// inspect.ts during the hub fold. Every event row + chain verify.
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, statGrid } from './ui.ts';
import { displayName } from './ui.ts';

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (h?: string) => (h ? `${esc(h.slice(0, 12))}…` : '—');
const when = (iso?: string) => (iso ? esc(iso.replace('T', ' ').slice(0, 19)) : '—');

export interface LedgerEventRow {
  seq: number; at: string; actor: string; kind: string;
  payload: unknown; prev_hash: string; hash: string;
}
export interface LedgerVerify { ok: boolean; events?: number; brokenAt?: number }

export function renderLedgerPage(
  events: LedgerEventRow[], verify: LedgerVerify, lang: Lang = 'en',
): string {
  const body = `<div class="page">${pageHeader({
    kicker: t(lang, 'detail.ledger.kicker'),
    title: t(lang, 'detail.ledger.h1'),
    em: t(lang, 'detail.ledger.h1.em'),
    lede: t(lang, 'detail.ledger.lede'),
    back: { href: '/impact#proof', label: t(lang, 'nav.impact') },
  })}
<p>${verify.ok
  ? `<strong style="color:var(--sf-ok-ink)">✓ ${esc(t(lang, 'detail.ledger.ok'))}</strong> — ${verify.events} ${esc(t(lang, 'detail.ledger.okBody'))}`
  : `<strong style="color:var(--sf-coral-ink)">✗ ${esc(t(lang, 'detail.ledger.broken'))} ${verify.brokenAt}</strong>`}
· <a href="/ledger/verify">${esc(t(lang, 'detail.ledger.verify'))}</a></p>
<details class="how-note"><summary>${esc(t(lang, 'detail.data'))}</summary>
<div class="hn-body"><a href="/ledger?format=json">JSON</a></div></details>
<table>
<tr><th scope="col">#</th><th scope="col">${esc(t(lang, 'col.at'))}</th><th scope="col">${esc(t(lang, 'col.event'))}</th><th scope="col">${esc(t(lang, 'col.actor'))}</th><th scope="col">${esc(t(lang, 'col.hash'))}</th></tr>
${[...events].reverse().map((e) => `<tr>
<td>${e.seq}</td><td class="muted">${when(e.at)}</td>
<td><code>${esc(e.kind)}</code></td><td>${displayName(e.actor)}</td>
<td class="muted" title="${esc(e.hash)}"><code>${short(e.hash)}</code></td>
</tr>`).join('')}
</table>
</div>`;
  return pageShell({ title: `${t(lang, 'detail.ledger.kicker')} — Springforth`,
    htmx: false, lang }, body);
}

export function renderLedgerVerifyPage(v: LedgerVerify, lang: Lang = 'en'): string {
  const body = `<div class="page">${pageHeader({
    kicker: t(lang, 'detail.verify.kicker'),
    title: t(lang, 'detail.verify.h1'),
    em: v.ok ? t(lang, 'detail.verify.ok.em') : t(lang, 'detail.verify.bad.em'),
    lede: v.ok
      ? t(lang, 'detail.verify.okBody')
      : `${t(lang, 'detail.verify.badBody')} — #${v.brokenAt ?? '?'}`,
    back: { href: '/ledger', label: t(lang, 'detail.ledger.kicker') },
  })}
${statGrid([
    { v: String(v.events ?? '—'), l: t(lang, 'detail.verify.events') },
    { v: v.ok ? '✓' : '✗', l: t(lang, 'detail.verify.integrity') },
    { v: 'OTS', l: t(lang, 'detail.verify.anchored') },
  ])}
<p class="muted"><a href="/ledger">${esc(t(lang, 'detail.ledger.browse'))}</a></p>
<details class="how-note"><summary>${esc(t(lang, 'detail.data'))}</summary>
<div class="hn-body"><a href="/ledger/verify?format=json">JSON</a></div></details>
</div>`;
  return pageShell({ title: `${t(lang, 'detail.verify.kicker')} — Springforth`,
    htmx: false, lang }, body);
}
