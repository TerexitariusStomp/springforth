import type { PlanNode, TrustEdge } from '@springforth/coordination';
import type { PossibilityStatus, Valuation } from '@springforth/core';
import { deckCard } from './landing.ts';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { displayName } from './ui.ts';

// /possibilities — the card deck. Compact Figma cards in a filterable grid;
// each card opens a full detail overlay (pure CSS :target — no JS needed)
// carrying needs, bringing, participants, forms, and the value block.
// #declare is a real form posting to POST /possibilities.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface PossibilityCard {
  id: string; title: string; description: string; declarerId: string;
  place?: string; timeStart?: string; timeEnd?: string; deadline?: string;
  minParticipants: number; maxParticipants?: number;
  status: PossibilityStatus;
  score: number; tipping?: boolean;
  scoring: { score: number; trust: number; urgency: number; cover: number };
  participantCount: number;
  // Identity gradation — undefined until critical mass (cover ≥ 0.5 or
  // quorum reached). Counts are always public; names reveal late.
  participants?: { actor: string; bringingNodeId?: string }[];
  needs: (PlanNode & { met: boolean })[];
  bringing: PlanNode[];
  quorum: { met: boolean; required: number; requiredMet: number };
  report?: { summary: string; evidence: string; learnings: string; at: string };
  context?: { datasets?: { name: string; value: string; source: string; fetchedAt: string }[] };
  // Derived monetary valuation (ledger + declared + cited-benchmark inputs,
  // per currency) — see docs/hackathon/VALUATION.md for the methodology.
  value?: Valuation;
}

// Card ↔ hub links — computed edge-side by loadCardConnections; the
// portal only renders. Mirrors the views.ts shape, kept local to avoid
// importing the edge package.
export interface CardConnections {
  overlapCount: number;
  focusNodeId?: string;
  rounds: { id: string; title: string }[];
  committed: Record<string, number>;
  pledges: number;
  claimId?: string;
  hasReport: boolean;
}

const money0 = (amount: number, currency: string) =>
  `${currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)}`;

// "Connected" — the card's links into the hub sections. Renders nothing
// unless at least one connection exists.
function connectedBlock(c: PossibilityCard, conn: CardConnections | undefined, lang: Lang): string {
  if (!conn) return '';
  const bits: string[] = [];
  if (conn.overlapCount > 0 && conn.focusNodeId)
    bits.push(`<a href="/collaborate?node=${esc(conn.focusNodeId)}#overlaps">${conn.overlapCount} ${esc(t(lang, 'conn.overlaps'))} →</a>`);
  else if (conn.overlapCount > 0)
    bits.push(`<a href="/collaborate#overlaps">${conn.overlapCount} ${esc(t(lang, 'conn.overlaps'))} →</a>`);
  for (const r of conn.rounds)
    bits.push(`<a href="/rounds/${esc(r.id)}">${esc(t(lang, 'conn.eligible'))} <strong>${esc(r.title)}</strong> →</a>`);
  const committed = Object.entries(conn.committed).filter(([, v]) => v > 0)
    .map(([cur, v]) => money0(v, cur)).join(' · ');
  if (committed || conn.pledges > 0) {
    const parts = [
      committed ? `${committed} ${esc(t(lang, 'conn.committed'))}` : '',
      conn.pledges > 0 ? `${conn.pledges} ${esc(t(lang, 'conn.pledges'))}` : '',
    ].filter(Boolean).join(' · ');
    bits.push(`<a href="/fund#pledges">${parts} →</a>`);
  }
  if (conn.claimId)
    bits.push(`<a href="/claims/${esc(conn.claimId)}">${esc(t(lang, 'conn.proof'))} →</a>`);
  if (conn.hasReport)
    bits.push(`<a href="/possibilities/${esc(c.id)}/report">${esc(t(lang, 'conn.report'))} →</a>`);
  if (!bits.length) return '';
  return `<p class="ctx"><strong>${esc(t(lang, 'conn.title'))}:</strong> ${bits.join(' · ')}</p>`;
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 })
    .format(amount);

// "Coordinated value (est.)" — derived at render from ledger donations/match,
// participant-declared hours and offer budgets, and cited benchmark rates.
// Per-currency rows, never converted; every component carries its provenance.
function valueBlock(v: Valuation, tt: (k: string) => string): string {
  const rows = Object.entries(v.byCurrency).filter(([, c]) => c.total > 0 || c.asked > 0 || c.riskAvoided > 0)
    .map(([cur, c]) => {
      const parts: string[] = [];
      if (c.committed > 0) parts.push(`${money(c.committed, cur)} ${tt('valb.committed')}`);
      if (c.matched > 0) parts.push(`${money(c.matched, cur)} ${tt('valb.matched')}`);
      if (c.inKind > 0) parts.push(`${money(c.inKind, cur)} ${tt('valb.inKind')}`);
      if (c.volunteerTime > 0) parts.push(`${money(c.volunteerTime, cur)} ${tt('valb.volunteer')}`);
      if (c.asked > 0) parts.push(`${money(c.asked, cur)} ${tt('valb.asked')}`);
      const risk = c.riskAvoided > 0
        ? ` <em>+ ${tt('valb.est')} ${money(c.riskAvoided, cur)} ${tt('valb.risk')}` +
          (c.riskPerUnit > 0 ? ` (${tt('valb.est')} ${money(Math.round(c.riskPerUnit), cur)} ${tt('valb.per')} ${money(1, cur)})` : '') +
          `</em>` : '';
      const lev = c.leverage > 0 ? ` <small>(×${c.leverage} ${tt('valb.lev')})</small>` : '';
      return `<li>${esc(cur)} <strong>${money(c.total, cur)}</strong>${lev} — ${parts.join(' · ')}${risk}</li>`;
    }).join('');
  if (!rows && !(v.hoursTotal > 0)) return '';
  return `<p class="meta"><strong>${esc(tt('valb.title'))}</strong> —
${esc(tt('valb.lede'))}
<ul class="needs">${rows}</ul>
${v.method.length ? `<small>${v.method.map(esc).join(' · ')}</small>` : ''}
<small><a href="https://github.com/TerexitariusStomp/springforth/blob/main/docs/hackathon/VALUATION.md">${esc(tt('valb.methodology'))}</a></small></p>`;
}

function countdown(deadline: string | undefined, tt: (k: string) => string): string {
  if (!deadline) return tt('card.openEnded');
  const d = Math.ceil((Date.parse(deadline) - Date.now()) / 86_400_000);
  return d < 0 ? tt('card.deadlinePassed') : d === 0 ? tt('card.today') : `${d} ${tt('card.daysLeft')}`;
}

// Full card detail — lives inside the :target overlay panel.
function cardDetail(c: PossibilityCard, conn: CardConnections | undefined, lang: Lang): string {
  const tt = (k: string) => t(lang, k);
  const live = c.status === 'active' || c.status === 'draft';
  const cover = c.scoring.cover;
  const needRows = c.needs.map((n) => `<li>
    ${n.met ? '✓' : '•'} ${esc(n.label)}
    ${n.category ? `<span class="nice">[${esc(n.category)}]</span>` : ''}
    ${n.required ? `<span class="req">${esc(tt('need.required'))}</span>` : `<span class="nice">${esc(tt('need.nice'))}</span>`}
    ${n.flaggedBy ? `<span class="nice">${esc(tt('need.flaggedBy'))} ${esc(n.flaggedBy)}</span>` : ''}
    ${n.met ? `<span class="met">${esc(tt('need.met'))}</span>` : ''}</li>`).join('');
  const bringing = c.bringing.map((n) => `<li>${esc(n.label)} — ${esc(n.orgIds[0] ?? '')}</li>`).join('');
  const joined = (c.participants ?? []).map((x) => `<li>${esc(x.actor)}${x.bringingNodeId ? ` + ${esc(tt('card.bringingPlus'))}` : ''}</li>`).join('');
  const partCap = c.maxParticipants ? `/${c.maxParticipants} cap` : '';
  return `<div class="card-overlay" id="${esc(c.id)}">
<div class="detail-panel" role="dialog" aria-modal="true" aria-label="${esc(c.title)}" tabindex="-1">
<a class="modal-close" href="#deck" aria-label="${esc(tt('a11y.close'))}">✕</a>
<h3>“${esc(c.title)}”</h3>
<p><span class="badge lime">${esc(c.status)}</span>
${c.tipping ? `<span class="badge gold">${esc(tt('card.tipping'))}</span>` : ''}
<span class="badge">${esc(countdown(c.deadline, tt))}</span>
<span class="badge">${c.participantCount}/${c.minParticipants} ${esc(tt('card.in'))}${partCap}</span>
<span class="badge">${esc(tt('card.needs').toLowerCase())} ${c.quorum.requiredMet}/${c.quorum.required}</span>
<span class="badge">${esc(tt('card.score'))} ${c.score.toFixed(2)}</span></p>
<div class="bar"><div class="fill" style="width:${Math.round(cover * 100)}%"></div></div>
<p class="meta">${esc(tt('card.cover'))} ${(cover * 100).toFixed(0)}% ·
${esc(tt('card.trust'))} ${c.scoring.trust.toFixed(2)} · ${esc(tt('card.urgency'))} ${c.scoring.urgency.toFixed(2)}</p>
${c.value ? valueBlock(c.value, tt) : ''}
<p>${esc(tt('card.declaredBy'))} <strong>${displayName(c.declarerId)}</strong>${c.place ? ` · ${esc(c.place)}` : ''}
${c.timeStart ? ` · ${esc(c.timeStart.slice(0, 10))}${c.timeEnd ? ` → ${esc(c.timeEnd.slice(0, 10))}` : ''}` : ''}
· <a href="/possibilities/${esc(c.id)}/ics">${esc(tt('card.ics'))}</a></p>
${c.description ? `<p>${esc(c.description)}</p>` : ''}
${c.context?.datasets?.length ? `<p class="ctx"><strong>${esc(tt('card.verified'))}</strong></p><ul class="needs">${c.context.datasets.map((d) => `<li>◆ ${esc(d.name)}: ${esc(d.value)}${d.source ? ` <span class="nice">(${esc(d.source)})</span>` : ''}</li>`).join('')}</ul>` : ''}
${needRows ? `<p><strong>${esc(tt('card.needs'))}</strong></p><ul class="needs">${needRows}</ul>` : ''}
${bringing ? `<p><strong>${esc(tt('card.bringing'))}</strong></p><ul class="needs">${bringing}</ul>` : ''}
${c.participants === undefined
  ? `<p><strong>${esc(tt('card.inH'))}:</strong> ${c.participantCount} — <em>${esc(tt('card.namesReveal'))}</em></p>`
  : joined ? `<p><strong>${esc(tt('card.inH'))} (${c.participantCount})</strong></p><ul class="needs">${joined}</ul>` : ''}
${live ? `<form method="post" action="/possibilities/${esc(c.id)}/join" class="val">
  <input name="actor" placeholder="${esc(tt('form.name'))}" aria-label="${esc(tt('form.name'))}" required>
  <input name="bringing" placeholder="${esc(tt('form.bringing'))}" aria-label="${esc(tt('form.bringing'))}">
  <input name="hours" type="number" min="0" step="0.5" placeholder="${esc(tt('form.hours'))}" aria-label="${esc(tt('form.hours'))}" style="max-width:7rem">
  <button>${esc(tt('form.coming'))}</button>
</form>
<form method="post" action="/possibilities/${esc(c.id)}/need" class="val">
  <input name="actor" placeholder="${esc(tt('form.name'))}" aria-label="${esc(tt('form.name'))}" required>
  <input name="title" placeholder="${esc(tt('form.needMissing'))}" aria-label="${esc(tt('form.needMissing'))}" required>
  <input name="category" placeholder="${esc(tt('form.category'))}" aria-label="${esc(tt('form.category'))}">
  <button>${esc(tt('form.flagNeed'))}</button>
</form>
<form method="post" action="/possibilities/${esc(c.id)}/pass" class="val">
  <input name="actor" placeholder="${esc(tt('form.name'))}" aria-label="${esc(tt('form.name'))}" required>
  <button>${esc(tt('form.pass'))}</button>
</form>` : ''}
${c.status === 'completed' || c.status === 'quorum' ? `<form method="post" action="/possibilities/${esc(c.id)}/appreciate" class="val">
  <input name="from" placeholder="${esc(tt('form.name'))}" aria-label="${esc(tt('form.name'))}" required>
  <input name="to" placeholder="${esc(tt('form.whoShowed'))}" aria-label="${esc(tt('form.whoShowed'))}" required>
  <input name="note" placeholder="${esc(tt('form.noteClutch'))}" aria-label="${esc(tt('form.noteClutch'))}">
  <button>${esc(tt('form.appreciate'))}</button>
</form>` : ''}
${c.report ? `<p class="res"><strong>${esc(tt('card.report'))}</strong> ${esc(c.report.summary)}${c.report.learnings ? ` — <em>${esc(c.report.learnings)}</em>` : ''}</p>` : ''}
${connectedBlock(c, conn, lang)}
</div></div>`;
}

const STATUS_FILTERS: Array<[string, string]> = [
  ['', 'deck.all'], ['active', 'deck.building'], ['quorum', 'deck.quorum'],
  ['completed', 'deck.completed'], ['draft', 'deck.f.draft'], ['expired', 'deck.f.expired'],
];

const DECK_CSS = `
.card-overlay{display:none}
.card-overlay:target{display:grid;position:fixed;inset:0;z-index:50;padding:1.25rem;place-items:center;background:rgba(8,28,20,.7);backdrop-filter:blur(8px)}
.detail-panel{width:min(43.75rem,100%);max-height:88vh;overflow:auto;padding:2.25rem;position:relative;border-radius:18px;background:var(--sf-cream-2);box-shadow:0 30px 100px rgba(0,0,0,.3)}
.detail-panel h3{margin:0 0 .75rem;font-family:var(--sf-serif);font-weight:400;color:var(--sf-ink-2);font-size:30px;line-height:1.16}
.needs{list-style:none;padding-left:.25rem;margin:.2rem 0;font-size:13px}
.detail-panel .needs li{padding:.15rem 0}
.val{display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap}
.val input{min-height:2.75rem;padding:.5rem .7rem;flex:1;min-width:8rem;border:1px solid var(--sf-line);border-radius:8px;font:inherit;font-size:13px}
.val button{min-height:2.75rem;padding:.5rem 1.1rem;cursor:pointer;background:var(--sf-green-3);color:var(--sf-cream);border:0;border-radius:99px;font-weight:800;font-size:12px}
.res{background:rgba(200,243,109,.25);padding:.6rem .8rem;border-radius:.5rem;font-size:13px}
.req{color:var(--sf-danger-ink);font-size:.8rem}.nice{color:var(--sf-muted);font-size:.8rem}.met{color:var(--sf-ok);font-size:.8rem}
.tip{background:var(--sf-gold-soft);color:var(--sf-gold)}.meta{font-size:.8rem;color:var(--sf-muted)}
.bar{background:var(--sf-cream-3);border-radius:99px;height:.375rem;margin:.5rem 0;overflow:hidden}
.fill{background:var(--sf-lime);height:100%}
.ctx{color:var(--sf-info);font-size:13px}
.mutual-panel{max-width:78.125rem;margin:3rem auto 0;background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:12px;padding:1.625rem}
.mutual-panel h3{font-family:var(--sf-serif);font-weight:400;font-size:24px;margin:0 0 .375rem}
.mutual-panel ul{list-style:none;padding:0;font-size:13px}
.feed-actions{display:none}
@media(max-width:40rem){
  .feed-mode .possibility-card .join-button{display:none}
  .feed-mode .possibility-card .needs{display:none}
  .deck-controls .search-field{display:none}
  .feed-actions{display:flex;gap:.625rem;margin-top:.875rem}
  .feed-actions a{flex:1;min-height:2.75rem;display:inline-flex;align-items:center;justify-content:center;
    border-radius:99px;font-size:13px;font-weight:800;text-decoration:none}
  .feed-actions .feed-skip{color:var(--sf-muted);border:1px solid var(--sf-line)}
  .feed-actions .feed-yes{background:var(--sf-coral);color:var(--sf-ink-fixed)}
  .feed-actions .feed-yes:focus-visible,.feed-actions .feed-skip:focus-visible{outline:2px solid var(--sf-green-2);outline-offset:2px}
}
@media(max-width:45rem){.detail-panel{padding:1.625rem 1.125rem}}
`;

export function renderPossibilitiesPage(
  cards: PossibilityCard[], edges: TrustEdge[] = [], viewer?: string,
  opts: { status?: string; lang?: Lang; connections?: Record<string, CardConnections>; mine?: boolean } = {},
): string {
  const status = opts.status ?? '';
  const lang = opts.lang ?? 'en';
  const mine = !!opts.mine;
  const tt = (k: string) => t(lang, k);
  const filtered = status ? cards.filter((c) => c.status === status) : cards;
  const keep = `${viewer ? `actor=${encodeURIComponent(viewer)}` : ''}${mine ? `${viewer ? '&' : ''}for=${encodeURIComponent(viewer ?? '')}` : ''}`;
  const qp = (extra: string) => `?${[extra, keep].filter(Boolean).join('&')}`;
  const grid = filtered.map((c, idx) => deckCard({
    id: c.id, title: c.title, place: c.place,
    status: c.status, participants: c.participantCount,
    min: c.minParticipants || 0, deadline: c.deadline,
    needs: c.needs.filter((n) => !n.met).slice(0, 3).map((n) => n.label),
  }, { base: '', tt, feed: { nextId: filtered[idx + 1]?.id } })).join('\n');
  const overlays = cards.map((c) => cardDetail(c, opts.connections?.[c.id], lang)).join('\n');
  const mutual = edges.filter((e) => e.mutual > 0).slice(0, 10)
    .map((e) => `<li>${displayName(e.from)} &harr; ${displayName(e.to)} — ${e.mutual} × ${esc(t(lang, 'deck.mutual.times'))}</li>`).join('');

  const body = `
<section class="section" id="deck" style="padding-top:60px">
  <div class="section-heading">
    <div><span class="kicker">${esc(tt('deck.kicker'))}</span>
      <h1>${esc(tt('deck.h1'))} <em>${esc(tt('deck.h1.em'))}</em></h1></div>
    <p>${esc(tt('deck.lede'))}
    ${viewer ? `<br><em>${esc(tt('deck.sortingFor'))} ${esc(viewer)}</em>` : ''}
    ${mine && viewer ? `<br><strong>${esc(tt('deck.mine.banner'))}</strong> ${esc(tt('deck.mine.body'))}` : ''}</p>
  </div>
  <div class="deck-controls">
    <nav class="filters" aria-label="${esc(tt('a11y.deckFilter'))}">
      ${STATUS_FILTERS.map(([v, l]) =>
        `<a href="/possibilities${v ? qp(`status=${v}`) : (keep ? `?${keep}` : '')}" class="${status === v ? 'active' : ''}"
          ${status === v ? 'aria-current="true"' : ''}>${esc(tt(l))}</a>`).join('')}
      ${viewer ? `<a href="/possibilities?actor=${encodeURIComponent(viewer)}${mine ? '' : `&for=${encodeURIComponent(viewer)}`}"
        class="${mine ? 'active' : ''}" ${mine ? 'aria-current="true"' : ''}>${esc(tt(mine ? 'deck.mine.all' : 'deck.mine.show'))}</a>` : ''}
    </nav>
    <label class="search-field">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="deck-search" type="search" placeholder="${esc(tt('deck.search'))}" aria-label="${esc(tt('a11y.deckSearch'))}">
    </label>
  </div>
  <div class="card-grid feed-mode" id="card-grid">
    ${grid || `<div class="empty-state">${esc(tt('deck.empty'))} <a href="#declare">${esc(tt('deck.empty.cta'))}</a>.</div>`}
  </div>
  ${mutual ? `<div class="mutual-panel"><h3>${esc(t(lang, 'deck.mutual'))}</h3>
    <p class="muted">${esc(t(lang, 'deck.mutual.body'))}</p>
    <ul>${mutual}</ul></div>` : ''}
  <p class="muted" style="max-width:78.125rem;margin:2rem auto 0">
    <a href="/collaborate">${esc(t(lang, 'nav.collaborate'))}</a> ·
    <a href="/fund">${esc(t(lang, 'nav.fund'))}</a> ·
    <a href="/impact">${esc(t(lang, 'nav.impact'))}</a><br>
    <span title="${esc(t(lang, 'deck.ordering.body'))}">${esc(t(lang, 'deck.ordering'))}</span><br>
    ${esc(t(lang, 'deck.telegram.pre'))} <a href="https://t.me/springforth_bot" rel="noopener">@springforth_bot</a> ${esc(t(lang, 'deck.telegram'))}</p>
  <details class="how-note" style="max-width:78.125rem;margin:0 auto"><summary>${esc(tt('detail.data'))}</summary>
  <div class="hn-body"><a href="/possibilities?format=json">JSON</a></div></details>
</section>

${overlays}

<div class="modal-anchor" id="declare">
  <div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="declare-h">
      <a class="modal-close" href="#deck" aria-label="${esc(tt('a11y.close'))}">✕</a>
      <span class="kicker">${esc(tt('declare.kicker'))}</span>
      <h2 id="declare-h">${esc(tt('declare.h2'))}</h2>
      <p>${esc(tt('declare.lede'))}</p>
      <form method="post" action="/possibilities">
        <input type="text" name="website" tabindex="-1" autocomplete="off"
          style="position:absolute;left:-9999px" aria-hidden="true">
        <label>${esc(tt('declare.possibility'))}
          <textarea name="title" required placeholder="${esc(tt('declare.ph'))}"></textarea></label>
        <label>${esc(tt('declare.name'))}
          <input name="declarerId" required placeholder="${esc(tt('declare.namePh'))}"></label>
        <div class="modal-row">
          <label>${esc(tt('declare.where'))} <input name="place" placeholder="${esc(tt('declare.wherePh'))}"></label>
          <label>${esc(tt('declare.deadline'))} <input name="deadline" type="date"></label>
        </div>
        <div class="modal-row">
          <label>${esc(tt('declare.min'))}
            <input name="minParticipants" type="number" min="1" value="3"></label>
          <label>${esc(tt('declare.desc'))} <input name="description" placeholder="${esc(tt('declare.descPh'))}"></label>
        </div>
        <button class="modal-submit" type="submit">${esc(tt('declare.submit'))}</button>
      </form>
    </div>
  </div>
</div>

<script>
document.getElementById('deck-search')?.addEventListener('input', (e) => {
  const q = (e.target.value || '').toLowerCase();
  document.querySelectorAll('#card-grid .possibility-card').forEach((el) => {
    el.style.display = !q || (el.dataset.search || '').includes(q) ? '' : 'none';
  });
});
const openOverlay = () => document.querySelector('.card-overlay:target');
const closeOverlay = () => { if (openOverlay()) location.hash = 'deck'; };
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
document.addEventListener('click', (e) => { const ov = openOverlay(); if (ov && e.target === ov) closeOverlay(); });
const focusPanel = () => openOverlay()?.querySelector('.detail-panel')?.focus();
addEventListener('hashchange', focusPanel);
if (openOverlay()) focusPanel();
</script>`;

  return pageShell({
    title: `${tt('deck.pageTitle')} — Springforth`,
    desc: tt('deck.desc'),
    lang, extraCss: DECK_CSS,
  }, body);
}
